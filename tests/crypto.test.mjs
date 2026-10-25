/**
 * Automated Test Suite for Phase 1 Cryptographic Core & Keystore
 */

import {
  generateIdentityKeyPair,
  exportPublicKeyToJwk,
  importPublicKeyFromJwk,
  computeKeyFingerprint,
  computeSafetyNumber,
  deriveConversationKey,
  encryptMessage,
  decryptMessage,
  isEncryptedMessage,
  encryptBinary,
  decryptBinary,
  exportEncryptedKeyVault,
  importEncryptedKeyVault,
  generateOfflineBackupJson,
  restoreFromOfflineBackupJson,
  evaluatePassphraseStrength
} from '../src/services/crypto.js';

import {
  saveIdentityKey,
  getIdentityKey,
  deleteIdentityKey,
  saveConversationKey,
  getConversationKey,
  pinPartnerFingerprint,
  getPinnedPartnerFingerprint,
  markPartnerVerified,
  clearEntireKeystore
} from '../src/services/keystore.js';

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

async function runTests() {
  console.log('\n--- 1. Testing Identity Key Generation & Export/Import ---');
  const aliceId = await generateIdentityKeyPair();
  const bobId = await generateIdentityKeyPair();

  assert(aliceId.keyPair.privateKey && aliceId.keyPair.publicKey, 'Alice ECDH keypair generated');
  assert(bobId.keyPair.privateKey && bobId.keyPair.publicKey, 'Bob ECDH keypair generated');
  assert(aliceId.publicKeyJwk.crv === 'P-256', 'Alice public key is NIST P-256');
  assert(aliceId.fingerprint.length === 64, 'Alice fingerprint is 64 hex characters (SHA-256)');

  const reimportedAlicePub = await importPublicKeyFromJwk(aliceId.publicKeyJwk);
  assert(reimportedAlicePub.type === 'public', 'Public key re-imported successfully from JWK');

  console.log('\n--- 2. Testing Mutual Safety Number Derivation ---');
  // Test symmetry: Alice calculating for (Alice, Bob) vs Bob calculating for (Bob, Alice)
  const safetyAlice = await computeSafetyNumber(aliceId.publicKeyJwk, bobId.publicKeyJwk);
  const safetyBob = await computeSafetyNumber(bobId.publicKeyJwk, aliceId.publicKeyJwk);

  assert(safetyAlice.decimalFormatted === safetyBob.decimalFormatted, 'Safety numbers match symmetrically (decimal 60-digits)');
  assert(safetyAlice.hexFormatted === safetyBob.hexFormatted, 'Safety numbers match symmetrically (hex)');
  assert(safetyAlice.decimalRaw.length === 60, 'Decimal Safety Number is exactly 60 digits (12x5 blocks)');
  console.log(`     Sample Safety Number: ${safetyAlice.decimalFormatted.substring(0, 35)}...`);

  console.log('\n--- 3. Testing ECDH + HKDF Key Agreement Consistency ---');
  const chatId = '00000000-0000-0000-0000-000000000001';
  
  // Alice derives with her private key + Bob's public key
  const aliceCek = await deriveConversationKey({
    myPrivateKey: aliceId.keyPair.privateKey,
    partnerPublicKey: bobId.keyPair.publicKey,
    chatId,
    epoch: 'epoch_1'
  });

  // Bob derives with his private key + Alice's public key
  const bobCek = await deriveConversationKey({
    myPrivateKey: bobId.keyPair.privateKey,
    partnerPublicKey: aliceId.keyPair.publicKey,
    chatId,
    epoch: 'epoch_1'
  });

  const rawAliceCek = await globalThis.crypto.subtle.exportKey('raw', aliceCek);
  const rawBobCek = await globalThis.crypto.subtle.exportKey('raw', bobCek);
  const aHex = Buffer.from(rawAliceCek).toString('hex');
  const bHex = Buffer.from(rawBobCek).toString('hex');

  assert(aHex === bHex, 'Alice and Bob independently derive identical AES-256-GCM CEK');

  console.log('\n--- 4. Testing Message Encryption & Decryption Round-Trip ---');
  const originalMessage = {
    text: 'Meet me at the sanctuary garden at midnight 🌙',
    reply_to: { sender_name: 'Bob', content: 'Where should we meet?' },
    caption: null
  };

  const encryptedArmored = await encryptMessage(originalMessage, aliceCek, 'epoch_1');
  assert(isEncryptedMessage(encryptedArmored), 'Message starts with enc:v1 envelope prefix');
  assert(!encryptedArmored.includes('sanctuary garden'), 'Ciphertext does not leak plaintext text');

  const decryptedResult = await decryptMessage(encryptedArmored, bobCek);
  assert(decryptedResult.isEncrypted === true, 'Decrypted indicates isEncrypted true');
  assert(decryptedResult.payload.text === originalMessage.text, 'Decrypted text matches original text');
  assert(decryptedResult.payload.reply_to.content === originalMessage.reply_to.content, 'Decrypted reply snippet matches');

  console.log('\n--- 5. Testing Ciphertext Tamper Resistance ---');
  const tamperedCipher = encryptedArmored.slice(0, -4) + 'AAAA';
  let tamperCaught = false;
  try {
    await decryptMessage(tamperedCipher, bobCek);
  } catch (err) {
    tamperCaught = true;
  }
  assert(tamperCaught, 'Tampered ciphertext rejected with authentication failure (AES-GCM tag mismatch)');

  console.log('\n--- 6. Testing Binary / Image Encryption & Decryption ---');
  // Create a 10KB dummy image binary buffer
  const fakeImageBytes = new Uint8Array(10240);
  for (let i = 0; i < fakeImageBytes.length; i++) {
    fakeImageBytes[i] = (i * 7 + 13) % 256;
  }

  const encryptedImage = await encryptBinary(fakeImageBytes, aliceCek);
  assert(encryptedImage.byteLength === 12 + fakeImageBytes.byteLength + 16, 'Encrypted binary has 12-byte IV + payload + 16-byte tag');
  
  const decryptedImageBuffer = await decryptBinary(encryptedImage, bobCek);
  const decryptedImageBytes = new Uint8Array(decryptedImageBuffer);
  
  let binaryMatch = decryptedImageBytes.byteLength === fakeImageBytes.byteLength;
  for (let i = 0; i < fakeImageBytes.length; i++) {
    if (decryptedImageBytes[i] !== fakeImageBytes[i]) {
      binaryMatch = false;
      break;
    }
  }
  assert(binaryMatch, 'Decrypted binary image bytes match original bytes 100%');

  console.log('\n--- 7. Testing Passphrase Strength Evaluator ---');
  assert(!evaluatePassphraseStrength('12345').isStrong, 'Weak PIN detected as not strong');
  assert(!evaluatePassphraseStrength('password').isStrong, 'Common password detected as not strong');
  assert(evaluatePassphraseStrength('Correct-Horse-Battery-Staple-2026!').isStrong, 'Strong multi-word passphrase validated');

  console.log('\n--- 8. Testing PBKDF2 (600k) Passphrase Vault Backup & Recovery ---');
  const testPassphrase = 'Sanctuary-Secret-Passphrase-2026!';
  const vault = await exportEncryptedKeyVault(aliceId.keyPair.privateKey, testPassphrase, { test: true });

  assert(vault.encrypted_private_key && vault.key_salt && vault.key_iv, 'Encrypted vault bundle fields present');
  assert(vault.key_kdf_iterations === 600000, 'KDF iterations set to 600,000');

  // Successful restoration
  const restored = await importEncryptedKeyVault(vault, testPassphrase);
  assert(restored.privateKey.type === 'private', 'Private key restored from vault successfully');

  // Verify restored private key works for ECDH derivation
  const restoredCek = await deriveConversationKey({
    myPrivateKey: restored.privateKey,
    partnerPublicKey: bobId.keyPair.publicKey,
    chatId,
    epoch: 'epoch_1'
  });
  const rawRestoredCek = await globalThis.crypto.subtle.exportKey('raw', restoredCek);
  assert(Buffer.from(rawRestoredCek).equals(Buffer.from(rawAliceCek)), 'Restored private key derives identical CEK');

  // Incorrect passphrase rejection
  let wrongPassCaught = false;
  try {
    await importEncryptedKeyVault(vault, 'Wrong-Passphrase-Attempt!');
  } catch (e) {
    wrongPassCaught = true;
  }
  assert(wrongPassCaught, 'Incorrect passphrase correctly throws authentication error');

  console.log('\n--- 9. Testing Offline Backup JSON (.saviour-backup) ---');
  const offlineJson = generateOfflineBackupJson(vault, aliceId.publicKeyJwk, 'alice@example.com');
  const parsedJson = JSON.parse(offlineJson);
  assert(parsedJson.app === 'The Saviour', 'Offline backup contains app header');
  assert(parsedJson.format === 'sanctuary-key-vault-v1', 'Offline backup format matches specification');

  const restoredFromOffline = await restoreFromOfflineBackupJson(offlineJson, testPassphrase);
  assert(restoredFromOffline.privateKey.type === 'private', 'Private key restored from offline JSON backup');

  console.log('\n--- 10. Testing Local Keystore (Storage & TOFU Pinning) ---');
  await clearEntireKeystore();
  
  // Test saving and retrieving identity key
  await saveIdentityKey('user_alice_uuid', {
    privateKey: aliceId.keyPair.privateKey,
    publicKey: aliceId.keyPair.publicKey,
    publicKeyJwk: aliceId.publicKeyJwk,
    fingerprint: aliceId.fingerprint
  });

  const retrievedId = await getIdentityKey('user_alice_uuid');
  assert(retrievedId && retrievedId.fingerprint === aliceId.fingerprint, 'Identity key retrieved from local keystore');

  // Test conversation key storage
  await saveConversationKey(chatId, 'epoch_1', aliceCek);
  const retrievedCek = await getConversationKey(chatId, 'epoch_1');
  assert(retrievedCek && retrievedCek.type === 'secret', 'Conversation key retrieved by epoch');

  // Test TOFU Fingerprint Pinning
  await pinPartnerFingerprint('user_bob_uuid', bobId.fingerprint, false);
  const pinnedBob = await getPinnedPartnerFingerprint('user_bob_uuid');
  assert(pinnedBob && pinnedBob.fingerprint === bobId.fingerprint, 'Partner fingerprint pinned in keystore');
  assert(pinnedBob.isVerified === false, 'Partner starts as unverified');

  await markPartnerVerified('user_bob_uuid', true);
  const verifiedBob = await getPinnedPartnerFingerprint('user_bob_uuid');
  assert(verifiedBob.isVerified === true, 'Partner marked as verified after out-of-band verification');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log(`========================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
