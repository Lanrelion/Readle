import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LibraryDashboard from './pages/LibraryDashboard';
import BookDetail from './pages/BookDetail';
import EbookReader from './pages/EbookReader';
import QuotesList from './pages/QuotesList';
import AddBook from './pages/AddBook';
import { useEffect } from 'react';
import { seedMockData } from './services/db';

function App() {
  useEffect(() => {
    seedMockData();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LibraryDashboard />} />
        <Route path="/book/:id" element={<BookDetail />} />
        <Route path="/reader/:id" element={<EbookReader />} />
        <Route path="/quotes" element={<QuotesList />} />
        <Route path="/add-book" element={<AddBook />} />
      </Routes>
    </Router>
  );
}

export default App;
