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
import { fullSync, syncLocalToCloud } from './services/syncService';
import './App.css';

function App() {
  useTheme(); // Initialize theme globally
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
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
  }, []);

  // Background Sync (Every 5 Minutes)
  useEffect(() => {
    // Only sync if user is signed in
    if (!user) return;

    // Initial sync
    fullSync();

    // Background sync every 5 minutes
    const interval = setInterval(() => {
      if (navigator.onLine) {
        console.log('[App] Running background sync...');
        syncLocalToCloud(); // Only push local changes
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user]);

  return (
    <>
      <OfflineBanner />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
      <Router>
        <Routes>
          <Route path="/" element={<LibraryDashboard />} />
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
