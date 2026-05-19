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

export const seedMockData = async () => {
  const count = await db.books.count();
  if (count > 0) return;

  await db.books.bulkAdd([
    {
      id: crypto.randomUUID(),
      type: 'ebook',
      title: 'Dune',
      author: 'Frank Herbert',
      isbn: '978-0-441-13597-7',
      status: 'reading',
      cover: 'https://m.media-amazon.com/images/I/41D-A14y7GL._SY445_SX342_.jpg',
      progress: { type: 'percentage', value: 45 },
      dateAdded: new Date().toISOString(),
      dateCompleted: null,
      metadata: { totalPages: 688, language: 'en' },
      updatedAt: new Date().toISOString(),
      synced: 0
    },
    {
      id: crypto.randomUUID(),
      type: 'physical',
      title: 'The Hobbit',
      author: 'J.R.R. Tolkien',
      isbn: '978-0-547-92822-8',
      status: 'completed',
      cover: 'https://m.media-amazon.com/images/I/41E9bHj1VKL._SY445_SX342_.jpg',
      progress: { type: 'pages', value: '310/310' },
      dateAdded: '2025-04-15T14:30:00Z',
      dateCompleted: '2025-05-05T18:00:00Z',
      updatedAt: '2025-05-05T18:00:00Z',
      synced: 0
    },
    {
      id: crypto.randomUUID(),
      type: 'pdf',
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      isbn: '978-0593135204',
      status: 'wantToRead',
      cover: 'https://m.media-amazon.com/images/I/51A31LozjPL._SY445_SX342_.jpg',
      progress: { type: 'percentage', value: 0 },
      dateAdded: new Date().toISOString(),
      dateCompleted: null,
      updatedAt: new Date().toISOString(),
      synced: 0
    }
  ]);
};

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


