import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LibraryDashboard from './pages/LibraryDashboard';
import AddBook from './pages/AddBook';
import BookDetail from './pages/BookDetail';
import EbookReader from './pages/EbookReader';
import QuotesList from './pages/QuotesList';
import { useTheme } from './hooks/useTheme';
import { OfflineBanner } from './components/OfflineBanner';
import { AuthModal } from './components/AuthModal';
import { supabase } from './services/supabase';
import { fullSync } from './services/syncService';
import { clearLocalDatabase } from './services/db';
import './App.css';

function App() {
  useTheme(); // Initialize theme globally
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState(null);
  const [isPurging, setIsPurging] = useState(() => localStorage.getItem('needsDBClear') === 'true');

  // Purge database on boot if needed (guarantees no locks from active React component trees)
  useEffect(() => {
    if (isPurging) {
      console.log('[App] Purge flag detected. Wiping IndexedDB...');
      clearLocalDatabase()
        .then(() => {
          localStorage.removeItem('needsDBClear');
          console.log('[App] IndexedDB local database wiped successfully');
          setIsPurging(false);
        })
        .catch((err) => {
          console.error('[App] Failed to clear IndexedDB:', err);
          localStorage.removeItem('needsDBClear');
          setIsPurging(false);
        });
    }
  }, [isPurging]);

  useEffect(() => {
    if (isPurging) return;
    let timer = null;

    // Check if user is signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      
      const skipped = localStorage.getItem('skippedAuth') === 'true';
      
      // Show auth prompt if not signed in and has not previously skipped (after 5 seconds)
      if (!session && !skipped) {
        timer = setTimeout(() => setShowAuthModal(true), 5000);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        
        if (event === 'SIGNED_IN') {
          console.log('[App] User signed in, starting sync...');
          const result = await fullSync();
          console.log('[App] Sync complete:', result);
          alert(`Synced ${result.downloaded + result.uploaded} items`);
        }
      }
    );

    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [isPurging]);

  // Background Sync (Every 5 Minutes)
  useEffect(() => {
    if (isPurging) return;
    // Only sync if user is signed in
    if (!user) return;

    // Initial sync
    fullSync();

    // Background sync every 5 minutes
    const interval = setInterval(() => {
      if (navigator.onLine) {
        console.log('[App] Running background sync...');
        fullSync(); // Run bidirectional sync to pull new items as well as push local items
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Instant sync upon reconnection
    const handleOnline = () => {
      console.log('[App] Internet connection restored, starting immediate sync...');
      fullSync().catch(err => console.warn('[App] Reconnection sync failed:', err));
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, isPurging]);

  if (isPurging) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex flex-col items-center justify-center p-6 select-none">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-10 h-10 border-2 border-indigo border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <h3 className="font-serif text-xl font-normal tracking-wide">Purging Session Data</h3>
            <p className="text-xs font-accent text-foreground-tertiary tracking-widest uppercase">Clearing local library offline files...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <OfflineBanner />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
      <Router>
        <Routes>
          <Route path="/" element={<LibraryDashboard user={user} />} />
          <Route path="/add" element={<AddBook />} />
          <Route path="/book/:id" element={<BookDetail />} />
          <Route path="/read/:id" element={<EbookReader />} />
          <Route path="/quotes" element={<QuotesList />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
