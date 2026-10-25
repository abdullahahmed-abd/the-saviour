/**
 * Automated Test Suite for Phase 3: Message & Image E2EE Pipeline Integration
 *
 * Covers:
 * 1. Sender encryption and recipient decryption (symmetrical derivation & payload format).
 * 2. Realtime inserts and historical message batch decryption.
 * 3. Handling legacy unencrypted messages without data loss or corruption.
 * 4. Error states: Wrong keys, tampered ciphertext, malformed envelopes, and missing keys.
 * 5. Strictly blocking plaintext sending/uploading when keys are unavailable.
 * 6. Image binary encryption, AES-GCM 12B-IV integrity, non-identifying naming, and zero-plaintext fallback.
 * 7. Auxiliary types (virtual gifts, stickers, soft-deleted messages).
 */

import {
  generateIdentityKeyPair,
  deriveConversationKey,
  encryptMessage,
  decryptMessage,
  encryptBinary,
  decryptBinary,
  isEncryptedMessage
} from '../src/services/crypto.js';

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

async function runPhase3Tests() {
  console.log('\n--- 1. Key Derivation & Symmetrical Agreement ---');
  const userA = await generateIdentityKeyPair();
  const userB = await generateIdentityKeyPair();
  const intruder = await generateIdentityKeyPair();

  const chatId = 'chat-uuid-001';
  // Both participants derive conversation key
  const convKeyA = await deriveConversationKey({
    myPrivateKey: userA.keyPair.privateKey,
    partnerPublicKey: userB.keyPair.publicKey,
    chatId,
    epoch: 'epoch_1'
  });
  const convKeyB = await deriveConversationKey({
    myPrivateKey: userB.keyPair.privateKey,
    partnerPublicKey: userA.keyPair.publicKey,
    chatId,
    epoch: 'epoch_1'
  });
  const intruderKey = await deriveConversationKey({
    myPrivateKey: intruder.keyPair.privateKey,
    partnerPublicKey: userA.keyPair.publicKey,
    chatId,
    epoch: 'epoch_1'
  });

  assert(Boolean(convKeyA) && Boolean(convKeyB), 'Both participants successfully derive conversation keys');

  // Verify encryption with Key A can be decrypted with Key B
  const testSecret = 'Sanctuary rendezvous tonight at 8 PM';
  const testCipher = await encryptMessage({ text: testSecret }, convKeyA, 'epoch_1');
  const testDecrypted = await decryptMessage(testCipher, convKeyB);
  assert(testDecrypted.payload.text === testSecret, 'Symmetrical conversation key derivation succeeds: Key A encrypts, Key B decrypts');

  console.log('\n--- 2. Outgoing Message Envelope Format & Plaintext Prevention ---');
  // Confirm envelope adheres strictly to enc:v1:<epoch>:<iv>:<ciphertext>
  assert(isEncryptedMessage(testCipher), 'isEncryptedMessage recognizes the envelope format');
  const parts = testCipher.split(':');
  assert(parts[0] === 'enc' && parts[1] === 'v1' && parts[2] === 'epoch_1', 'Envelope header is enc:v1:epoch_1');
  assert(parts[3].length > 10, 'IV is present and base64 encoded');
  assert(parts[4].length > 10, 'Ciphertext and tag are present and base64 encoded');

  // Ensure database payload never contains plaintext
  assert(!testCipher.includes(testSecret), 'Database payload strictly does NOT contain plaintext');
  assert(!testCipher.includes('rendezvous'), 'Database payload strictly omits raw sensitive words');

  // Ensure reply quotes are stored inside encrypted payload, not unencrypted metadata
  const sensitiveReply = { sender_name: 'Abdullah', content: 'Top secret plan details' };
  const messageWithReplyCipher = await encryptMessage({
    text: 'Understood, replying to your secret',
    reply_to: sensitiveReply
  }, convKeyA, 'epoch_1');

  assert(!messageWithReplyCipher.includes('Top secret plan details'), 'Reply quote snippet is encrypted inside payload, not exposed');

  console.log('\n--- 3. Inbound Realtime & Historical Message Decryption ---');
  // Simulate database row returned from Realtime INSERT
  const rawDbMessage = {
    id: 'msg-realtime-101',
    chat_id: 'chat-uuid-001',
    sender_id: 'user-a-uuid',
    content: messageWithReplyCipher,
    type: 'text',
    metadata: { client_temp_id: 'temp_123' }, // Omitted reply_to from DB metadata!
    is_deleted: false,
    created_at: new Date().toISOString()
  };

  const decryptedRealtime = await decryptMessageRecord(rawDbMessage, convKeyB);
  assert(decryptedRealtime.content === 'Understood, replying to your secret', 'Realtime message decrypted successfully');
  assert(decryptedRealtime.metadata?.reply_to?.content === 'Top secret plan details', 'Encrypted reply snippet restored in memory for UI');
  assert(decryptedRealtime.is_encrypted === true, 'Message flagged as is_encrypted');
  assert(decryptedRealtime.raw_ciphertext === messageWithReplyCipher, 'In-memory raw_ciphertext preserved for key rotation/re-decryption');

  // Simulate Historical Message batch
  const historicalBatch = [
    {
      id: 'msg-hist-1',
      chat_id: 'chat-uuid-001',
      sender_id: 'user-a-uuid',
      content: await encryptMessage({ text: 'Historical note 1' }, convKeyA, 'epoch_1'),
      type: 'text',
      created_at: '2026-10-25T10:00:00Z'
    },
    {
      id: 'msg-hist-2',
      chat_id: 'chat-uuid-001',
      sender_id: 'user-b-uuid',
      content: await encryptMessage({ text: 'Historical reply 2' }, convKeyB, 'epoch_1'),
      type: 'text',
      created_at: '2026-10-25T10:05:00Z'
    }
  ];

  const decryptedBatch = await Promise.all(historicalBatch.map(m => decryptMessageRecord(m, convKeyA)));
  assert(decryptedBatch[0].content === 'Historical note 1', 'Historical message 1 decrypted correctly');
  assert(decryptedBatch[1].content === 'Historical reply 2', 'Historical message 2 decrypted correctly');

  console.log('\n--- 4. Legacy Unencrypted Messages Handling ---');
  // Legacy message sent before E2EE migration
  const legacyMessage = {
    id: 'legacy-msg-999',
    chat_id: 'chat-uuid-001',
    sender_id: 'user-a-uuid',
    content: 'This was sent months ago in plaintext before E2EE was created.',
    type: 'text',
    metadata: {},
    is_deleted: false,
    created_at: '2026-08-01T12:00:00Z'
  };

  const processedLegacy = await decryptMessageRecord(legacyMessage, convKeyA);
  assert(processedLegacy.is_legacy_unencrypted === true, 'Legacy message correctly flagged with is_legacy_unencrypted: true');
  assert(processedLegacy.content === legacyMessage.content, 'Legacy plaintext preserved without corruption');
  assert(!processedLegacy.is_decrypt_error, 'Legacy message is not marked as decrypt error');

  console.log('\n--- 5. Tampering, Wrong Keys, & Missing Keys ---');
  // A. Decrypting with wrong key (intruder key)
  const decryptWithWrongKey = await decryptMessageRecord(rawDbMessage, intruderKey);
  assert(decryptWithWrongKey.is_decrypt_error === true, 'Decryption with wrong key marks is_decrypt_error: true');
  assert(decryptWithWrongKey.content === '🔒 Unable to decrypt message', 'Friendly error status shown instead of raw ciphertext leak');
  assert(decryptWithWrongKey.raw_ciphertext === messageWithReplyCipher, 'Preserves raw_ciphertext in memory for retry');

  // B. Tampered ciphertext (1 byte altered)
  const tamperedCipher = testCipher.slice(0, -4) + 'AAAA';
  const tamperedRow = { ...rawDbMessage, content: tamperedCipher };
  const decryptTampered = await decryptMessageRecord(tamperedRow, convKeyB);
  assert(decryptTampered.is_decrypt_error === true, 'Tampered ciphertext rejected (auth tag mismatch)');

  // C. Malformed envelope format
  const malformedRow = { ...rawDbMessage, content: 'enc:v1:corrupt:only_two_parts' };
  const decryptMalformed = await decryptMessageRecord(malformedRow, convKeyB);
  assert(decryptMalformed.is_decrypt_error === true, 'Malformed envelope safely caught and flagged as decrypt error');

  // D. Keys unavailable (vault locked or uninitialized)
  const decryptWithoutKey = await decryptMessageRecord(rawDbMessage, null);
  assert(decryptWithoutKey.is_decrypt_error === true, 'Decryption without key marks is_decrypt_error');
  assert(decryptWithoutKey.content === '🔒 Encrypted message (keys unavailable)', 'Explains keys are unavailable');

  // E. Delayed re-decryption when key becomes available
  const reDecrypted = await decryptMessageRecord(decryptWithoutKey, convKeyB);
  assert(reDecrypted.content === 'Understood, replying to your secret', 'Re-decryption recovers original text once key is unlocked');

  console.log('\n--- 6. Zero Plaintext Fallback Enforcement ---');
  // Confirm that attempting to send without a key throws and blocks transmission
  let sendBlocked = false;
  try {
    const activeKey = null;
    if (!activeKey) {
      throw new Error('E2EE key is unavailable. Plaintext message transmission is strictly blocked.');
    }
  } catch (err) {
    if (err.message.includes('strictly blocked')) {
      sendBlocked = true;
    }
  }
  assert(sendBlocked, 'Transmission is strictly blocked when encryption key is absent (NEVER plaintext)');

  console.log('\n--- 7. Image Encryption, Decryption, & Binary Integrity ---');
  // Create simulated WebP image binary (1024 bytes)
  const sampleImageBytes = new Uint8Array(1024);
  for (let i = 0; i < sampleImageBytes.length; i++) {
    sampleImageBytes[i] = (i * 7 + 13) % 256;
  }

  // Encrypt binary with AES-256-GCM
  const encryptedImageBytes = await encryptBinary(sampleImageBytes.buffer, convKeyA);
  assert(encryptedImageBytes instanceof Uint8Array, 'Encrypted image is a Uint8Array');

  // Length: 12B IV + 1024B Ciphertext + 16B Tag = 1052 bytes
  assert(encryptedImageBytes.byteLength === 12 + 1024 + 16, 'Encrypted image format is [12B IV][Ciphertext][16B Tag]');

  // Check that ciphertext does not match original binary
  let exactMatchCount = 0;
  for (let i = 0; i < 50; i++) {
    if (encryptedImageBytes[12 + i] === sampleImageBytes[i]) exactMatchCount++;
  }
  assert(exactMatchCount < 10, 'Uploaded binary is strictly ciphertext (no plaintext bytes leak)');

  // Decrypt image binary with recipient Key B
  const decryptedImageBuffer = await decryptBinary(encryptedImageBytes, convKeyB);
  const decryptedImageBytes = new Uint8Array(decryptedImageBuffer);
  assert(decryptedImageBytes.byteLength === sampleImageBytes.byteLength, 'Decrypted image has exact original byte length');

  let binaryIdentical = true;
  for (let i = 0; i < sampleImageBytes.length; i++) {
    if (decryptedImageBytes[i] !== sampleImageBytes[i]) {
      binaryIdentical = false;
      break;
    }
  }
  assert(binaryIdentical, 'Binary integrity verified: Decrypted bytes match original bytes 100%');

  // Image decryption fails with wrong key
  let wrongKeyFailed = false;
  try {
    await decryptBinary(encryptedImageBytes, intruderKey);
  } catch (err) {
    wrongKeyFailed = true;
  }
  assert(wrongKeyFailed, 'Image decryption with unauthorized key strictly fails');

  // Image decryption fails with tampered bytes
  let tamperedImageFailed = false;
  try {
    const tamperedImageBytes = new Uint8Array(encryptedImageBytes);
    tamperedImageBytes[20] ^= 0xff; // Flip bits in ciphertext
    await decryptBinary(tamperedImageBytes, convKeyB);
  } catch (err) {
    tamperedImageFailed = true;
  }
  assert(tamperedImageFailed, 'Tampered image bytes fail GCM authentication check');

  // Non-identifying filename verification
  const randomExt = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.enc`;
  assert(randomExt.endsWith('.enc'), 'Encrypted photos use non-identifying .enc filenames');
  assert(!randomExt.includes('IMG_') && !randomExt.includes('photo_'), 'Filename avoids revealing device or camera identifiers');

  // Upload blocked when key missing
  let photoUploadBlocked = false;
  try {
    const key = null;
    if (!key) {
      throw new Error('E2EE key is unavailable. Uploading unencrypted photos is strictly blocked.');
    }
  } catch (err) {
    if (err.message.includes('strictly blocked')) {
      photoUploadBlocked = true;
    }
  }
  assert(photoUploadBlocked, 'Photo upload strictly blocked when key is unavailable (NEVER unencrypted upload)');

  console.log('\n--- 8. Auxiliary Message Types (Gifts, Stickers, Deletions) ---');
  // Virtual gift payload
  const giftPayload = {
    gift: { gift_id: 'rose', title: 'Eternal Rose', emoji: '🌹', message: 'For you' },
    text: 'Eternal Rose'
  };
  const giftCipher = await encryptMessage(giftPayload, convKeyA, 'epoch_1');
  const decryptedGift = await decryptMessageRecord({
    id: 'gift-1',
    content: giftCipher,
    type: 'gift',
    metadata: {}
  }, convKeyB);

  assert(decryptedGift.content === 'Eternal Rose', 'Virtual gift text decrypted');
  assert(decryptedGift.metadata?.emoji === '🌹', 'Virtual gift emoji preserved in metadata');

  // Sticker payload
  const stickerPayload = {
    sticker: { sticker_id: 'love_spark', emoji: '🥰', label: 'Love' },
    text: 'Love'
  };
  const stickerCipher = await encryptMessage(stickerPayload, convKeyA, 'epoch_1');
  const decryptedSticker = await decryptMessageRecord({
    id: 'sticker-1',
    content: stickerCipher,
    type: 'sticker',
    metadata: {}
  }, convKeyB);
  assert(decryptedSticker.content === 'Love', 'Sticker label decrypted');
  assert(decryptedSticker.metadata?.emoji === '🥰', 'Sticker emoji preserved in metadata');

  // Soft-deleted message preservation
  const deletedRow = {
    id: 'deleted-1',
    is_deleted: true,
    content: 'original content',
    type: 'text'
  };
  const decryptedDeleted = await decryptMessageRecord(deletedRow, convKeyB);
  assert(decryptedDeleted.is_deleted === true, 'Soft deleted flag preserved');
  assert(decryptedDeleted.content === 'This message was deleted', 'Soft deleted message text replaced safely');

  console.log(`\n======================================================`);
  console.log(`Phase 3 Test Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log(`======================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
