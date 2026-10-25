import { supabase } from './supabase';
import { compressImage } from '../utils/imageCompressor';
import { encryptBinary, decryptBinary } from './crypto';

const BUCKET_NAME = 'chat-photos';
const signedUrlCache = new Map(); // path -> { url, expiresAt }
const decryptedBlobUrlCache = new Map(); // path -> blobUrl

/**
 * Upload an End-to-End Encrypted photo to Supabase Storage.
 * 
 * Flow:
 * 1. Checks that conversationKey is present. NEVER uploads plaintext as fallback.
 * 2. Compresses image locally to WebP (stripping EXIF metadata).
 * 3. Encrypts compressed binary using AES-256-GCM.
 * 4. Uploads ciphertext binary blob with non-identifying filename (.enc).
 */
export async function uploadEncryptedChatPhoto(file, chatId, userId, conversationKey) {
  if (!file) throw new Error('No file provided');
  if (!conversationKey) {
    throw new Error('E2EE key is unavailable. Uploading unencrypted photos is strictly blocked.');
  }

  // Check initial file size limit (5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image exceeds 5MB limit. Please select a smaller photo.');
  }

  // 1. Compress photo locally (strips EXIF & dimensions)
  const processedFile = await compressImage(file);
  const arrayBuffer = await processedFile.arrayBuffer();

  // 2. Encrypt binary payload with AES-256-GCM
  // Format: [12 bytes IV][Ciphertext + 16-byte Auth Tag]
  const encryptedBytes = await encryptBinary(arrayBuffer, conversationKey);

  // 3. Prepare non-identifying filename
  const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.enc`;
  const filePath = `photos/${chatId}/${userId}/${cleanFileName}`;

  const encryptedBlob = new Blob([encryptedBytes], { type: 'application/octet-stream' });

  // 4. Upload raw ciphertext to private bucket
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, encryptedBlob, {
      contentType: 'application/octet-stream',
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    // If Supabase storage bucket currently restricts mime types before migration,
    // upload with image/webp content-type header while preserving pure ciphertext bytes
    if (error.message?.includes('mime') || error.error === 'Invalid MIME type') {
      const fallbackUpload = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, encryptedBlob, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false
        });
      if (fallbackUpload.error) {
        throw new Error(fallbackUpload.error.message || 'Failed to upload encrypted photo.');
      }
      return {
        path: fallbackUpload.data.path,
        size: encryptedBytes.byteLength
      };
    }
    throw new Error(error.message || 'Failed to upload encrypted photo.');
  }

  return {
    path: data.path,
    size: encryptedBytes.byteLength
  };
}

/**
 * Download and decrypt an encrypted photo from Supabase Storage.
 * 
 * Returns an in-memory Blob URL for local rendering.
 * Caches Blob URL in memory so subsequent renders are instantaneous.
 */
export async function downloadAndDecryptChatPhoto(path, conversationKey) {
  if (!path) return '';

  // 1. Check in-memory decrypted Blob URL cache
  if (decryptedBlobUrlCache.has(path)) {
    return decryptedBlobUrlCache.get(path);
  }

  // 2. Legacy unencrypted photo fallback (for historical messages prior to E2EE)
  if (!path.endsWith('.enc')) {
    return getSignedPhotoUrl(path);
  }

  // 3. Ensure key is available
  if (!conversationKey) {
    throw new Error('Conversation key is not available for decryption.');
  }

  // 4. Download raw encrypted bytes from private storage
  const { data: blob, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path);

  if (error) {
    throw new Error('Failed to download encrypted photo: ' + error.message);
  }

  // 5. Decrypt binary with AES-256-GCM
  const arrayBuffer = await blob.arrayBuffer();
  const decryptedBuffer = await decryptBinary(new Uint8Array(arrayBuffer), conversationKey);

  // 6. Construct local WebP Blob & URL
  const decryptedBlob = new Blob([decryptedBuffer], { type: 'image/webp' });
  const blobUrl = URL.createObjectURL(decryptedBlob);

  decryptedBlobUrlCache.set(path, blobUrl);
  return blobUrl;
}

/**
 * Revoke all temporary in-memory Object URLs to prevent memory leaks
 */
export function revokeAllDecryptedBlobUrls() {
  for (const blobUrl of decryptedBlobUrlCache.values()) {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch (e) {}
  }
  decryptedBlobUrlCache.clear();
}

/**
 * Retrieve short-lived signed URL for a private photo path (legacy compatibility).
 */
export async function getSignedPhotoUrl(path, expiresIn = 3600) {
  if (!path) return '';

  const cached = signedUrlCache.get(path);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 300000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.warn(`Failed to create signed URL for ${path}:`, error.message);
    return '';
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: now + expiresIn * 1000
  });

  return data.signedUrl;
}

/**
 * Delete a photo
 */
export async function deleteChatPhoto(path) {
  if (!path) return;
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw error;
  }

  signedUrlCache.delete(path);
  if (decryptedBlobUrlCache.has(path)) {
    const url = decryptedBlobUrlCache.get(path);
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
    decryptedBlobUrlCache.delete(path);
  }
}
