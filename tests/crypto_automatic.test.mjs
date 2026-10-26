/**
 * Automated Test Suite for Automatic E2EE Lifecycle and Frictionless Key Management
 */

import {
  generateIdentityKeyPair,
  exportPublicKeyToJwk,
  importPublicKeyFromJwk,
  computeSafetyNumber,
  deriveConversationKey,
  encryptMessage,
  decryptMessage,
  encryptBinary,
  decryptBinary,
  isEncryptedMessage
} from '../src/services/crypto.js';

import {
  saveIdentityKey,
  getIdentityKey,
  saveConversationKey,
  getConversationKey,
  pinPartnerFingerprint,
  getPinnedPartnerFingerprint,
  markPartnerVerified,
  clearEntireKeystore
} from '../src/services/keystore.js';

import { decryptMessageRecord } from '../src/services/messages.js';

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

async function runAutomaticE2EETests() {
  console.log('\n--- 1. Automatic Key Generation & Persistent Keystore ---');
  await clearEntireKeystore();

  // Simulating first-time login: no key exists initially
  const initialKey = await getIdentityKey('alice-user-id');
  assert(initialKey === null, 'First-time user starts with clean local keystore');

  // App automatically generates identity key without prompting for a passphrase
  const { keyPair, publicKeyJwk, fingerprint } = await generateIdentityKeyPair();
  assert(Boolean(keyPair.privateKey) && Boolean(keyPair.publicKey), 'Identity keypair automatically generated via Web Crypto API');
  assert(publicKeyJwk.crv === 'P-256' && publicKeyJwk.kty === 'EC', 'Generated public key is NIST P-256');
  assert(typeof fingerprint === 'string' && fingerprint.length === 64, 'Generated fingerprint is 64-char SHA-256 hex');

  // Save to IndexedDB keystore
  await saveIdentityKey('alice-user-id', {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyJwk,
    fingerprint
  });

  // Reload key (simulating app reload / return)
  const reloadedKey = await getIdentityKey('alice-user-id');
  assert(Boolean(reloadedKey), 'Identity key loaded successfully on return');
  assert(reloadedKey.fingerprint === fingerprint, 'Reloaded identity key has identical fingerprint (no regeneration)');

  console.log('\n--- 2. Public Key JWK Validation & Malformed Key Rejection ---');
  // Valid JWK imports cleanly
  const validPub = await importPublicKeyFromJwk(publicKeyJwk);
  assert(Boolean(validPub), 'Valid EC P-256 JWK imported successfully');

  // Malformed JWKs rejected safely
  let rejectedMalformed = false;
  try {
    await importPublicKeyFromJwk({ kty: 'RSA', n: 'abc', e: 'AQAB' });
  } catch (e) {
    rejectedMalformed = true;
    assert(e.message.includes('Expected EC P-256'), 'Non-EC JWK correctly rejected');
  }
  assert(rejectedMalformed, 'Malformed RSA key rejected');

  let rejectedNull = false;
  try {
    await importPublicKeyFromJwk(null);
  } catch (e) {
    rejectedNull = true;
    assert(e.message.includes('JWK object required'), 'Null JWK correctly rejected');
  }
  assert(rejectedNull, 'Null public key rejected');

  console.log('\n--- 3. Two-User Automatic Symmetrical Agreement ---');
  // Bob automatically initializes his keypair
  const bobId = await generateIdentityKeyPair();
  await saveIdentityKey('bob-user-id', {
    privateKey: bobId.keyPair.privateKey,
    publicKey: bobId.keyPair.publicKey,
    publicKeyJwk: bobId.publicKeyJwk,
    fingerprint: bobId.fingerprint
  });

  const chatId = 'sanctuary-chat-001';

  // Alice derives CEK using Alice private + Bob public
  const aliceCek = await deriveConversationKey({
    myPrivateKey: keyPair.privateKey,
    partnerPublicKey: bobId.keyPair.publicKey,
    chatId,
    epoch: 'epoch_1'
  });

  // Bob derives CEK using Bob private + Alice public
  const bobCek = await deriveConversationKey({
    myPrivateKey: bobId.keyPair.privateKey,
    partnerPublicKey: keyPair.publicKey,
    chatId,
    epoch: 'epoch_1'
  });

  assert(Boolean(aliceCek) && Boolean(bobCek), 'Both users derive conversation keys');

  // Safety number computation
  const sNumberAlice = await computeSafetyNumber(publicKeyJwk, bobId.publicKeyJwk);
  const sNumberBob = await computeSafetyNumber(bobId.publicKeyJwk, publicKeyJwk);
  assert(sNumberAlice.decimalFormatted === sNumberBob.decimalFormatted, 'Mutual Safety Number is identical regardless of query order');
  assert(sNumberAlice.decimalFormatted.length === 71, 'Safety Number contains 12 groups of 5 decimal digits (71 chars with spaces)');

  console.log('\n--- 4. End-to-End Encrypted Message Transmission ---');
  const sensitivePayload = {
    text: 'Meet me at the sanctuary garden at sunset',
    reply_to: { sender_name: 'Bob', content: 'Where should we meet?' }
  };

  // Alice encrypts
  const ciphertext = await encryptMessage(sensitivePayload, aliceCek, 'epoch_1');
  assert(isEncryptedMessage(ciphertext), 'Message has armored enc:v1 envelope format');
  assert(!ciphertext.includes('garden'), 'Ciphertext does not contain plaintext text');
  assert(!ciphertext.includes('sunset'), 'Ciphertext does not contain sensitive keywords');
  assert(!ciphertext.includes('Where should we meet'), 'Reply snippet is encrypted inside payload');

  // Bob decrypts
  const decryptedRecord = await decryptMessageRecord(
    {
      id: 'msg-001',
      chat_id: chatId,
      sender_id: 'alice-user-id',
      content: ciphertext,
      type: 'text',
      metadata: {},
      is_deleted: false,
      created_at: new Date().toISOString()
    },
    bobCek
  );

  assert(decryptedRecord.is_encrypted === true, 'Message flagged as is_encrypted');
  assert(decryptedRecord.content === 'Meet me at the sanctuary garden at sunset', 'Decrypted text matches original plaintext');
  assert(decryptedRecord.metadata.reply_to.content === 'Where should we meet?', 'Decrypted reply snippet restored in local memory');

  console.log('\n--- 5. End-to-End Encrypted Image Transmission ---');
  // Generate random image bytes (simulating WebP image)
  const mockImageBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x11, 0x22, 0x33, 0x44]);
  const encryptedImage = await encryptBinary(mockImageBytes, aliceCek);

  assert(encryptedImage.byteLength === 12 + mockImageBytes.byteLength + 16, 'Encrypted image has 12B IV + payload + 16B auth tag');
  assert(encryptedImage.slice(0, 4).toString() !== mockImageBytes.slice(0, 4).toString(), 'Encrypted image bytes do not leak plaintext RIFF/WEBP header');

  // Bob decrypts image
  const decryptedImageBuffer = await decryptBinary(encryptedImage, bobCek);
  const decryptedImageBytes = new Uint8Array(decryptedImageBuffer);
  assert(decryptedImageBytes.byteLength === mockImageBytes.byteLength, 'Decrypted image byte length matches original');

  let allBytesMatch = true;
  for (let i = 0; i < mockImageBytes.byteLength; i++) {
    if (decryptedImageBytes[i] !== mockImageBytes[i]) allBytesMatch = false;
  }
  assert(allBytesMatch, 'Decrypted image bytes match original bytes 100%');

  console.log('\n--- 6. Zero Plaintext Fallback Enforcement ---');
  // Attempt to encrypt without key throws error
  let blockedWithoutKey = false;
  try {
    await encryptMessage('Secret text', null, 'epoch_1');
  } catch (e) {
    blockedWithoutKey = true;
  }
  assert(blockedWithoutKey, 'Message encryption strictly blocked when CEK is null (NEVER plaintext)');

  let blockedImageWithoutKey = false;
  try {
    await encryptBinary(mockImageBytes, null);
  } catch (e) {
    blockedImageWithoutKey = true;
  }
  assert(blockedImageWithoutKey, 'Image encryption strictly blocked when CEK is null (NEVER plaintext)');

  console.log('\n--- 7. Missing Key & Corruption Error Handling ---');
  // Decrypting without conversation key returns safe placeholder
  const safePlaceholder = await decryptMessageRecord(
    {
      id: 'msg-002',
      content: ciphertext,
      is_deleted: false
    },
    null
  );
  assert(safePlaceholder.is_decrypt_error === true, 'Flagged as decrypt error when key unavailable');
  assert(safePlaceholder.content.includes('Encrypted message'), 'Shows user-friendly error instead of leaking raw ciphertext');
  assert(safePlaceholder.raw_ciphertext === ciphertext, 'Preserves raw ciphertext for retry');

  // Tampered ciphertext fails authentication
  const tamperedCipher = ciphertext.slice(0, -6) + 'AAAAAA';
  let tamperRejected = false;
  try {
    await decryptMessage(tamperedCipher, bobCek);
  } catch (e) {
    tamperRejected = true;
    assert(e.message.includes('authentication failed'), 'AES-GCM tag mismatch on tampered ciphertext');
  }
  assert(tamperRejected, 'Tampered message ciphertext authentication strictly failed');

  console.log('\n--- 8. Anti-MITM Key Substitution Detection ---');
  // Pin Bob's fingerprint in Alice's keystore
  await pinPartnerFingerprint('bob-user-id', bobId.fingerprint, false);
  const pinned = await getPinnedPartnerFingerprint('bob-user-id');
  assert(pinned.fingerprint === bobId.fingerprint, 'Bob fingerprint pinned in keystore (TOFU)');
  assert(pinned.isVerified === false, 'Bob starts as unverified (TOFU is not verification)');

  // Simulate Bob key replacement (e.g. reinstallation or malicious MITM substitution)
  const attackerId = await generateIdentityKeyPair();
  assert(attackerId.fingerprint !== pinned.fingerprint, 'Attacker/Reinstalled key fingerprint does not match pinned fingerprint');

  // Explicit user verification
  await markPartnerVerified('bob-user-id', true);
  const verifiedPinned = await getPinnedPartnerFingerprint('bob-user-id');
  assert(verifiedPinned.isVerified === true, 'Partner marked verified only after explicit user verification');

  console.log('\n======================================================');
  console.log(`Automatic E2EE Test Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAutomaticE2EETests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
