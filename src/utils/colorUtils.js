// src/utils/colorUtils.js

/**
 * Returns a deterministic accent colour hex string from a title string.
 * @param {string} title 
 * @returns {string} Hex color
 */
export function titleToColor(title) {
  const colors = ['#66785F', '#8A6A55', '#4A5A73', '#C7A96B', '#5E574E'];
  let hash = 0;
  const safeTitle = title || '';
  for (let i = 0; i < safeTitle.length; i++) {
    hash = safeTitle.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

