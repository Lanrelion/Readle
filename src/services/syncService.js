// src/services/syncService.js
import { supabase } from './supabase';
import { db } from './db';

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
    console.log('[Sync] Not signed in, skipping sync');
    return { uploaded: 0, failed: 0 };
  }

  const userId = session.user.id;
  let uploaded = 0;
  let failed = 0;

  // Sync deletions first
  await syncDeletionsToCloud();

  try {
    // Sync unsynced books (where synced is not 1, catching 0, undefined, or legacy records)
    const allLocalBooks = await db.books.toArray();
    const localBooks = allLocalBooks.filter(book => book.synced !== 1);
    
    for (const book of localBooks) {
      try {
        const bookData = {
          id: book.id,
          user_id: userId,
          type: book.type,
          title: book.title,
          author: book.author,
          isbn: book.isbn || null,
          status: book.status,
          cover: book.cover || null,
          progress: book.progress || null,
          date_added: book.dateAdded,
          date_completed: book.dateCompleted || null,
          metadata: book.metadata || null,
        };

        const { error } = await supabase.from('books').upsert(bookData);
        if (error) throw error;
        
        // Mark as synced locally
        await db.books.update(book.id, { synced: 1 });
        uploaded++;
      } catch (error) {
        console.error('[Sync] Failed to sync book:', book.title, error);
        failed++;
      }
    }

    // Sync unsynced quotes
    const allLocalQuotes = await db.quotes.toArray();
    const localQuotes = allLocalQuotes.filter(quote => quote.synced !== 1);
    
    for (const quote of localQuotes) {
      try {
        const quoteData = {
          id: quote.id,
          user_id: userId,
          book_id: quote.bookId,
          quote_text: quote.text || quote.quoteText, // handle text/quoteText mapping
          page_number: quote.pageNumber || null,
          personal_note: quote.personalNote || null,
          date_saved: quote.dateSaved,
        };

        const { error } = await supabase.from('quotes').upsert(quoteData);
        if (error) throw error;
        
        await db.quotes.update(quote.id, { synced: 1 });
        uploaded++;
      } catch (error) {
        console.error('[Sync] Failed to sync quote:', quote.id, error);
        failed++;
      }
    }

    // Sync progress
    const allLocalProgress = await db.ebookProgress.toArray();
    const localProgress = allLocalProgress.filter(progress => progress.synced !== 1);
    
    for (const progress of localProgress) {
      try {
        const progressData = {
          user_id: userId,
          book_id: progress.bookId,
          current_page: progress.currentPage || null,
          total_pages: progress.totalPages || null,
          percentage_read: progress.percentageRead || 0,
          last_read_date: progress.lastReadDate,
          total_read_time: progress.totalReadTime || 0,
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
    // Pull books
    const { data: cloudBooks, error: booksError } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId);

    if (booksError) throw booksError;

    // Delete local books that were deleted on other devices
    const cloudBookIds = new Set(cloudBooks?.map(b => b.id) || []);
    const localBooks = await db.books.toArray();
    for (const localBook of localBooks) {
      if (localBook.synced === 1 && !cloudBookIds.has(localBook.id)) {
        console.log('[Sync] Deleting book locally (deleted on other device):', localBook.title);
        await db.books.delete(localBook.id);
        await db.ebookProgress.delete(`${localBook.id}-progress`);
        
        // Also delete associated local quotes
        const bookQuotes = await db.quotes.where('bookId').equals(localBook.id).toArray();
        for (const q of bookQuotes) {
          await db.quotes.delete(q.id);
        }
      }
    }

    for (const book of cloudBooks || []) {
      try {
        const local = await db.books.get(book.id);
        const cloudNewer = local ? (new Date(book.updated_at) > new Date(local.updatedAt || local.dateAdded || 0)) : true;
        
        // If local doesn't exist, is already in sync, or cloud is newer: apply cloud changes
        if (!local || local.synced === 1 || cloudNewer) {
          await db.books.put({
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
            metadata: book.metadata,
            updatedAt: book.updated_at,
            synced: 1, // mark as clean
            // Preserve fileBlob if local book already has it
            fileBlob: local?.fileBlob || null
          });
          downloaded++;
        }
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
    const localQuotes = await db.quotes.toArray();
    for (const localQuote of localQuotes) {
      if (localQuote.synced === 1 && !cloudQuoteIds.has(localQuote.id)) {
        console.log('[Sync] Deleting quote locally (deleted on other device):', localQuote.id);
        await db.quotes.delete(localQuote.id);
      }
    }

    for (const quote of cloudQuotes || []) {
      try {
        const local = await db.quotes.get(quote.id);
        if (!local || local.synced === 1) {
          await db.quotes.put({
            id: quote.id,
            bookId: quote.book_id,
            text: quote.quote_text,
            quoteText: quote.quote_text, // keep both to prevent breaking anything
            pageNumber: quote.page_number,
            personalNote: quote.personal_note,
            dateSaved: quote.date_saved,
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
    const localProgresses = await db.ebookProgress.toArray();
    for (const localProgress of localProgresses) {
      if (localProgress.synced === 1 && !cloudProgressIds.has(localProgress.id)) {
        console.log('[Sync] Deleting progress locally (deleted on other device):', localProgress.id);
        await db.ebookProgress.delete(localProgress.id);
      }
    }

    for (const progress of cloudProgress || []) {
      try {
        const progressId = `${progress.book_id}-progress`;
        const local = await db.ebookProgress.get(progressId);
        const cloudNewer = local ? (new Date(progress.last_read_date) > new Date(local.lastReadDate || 0)) : true;

        if (!local || local.synced === 1 || cloudNewer) {
          await db.ebookProgress.put({
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
 * Full bidirectional sync (Safe Pull-then-Push Sequence)
 */
export async function fullSync() {
  console.log('[Sync] Starting full sync...');
  
  // First pull from cloud (to get latest from other devices)
  const downloadResult = await syncCloudToLocal();
  
  // Then push local changes (to save local edits)
  const uploadResult = await syncLocalToCloud();
  
  return {
    downloaded: downloadResult.downloaded,
    uploaded: uploadResult.uploaded,
    failed: downloadResult.failed + uploadResult.failed,
  };
}
