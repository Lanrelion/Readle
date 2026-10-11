// Quote Card Color Adaptation for Light and Dark Modes
// Maps light paper tints to rich atmospheric dark card tones in dark mode

export const QUOTE_PALETTE = [
  { id: 'rice', color: '#F5F1E8', label: 'Rice Paper' },
  { id: 'blue', color: '#E3E9F1', label: 'Mist Blue' },
  { id: 'sage', color: '#E8F1E3', label: 'Sage' },
  { id: 'sakura', color: '#F1E3E8', label: 'Sakura' },
  { id: 'parchment', color: '#F1EBE3', label: 'Parchment' },
];

export function getQuoteTheme(color, isDark) {
  const c = (color || '#F5F1E8').trim().toUpperCase();

  if (isDark) {
    switch (c) {
      case '#E3E9F1': // Mist Blue -> Dark Indigo
        return {
          backgroundColor: '#1C232E',
          borderLeftColor: '#6B7E9C',
        };
      case '#E8F1E3': // Sage -> Dark Forest
        return {
          backgroundColor: '#1B241C',
          borderLeftColor: '#7E9675',
        };
      case '#F1E3E8': // Sakura -> Dark Plum
        return {
          backgroundColor: '#271D23',
          borderLeftColor: '#D8B7B0',
        };
      case '#F1EBE3': // Parchment -> Dark Sand/Clay
        return {
          backgroundColor: '#241F1A',
          borderLeftColor: '#B5957F',
        };
      case '#F5F1E8': // Rice Paper -> Dark Warm Sumi
      case '#EFE9DD':
      default:
        return {
          backgroundColor: '#221F1B',
          borderLeftColor: '#8A9A80',
        };
    }
  }

  // Light mode: delicate paper tints with earthy border accents
  switch (c) {
    case '#E3E9F1':
      return {
        backgroundColor: '#E3E9F1',
        borderLeftColor: '#4A5A73',
      };
    case '#E8F1E3':
      return {
        backgroundColor: '#E8F1E3',
        borderLeftColor: '#66785F',
      };
    case '#F1E3E8':
      return {
        backgroundColor: '#F1E3E8',
        borderLeftColor: '#8A6A55',
      };
    case '#F1EBE3':
      return {
        backgroundColor: '#F1EBE3',
        borderLeftColor: '#8A6A55',
      };
    case '#F5F1E8':
    case '#EFE9DD':
    default:
      return {
        backgroundColor: '#F5F1E8',
        borderLeftColor: '#66785F',
      };
  }
}
