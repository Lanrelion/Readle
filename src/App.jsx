import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LibraryDashboard from './pages/LibraryDashboard'
import AddBook from './pages/AddBook'
import BookDetail from './pages/BookDetail'
import EbookReader from './pages/EbookReader'
import QuotesList from './pages/QuotesList'
import { useTheme } from './hooks/useTheme'
import { OfflineBanner } from './components/OfflineBanner'
import './App.css'

function App() {
  useTheme(); // Initialize theme globally

  return (
    <>
      <OfflineBanner />
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
  )
}

export default App
