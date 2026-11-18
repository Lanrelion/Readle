import { db } from '../services/db';
import { pushBook } from '../services/syncService';

const WITHDRAWN = { recommended: false, recommendedAt: null, recommendedSyncedAt: null };

export const canRecommend = (book) => (
  book?.status === 'completed'
  && (book.rating ?? 0) >= 4
  && book.type !== 'pdf'
  && !!book.title?.trim()
  && !!book.author?.trim()
);

// Stars are integers from 1 to 5, or null to clear the rating.
export async function setRating(book, stars) {
  if (stars !== null && (!Number.isInteger(stars) || stars < 1 || stars > 5)) {
    return { ok: false, reason: 'invalid_rating' };
  }

  const withdraws = stars === null || stars < 4;
  const patch = {
    rating: stars,
    ...(withdraws ? WITHDRAWN : {}),
    updatedAt: new Date().toISOString(),
    synced: 0,
  };
  await db.books.update(book.id, patch);
  const res = await pushBook({ ...book, ...patch });
  return { ...res, withdrew: withdraws && !!book.recommended };
}

// Pass the book as it is after any status change.
export async function setRecommended(book, value) {
  if (value && !canRecommend(book)) {
    return { ok: false, reason: 'ineligible' };
  }

  const patch = {
    ...(value
      ? { recommended: true, recommendedAt: new Date().toISOString() }
      : WITHDRAWN),
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
