const PALETTE = ['#66785F', '#8A6A55', '#4A5A73', '#C7A96B', '#5E574E'];

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) =>
    Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? 255 - c : c) * amt)));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export const norm = (s) => (s || '').trim().toLowerCase();

export function bookArt(title, author) {
  const seed = hashString(`${norm(title)}|${norm(author)}`);
  const base = PALETTE[seed % PALETTE.length];
  return {
    color: shade(base, (((seed >>> 5) % 5) - 2) * 0.05),
    ink: base === '#C7A96B' ? '#1D1B18' : '#F5F1E8',
    height: 150 + ((seed >>> 3) % 60),   // 150 to 209
    width: 34 + ((seed >>> 9) % 26),     // 34 to 59
    ornament: (seed >>> 13) % 4,         // 0 none, 1 bands, 2 double rule, 3 diamond
    leans: (seed >>> 17) % 9 === 0,
  };
}

