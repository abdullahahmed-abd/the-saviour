import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import {
  generateIdentityKeyPair,
  importPublicKeyFromJwk,
  computeSafetyNumber,
  deriveConversationKey,
  exportEncryptedKeyVault,
  importEncryptedKeyVault,
  generateOfflineBackupJson,
  restoreFromOfflineBackupJson,
  evaluatePassphraseStrength
} from '../services/crypto';
import {
  saveIdentityKey,
  getIdentityKey,
  saveConversationKey,
  getConversationKey,
  pinPartnerFingerprint,
  getPinnedPartnerFingerprint,
  markPartnerVerified,
  clearEntireKeystore
} from '../services/keystore';
import {
  PUBLIC_KEYS_TABLE,
  fetchUserPublicE2EEKey,
  fetchUserE2EEVault,
  publishUserE2EEKey
} from '../services/e2eeKeys';

const CryptoContext = createContext(null);

export function CryptoProvider({ children }) {
  const { user, isAuthorized, partnerProfile, sanctuaryChat } = useAuth();

  const [cryptoState, setCryptoState] = useState('loading'); // 'loading' | 'uninitialized' | 'locked' | 'missing_local_key' | 'ready' | 'waiting_for_partner' | 'key_mismatch' | 'error'
  const [identityKey, setIdentityKey] = useState(null); // { privateKey, publicKey, publicKeyJwk, fingerprint }
  const [partnerKey, setPartnerKey] = useState(null); // { publicKey, publicKeyJwk, fingerprint }
  const [conversationKey, setConversationKey] = useState(null);
  const [safetyNumber, setSafetyNumber] = useState(null);
  const [isPartnerVerified, setIsPartnerVerified] = useState(false);
  const [keyMismatchDetails, setKeyMismatchDetails] = useState(null);

  // Modals & User interaction states
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [passphraseError, setPassphraseError] = useState(null);
  const [remoteVaultData, setRemoteVaultData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isInitializingRef = useRef(false);
  const identityKeyRef = useRef(null);

  useEffect(() => {
    identityKeyRef.current = identityKey;
  }, [identityKey]);

  const chatId = sanctuaryChat?.id || '00000000-0000-0000-0000-000000000001';
  const partnerId = partnerProfile?.id;

  // ---------------------------------------------------------------------------
  // 1. Resolve Partner Public Key, TOFU Pinning & Conversation Key Derivation
  // ---------------------------------------------------------------------------
  const resolvePartnerAndDerive = useCallback(async (myIdentity, targetPartnerId, currentChatId) => {
    if (!myIdentity || !myIdentity.privateKey) {
      setCryptoState('waiting_for_partner');
      return;
    }

    let resolvedPartnerId = targetPartnerId;

    try {
      // If targetPartnerId is not known yet (e.g. chat_members not loaded), query public keys table
      if (!resolvedPartnerId && user) {
        const { data: partnerKeyRow } = await supabase
          .from(PUBLIC_KEYS_TABLE)
          .select('user_id, public_key, key_fingerprint')
          .neq('user_id', user.id)
          .maybeSingle();

        if (partnerKeyRow && partnerKeyRow.user_id) {
          resolvedPartnerId = partnerKeyRow.user_id;
        }
      }

      if (!resolvedPartnerId) {
        setPartnerKey(null);
        setCryptoState('waiting_for_partner');
        return;
      }

      // Fetch partner's public key from Supabase (strictly public fields only)
      const remotePartnerRecord = await fetchUserPublicE2EEKey(resolvedPartnerId);

      if (!remotePartnerRecord || !remotePartnerRecord.public_key) {
        // Partner has not established their public key yet
        setPartnerKey(null);
        setCryptoState('waiting_for_partner');
        return;
      }

      const partnerJwk = remotePartnerRecord.public_key;
      const partnerFingerprint = remotePartnerRecord.key_fingerprint;
      const importedPartnerPub = await importPublicKeyFromJwk(partnerJwk);

      const resolvedPartner = {
        publicKey: importedPartnerPub,
        publicKeyJwk: partnerJwk,
        fingerprint: partnerFingerprint
      };
      setPartnerKey(resolvedPartner);

      // Check pinned partner fingerprint in local IndexedDB
      const pinned = await getPinnedPartnerFingerprint(resolvedPartnerId);

      if (pinned) {
        // Fingerprint was previously pinned: Verify anti-substitution guard
        if (pinned.fingerprint !== partnerFingerprint) {
          // CRITICAL SECURITY EVENT: Partner's public key changed!
          console.warn('⚠️ SECURITY WARNING: Partner identity key mismatch detected!');
          setKeyMismatchDetails({
            pinnedFingerprint: pinned.fingerprint,
            currentFingerprint: partnerFingerprint
          });
          setCryptoState('key_mismatch');
          setIsPartnerVerified(false);
          return;
        }

        // Fingerprint matches pinned record
        setIsPartnerVerified(Boolean(pinned.isVerified));
      } else {
        // First time seeing partner: Pin fingerprint with isVerified = false (TOFU)
        await pinPartnerFingerprint(resolvedPartnerId, partnerFingerprint, false);
        setIsPartnerVerified(false);
      }

      // Compute deterministic mutual Safety Number
      const sNumber = await computeSafetyNumber(myIdentity.publicKeyJwk, partnerJwk);
      setSafetyNumber(sNumber);

      // Derive Conversation Encryption Key (CEK)
      let cek = await getConversationKey(currentChatId, 'epoch_1');
      if (!cek) {
        cek = await deriveConversationKey({
          myPrivateKey: myIdentity.privateKey,
          partnerPublicKey: importedPartnerPub,
          chatId: currentChatId,
          epoch: 'epoch_1'
        });
        await saveConversationKey(currentChatId, 'epoch_1', cek);
      }

      setConversationKey(cek);
      setCryptoState('ready');
    } catch (err) {
      console.warn('Failed to resolve partner key or derive CEK:', err.message);
      setCryptoState('waiting_for_partner');
    }
  }, [user]);

  // ---------------------------------------------------------------------------
  // 2. Initialize Cryptographic State (Automatic, Frictionless Key Lifecycle)
  // ---------------------------------------------------------------------------
  const initCrypto = useCallback(async () => {
    if (!user || !isAuthorized) {
      setCryptoState('idle');
      setIdentityKey(null);
      setPartnerKey(null);
      setConversationKey(null);
      setSafetyNumber(null);
      return;
    }

    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    setCryptoState('loading');
    setPassphraseError(null);

    try {
      // 1. Check local IndexedDB keystore for current user's identity key
      let localIdKey = await getIdentityKey(user.id);

      if (localIdKey && localIdKey.privateKey && localIdKey.publicKey) {
        // Local identity key is already present and valid on this device
        setIdentityKey(localIdKey);
        identityKeyRef.current = localIdKey;

        // Ensure public key is published remotely if not yet synced
        try {
          const remotePub = await fetchUserPublicE2EEKey(user.id);
          if (!remotePub || remotePub.key_fingerprint !== localIdKey.fingerprint) {
            await publishUserE2EEKey({
              userId: user.id,
              publicKeyJwk: localIdKey.publicKeyJwk,
              fingerprint: localIdKey.fingerprint
            });
          }
        } catch (syncErr) {
          console.warn('Non-fatal background public key sync notice:', syncErr.message);
        }

        await resolvePartnerAndDerive(localIdKey, partnerId, chatId);
        return;
      }

      // 2. Local key not found in IndexedDB: Check if user already has a public key or vault in Supabase
      const [remotePub, remoteVault] = await Promise.all([
        fetchUserPublicE2EEKey(user.id),
        fetchUserE2EEVault(user.id)
      ]);

      if (remoteVault && remoteVault.encrypted_private_key) {
        // Vault exists remotely -> Device is locked; requires passphrase unlock to restore
        setRemoteVaultData(remoteVault);
        setCryptoState('locked');
        return;
      }

      if (remotePub && remotePub.public_key) {
        // User already has an established public identity key in Supabase,
        // but the private key is missing on this browser/device and no remote vault exists.
        // DO NOT silently regenerate a key without user awareness, as this would make historical messages unreadable.
        console.warn('Identity key exists remotely but private key is missing on this device.');
        setCryptoState('missing_local_key');
        return;
      }

      // 3. Brand new user: Neither local key nor remote public key exists!
      // AUTOMATIC KEY LIFECYCLE: Automatically generate identity key pair on device
      const { keyPair, publicKeyJwk, fingerprint } = await generateIdentityKeyPair();

      const identityRecord = {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        publicKeyJwk,
        fingerprint
      };

      // Save to local IndexedDB (never leaves device unencrypted)
      await saveIdentityKey(user.id, identityRecord);
      setIdentityKey(identityRecord);
      identityKeyRef.current = identityRecord;

      // Publish public key to Supabase (public fields only)
      await publishUserE2EEKey({
        userId: user.id,
        publicKeyJwk,
        fingerprint
      });

      // Complete derivation with partner if partner's key is available
      await resolvePartnerAndDerive(identityRecord, partnerId, chatId);
    } catch (err) {
      console.warn('Crypto initialization error:', err.message);
      setCryptoState('error');
    } finally {
      isInitializingRef.current = false;
    }
  }, [user, isAuthorized, partnerId, chatId, resolvePartnerAndDerive]);

  useEffect(() => {
    initCrypto();
  }, [initCrypto]);

  // ---------------------------------------------------------------------------
  // 3. Realtime Listener on Public Keys (Instant Partner Discovery & Anti-MITM)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user || !isAuthorized) return;

    const channel = supabase.channel(`e2ee_keys_realtime_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: PUBLIC_KEYS_TABLE },
        async (payload) => {
          const row = payload.new;
          if (!row || !row.user_id || row.user_id === user.id) return;
          // Partner's public key was created or updated in real-time
          const currentIdKey = identityKeyRef.current || (await getIdentityKey(user.id));
          if (currentIdKey) {
            await resolvePartnerAndDerive(currentIdKey, row.user_id, chatId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAuthorized, chatId, resolvePartnerAndDerive]);

  // ---------------------------------------------------------------------------
  // 4. Passphrase Setup for Encrypted Remote Backup Vault (Optional, from Settings)
  // ---------------------------------------------------------------------------
  const setupE2EE = async (passphrase) => {
    if (!user) throw new Error('User required');
    const strength = evaluatePassphraseStrength(passphrase);
    if (!strength.isStrong) {
      throw new Error('Please choose a stronger passphrase (min 10 characters with mixed complexity or 4+ words)');
    }

    setIsProcessing(true);
    setPassphraseError(null);

    try {
      // Use existing identity key if present, otherwise generate new
      let record = identityKeyRef.current || (await getIdentityKey(user.id));
      if (!record || !record.privateKey) {
        const { keyPair, publicKeyJwk, fingerprint } = await generateIdentityKeyPair();
        record = {
          privateKey: keyPair.privateKey,
          publicKey: keyPair.publicKey,
          publicKeyJwk,
          fingerprint
        };
        await saveIdentityKey(user.id, record);
        setIdentityKey(record);
        identityKeyRef.current = record;
      }

      // Encrypt private key vault with PBKDF2 (600,000 iterations)
      const vault = await exportEncryptedKeyVault(record.privateKey, passphrase, {
        userId: user.id,
        email: user.email
      });

      // Publish public key and encrypted vault to Supabase
      await publishUserE2EEKey({
        userId: user.id,
        publicKeyJwk: record.publicKeyJwk,
        encryptedVault: vault.encrypted_private_key,
        keySalt: vault.key_salt,
        keyIv: vault.key_iv,
        keyKdfIterations: vault.key_kdf_iterations,
        fingerprint: record.fingerprint
      });

      // Complete derivation
      await resolvePartnerAndDerive(record, partnerId, chatId);

      setSetupModalOpen(false);
      return { success: true, vault, publicKeyJwk: record.publicKeyJwk };
    } catch (err) {
      setPassphraseError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. Passphrase Unlock on New Device
  // ---------------------------------------------------------------------------
  const unlockE2EE = async (passphrase) => {
    if (!user) throw new Error('User required');
    if (!remoteVaultData) {
      throw new Error('No remote encrypted key vault found for this account.');
    }

    setIsProcessing(true);
    setPassphraseError(null);

    try {
      const restored = await importEncryptedKeyVault(
        {
          encrypted_private_key: remoteVaultData.encrypted_private_key,
          key_salt: remoteVaultData.key_salt,
          key_iv: remoteVaultData.key_iv,
          key_kdf_iterations: remoteVaultData.key_kdf_iterations || 600000
        },
        passphrase
      );

      // Fetch public key if not in vault data
      let pubJwk = remoteVaultData.public_key;
      let fingerprint = remoteVaultData.key_fingerprint;
      if (!pubJwk) {
        const pubRecord = await fetchUserPublicE2EEKey(user.id);
        pubJwk = pubRecord?.public_key;
        fingerprint = pubRecord?.key_fingerprint || '';
      }

      const pubKey = await importPublicKeyFromJwk(pubJwk);

      const identityRecord = {
        privateKey: restored.privateKey,
        publicKey: pubKey,
        publicKeyJwk: pubJwk,
        fingerprint
      };

      // Save unlocked key to local device IndexedDB
      await saveIdentityKey(user.id, identityRecord);
      setIdentityKey(identityRecord);
      identityKeyRef.current = identityRecord;

      // Complete derivation
      await resolvePartnerAndDerive(identityRecord, partnerId, chatId);

      setUnlockModalOpen(false);
      return { success: true };
    } catch (err) {
      const msg = err.message.includes('tag mismatch') || err.message.includes('Incorrect passphrase')
        ? 'Incorrect passphrase. Please verify your Sanctuary Passphrase.'
        : 'Failed to unlock key: ' + err.message;
      setPassphraseError(msg);
      throw new Error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. Restore from Offline Backup File (.saviour-backup)
  // ---------------------------------------------------------------------------
  const restoreFromOfflineFile = async (jsonString, passphrase) => {
    if (!user) throw new Error('User required');
    setIsProcessing(true);
    setPassphraseError(null);

    try {
      const restored = await restoreFromOfflineBackupJson(jsonString, passphrase);
      const pubKey = await importPublicKeyFromJwk(restored.publicKeyJwk);

      const identityRecord = {
        privateKey: restored.privateKey,
        publicKey: pubKey,
        publicKeyJwk: restored.publicKeyJwk,
        fingerprint: remoteVaultData?.key_fingerprint || ''
      };

      await saveIdentityKey(user.id, identityRecord);
      setIdentityKey(identityRecord);
      identityKeyRef.current = identityRecord;

      await resolvePartnerAndDerive(identityRecord, partnerId, chatId);
      setUnlockModalOpen(false);
      return { success: true };
    } catch (err) {
      const msg = 'Failed to restore backup file: ' + err.message;
      setPassphraseError(msg);
      throw new Error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. Explicit Reset / Regeneration When Local Key is Truly Missing
  // ---------------------------------------------------------------------------
  const resetIdentityKey = async () => {
    if (!user) throw new Error('User required');
    setIsProcessing(true);
    try {
      const { keyPair, publicKeyJwk, fingerprint } = await generateIdentityKeyPair();
      const identityRecord = {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        publicKeyJwk,
        fingerprint
      };
      await saveIdentityKey(user.id, identityRecord);
      setIdentityKey(identityRecord);
      identityKeyRef.current = identityRecord;

      await publishUserE2EEKey({
        userId: user.id,
        publicKeyJwk,
        fingerprint
      });

      await resolvePartnerAndDerive(identityRecord, partnerId, chatId);
      return { success: true };
    } catch (err) {
      console.error('Failed to reset identity key:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. Explicit Safety Number Verification (Strict Anti-MITM)
  // ---------------------------------------------------------------------------
  const verifyPartnerSafetyNumber = async () => {
    const targetId = partnerId || partnerKey?.user_id;
    if (!targetId) return;
    await markPartnerVerified(targetId, true);
    setIsPartnerVerified(true);
    setSafetyModalOpen(false);
  };

  const unverifyPartnerSafetyNumber = async () => {
    const targetId = partnerId || partnerKey?.user_id;
    if (!targetId) return;
    await markPartnerVerified(targetId, false);
    setIsPartnerVerified(false);
  };

  // ---------------------------------------------------------------------------
  // 9. Accept New Key After Partner Reinstallation / Genuine Rotation
  // ---------------------------------------------------------------------------
  const acceptNewPartnerKey = async () => {
    const targetId = partnerId || partnerKey?.user_id;
    if (!targetId || !partnerKey) return;
    // Re-pin new fingerprint with isVerified = false
    await pinPartnerFingerprint(targetId, partnerKey.fingerprint, false);
    setKeyMismatchDetails(null);
    setIsPartnerVerified(false);

    // Re-compute and derive
    if (identityKey) {
      await resolvePartnerAndDerive(identityKey, targetId, chatId);
    }
  };

  // ---------------------------------------------------------------------------
  // 10. Export Offline Backup File (.saviour-backup)
  // ---------------------------------------------------------------------------
  const downloadOfflineBackup = async (passphrase) => {
    if (!identityKey) throw new Error('Identity key not initialized');
    const vault = await exportEncryptedKeyVault(identityKey.privateKey, passphrase, {
      userId: user.id,
      email: user.email
    });

    const json = generateOfflineBackupJson(vault, identityKey.publicKeyJwk, user.email);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanctuary_e2ee_${user.email.split('@')[0]}.saviour-backup`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const value = {
    cryptoState,
    identityKey,
    partnerKey,
    conversationKey,
    safetyNumber,
    isPartnerVerified,
    keyMismatchDetails,
    setupModalOpen,
    unlockModalOpen,
    safetyModalOpen,
    passphraseError,
    isProcessing,
    setSetupModalOpen,
    setUnlockModalOpen,
    setSafetyModalOpen,
    setPassphraseError,
    setupE2EE,
    unlockE2EE,
    restoreFromOfflineFile,
    resetIdentityKey,
    verifyPartnerSafetyNumber,
    unverifyPartnerSafetyNumber,
    acceptNewPartnerKey,
    downloadOfflineBackup,
    refreshCrypto: initCrypto
  };

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>;
}

export function useCrypto() {
  const context = useContext(CryptoContext);
  if (!context) {
    throw new Error('useCrypto must be used within a CryptoProvider');
  }
  return context;
}
