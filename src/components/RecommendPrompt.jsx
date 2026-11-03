import { useEffect, useRef, useState } from 'react';
import { Check, X } from '@phosphor-icons/react';
import gsap from 'gsap';
import { supabase } from '../services/supabase';
import { setRecommended } from '../utils/recommend';

export default function RecommendPrompt({ book, onClose }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const panelRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (alive) setSignedIn(!!session);
    }).catch(() => {});
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const panel = panelRef.current;
    if (!reduce && panel) {
      gsap.fromTo(panel, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (panel) gsap.killTweensOf(panel);
    };
  }, []);

  const recommend = async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = await setRecommended(book, true);
      setSyncPending(!result.ok);
      setSaved(true);
      timerRef.current = setTimeout(onClose, 2000);
    } catch (error) {
      console.error('[Recommend] Could not save recommendation locally:', error);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="recommend-title" className="relative w-full max-w-md border border-foreground-tertiary/20 bg-background p-7 text-foreground shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 p-2 text-foreground-tertiary hover:text-foreground"><X size={18} /></button>
        {saved ? (
          <div className="py-5 text-center"><Check size={30} className="mx-auto mb-3 text-moss" /><h2 id="recommend-title" className="font-serif text-2xl">Saved.</h2><p className="mt-2 text-sm text-foreground-secondary">{signedIn && !syncPending ? 'Your recommendation is saved.' : `Your choice is saved on this device and will publish ${signedIn ? 'when the connection returns.' : 'when you sign in.'}`}</p></div>
        ) : (
          <>
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-foreground-tertiary">Finished reading</p>
            <h2 id="recommend-title" className="font-serif text-2xl">Would you recommend this book?</h2>
            <p className="mt-2 text-sm text-foreground-secondary">{book.title}</p>
            <div className="mt-7 flex gap-3">
              <button type="button" disabled={pending} onClick={recommend} className="flex-1 bg-moss px-4 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60">{pending ? 'Saving…' : 'Recommend it'}</button>
              <button type="button" onClick={onClose} className="border border-foreground-tertiary/30 px-4 py-3 text-sm text-foreground-secondary hover:bg-background-secondary">Maybe later</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
