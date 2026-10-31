import { useRef, useLayoutEffect } from 'react';
import { gsap, prefersReducedMotion } from '../../utils/gsapSetup';

export function ShelfAmbient({ moteCount = 16, reduce = false }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (reduce || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.to('.light-shaft', { xPercent: 12, opacity: 0.85, duration: 14, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to('.light-shaft', {
        yPercent: -15, ease: 'none',
        scrollTrigger: { trigger: ref.current?.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
      gsap.utils.toArray('.mote').forEach((m) => {
        gsap.set(m, { left: gsap.utils.random(0, 100) + '%', top: gsap.utils.random(0, 100) + '%', scale: gsap.utils.random(0.6, 1.4), opacity: 0 });
        gsap.to(m, {
          y: gsap.utils.random(-80, -30), x: gsap.utils.random(-30, 30), opacity: gsap.utils.random(0.15, 0.4),
          duration: gsap.utils.random(6, 12), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: gsap.utils.random(0, 6),
        });
      });
    }, ref);
    return () => ctx.revert();
  }, [moteCount, reduce]);

  if (reduce) return null;

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div className="light-shaft" />
      {Array.from({ length: moteCount }, (_, i) => <i key={i} className="mote" />)}
    </div>
  );
}

