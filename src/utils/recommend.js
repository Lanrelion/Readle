import { db } from '../services/db';
import { pushBook } from '../services/syncService';

export const canRecommend = (book) => (
  book?.status === 'completed'
  && book.type !== 'pdf'
  && !!book.title?.trim()
  && !!book.author?.trim()
);

// Pass the book as it is after any status change.
export async function setRecommended(book, value) {
  if (value && !canRecommend(book)) {
    return { ok: false, reason: 'not_recommendable' };
  }

  const patch = {
    ...(value
      ? { recommended: true, recommendedAt: new Date().toISOString() }
      : { recommended: false, recommendedAt: null, recommendedSyncedAt: null }),
    updatedAt: new Date().toISOString(),
    synced: 0,
  };
  await db.books.update(book.id, patch);
  const res = await pushBook({ ...book, ...patch });
  if (res.ok && value) {
    await db.books.update(book.id, { recommendedSyncedAt: new Date().toISOString() });
  }
  return res;
}

export const recommendPatchForStatus = (newStatus) => (
  newStatus === 'completed'
    ? {}
    : { recommended: false, recommendedAt: null, recommendedSyncedAt: null }
);
