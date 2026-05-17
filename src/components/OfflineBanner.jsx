// src/components/OfflineBanner.jsx
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
      const timer = setTimeout(() => setShowBanner(false), 3000);
      return () => clearTimeout(timer);
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
        bg-moss text-background px-4 py-2.5
        text-center text-xs font-sans tracking-wide font-medium uppercase
        transition-all duration-300 ease-in-out
        z-[9999] border-b border-moss/20 shadow-md
        ${showBanner ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
      `}
    >
      {isOnline ? (
        <span className="flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-background animate-pulse" />
          Back online — Syncing book collections
        </span>
      ) : (
        <span className="flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-200 animate-ping" />
          Offline — Reading locally from Rice Paper cache
        </span>
      )}
    </div>
  );
}
