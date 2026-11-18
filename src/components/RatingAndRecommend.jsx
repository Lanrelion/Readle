import { useState } from 'react';
import { StarRating } from './StarRating';
import { canRecommend, setRating, setRecommended } from '../utils/recommend';

export function RatingAndRecommend({ book }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const rated4 = (book.rating ?? 0) >= 4;
  const shared = book.recommended && book.recommendedSyncedAt;
  const pending = book.recommended && !book.recommendedSyncedAt;

  const rate = async (stars) => {
    setNote('');
    try {
      const result = await setRating(book, stars);
      if (result.withdrew) {
        setNote(stars === null
          ? 'Rating cleared, so it is no longer recommended.'
          : 'Rated below 4, so it is no longer recommended.');
      }
    } catch (error) {
      console.error('[Rating] Could not save rating:', error);
      setNote('Could not save this rating. Please try again.');
    }
  };

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const result = await setRecommended(book, !book.recommended);
      if (!result.ok && result.reason !== 'ineligible') {
        setNote(book.recommended
          ? 'Offline. It will leave Explore when you are back online.'
          : 'Saved. It will be shared once you are signed in and online.');
      }
    } catch (error) {
      console.error('[Recommend] Could not update recommendation:', error);
      setNote('Could not save this change. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="plaque">Your rating</p>
        <StarRating value={book.rating ?? 0} onChange={rate} size={24} />
        {book.rating != null && <button type="button" onClick={() => rate(null)} className="text-xs text-foreground-tertiary hover:text-foreground">Clear rating</button>}
        <p className="text-xs text-foreground-tertiary">Only you can see your rating.</p>
      </div>

      {book.type !== 'pdf' && (
        <div className="space-y-2">
          <p className="plaque">Recommend</p>
          {rated4 ? (
            <>
              <p className="text-sm text-foreground-secondary">
                {shared && 'Recommended. Other readers can find it in Explore.'}
                {pending && 'Recommended. Will be shared once you are signed in and online.'}
                {!book.recommended && 'Would you recommend this book? We share the title and author. Never your name or your rating.'}
              </p>
              <button type="button" onClick={toggle} disabled={busy || !canRecommend(book)} className={`border px-4 py-2 text-sm transition disabled:opacity-60 ${book.recommended ? 'border-foreground-tertiary/30 text-foreground-secondary hover:border-foreground' : 'border-indigo bg-indigo text-white hover:border-clay hover:bg-clay'}`}>
                {book.recommended ? 'Withdraw recommendation' : 'Recommend it'}
              </button>
            </>
          ) : (
            <p className="text-xs text-foreground-tertiary">Rate a book 4 or 5 stars to recommend it.</p>
          )}
          {note && <p role="status" className="text-xs text-foreground-tertiary">{note}</p>}
        </div>
      )}
    </div>
  );
}
