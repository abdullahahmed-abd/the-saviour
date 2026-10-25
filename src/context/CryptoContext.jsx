import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
import { fetchUserPublicE2EEKey, fetchUserE2EEVault, publishUserE2EEKey } from '../services/e2eeKeys';

const CryptoContext = createContext(null);

export function CryptoProvider({ children }) {
  const { user, isAuthorized, partnerProfile, sanctuaryChat } = useAuth();

  const [cryptoState, setCryptoState] = useState('loading'); // 'loading' | 'uninitialized' | 'locked' | 'ready' | 'waiting_for_partner' | 'key_mismatch'
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

  const chatId = sanctuaryChat?.id || '00000000-0000-0000-0000-000000000001';
  const partnerId = partnerProfile?.id;

  // ---------------------------------------------------------------------------
  // 1. Initialize Cryptographic State for the Authenticated User
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

    setCryptoState('loading');
    setPassphraseError(null);

    try {
      // 1. Check local IndexedDB keystore for current user's identity key
      const localIdKey = await getIdentityKey(user.id);

      if (localIdKey && localIdKey.privateKey && localIdKey.publicKey) {
        // Local identity key is present on this device
        setIdentityKey(localIdKey);
        await resolvePartnerAndDerive(localIdKey, partnerId, chatId);
        return;
      }

      // 2. Local key not found: Check if user has an encrypted vault in Supabase
      const remoteRecord = await fetchUserE2EEVault(user.id);

      if (remoteRecord && remoteRecord.encrypted_private_key) {
        // Vault exists remotely -> Device is locked; requires passphrase unlock
        setRemoteVaultData(remoteRecord);
        setCryptoState('locked');
        setUnlockModalOpen(true);
      } else {
        // No local key and no remote vault -> First-time user needs to initialize E2EE
        setCryptoState('uninitialized');
        setSetupModalOpen(true);
      }
    } catch (err) {
      console.warn('Crypto initialization non-fatal error:', err.message);
      setCryptoState('uninitialized');
      setSetupModalOpen(true);
    }
  }, [user, isAuthorized, partnerId, chatId]);

  useEffect(() => {
    initCrypto();
  }, [initCrypto]);

  // ---------------------------------------------------------------------------
  // 2. Resolve Partner Public Key, TOFU Pinning & Conversation Key Derivation
  // ---------------------------------------------------------------------------
  const resolvePartnerAndDerive = async (myIdentity, targetPartnerId, currentChatId) => {
    if (!targetPartnerId) {
      setCryptoState('waiting_for_partner');
      return;
    }

    try {
      // Fetch partner's public key from Supabase (strictly public fields only)
      const remotePartnerRecord = await fetchUserPublicE2EEKey(targetPartnerId);

      if (!remotePartnerRecord || !remotePartnerRecord.public_key) {
        // Partner has not initialized their E2EE keys yet
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
      const pinned = await getPinnedPartnerFingerprint(targetPartnerId);

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

        // Fingerprint matches: Never mark as verified automatically.
        // TOFU pinning alone is NOT verification.
        setIsPartnerVerified(Boolean(pinned.isVerified));
      } else {
        // First time seeing partner: Pin fingerprint with isVerified = false (TOFU)
        await pinPartnerFingerprint(targetPartnerId, partnerFingerprint, false);
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
  };

  // ---------------------------------------------------------------------------
  // 3. First-Time E2EE Setup
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
      // 1. Generate local ECDH identity keypair
      const { keyPair, publicKeyJwk, fingerprint } = await generateIdentityKeyPair();

      // 2. Encrypt private key vault with PBKDF2 (600,000 iterations)
      const vault = await exportEncryptedKeyVault(keyPair.privateKey, passphrase, {
        userId: user.id,
        email: user.email
      });

      // 3. Save to local IndexedDB
      const identityRecord = {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        publicKeyJwk,
        fingerprint
      };
      await saveIdentityKey(user.id, identityRecord);
      setIdentityKey(identityRecord);

      // 4. Publish public key and encrypted vault to Supabase
      await publishUserE2EEKey({
        userId: user.id,
        publicKeyJwk,
        encryptedVault: vault.encrypted_private_key,
        keySalt: vault.key_salt,
        keyIv: vault.key_iv,
        keyKdfIterations: vault.key_kdf_iterations,
        fingerprint
      });

      // 5. Complete derivation if partner key available
      await resolvePartnerAndDerive(identityRecord, partnerId, chatId);

      setSetupModalOpen(false);
      return { success: true, vault, publicKeyJwk };
    } catch (err) {
      setPassphraseError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Passphrase Unlock on New Device
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

      const pubKey = await importPublicKeyFromJwk(remoteVaultData.public_key);

      const identityRecord = {
        privateKey: restored.privateKey,
        publicKey: pubKey,
        publicKeyJwk: remoteVaultData.public_key,
        fingerprint: remoteVaultData.key_fingerprint
      };

      // Save unlocked key to local device IndexedDB
      await saveIdentityKey(user.id, identityRecord);
      setIdentityKey(identityRecord);

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
  // 5. Restore from Offline Backup File (.saviour-backup)
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
  // 6. Explicit Safety Number Verification (Strict Anti-MITM)
  // ---------------------------------------------------------------------------
  const verifyPartnerSafetyNumber = async () => {
    if (!partnerId) return;
    await markPartnerVerified(partnerId, true);
    setIsPartnerVerified(true);
    setSafetyModalOpen(false);
  };

  const unverifyPartnerSafetyNumber = async () => {
    if (!partnerId) return;
    await markPartnerVerified(partnerId, false);
    setIsPartnerVerified(false);
  };

  // ---------------------------------------------------------------------------
  // 7. Accept New Key After Partner Reinstallation / Genuine Rotation
  // ---------------------------------------------------------------------------
  const acceptNewPartnerKey = async () => {
    if (!partnerId || !partnerKey) return;
    // Re-pin new fingerprint with isVerified = false
    await pinPartnerFingerprint(partnerId, partnerKey.fingerprint, false);
    setKeyMismatchDetails(null);
    setIsPartnerVerified(false);

    // Re-compute and derive
    if (identityKey) {
      await resolvePartnerAndDerive(identityKey, partnerId, chatId);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. Export Offline Backup File (.saviour-backup)
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
