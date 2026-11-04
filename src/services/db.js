import Dexie from 'dexie';

export const db = new Dexie('BookTrackDB');

db.version(1).stores({
  books: 'id, type, title, author, status, dateAdded',
  quotes: 'id, bookId, dateSaved',
  ebookProgress: 'id, bookId'
});

db.version(2).stores({
  books: 'id, type, title, author, status, dateAdded',
  quotes: 'id, bookId, dateSaved',
  ebookProgress: 'id, bookId',
  deletedRecords: 'id, type'
});

db.version(3).stores({
  books: 'id, type, title, author, status, dateAdded, synced',
  quotes: 'id, bookId, dateSaved, synced',
  ebookProgress: 'id, bookId, synced',
  deletedRecords: 'id, type'
});

// [Bug 8] Request persistent storage to prevent browser from silently evicting IndexedDB
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    if (granted) {
      console.log('[DB] Persistent storage granted — data will not be auto-evicted');
    } else {
      console.info('[DB] Persistent storage denied; using browser-managed IndexedDB storage');
    }
  });
}

// No seeder. New users start with an empty library.
// The empty state is handled by LibraryDashboard's empty state UI.

// Add helper to save PDF progress
export async function savePDFProgress(bookId, currentPage, totalPages) {
  if (!bookId || !currentPage || !totalPages) return;
  const percentage = Math.round((currentPage / totalPages) * 100);
  
  await db.ebookProgress.put({
    id: `${bookId}-progress`,
    bookId,
    currentPage, // PDF page number
    totalPages, // Total PDF pages
    percentageRead: percentage,
    lastReadDate: new Date().toISOString(),
    synced: 0,
  });
  
  // Also update book progress in books store
  await db.books.update(bookId, {
    progress: {
      type: 'pages',
      value: `${currentPage}/${totalPages}`,
    },
    updatedAt: new Date().toISOString(),
    synced: 0,
  });
}

// Add helper to load PDF progress
export async function loadPDFProgress(bookId) {
  if (!bookId) return 1;
  const progress = await db.ebookProgress.get(`${bookId}-progress`);
  return progress?.currentPage || 1; // Default to page 1
}

// Add helpers to log deletions for background synchronization
export async function deleteBook(id) {
  // Cascade delete quotes locally
  const bookQuotes = await db.quotes.where('bookId').equals(id).toArray();
  for (const q of bookQuotes) {
    await db.quotes.delete(q.id);
    await db.deletedRecords.put({ id: q.id, type: 'quote' });
  }
  
  // Delete progress
  await db.ebookProgress.delete(`${id}-progress`);
  await db.deletedRecords.put({ id: `${id}-progress`, type: 'progress' });

  // Delete book
  await db.books.delete(id);
  await db.deletedRecords.put({ id, type: 'book' });
}

export async function deleteQuote(id) {
  await db.quotes.delete(id);
  await db.deletedRecords.put({ id, type: 'quote' });
}

// Preserve only local file/cover payloads while signed out. Cloud sync restores
// the complete metadata before these placeholders are shown in the library.
export async function clearLocalDatabase() {
  await db.transaction('rw', db.books, db.quotes, db.ebookProgress, db.deletedRecords, async () => {
    const allBooks = await db.books.toArray();
    const skeletons = allBooks
      .filter(book => book.fileBlob || book.cover)
      .map(book => ({
        id: book.id,
        _skeletonOnly: true,
        synced: 1,
        ...(book.fileBlob ? { fileBlob: book.fileBlob } : {}),
        ...(book.cover ? { cover: book.cover } : {}),
      }));

    // One transaction prevents an interrupted sign-out from leaving a mixture
    // of full records and placeholders that the next cloud pull cannot merge.
    await db.books.clear();
    if (skeletons.length) await db.books.bulkPut(skeletons);
    await db.quotes.clear();
    await db.ebookProgress.clear();
    await db.deletedRecords.clear();
  });
}

// Helper to save progress for ANY book type (physical, ebook, pdf)
export async function saveBookProgress(bookId, progressData) {
  if (!bookId) return;

  const { currentPage, totalPages, percentageRead } = progressData;

  await db.ebookProgress.put({
    id: `${bookId}-progress`,
    bookId,
    currentPage: currentPage ?? null,
    totalPages: totalPages ?? null,
    percentageRead: percentageRead ?? 0,
    lastReadDate: new Date().toISOString(),
    synced: 0,
  });
}

// One-time cleanup: remove seed books from local IndexedDB
export async function removeSeedBooks() {
  const seedTitles = ['Dune', 'The Hobbit', 'Project Hail Mary'];
  const seedAuthors = ['Frank Herbert', 'J.R.R. Tolkien', 'Andy Weir'];
  
  const booksToDelete = await db.books
    .filter(book => 
      seedTitles.includes(book.title) && 
      seedAuthors.includes(book.author)
    )
    .toArray();
  
  if (booksToDelete.length > 0) {
    const ids = booksToDelete.map(b => b.id);
    await db.books.bulkDelete(ids);
    console.log('[DB] Removed', booksToDelete.length, 'seed books');
  }
}
