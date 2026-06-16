import { db } from './db';
import ePub from 'epubjs';

export async function repairMissingCovers() {
  try {
    const booksWithoutCover = await db.books.filter(b => (!b.cover || b.cover === 'null') && b.fileBlob && b.type === 'ebook').toArray();
    if (booksWithoutCover.length === 0) return;

    console.log(`[Repair] Found ${booksWithoutCover.length} books missing covers. Attempting to restore...`);
    
    for (const book of booksWithoutCover) {
      try {
        const epub = ePub(book.fileBlob);
        await epub.ready;
        const coverUrl = await epub.coverUrl();
        if (coverUrl) {
          const response = await fetch(coverUrl);
          const blob = await response.blob();
          const coverBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          URL.revokeObjectURL(coverUrl);
          
          await db.books.update(book.id, { cover: coverBase64 });
          console.log(`[Repair] Successfully restored cover for "${book.title}"`);
        }
      } catch (err) {
        console.warn(`[Repair] Could not restore cover for "${book.title}"`, err);
      }
    }
  } catch (error) {
    console.error('[Repair] Failed to repair covers:', error);
  }
}
