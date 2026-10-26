/**
 * The Saviour — Local IndexedDB Keystore Service
 * 
 * Provides secure, persistent on-device storage for:
 * 1. User ECDH Identity Keypair (CryptoKey objects)
 * 2. Derived Conversation Encryption Keys (CEK) by epoch
 * 3. Pinned Partner Fingerprints (for TOFU & Anti-MITM protection)
 * 
 * Keys stored here never leave the user's local browser storage in plaintext.
 */

const DB_NAME = 'the_saviour_e2ee';
const DB_VERSION = 1;

const STORES = {
  IDENTITY_KEYS: 'identity_keys',
  CONVERSATION_KEYS: 'conversation_keys',
  PINNED_FINGERPRINTS: 'pinned_fingerprints',
  SETTINGS: 'keystore_settings'
};

// In-memory fallback for environments without native indexedDB (e.g. Node tests or restricted iframes)
const memoryStore = {
  [STORES.IDENTITY_KEYS]: new Map(),
  [STORES.CONVERSATION_KEYS]: new Map(),
  [STORES.PINNED_FINGERPRINTS]: new Map(),
  [STORES.SETTINGS]: new Map()
};

const hasIndexedDB = () => {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
};

/**
 * Open or initialize the IndexedDB database
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.IDENTITY_KEYS)) {
        db.createObjectStore(STORES.IDENTITY_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.CONVERSATION_KEYS)) {
        db.createObjectStore(STORES.CONVERSATION_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.PINNED_FINGERPRINTS)) {
        db.createObjectStore(STORES.PINNED_FINGERPRINTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('IndexedDB failed to open, falling back to in-memory store:', request.error);
      resolve(null);
    };
  });
}

/**
 * Generic helper to execute a transaction
 */
async function perform(storeName, mode, callback) {
  const db = await openDB();
  if (!db) {
    const store = memoryStore[storeName];
    return callback({
      get: (id) => Promise.resolve(store.get(id)),
      put: (item) => {
        store.set(item.id, item);
        return Promise.resolve();
      },
      delete: (id) => {
        store.delete(id);
        return Promise.resolve();
      },
      getAll: () => Promise.resolve(Array.from(store.values())),
      clear: () => {
        store.clear();
        return Promise.resolve();
      }
    });
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    const wrappedStore = {
      get: (id) => new Promise((res, rej) => {
        const req = store.get(id);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      }),
      put: (item) => new Promise((res, rej) => {
        const req = store.put(item);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      }),
      delete: (id) => new Promise((res, rej) => {
        const req = store.delete(id);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      }),
      getAll: () => new Promise((res, rej) => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
      }),
      clear: () => new Promise((res, rej) => {
        const req = store.clear();
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      })
    };

    callback(wrappedStore)
      .then(result => {
        tx.oncomplete = () => resolve(result);
      })
      .catch(err => {
        tx.abort();
        reject(err);
      });

    tx.onerror = () => reject(tx.error);
  });
}

// -----------------------------------------------------------------------------
// Identity Key Operations
// -----------------------------------------------------------------------------

/**
 * Store the local user's Identity Keypair in IndexedDB
 */
export async function saveIdentityKey(userId, { privateKey, publicKey, publicKeyJwk, fingerprint }) {
  if (!userId) throw new Error('userId is required');
  return perform(STORES.IDENTITY_KEYS, 'readwrite', async (store) => {
    await store.put({
      id: userId,
      privateKey,
      publicKey,
      publicKeyJwk,
      fingerprint,
      updatedAt: Date.now()
    });
  });
}

/**
 * Retrieve the local user's Identity Keypair
 */
export async function getIdentityKey(userId) {
  if (!userId) return null;
  return perform(STORES.IDENTITY_KEYS, 'readonly', async (store) => {
    return (await store.get(userId)) || null;
  });
}

/**
 * Remove local Identity Keypair (e.g. on full client key wipe)
 */
export async function deleteIdentityKey(userId) {
  if (!userId) return;
  return perform(STORES.IDENTITY_KEYS, 'readwrite', async (store) => {
    await store.delete(userId);
  });
}

// -----------------------------------------------------------------------------
// Conversation Key (CEK) Operations
// -----------------------------------------------------------------------------

/**
 * Store derived Conversation Encryption Key (AES-256-GCM) by chat and epoch
 */
export async function saveConversationKey(chatId, epoch, key) {
  if (!chatId || !epoch || !key) throw new Error('chatId, epoch, and key are required');
  const recordId = `${chatId}:${epoch}`;
  return perform(STORES.CONVERSATION_KEYS, 'readwrite', async (store) => {
    await store.put({
      id: recordId,
      chatId,
      epoch,
      key,
      savedAt: Date.now()
    });
  });
}

/**
 * Retrieve Conversation Encryption Key by chat and epoch
 */
export async function getConversationKey(chatId, epoch) {
  if (!chatId || !epoch) return null;
  const recordId = `${chatId}:${epoch}`;
  return perform(STORES.CONVERSATION_KEYS, 'readonly', async (store) => {
    const record = await store.get(recordId);
    return record?.key || null;
  });
}

/**
 * Retrieve all Conversation Encryption Keys for a chat
 */
export async function getAllConversationKeys(chatId) {
  if (!chatId) return [];
  return perform(STORES.CONVERSATION_KEYS, 'readonly', async (store) => {
    const all = await store.getAll();
    return all.filter(r => r.chatId === chatId);
  });
}

// -----------------------------------------------------------------------------
// Pinned Partner Fingerprint (TOFU / Anti-Key-Substitution) Operations
// -----------------------------------------------------------------------------

/**
 * Pin or update partner's public key fingerprint
 */
export async function pinPartnerFingerprint(partnerUserId, fingerprint, isVerified = false) {
  if (!partnerUserId || !fingerprint) throw new Error('partnerUserId and fingerprint required');
  return perform(STORES.PINNED_FINGERPRINTS, 'readwrite', async (store) => {
    const existing = await store.get(partnerUserId);
    const fingerprintChanged = existing && existing.fingerprint !== fingerprint;
    await store.put({
      id: partnerUserId,
      fingerprint,
      isVerified: fingerprintChanged ? Boolean(isVerified) : Boolean(isVerified || existing?.isVerified),
      pinnedAt: fingerprintChanged ? Date.now() : (existing?.pinnedAt || Date.now()),
      lastCheckedAt: Date.now()
    });
  });
}

/**
 * Mark partner's safety number as manually verified by user
 */
export async function markPartnerVerified(partnerUserId, isVerified = true) {
  if (!partnerUserId) return;
  return perform(STORES.PINNED_FINGERPRINTS, 'readwrite', async (store) => {
    const existing = await store.get(partnerUserId);
    if (existing) {
      existing.isVerified = isVerified;
      existing.verifiedAt = Date.now();
      await store.put(existing);
    }
  });
}

/**
 * Retrieve pinned partner fingerprint
 */
export async function getPinnedPartnerFingerprint(partnerUserId) {
  if (!partnerUserId) return null;
  return perform(STORES.PINNED_FINGERPRINTS, 'readonly', async (store) => {
    return (await store.get(partnerUserId)) || null;
  });
}

// -----------------------------------------------------------------------------
// Clear Entire Keystore
// -----------------------------------------------------------------------------

export async function clearEntireKeystore() {
  await perform(STORES.IDENTITY_KEYS, 'readwrite', store => store.clear());
  await perform(STORES.CONVERSATION_KEYS, 'readwrite', store => store.clear());
  await perform(STORES.PINNED_FINGERPRINTS, 'readwrite', store => store.clear());
  await perform(STORES.SETTINGS, 'readwrite', store => store.clear());
}
