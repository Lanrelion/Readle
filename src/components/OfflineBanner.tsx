// src/components/OfflineBanner.tsx
import { useState, useEffect } from 'react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showBanner, setShowBanner] = useState(!isOnline);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "Back online" banner for 3 seconds
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className={`
        fixed top-0 left-0 right-0
        bg-moss text-white px-4 py-2
        text-center text-sm font-sans
        transition-all duration-300 ease-in-out
        z-50
        ${showBanner ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
      `}
    >
      {isOnline ? (
        <span>✓ Back online — syncing data</span>
      ) : (
        <span>⚠ Offline — reading locally from your device</span>
      )}
    </div>
  );
}
