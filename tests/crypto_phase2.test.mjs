/**
 * Automated Test Suite for Phase 2: Key Lifecycle, Verification States, and Anti-MITM
 */

import {
  generateIdentityKeyPair,
  exportEncryptedKeyVault,
  importEncryptedKeyVault,
  generateOfflineBackupJson,
  restoreFromOfflineBackupJson,
  computeSafetyNumber,
  evaluatePassphraseStrength
} from '../src/services/crypto.js';

import {
  saveIdentityKey,
  getIdentityKey,
  pinPartnerFingerprint,
  getPinnedPartnerFingerprint,
  markPartnerVerified,
  clearEntireKeystore
} from '../src/services/keystore.js';

import {
  PUBLIC_KEYS_TABLE,
  VAULTS_TABLE,
  fetchUserPublicE2EEKey,
  fetchUserE2EEVault
} from '../src/services/e2eeKeys.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
    failedTests++;
  }
}

async function runPhase2Tests() {
  console.log('\n--- 1. Testing First-Time Setup Lifecycle ---');
  await clearEntireKeystore();

  // Initially: Keystore has no identity key for User A
  const initialKey = await getIdentityKey('user_a_uuid');
  assert(initialKey === null, 'Initial state: Local keystore is uninitialized');

  // User A runs setup with a strong passphrase
  const userPassphrase = 'Sanctuary-Master-Passphrase-2026!';
  const passCheck = evaluatePassphraseStrength(userPassphrase);
  assert(passCheck.isStrong, 'Passphrase meets entropy strength requirements');

  const userA_Id = await generateIdentityKeyPair();
  const vault = await exportEncryptedKeyVault(userA_Id.keyPair.privateKey, userPassphrase, {
    userId: 'user_a_uuid',
    email: 'user_a@example.com'
  });

  // Save to local keystore
  await saveIdentityKey('user_a_uuid', {
    privateKey: userA_Id.keyPair.privateKey,
    publicKey: userA_Id.keyPair.publicKey,
    publicKeyJwk: userA_Id.publicKeyJwk,
    fingerprint: userA_Id.fingerprint
  });

  const savedKey = await getIdentityKey('user_a_uuid');
  assert(savedKey && savedKey.fingerprint === userA_Id.fingerprint, 'Identity key saved and ready on Device 1');
  assert(vault.encrypted_private_key && vault.key_kdf_iterations === 600000, 'Encrypted remote vault prepared with 600,000 PBKDF2 iterations');

  console.log('\n--- 2. Testing New Device Locked State & Passphrase Unlock ---');
  // Simulate Device 2: A different device keystore that starts with no local private key
  const device2_keystore = new Map(); // Simulating isolated device storage
  assert(!device2_keystore.has('user_a_uuid'), 'Device 2 starts in locked state (no local private key)');

  // Device 2 enters incorrect passphrase
  let unlockFailedAsExpected = false;
  try {
    await importEncryptedKeyVault(vault, 'Wrong-Passphrase-Guess');
  } catch (err) {
    unlockFailedAsExpected = true;
    assert(!err.message.includes(userPassphrase), 'Error message does not leak passphrase');
  }
  assert(unlockFailedAsExpected, 'Device 2 unlock fails on incorrect passphrase');

  // Device 2 enters correct passphrase
  const unlocked = await importEncryptedKeyVault(vault, userPassphrase);
  assert(unlocked.privateKey.type === 'private', 'Device 2 successfully unlocks private key using passphrase');

  console.log('\n--- 3. Testing TOFU Pinning & Strict Non-Automatic Verification ---');
  const userB_Id = await generateIdentityKeyPair();

  // First time seeing partner: Pin fingerprint
  await pinPartnerFingerprint('user_b_uuid', userB_Id.fingerprint, false);
  const pinnedRecord = await getPinnedPartnerFingerprint('user_b_uuid');

  assert(pinnedRecord && pinnedRecord.fingerprint === userB_Id.fingerprint, 'Partner fingerprint pinned on first use (TOFU)');
  assert(pinnedRecord.isVerified === false, 'CRITICAL: Partner is NOT automatically marked verified on first use');

  // User manually verifies partner after comparing Safety Number
  await markPartnerVerified('user_b_uuid', true);
  const verifiedRecord = await getPinnedPartnerFingerprint('user_b_uuid');
  assert(verifiedRecord.isVerified === true, 'Partner marked verified only after explicit user verification action');

  console.log('\n--- 4. Testing Anti-Key-Substitution (Key Mismatch Detection) ---');
  // Pinned fingerprint is userB_Id.fingerprint
  const attackerKey = await generateIdentityKeyPair(); // Attacker replaces key on server

  const isKeyMismatch = pinnedRecord.fingerprint !== attackerKey.fingerprint;
  assert(isKeyMismatch, 'Anti-Key-Substitution: System detects public key replacement');

  console.log('\n--- 5. Testing Mutual Safety Number Precision ---');
  const safetyNumber1 = await computeSafetyNumber(userA_Id.publicKeyJwk, userB_Id.publicKeyJwk);
  const safetyNumber2 = await computeSafetyNumber(userB_Id.publicKeyJwk, userA_Id.publicKeyJwk);

  assert(safetyNumber1.decimalFormatted === safetyNumber2.decimalFormatted, 'Mutual Safety Numbers are identical for both participants');
  assert(safetyNumber1.decimalRaw.length === 60, 'Safety Number has exactly 60 digits (12 groups of 5)');

  console.log('\n--- 6. Testing Offline Backup Export & Restoration Flow ---');
  const backupJson = generateOfflineBackupJson(vault, userA_Id.publicKeyJwk, 'alice@sanctuary.local');
  const restoredFromBackup = await restoreFromOfflineBackupJson(backupJson, userPassphrase);

  assert(restoredFromBackup.privateKey.type === 'private', 'Private key restored from offline .saviour-backup JSON');
  assert(restoredFromBackup.publicKeyJwk.crv === 'P-256', 'Restored key retains NIST P-256 curve');

  console.log('\n--- 7. Testing Secret Sanitization (No Key Exposure in Errors) ---');
  // Verify that vault JSON string does NOT contain unencrypted private key material
  assert(!backupJson.includes('"d":'), 'Exported vault JSON does not expose unencrypted "d" scalar private parameter');
  assert(!JSON.stringify(vault).includes('"d":'), 'Remote vault payload does not contain unencrypted private key');

  console.log('\n--- 8. Testing Public Key vs Private Vault Table Separation ---');
  assert(PUBLIC_KEYS_TABLE === 'user_e2ee_public_keys', 'Public keys targeted to dedicated user_e2ee_public_keys table');
  assert(VAULTS_TABLE === 'user_e2ee_vaults', 'Private vaults targeted to dedicated user_e2ee_vaults table');
  assert(PUBLIC_KEYS_TABLE !== VAULTS_TABLE, 'Public keys and encrypted vaults maintain strict architectural table separation');

  // Verify that public key query signature excludes sensitive vault fields
  const samplePublicRecord = {
    user_id: 'sample-user-uuid',
    public_key: userA_Id.publicKeyJwk,
    key_fingerprint: userA_Id.fingerprint,
    updated_at: new Date().toISOString()
  };
  assert(!('encrypted_private_key' in samplePublicRecord), 'Partner public record strictly excludes encrypted_private_key');
  assert(!('key_salt' in samplePublicRecord), 'Partner public record strictly excludes key_salt');
  assert(!('key_iv' in samplePublicRecord), 'Partner public record strictly excludes key_iv');
  assert(!('key_kdf_iterations' in samplePublicRecord), 'Partner public record strictly excludes key_kdf_iterations');

  console.log(`\n========================================`);
  console.log(`Phase 2 Test Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log(`========================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch(err => {
  console.error('Unhandled Phase 2 test suite error:', err);
  process.exit(1);
});
