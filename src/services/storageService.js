import { supabase } from './supabase';

const BUCKET_NAME = 'book_files';

/**
 * Uploads a book file (Blob) to Supabase Storage.
 * Uses the path `${userId}/${bookId}`.
 * 
 * @param {string} userId - The user's Supabase auth ID.
 * @param {string} bookId - The unique book ID.
 * @param {Blob} fileBlob - The actual EPUB or PDF file.
 * @returns {Promise<string|null>} - The public/signed URL or null if failed.
 */
export async function uploadBookFile(userId, bookId, fileBlob) {
  if (!userId || !bookId || !fileBlob) return null;

  try {
    const filePath = `${userId}/${bookId}`;
    
    // We use upsert so that if the file already exists, we replace it.
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBlob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('[Storage] Upload error:', error);
      throw error;
    }

    // Get the URL for the uploaded file. 
    // Even for private buckets, we can store the path in the database to know it exists.
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return urlData?.publicUrl || filePath;
  } catch (err) {
    console.error('[Storage] Failed to upload file:', err);
    return null;
  }
}

/**
 * Downloads a book file from Supabase Storage.
 * 
 * @param {string} userId - The user's Supabase auth ID.
 * @param {string} bookId - The unique book ID.
 * @returns {Promise<Blob|null>} - The file as a Blob, or null if failed.
 */
export async function downloadBookFile(userId, bookId) {
  if (!userId || !bookId) return null;

  try {
    const filePath = `${userId}/${bookId}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error) {
      console.error('[Storage] Download error:', error);
      throw error;
    }

    return data; // 'data' is the Blob
  } catch (err) {
    console.error('[Storage] Failed to download file:', err);
    return null;
  }
}

/**
 * Deletes a book file from Supabase Storage.
 * 
 * @param {string} userId - The user's Supabase auth ID.
 * @param {string} bookId - The unique book ID.
 * @returns {Promise<boolean>} - True if successful.
 */
export async function deleteBookFile(userId, bookId) {
  if (!userId || !bookId) return false;

  try {
    const filePath = `${userId}/${bookId}`;
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('[Storage] Delete error:', error);
      throw error;
    }

    return true;
  } catch (err) {
    console.error('[Storage] Failed to delete file:', err);
    return false;
  }
}
