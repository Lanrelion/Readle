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
import ScrollToTop from './components/ScrollToTop';
import { supabase } from './services/supabase';
import { fullSync } from './services/syncService';
import { clearLocalDatabase, removeSeedBooks } from './services/db';
import { getProfile, updateLastSeen } from './services/profileService';
import { repairMissingCovers } from './services/repairService';
import './App.css';

function App() {
  useTheme(); // Initialize theme globally
  const [showAuthModal, setShowAuthModal] = useState(false);
  // [Bug 10] Initialize user from localStorage cache to prevent "Sign In to Sync" flash
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('cachedUser');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [isPurging, setIsPurging] = useState(() => localStorage.getItem('needsDBClear') === 'true');

  useEffect(() => {
    // One-time cleanup for existing users who have seed books
    removeSeedBooks();
    
    // Repair any missing base64 covers from downloaded blobs
    repairMissingCovers();
  }, []);

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
      const sessionUser = session?.user || null;
      setUser(sessionUser);
      // [Bug 10] Cache user in localStorage so next page load doesn't flash
      if (sessionUser) {
        localStorage.setItem('cachedUser', JSON.stringify({ id: sessionUser.id, email: sessionUser.email }));
      } else {
        localStorage.removeItem('cachedUser');
      }
      
      const skipped = localStorage.getItem('skippedAuth') === 'true';
      
      // Show auth prompt if not signed in and has not previously skipped (after 5 seconds)
      if (!session && !skipped) {
        timer = setTimeout(() => setShowAuthModal(true), 5000);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const sessionUser = session?.user || null;
        setUser(sessionUser);
        
        // [Bug 10] Update cache on auth changes
        if (sessionUser) {
          localStorage.setItem('cachedUser', JSON.stringify({ id: sessionUser.id, email: sessionUser.email }));
        } else {
          localStorage.removeItem('cachedUser');
        }

        if (event === 'SIGNED_IN' && session) {
          // Update last seen
          await updateLastSeen(session.user.id);
          
          // Get profile
          const profile = await getProfile(session.user.id);
          console.log('[App] User profile:', profile);
          
          // Run full sync
          await fullSync();
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

    // Initial sync (covers sign-in event too since user state changed)
    fullSync().then(result => {
      if (result.downloaded + result.uploaded > 0) {
        console.log('[App] Initial sync complete:', result);
      }
    }).catch(err => console.warn('[App] Initial sync failed:', err));

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
        <ScrollToTop />
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
