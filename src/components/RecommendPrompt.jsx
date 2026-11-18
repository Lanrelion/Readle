import { useEffect, useRef, useState } from 'react';
import { gsap, prefersReducedMotion } from '../utils/gsapSetup';
import { supabase } from '../services/supabase';
import { setRating, setRecommended } from '../utils/recommend';
import { StarRating } from './StarRating';

export function RecommendPrompt({ book, onClose }) {
  const [stage, setStage] = useState('rate');
  const [stars, setStars] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const backdrop = useRef(null);
  const panel = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) setSignedIn(!!data.session); })
      .catch(() => {});

    const backdropElement = backdrop.current;
    const panelElement = panel.current;
    if (!prefersReducedMotion()) {
      gsap.fromTo(backdropElement, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      gsap.fromTo(panelElement, { opacity: 0, scale: 0.94, y: 16 }, {
        opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'power3.out',
      });
    }

    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      gsap.killTweensOf([backdropElement, panelElement]);
    };
  }, []);

  const pick = async (value) => {
    setStars(value);
    await setRating(book, value);
    if (value >= 4) {
      setStage('ask');
    } else {
      setStage('saved');
      timerRef.current = setTimeout(onClose, 1600);
    }
  };

  const recommend = async () => {
    const result = await setRecommended({ ...book, rating: stars }, true);
    setStage(result.ok ? 'shared' : 'pending');
    timerRef.current = setTimeout(onClose, 2000);
  };

  const showingRating = stage === 'rate' || stage === 'ask';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Rate this book">
      <button ref={backdrop} type="button" aria-label="Close rating prompt" onClick={onClose} className="absolute inset-0 cursor-default bg-foreground/30 backdrop-blur-[4px]" />
      <section ref={panel} className="relative w-full space-y-4 bg-background-secondary p-8 text-foreground md:max-w-md">
        <p className="plaque">Finished</p>
        <h2 className="font-serif text-2xl font-normal">{book.title}</h2>

        {showingRating && (
          <>
            <p className="text-sm text-foreground-secondary">{stage === 'rate' ? 'How was it?' : 'Your rating'}</p>
            <StarRating value={stars ?? 0} onChange={pick} />
          </>
        )}

        {stage === 'rate' && (
          <button type="button" onClick={onClose} className="text-sm text-foreground-tertiary hover:text-foreground">Skip</button>
        )}

        {stage === 'ask' && (
          <>
            <h3 className="pt-2 font-serif text-lg font-normal">Would you recommend this book?</h3>
            <p className="text-sm leading-relaxed text-foreground-secondary">We share the title and author with other readers. Never your name or your rating.</p>
            {!signedIn && <p className="text-xs text-foreground-tertiary">You are not signed in. It will be shared once you sign in.</p>}
            <div className="flex items-center gap-4 pt-2">
              <button type="button" onClick={recommend} className="bg-indigo px-6 py-3 text-sm text-white transition hover:bg-clay">Recommend it</button>
              <button type="button" onClick={onClose} className="text-sm text-foreground-tertiary hover:text-foreground">Maybe later</button>
            </div>
          </>
        )}

        {stage === 'saved' && <p role="status" className="text-sm text-foreground-secondary">Rating saved.</p>}
        {stage === 'shared' && <p role="status" className="text-sm text-foreground-secondary">Recommended. Other readers can now find it in Explore.</p>}
        {stage === 'pending' && <p role="status" className="text-sm text-foreground-secondary">Saved. It will be shared once you are signed in and online.</p>}
      </section>
    </div>
  );
}
