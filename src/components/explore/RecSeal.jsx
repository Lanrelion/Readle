import { Star } from '@phosphor-icons/react';

export function RecSeal({ count, variant = 'spine' }) {
  const text = count > 99 ? '99+' : String(count);
  return (
    <span className={`rec-seal rec-seal--${variant}`} aria-hidden="true">
      <Star className="rec-seal__star" weight="fill" />
      <span>{text}</span>
    </span>
  );
}
