/**
 * The Saviour — Remote E2EE Key Sync Service
 * 
 * Safely publishes and retrieves:
 * 1. Public keys (`user_e2ee_public_keys`): Accessible to authorized chat members.
 *    Used for ECDH key agreement and Safety Number calculation.
 * 2. Passphrase-encrypted private vaults (`user_e2ee_vaults`): Accessible ONLY to its owner (auth.uid() = user_id).
 *    Used exclusively for private key recovery on new devices.
 * 
 * Strict Principle of Least Privilege:
 * - A partner's query NEVER asks for or receives `encrypted_private_key`, `key_salt`, or `key_iv`.
 * - Unencrypted private keys NEVER leave the local client.
 */

import { supabase } from './supabase.js';

export const PUBLIC_KEYS_TABLE = 'user_e2ee_public_keys';
export const VAULTS_TABLE = 'user_e2ee_vaults';
const LEGACY_TABLE = 'user_e2ee_keys';

/**
 * Fetch ONLY the public key and fingerprint for a user ID (e.g. partner).
 * Strictly omits all private vault fields.
 */
export async function fetchUserPublicE2EEKey(userId) {
  if (!userId) return null;

  try {
    // 1. Try dedicated public keys table
    const { data, error } = await supabase
      .from(PUBLIC_KEYS_TABLE)
      .select('user_id, public_key, key_fingerprint, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      return data;
    }

    // 2. If table doesn't exist yet, try legacy single table (if present during transition)
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      const legacyRes = await supabase
        .from(LEGACY_TABLE)
        .select('user_id, public_key, key_fingerprint, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (!legacyRes.error && legacyRes.data) {
        return legacyRes.data;
      }
    }

    return null;
  } catch (err) {
    console.warn('E2EE public key retrieval network error:', err.message);
    return null;
  }
}

/**
 * Fetch remote encrypted private key vault for the authenticated owner on a new device.
 * Enforced by Supabase RLS: Only auth.uid() = userId can read this table.
 */
export async function fetchUserE2EEVault(userId) {
  if (!userId) return null;

  try {
    // 1. Try dedicated vaults table
    const { data, error } = await supabase
      .from(VAULTS_TABLE)
      .select('user_id, encrypted_private_key, key_salt, key_iv, key_kdf_iterations, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      return data;
    }

    // 2. If table doesn't exist yet, try legacy table fallback
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      const legacyRes = await supabase
        .from(LEGACY_TABLE)
        .select('user_id, encrypted_private_key, key_salt, key_iv, key_kdf_iterations, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (!legacyRes.error && legacyRes.data) {
        return legacyRes.data;
      }
    }

    return null;
  } catch (err) {
    console.warn('E2EE vault retrieval network error:', err.message);
    return null;
  }
}

/**
 * Publish or update local user's public key and encrypted vault in Supabase.
 * Separates data into user_e2ee_public_keys and user_e2ee_vaults.
 */
export async function publishUserE2EEKey({
  userId,
  publicKeyJwk,
  encryptedVault,
  keySalt,
  keyIv,
  keyKdfIterations = 600000,
  fingerprint
}) {
  if (!userId || !publicKeyJwk || !fingerprint) {
    throw new Error('userId, publicKeyJwk, and fingerprint are required');
  }

  const now = new Date().toISOString();

  // 1. Publish Public Key
  const publicKeyPayload = {
    user_id: userId,
    public_key: publicKeyJwk,
    key_fingerprint: fingerprint,
    updated_at: now
  };

  let pubResult = null;
  try {
    const { data, error } = await supabase
      .from(PUBLIC_KEYS_TABLE)
      .upsert(publicKeyPayload, { onConflict: 'user_id' })
      .select('user_id, key_fingerprint, updated_at')
      .single();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        // Fallback to legacy table if new table not migrated yet
        const legacyPayload = {
          ...publicKeyPayload,
          ...(encryptedVault ? {
            encrypted_private_key: encryptedVault,
            key_salt: keySalt,
            key_iv: keyIv,
            key_kdf_iterations: keyKdfIterations
          } : {})
        };
        const legRes = await supabase
          .from(LEGACY_TABLE)
          .upsert(legacyPayload, { onConflict: 'user_id' })
          .select('user_id, key_fingerprint, updated_at')
          .single();

        if (legRes.error && (legRes.error.code === '42P01' || legRes.error.message?.includes('does not exist'))) {
          return { offlineOnly: true };
        }
        pubResult = legRes.data;
      } else {
        throw error;
      }
    } else {
      pubResult = data;
    }
  } catch (err) {
    console.warn('Failed to publish public key (retained locally):', err.message);
    return { offlineOnly: true, error: err.message };
  }

  // 2. Publish Private Vault (if vault parameters provided)
  if (encryptedVault && keySalt && keyIv) {
    const vaultPayload = {
      user_id: userId,
      encrypted_private_key: encryptedVault,
      key_salt: keySalt,
      key_iv: keyIv,
      key_kdf_iterations: keyKdfIterations,
      updated_at: now
    };

    try {
      await supabase
        .from(VAULTS_TABLE)
        .upsert(vaultPayload, { onConflict: 'user_id' });
    } catch (err) {
      console.warn('Failed to publish encrypted vault (retained locally):', err.message);
    }
  }

  return pubResult || { offlineOnly: true };
}

/**
 * Backward-compatible helper for legacy callers.
 * If fetching partner, strictly delegates to fetchUserPublicE2EEKey.
 */
export async function fetchUserE2EEKey(userId, isSelf = false) {
  if (isSelf) {
    const [pub, vault] = await Promise.all([
      fetchUserPublicE2EEKey(userId),
      fetchUserE2EEVault(userId)
    ]);
    if (!pub && !vault) return null;
    return { ...(pub || {}), ...(vault || {}) };
  }
  return fetchUserPublicE2EEKey(userId);
}
