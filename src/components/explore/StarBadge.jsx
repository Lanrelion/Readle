import { Star } from '@phosphor-icons/react';

export function StarBadge({ count, variant = 'spine' }) {
  const text = count > 99 ? '99+' : String(count);
  return (
    <i className={`star-badge star-badge--${variant}`} aria-hidden="true">
      <Star size={9} weight="fill" />{text}
    </i>
  );
}
