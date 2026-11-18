import { Star } from '@phosphor-icons/react';

export function StarRating({ value, onChange, size = 28, label = 'Your rating' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange(n)}
          className="p-1 transition-transform duration-150 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo"
        >
          <Star
            size={size}
            weight={value >= n ? 'fill' : 'thin'}
            className={value >= n ? 'text-gold' : 'text-foreground-tertiary'}
          />
        </button>
      ))}
    </div>
  );
}
