import Dexie from 'dexie';

export const db = new Dexie('BookTrackDB');

db.version(1).stores({
  books: 'id, type, title, author, status, dateAdded',
  quotes: 'id, bookId, dateSaved',
  ebookProgress: 'id, bookId'
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
      metadata: { totalPages: 688, language: 'en' }
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
      dateCompleted: '2025-05-05T18:00:00Z'
    },
    {
      id: crypto.randomUUID(),
      type: 'ebook',
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      isbn: '978-0593135204',
      status: 'wantToRead',
      cover: 'https://m.media-amazon.com/images/I/51A31LozjPL._SY445_SX342_.jpg',
      progress: { type: 'percentage', value: 0 },
      dateAdded: new Date().toISOString(),
      dateCompleted: null
    }
  ]);
};

