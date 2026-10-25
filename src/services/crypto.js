/**
 * The Saviour — Cryptographic Core Service
 * 
 * Uses the native W3C Web Crypto API (crypto.subtle) for hardware-accelerated,
 * constant-time, authenticated encryption.
 * 
 * Standards & Primitives:
 * - Asymmetric Key Exchange: ECDH (NIST Curve P-256)
 * - Key Derivation: HKDF-SHA-256 (RFC 5869)
 * - Authenticated Symmetric Cipher: AES-256-GCM (96-bit IV, 128-bit Tag)
 * - Passphrase Key Wrapping: PBKDF2-HMAC-SHA256 (600,000 iterations)
 * - Safety Number: Lexicographically sorted canonical public keys hashed with SHA-256
 */

const cryptoSubtle = globalThis.crypto?.subtle;
const getRandomValues = (arr) => globalThis.crypto.getRandomValues(arr);

const HKDF_INFO_PREFIX = 'TheSaviour-E2EE-v1';
const ENVELOPE_PREFIX = 'enc:v1';
const PBKDF2_ITERATIONS = 600000;

// -----------------------------------------------------------------------------
// Base64 & Buffer Conversion Helpers
// -----------------------------------------------------------------------------

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function uint8ArrayToBase64(bytes) {
  return arrayBufferToBase64(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

export function base64ToUint8Array(base64) {
  return new Uint8Array(base64ToArrayBuffer(base64));
}

export function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// -----------------------------------------------------------------------------
// Identity Keypair Management (ECDH P-256)
// -----------------------------------------------------------------------------

/**
 * Generate a new ECDH P-256 keypair for client identity
 */
export async function generateIdentityKeyPair() {
  if (!cryptoSubtle) throw new Error('Web Crypto API is not available');

  const keyPair = await cryptoSubtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true, // Extractable so it can be backed up encrypted with passphrase
    ['deriveKey', 'deriveBits']
  );

  const publicKeyJwk = await exportPublicKeyToJwk(keyPair.publicKey);
  const fingerprint = await computeKeyFingerprint(publicKeyJwk);

  return {
    keyPair,
    publicKeyJwk,
    fingerprint
  };
}

/**
 * Export public CryptoKey to standardized JWK format
 */
export async function exportPublicKeyToJwk(publicKey) {
  const jwk = await cryptoSubtle.exportKey('jwk', publicKey);
  // Keep only relevant curve fields
  return {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y
  };
}

/**
 * Import public key from JWK format to CryptoKey
 */
export async function importPublicKeyFromJwk(jwk) {
  return cryptoSubtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
      ext: true
    },
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    []
  );
}

/**
 * Export private CryptoKey to JWK
 */
export async function exportPrivateKeyToJwk(privateKey) {
  return cryptoSubtle.exportKey('jwk', privateKey);
}

/**
 * Import private CryptoKey from JWK
 */
export async function importPrivateKeyFromJwk(jwk) {
  return cryptoSubtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// -----------------------------------------------------------------------------
// Fingerprints & Safety Numbers (Anti-MITM Verification)
// -----------------------------------------------------------------------------

/**
 * Canonical JSON serialization of a public key JWK
 */
export function canonicalizePublicKeyJwk(jwk) {
  return JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y
  });
}

/**
 * Compute SHA-256 fingerprint of a public key JWK (hex string)
 */
export async function computeKeyFingerprint(publicKeyJwk) {
  const canonical = canonicalizePublicKeyJwk(publicKeyJwk);
  const data = new TextEncoder().encode(canonical);
  const hash = await cryptoSubtle.digest('SHA-256', data);
  return bufferToHex(hash);
}

/**
 * Compute the deterministic mutual Safety Number between two users' public keys.
 * 
 * Sorts keys lexicographically so both User A and User B compute the exact same Safety Number.
 * Returns formatted 12 groups of 5 decimal digits (60 digits total) and chunked hex string.
 */
export async function computeSafetyNumber(userA_jwk, userB_jwk) {
  const canonA = canonicalizePublicKeyJwk(userA_jwk);
  const canonB = canonicalizePublicKeyJwk(userB_jwk);

  // Deterministic sorting (lexicographical)
  const [first, second] = canonA < canonB ? [canonA, canonB] : [canonB, canonA];

  const combinedString = `TheSaviour-SafetyNumber-v1:${first}:${second}`;
  const digest = await cryptoSubtle.digest('SHA-256', new TextEncoder().encode(combinedString));
  const bytes = new Uint8Array(digest);

  // 1. Format as 12 groups of 5 decimal digits (60 digits total)
  const groups = [];
  // Using 24 bytes (2 bytes per group)
  for (let i = 0; i < 12; i++) {
    const val = (bytes[i * 2] << 8) | bytes[i * 2 + 1];
    const fiveDigits = (val % 100000).toString().padStart(5, '0');
    groups.push(fiveDigits);
  }
  const decimalFormatted = groups.join(' ');

  // 2. Format as chunked hex
  const fullHex = bufferToHex(digest).toUpperCase();
  const hexChunks = fullHex.match(/.{1,4}/g)?.join(' ') || fullHex;

  return {
    decimalFormatted,
    decimalRaw: groups.join(''),
    hexFormatted: hexChunks,
    hexRaw: fullHex
  };
}

// -----------------------------------------------------------------------------
// Shared Conversation Encryption Key (CEK) Derivation
// -----------------------------------------------------------------------------

/**
 * Derive matching 256-bit AES-GCM Conversation Encryption Key from:
 * My Private Key + Partner's Public Key + ChatId + Epoch
 */
export async function deriveConversationKey({ myPrivateKey, partnerPublicKey, chatId, epoch = 'epoch_1' }) {
  if (!myPrivateKey || !partnerPublicKey || !chatId) {
    throw new Error('myPrivateKey, partnerPublicKey, and chatId are required');
  }

  // 1. Compute ECDH shared secret bits (256 bits)
  const sharedBits = await cryptoSubtle.deriveBits(
    {
      name: 'ECDH',
      public: partnerPublicKey
    },
    myPrivateKey,
    256
  );

  // 2. Import shared bits into HKDF key
  const hkdfKey = await cryptoSubtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  // 3. Derive 256-bit AES-GCM key using chatId as salt and context info
  const salt = new TextEncoder().encode(chatId);
  const info = new TextEncoder().encode(`${HKDF_INFO_PREFIX}:${epoch}`);

  const aesKey = await cryptoSubtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // Extractable for testing / local caching
    ['encrypt', 'decrypt']
  );

  return aesKey;
}

// -----------------------------------------------------------------------------
// Message Encryption & Decryption
// -----------------------------------------------------------------------------

/**
 * Encrypt a message payload with AES-256-GCM.
 * Formats output as an armored envelope: enc:v1:<epoch>:<base64-iv>:<base64-ciphertext>
 */
export async function encryptMessage(payload, aesGcmKey, epoch = 'epoch_1') {
  if (!payload) throw new Error('payload is required');
  if (!aesGcmKey) throw new Error('aesGcmKey is required');

  // Serialize payload to JSON string
  const plainText = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const plainBytes = new TextEncoder().encode(plainText);

  // Fresh 12-byte (96-bit) IV
  const iv = getRandomValues(new Uint8Array(12));

  // Encrypt with AES-GCM (auth tag automatically appended)
  const cipherBuffer = await cryptoSubtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesGcmKey,
    plainBytes
  );

  const base64Iv = uint8ArrayToBase64(iv);
  const base64Cipher = arrayBufferToBase64(cipherBuffer);

  return `${ENVELOPE_PREFIX}:${epoch}:${base64Iv}:${base64Cipher}`;
}

/**
 * Check if a message string is encrypted
 */
export function isEncryptedMessage(content) {
  return typeof content === 'string' && content.startsWith(`${ENVELOPE_PREFIX}:`);
}

/**
 * Decrypt an armored message envelope. Returns the original payload (parsed JSON if JSON).
 */
export async function decryptMessage(armoredContent, aesGcmKey) {
  if (!isEncryptedMessage(armoredContent)) {
    // Unencrypted legacy/system message fallback
    return { isEncrypted: false, content: armoredContent };
  }

  const parts = armoredContent.split(':');
  if (parts.length < 5) {
    throw new Error('Invalid encrypted message envelope structure');
  }

  const [, version, epoch, base64Iv, base64Cipher] = parts;
  if (version !== 'v1') {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const iv = base64ToUint8Array(base64Iv);
  const cipherBytes = base64ToArrayBuffer(base64Cipher);

  try {
    const decryptedBuffer = await cryptoSubtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      aesGcmKey,
      cipherBytes
    );

    const decryptedString = new TextDecoder().decode(decryptedBuffer);

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(decryptedString);
    } catch {
      parsedPayload = decryptedString;
    }

    return {
      isEncrypted: true,
      epoch,
      payload: parsedPayload
    };
  } catch (err) {
    throw new Error('Message authentication failed or incorrect encryption key (tag mismatch)');
  }
}

// -----------------------------------------------------------------------------
// Binary / Image Encryption & Decryption
// -----------------------------------------------------------------------------

/**
 * Encrypt binary data (ArrayBuffer or Uint8Array) using AES-256-GCM.
 * Output binary format: [12 bytes IV][Ciphertext + 16-byte Auth Tag]
 */
export async function encryptBinary(data, aesGcmKey) {
  if (!data) throw new Error('Data required');
  if (!aesGcmKey) throw new Error('aesGcmKey required');

  const inputBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const iv = getRandomValues(new Uint8Array(12));

  const cipherBuffer = await cryptoSubtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesGcmKey,
    inputBytes
  );

  const cipherBytes = new Uint8Array(cipherBuffer);

  // Combine IV (12 bytes) + Ciphertext into a single binary buffer
  const result = new Uint8Array(12 + cipherBytes.byteLength);
  result.set(iv, 0);
  result.set(cipherBytes, 12);

  return result;
}

/**
 * Decrypt binary data that was encrypted with encryptBinary.
 * Expects: [12 bytes IV][Ciphertext + Auth Tag]
 * Returns raw decrypted ArrayBuffer.
 */
export async function decryptBinary(encryptedData, aesGcmKey) {
  if (!encryptedData) throw new Error('Encrypted data required');
  if (!aesGcmKey) throw new Error('aesGcmKey required');

  const bytes = encryptedData instanceof Uint8Array ? encryptedData : new Uint8Array(encryptedData);
  if (bytes.byteLength < 28) { // 12 bytes IV + at least 16 bytes auth tag
    throw new Error('Encrypted binary data too short');
  }

  const iv = bytes.slice(0, 12);
  const cipherBytes = bytes.slice(12);

  try {
    const decryptedBuffer = await cryptoSubtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      aesGcmKey,
      cipherBytes
    );

    return decryptedBuffer;
  } catch (err) {
    throw new Error('Image decryption failed: Invalid key or corrupted file');
  }
}

// -----------------------------------------------------------------------------
// Passphrase-Encrypted Key Vault (PBKDF2-SHA256 + AES-GCM)
// -----------------------------------------------------------------------------

/**
 * Evaluate strength and entropy of a user passphrase
 */
export function evaluatePassphraseStrength(passphrase) {
  if (!passphrase || typeof passphrase !== 'string') {
    return { score: 0, feedback: 'Passphrase is required', isStrong: false };
  }

  let score = 0;
  if (passphrase.length >= 10) score += 1;
  if (passphrase.length >= 14) score += 1;
  if (passphrase.length >= 20) score += 1;
  if (/[A-Z]/.test(passphrase)) score += 1;
  if (/[a-z]/.test(passphrase)) score += 1;
  if (/[0-9]/.test(passphrase)) score += 1;
  if (/[^A-Za-z0-9]/.test(passphrase)) score += 1;
  // Check for multi-word phrase (e.g. 4+ words)
  const words = passphrase.trim().split(/\s+/);
  if (words.length >= 4) score += 2;

  const isStrong = score >= 5 && passphrase.length >= 10;
  let feedback = 'Weak passphrase';
  if (score >= 6) feedback = 'Very Strong sanctuary passphrase';
  else if (score >= 4) feedback = 'Good passphrase';

  return { score, feedback, isStrong };
}

/**
 * Derive Key Encryption Key (KEK) using PBKDF2 with 600,000 iterations
 */
async function derivePassphraseKek(passphrase, saltBytes, iterations = PBKDF2_ITERATIONS) {
  const passphraseKey = await cryptoSubtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return cryptoSubtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256'
    },
    passphraseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a user's private key into a secure vault bundle using their passphrase.
 * 
 * Returns vault object suitable for storing in public.user_e2ee_keys
 */
export async function exportEncryptedKeyVault(privateKey, passphrase, metadata = {}) {
  const strength = evaluatePassphraseStrength(passphrase);
  if (!strength.isStrong) {
    throw new Error('Passphrase is not strong enough. Minimum 10 characters with mixed complexity or 4+ words required.');
  }

  // 1. Export private key to JWK
  const privateKeyJwk = await exportPrivateKeyToJwk(privateKey);

  // 2. Prepare bundle payload
  const bundle = {
    v: 1,
    privateKeyJwk,
    metadata,
    createdAt: Date.now()
  };
  const bundleBytes = new TextEncoder().encode(JSON.stringify(bundle));

  // 3. Generate 32-byte salt and 12-byte IV
  const salt = getRandomValues(new Uint8Array(32));
  const iv = getRandomValues(new Uint8Array(12));

  // 4. Derive KEK via PBKDF2-SHA256 (600,000 iterations)
  const kek = await derivePassphraseKek(passphrase, salt, PBKDF2_ITERATIONS);

  // 5. Encrypt bundle with AES-GCM
  const cipherBuffer = await cryptoSubtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    kek,
    bundleBytes
  );

  return {
    encrypted_private_key: arrayBufferToBase64(cipherBuffer),
    key_salt: uint8ArrayToBase64(salt),
    key_iv: uint8ArrayToBase64(iv),
    key_kdf_iterations: PBKDF2_ITERATIONS
  };
}

/**
 * Decrypt and import private key from an encrypted vault bundle using passphrase.
 * 
 * Throws error if passphrase is incorrect or bundle corrupted.
 */
export async function importEncryptedKeyVault({ encrypted_private_key, key_salt, key_iv, key_kdf_iterations = PBKDF2_ITERATIONS }, passphrase) {
  if (!encrypted_private_key || !key_salt || !key_iv || !passphrase) {
    throw new Error('Encrypted vault fields and passphrase are required');
  }

  const salt = base64ToUint8Array(key_salt);
  const iv = base64ToUint8Array(key_iv);
  const cipherBuffer = base64ToArrayBuffer(encrypted_private_key);

  let kek;
  try {
    kek = await derivePassphraseKek(passphrase, salt, key_kdf_iterations);
  } catch (err) {
    throw new Error('Key derivation failed: ' + err.message);
  }

  let decryptedBuffer;
  try {
    decryptedBuffer = await cryptoSubtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      kek,
      cipherBuffer
    );
  } catch (err) {
    throw new Error('Incorrect passphrase or corrupted key bundle (authentication tag mismatch)');
  }

  const bundleString = new TextDecoder().decode(decryptedBuffer);
  const bundle = JSON.parse(bundleString);

  if (!bundle.privateKeyJwk) {
    throw new Error('Decrypted vault does not contain a valid private key structure');
  }

  const privateKey = await importPrivateKeyFromJwk(bundle.privateKeyJwk);

  return {
    privateKey,
    privateKeyJwk: bundle.privateKeyJwk,
    metadata: bundle.metadata || {}
  };
}

// -----------------------------------------------------------------------------
// Offline Backup File Export & Import (.saviour-backup)
// -----------------------------------------------------------------------------

/**
 * Generate formatted offline JSON file for paper/local disk backup
 */
export function generateOfflineBackupJson(vaultData, publicKeyJwk, userEmail) {
  return JSON.stringify({
    app: 'The Saviour',
    format: 'sanctuary-key-vault-v1',
    user_email: userEmail || 'sanctuary_user',
    public_key: publicKeyJwk,
    vault: {
      encrypted_private_key: vaultData.encrypted_private_key,
      key_salt: vaultData.key_salt,
      key_iv: vaultData.key_iv,
      key_kdf_iterations: vaultData.key_kdf_iterations
    },
    exported_at: new Date().toISOString(),
    security_notice: 'This file contains your end-to-end encrypted identity key. Keep it safe. Requires your Sanctuary Passphrase to unlock.'
  }, null, 2);
}

/**
 * Restore key from parsed offline backup file
 */
export async function restoreFromOfflineBackupJson(jsonString, passphrase) {
  const parsed = JSON.parse(jsonString);
  if (!parsed.vault || !parsed.vault.encrypted_private_key) {
    throw new Error('Invalid offline backup file format');
  }

  const restored = await importEncryptedKeyVault(parsed.vault, passphrase);
  return {
    ...restored,
    publicKeyJwk: parsed.public_key
  };
}
