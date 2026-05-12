import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import LibraryDashboard from './pages/LibraryDashboard';
import BookDetail from './pages/BookDetail';
import AddBook from './pages/AddBook';
import QuotesList from './pages/QuotesList';
import EbookReader from './pages/EbookReader';
import { useTheme } from './hooks/useTheme';

function App() {
  const { theme } = useTheme();

  return (
    <Router>
      <div className={theme}>
        <Routes>
          <Route path="/" element={<LibraryDashboard />} />
          <Route path="/book/:id" element={<BookDetail />} />
          <Route path="/add-book" element={<AddBook />} />
          <Route path="/quotes" element={<QuotesList />} />
          <Route path="/reader/:id" element={<EbookReader />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
