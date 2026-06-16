// src/services/syncService.js
import { supabase } from './supabase';
import { db } from './db';
import { uploadBookFile, downloadBookFile, deleteBookFile } from './storageService';

// ── Sync Mutex ──────────────────────────────────────────────────────────────
// Prevents concurrent fullSync() calls from racing against each other.
let isSyncing = false;

/**
 * Sync deletions to Supabase
 */
export async function syncDeletionsToCloud() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const deletedList = await db.deletedRecords.toArray();
  for (const item of deletedList) {
    try {
      if (item.type === 'book') {
        // Also attempt to delete the file from Storage. 
        // We don't throw if this fails, because the file might already be gone.
        await deleteBookFile(session.user.id, item.id);

        const { error } = await supabase.from('books').delete().eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'quote') {
        const { error } = await supabase.from('quotes').delete().eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'progress') {
        // progress id is bookId-progress, extract bookId
        const bookId = item.id.replace('-progress', '');
        const { error } = await supabase.from('ebook_progress').delete().eq('book_id', bookId);
        if (error) throw error;
      }
      // Successfully synced deletion, clean up tombstone
      await db.deletedRecords.delete(item.id);
    } catch (error) {
      console.error('[Sync] Failed to sync deletion for:', item.id, error);
    }
  }
}

/**
 * Sync all local changes (unsynced items) to Supabase
 * @returns {Promise<{uploaded: number, failed: number}>}
 */
export async function syncLocalToCloud() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.log('[Sync] No session found. User must be signed in to sync.');
    return { uploaded: 0, failed: 0 };
  }

  const userId = session.user.id;
  console.log('[Sync] Syncing as user:', session.user.email);

  let uploaded = 0;
  let failed = 0;

  // Sync deletions first
  await syncDeletionsToCloud();

  try {
    // Sync unsynced books (where synced is not 1, catching 0, undefined, or legacy records)
    const localBooks = await db.books.filter(book => book.synced !== 1).toArray();
    
    for (const book of localBooks) {
      try {
        // [Bug 3] Strip base64 covers — they can be enormous and cause upsert timeouts.
        // Cloud should only store URL covers; local IndexedDB retains the full cover.
        const cloudCover = (book.cover && book.cover.startsWith('data:')) ? null : (book.cover || null);

        // Upload file to Supabase Storage if local fileBlob exists but no file_url is present
        let fileUrl = book.file_url || null; // Might be undefined on older records
        if (book.fileBlob && !fileUrl) {
          console.log(`[Sync] Uploading file for book ${book.id}...`);
          const uploadedUrl = await uploadBookFile(userId, book.id, book.fileBlob);
          if (uploadedUrl) {
            fileUrl = uploadedUrl;
          }
        }

        const bookData = {
          id: book.id,
          user_id: userId,
          type: book.type,
          title: book.title,
          author: book.author,
          isbn: book.isbn || null,
          status: book.status,
          cover: cloudCover,
          progress: book.progress || null,
          date_added: book.dateAdded,
          date_completed: book.dateCompleted || null,
          file_url: fileUrl,
          metadata: book.metadata || null,
          notes: book.notes || null, // Add notes field
          // [Bug 4] Include updated_at so cloud and local timestamps stay aligned
          updated_at: book.updatedAt || new Date().toISOString(),
        };

        const { error } = await supabase.from('books').upsert(bookData, { onConflict: 'id' });
        if (error) {
          console.error('[Sync] Supabase error for book:', book.title, {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          failed++;
          continue;
        }
        
        // Mark as synced locally and update file_url
        await db.books.update(book.id, { synced: 1, file_url: fileUrl });
        uploaded++;
        console.log('[Sync] ✓ Synced book:', book.title);
      } catch (error) {
        console.error('[Sync] Unexpected error:', error);
        failed++;
      }
    }

    // Sync unsynced quotes
    const localQuotes = await db.quotes.filter(quote => quote.synced !== 1).toArray();
    
    for (const quote of localQuotes) {
      try {
        const quoteData = {
          id: quote.id,
          user_id: userId,
          book_id: quote.bookId,
          quote_text: quote.text || quote.quoteText, // handle text/quoteText mapping
          page_number: quote.pageNumber ?? null, // [Bug 6] nullish coalescing
          personal_note: quote.personalNote || null,
          date_saved: quote.dateSaved,
          // [Bug 5] Include color and cfi fields for cross-device sync
          color: quote.color || null,
          cfi: quote.cfi || null,
        };

        const { error } = await supabase.from('quotes').upsert(quoteData, { onConflict: 'id' });
        if (error) {
          console.error('[Sync] Supabase error for quote:', {
            code: error.code,
            message: error.message,
          });
          failed++;
          continue;
        }
        
        await db.quotes.update(quote.id, { synced: 1 });
        uploaded++;
      } catch (error) {
        console.error('[Sync] Quote sync error:', error);
        failed++;
      }
    }

    // Sync progress
    const localProgress = await db.ebookProgress.filter(progress => progress.synced !== 1).toArray();
    
    for (const progress of localProgress) {
      try {
        const progressData = {
          user_id: userId,
          book_id: progress.bookId,
          current_page: progress.currentPage ?? null,   // [Bug 6] nullish coalescing
          total_pages: progress.totalPages ?? null,      // [Bug 6]
          percentage_read: progress.percentageRead ?? 0, // [Bug 6]
          last_read_date: progress.lastReadDate,
          total_read_time: progress.totalReadTime ?? 0,  // [Bug 6]
        };

        const { error } = await supabase.from('ebook_progress').upsert(progressData, { onConflict: 'user_id,book_id' });
        if (error) throw error;
        
        await db.ebookProgress.update(progress.id, { synced: 1 });
        uploaded++;
      } catch (error) {
        console.error('[Sync] Failed to sync progress:', error);
        failed++;
      }
    }

    console.log(`[Sync] Uploaded ${uploaded} items, ${failed} failed`);
    return { uploaded, failed };
  } catch (error) {
    console.error('[Sync] Sync to cloud failed:', error);
    return { uploaded, failed };
  }
}

/**
 * Pull data from Supabase to local IndexedDB (Last-Write-Wins Conflict Resolution)
 * @returns {Promise<{downloaded: number, failed: number}>}
 */
export async function syncCloudToLocal() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.log('[Sync] Not signed in, skipping sync');
    return { downloaded: 0, failed: 0 };
  }

  const userId = session.user.id;
  let downloaded = 0;
  let failed = 0;

  try {
    // Load local tombstones to prevent resurrecting deleted items
    const deletedRecords = await db.deletedRecords.toArray();
    const deletedBookIds = new Set(deletedRecords.filter(r => r.type === 'book').map(r => r.id));
    const deletedQuoteIds = new Set(deletedRecords.filter(r => r.type === 'quote').map(r => r.id));
    const deletedProgressIds = new Set(deletedRecords.filter(r => r.type === 'progress').map(r => r.id));

    // Pull books
    const { data: cloudBooks, error: booksError } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId);

    if (booksError) throw booksError;

    // Delete local books that were deleted on other devices
    const cloudBookIds = new Set(cloudBooks?.map(b => b.id) || []);
    const localSyncedBookIds = await db.books.filter(b => b.synced === 1).primaryKeys();
    for (const localId of localSyncedBookIds) {
      if (!cloudBookIds.has(localId)) {
        console.log('[Sync] Deleting book locally (deleted on other device):', localId);
        await db.books.delete(localId);
        await db.ebookProgress.delete(`${localId}-progress`);
        
        // Also delete associated local quotes
        const bookQuoteIds = await db.quotes.where('bookId').equals(localId).primaryKeys();
        for (const qId of bookQuoteIds) {
          await db.quotes.delete(qId);
        }
      }
    }

    for (const book of cloudBooks || []) {
      try {
        if (deletedBookIds.has(book.id)) continue;

        const local = await db.books.get(book.id);
        const cloudNewer = local ? (new Date(book.updated_at) > new Date(local.updatedAt || local.dateAdded || 0)) : true;
        
        if (!local) {
          // [Bug 1] New book from cloud — use add() since there's no local record
          
          let downloadedBlob = null;
          if (book.file_url) {
            console.log(`[Sync] Downloading file for new book ${book.id}...`);
            downloadedBlob = await downloadBookFile(userId, book.id);
          }

          await db.books.add({
            id: book.id,
            type: book.type,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            status: book.status,
            cover: book.cover,
            progress: book.progress,
            dateAdded: book.date_added,
            dateCompleted: book.date_completed,
            file_url: book.file_url,
            metadata: book.metadata,
            notes: book.notes,
            updatedAt: book.updated_at,
            synced: 1,
            fileBlob: downloadedBlob // Will be Blob or null
          });
          downloaded++;
        } else if (local.synced === 1) {
          // Check if we need to download the file (it exists in cloud but not locally)
          let downloadedBlob = local.fileBlob;
          if (book.file_url && !local.fileBlob) {
            console.log(`[Sync] Downloading missing file for existing book ${book.id}...`);
            const fetchedBlob = await downloadBookFile(userId, book.id);
            if (fetchedBlob) {
              downloadedBlob = fetchedBlob;
            }
          }

          if (cloudNewer || downloadedBlob !== local.fileBlob) {
            // [Bug 1] Existing book — use update() to only modify metadata fields.
            // This preserves fileBlob and any other local-only fields automatically.
            await db.books.update(book.id, {
              type: book.type,
              title: book.title,
              author: book.author,
              isbn: book.isbn,
              status: book.status,
              // Only update cover from cloud if cloud has one, otherwise keep local
              cover: book.cover || local.cover,
              progress: book.progress,
              dateAdded: book.date_added,
              dateCompleted: book.date_completed,
              file_url: book.file_url,
              metadata: book.metadata,
              notes: book.notes,
              updatedAt: book.updated_at,
              synced: 1,
              fileBlob: downloadedBlob
            });
            downloaded++;
          }
        }
        // If local has pending offline edits (synced !== 1), skip — syncLocalToCloud will push them
      } catch (error) {
        console.error('[Sync] Failed to save book locally:', error);
        failed++;
      }
    }

    // Pull quotes
    const { data: cloudQuotes, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', userId);

    if (quotesError) throw quotesError;

    // Delete local quotes that were deleted on other devices
    const cloudQuoteIds = new Set(cloudQuotes?.map(q => q.id) || []);
    const localSyncedQuoteIds = await db.quotes.filter(q => q.synced === 1).primaryKeys();
    for (const localQuoteId of localSyncedQuoteIds) {
      if (!cloudQuoteIds.has(localQuoteId)) {
        console.log('[Sync] Deleting quote locally (deleted on other device):', localQuoteId);
        await db.quotes.delete(localQuoteId);
      }
    }

    for (const quote of cloudQuotes || []) {
      try {
        if (deletedQuoteIds.has(quote.id)) continue;

        const local = await db.quotes.get(quote.id);
        if (!local) {
          // New quote from cloud
          await db.quotes.add({
            id: quote.id,
            bookId: quote.book_id,
            text: quote.quote_text,
            quoteText: quote.quote_text, // keep both to prevent breaking anything
            pageNumber: quote.page_number,
            personalNote: quote.personal_note,
            dateSaved: quote.date_saved,
            // [Bug 5] Restore color and cfi from cloud
            color: quote.color || null,
            cfi: quote.cfi || null,
            synced: 1
          });
          downloaded++;
        } else if (local.synced === 1) {
          // Existing synced quote — update metadata
          await db.quotes.update(quote.id, {
            bookId: quote.book_id,
            text: quote.quote_text,
            quoteText: quote.quote_text,
            pageNumber: quote.page_number,
            personalNote: quote.personal_note,
            dateSaved: quote.date_saved,
            // [Bug 5] Restore color and cfi from cloud
            color: quote.color || local.color || null,
            cfi: quote.cfi || local.cfi || null,
            synced: 1
          });
          downloaded++;
        }
      } catch (error) {
        console.error('[Sync] Failed to save quote locally:', error);
        failed++;
      }
    }

    // Pull progress
    const { data: cloudProgress, error: progressError } = await supabase
      .from('ebook_progress')
      .select('*')
      .eq('user_id', userId);

    if (progressError) throw progressError;

    // Delete local progresses that were deleted on other devices
    const cloudProgressIds = new Set(cloudProgress?.map(p => `${p.book_id}-progress`) || []);
    const localSyncedProgressIds = await db.ebookProgress.filter(p => p.synced === 1).primaryKeys();
    for (const localProgressId of localSyncedProgressIds) {
      if (!cloudProgressIds.has(localProgressId)) {
        console.log('[Sync] Deleting progress locally (deleted on other device):', localProgressId);
        await db.ebookProgress.delete(localProgressId);
      }
    }

    for (const progress of cloudProgress || []) {
      try {
        const progressId = `${progress.book_id}-progress`;
        if (deletedProgressIds.has(progressId)) continue;

        const local = await db.ebookProgress.get(progressId);
        const cloudNewer = local ? (new Date(progress.last_read_date) > new Date(local.lastReadDate || 0)) : true;

        if (!local) {
          await db.ebookProgress.add({
            id: progressId,
            bookId: progress.book_id,
            currentPage: progress.current_page,
            totalPages: progress.total_pages,
            percentageRead: progress.percentage_read,
            lastReadDate: progress.last_read_date,
            totalReadTime: progress.total_read_time,
            synced: 1
          });
          downloaded++;
        } else if (local.synced === 1 && cloudNewer) {
          await db.ebookProgress.update(progressId, {
            bookId: progress.book_id,
            currentPage: progress.current_page,
            totalPages: progress.total_pages,
            percentageRead: progress.percentage_read,
            lastReadDate: progress.last_read_date,
            totalReadTime: progress.total_read_time,
            synced: 1
          });
          downloaded++;
        }
      } catch (error) {
        console.error('[Sync] Failed to save progress locally:', error);
        failed++;
      }
    }

    console.log(`[Sync] Downloaded ${downloaded} items, ${failed} failed`);
    return { downloaded, failed };
  } catch (error) {
    console.error('[Sync] Sync from cloud failed:', error);
    return { downloaded, failed };
  }
}

/**
 * Full bidirectional sync (Push-then-Pull Sequence)
 * [Bug 2] Protected by a mutex to prevent concurrent sync operations.
 */
export async function fullSync() {
  // If already syncing, skip to avoid race conditions
  if (isSyncing) {
    console.log('[Sync] Sync already in progress, skipping...');
    return { downloaded: 0, uploaded: 0, failed: 0 };
  }

  isSyncing = true;
  console.log('[Sync] Starting full sync...');
  
  try {
    // First push local changes (Local-to-Cloud priority for offline edits)
    const uploadResult = await syncLocalToCloud();

    // Then pull from cloud to get updates from other devices
    const downloadResult = await syncCloudToLocal();
    
    return {
      downloaded: downloadResult.downloaded,
      uploaded: uploadResult.uploaded,
      failed: downloadResult.failed + uploadResult.failed,
    };
  } finally {
    isSyncing = false;
  }
}
