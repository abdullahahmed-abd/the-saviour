import { supabase } from './supabase';
import { compressImage } from '../utils/imageCompressor';

const BUCKET_NAME = 'chat-photos';
const signedUrlCache = new Map(); // path -> { url, expiresAt }

/**
 * Upload a private photo to Supabase Storage
 */
export async function uploadChatPhoto(file, chatId, userId) {
  if (!file) throw new Error('No file provided');

  // Check initial file size limit (5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image exceeds 5MB limit. Please select a smaller photo.');
  }

  // Compress photo locally
  const processedFile = await compressImage(file);

  const fileExt = processedFile.name.split('.').pop() || 'webp';
  const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `photos/${chatId}/${userId}/${cleanFileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, processedFile, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(error.message || 'Failed to upload photo.');
  }

  // Pre-generate signed URL
  const signedUrl = await getSignedPhotoUrl(data.path);

  return {
    path: data.path,
    signedUrl,
    size: processedFile.size,
    type: processedFile.type
  };
}

/**
 * Retrieve short-lived signed URL for a private photo path.
 * Cached in memory so we do not spam Supabase API for the same image.
 */
export async function getSignedPhotoUrl(path, expiresIn = 3600) {
  if (!path) return '';

  const cached = signedUrlCache.get(path);
  const now = Date.now();
  // If cached and more than 5 minutes remain before expiry, reuse
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
 * Delete a private photo
 */
export async function deleteChatPhoto(path) {
  if (!path) return;
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    console.error('Failed to delete photo:', error);
    throw error;
  }

  signedUrlCache.delete(path);
}
