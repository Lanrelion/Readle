import { useState } from 'react';
import { Check, Star } from '@phosphor-icons/react';
import { canRecommend, setRecommended } from '../utils/recommend';

export default function RecommendSection({ book }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!canRecommend(book)) return null;

  const recommended = !!book.recommended;
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await setRecommended(book, !recommended);
      setMessage(!recommended
        ? (result.ok ? 'Added to your recommendations.' : 'Saved on this device. It will publish when you are online and signed in.')
        : (result.ok ? 'Removed from your recommendations.' : 'Removed on this device. The change will publish when you are online and signed in.'));
    } catch (error) {
      console.error('[Recommend] Could not update recommendation:', error);
      setMessage('Could not save this change. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-t border-foreground-tertiary/15 pt-5" aria-labelledby="recommend-section-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 id="recommend-section-title" className="text-xs font-accent uppercase tracking-widest text-foreground-tertiary">Recommend this book</h3>
          <p className="mt-1 text-sm text-foreground-secondary">Share the books you think readers should discover.</p>
        </div>
        <button type="button" disabled={busy} onClick={toggle} aria-pressed={recommended} className={`inline-flex shrink-0 items-center gap-2 border px-4 py-2 text-sm transition disabled:opacity-60 ${recommended ? 'border-moss bg-moss/10 text-moss' : 'border-foreground-tertiary/30 text-foreground hover:bg-background-secondary'}`}>
          {recommended ? <Check size={16} /> : <Star size={16} />}
          {recommended ? 'Recommended' : 'Recommend'}
        </button>
      </div>
      {recommended && !book.recommendedSyncedAt && <p className="mt-3 text-xs text-foreground-tertiary">Saved on this device; it will publish when you’re online and signed in.</p>}
      {message && <p role="status" className="mt-3 text-xs text-foreground-secondary">{message}</p>}
    </section>
  );
}
