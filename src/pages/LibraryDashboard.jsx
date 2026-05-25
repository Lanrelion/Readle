import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Books, MagnifyingGlass } from '@phosphor-icons/react';
import { db, seedMockData } from '../services/db';
import BookCard from '../components/BookCard';
import Navigation from '../components/Navigation';
import gsap from 'gsap';
import { supabase } from '../services/supabase';
import { AuthModal } from '../components/AuthModal';

export default function LibraryDashboard({ user }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => localStorage.getItem('statusFilter') || 'all');
  const [filterType, setFilterType] = useState(() => localStorage.getItem('formatFilter') || 'all');
  const [dateFilter, setDateFilter] = useState(() => localStorage.getItem('dateFilter') || 'all');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const dashboardRef = useRef(null);

  // Seed mock data once on mount
  useEffect(() => {
    seedMockData();
  }, []);

  // Entrance animation for dashboard elements
  useEffect(() => {
    if (!dashboardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(dashboardRef.current, 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
      );
    });
    return () => ctx.revert();
  }, []);

  // Sync filters to localStorage
  useEffect(() => {
    localStorage.setItem('statusFilter', filterStatus);
  }, [filterStatus]);

  useEffect(() => {
    localStorage.setItem('formatFilter', filterType);
  }, [filterType]);

  useEffect(() => {
    localStorage.setItem('dateFilter', dateFilter);
  }, [dateFilter]);

  // Reactive query to IndexedDB
  const books = useLiveQuery(
    async () => {
      let results;
      const now = new Date();
      
      // Determine date ranges
      let startDate = null;
      let endDate = null;
      let isYearFilter = false;

      if (dateFilter === 'thisMonth') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (dateFilter === 'last3Months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      } else if (/^\d{4}$/.test(dateFilter)) {
        const year = parseInt(dateFilter, 10);
        startDate = new Date(year, 0, 1);
        endDate = new Date(year + 1, 0, 1);
        isYearFilter = true;
      }

      // Query IndexedDB using Dexie indexes where possible
      if (startDate) {
        if (isYearFilter) {
          results = await db.books
            .where('dateAdded')
            .between(startDate.toISOString(), endDate.toISOString(), true, false)
            .toArray();
        } else {
          results = await db.books
            .where('dateAdded')
            .aboveOrEqual(startDate.toISOString())
            .toArray();
        }
      } else if (filterType !== 'all') {
        results = await db.books
          .where('type').equals(filterType)
          .toArray();
      } else {
        results = await db.books.toArray();
      }

      // In-memory post-filtering
      
      // 1. Filter by format (type) if it wasn't filtered by database query
      if (startDate && filterType !== 'all') {
        results = results.filter(b => b.type === filterType);
      }
      
      // 2. Filter by status
      if (filterStatus !== 'all') {
        results = results.filter(b => b.status === filterStatus);
      }
      
      // 3. Search by title or author
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        results = results.filter(b => 
          b.title.toLowerCase().includes(query) || 
          b.author.toLowerCase().includes(query)
        );
      }
      
      // Sort reading first, then newest
      return results.sort((a, b) => {
        if (a.status === 'reading' && b.status !== 'reading') return -1;
        if (b.status === 'reading' && a.status !== 'reading') return 1;
        return new Date(b.dateAdded) - new Date(a.dateAdded);
      });
    },
    [searchQuery, filterStatus, filterType, dateFilter],
    [] // Default value before loading
  );

  const stats = {
    total: books?.length || 0,
    reading: books?.filter(b => b.status === 'reading').length || 0,
    completed: books?.filter(b => b.status === 'completed').length || 0
  };

  const statusFilters = [
    { value: 'all', label: 'All Collection' },
    { value: 'reading', label: 'Currently Reading' },
    { value: 'wantToRead', label: 'Want to Read' },
    { value: 'completed', label: 'Finished' },
  ];

  // Generate year options from 2020 to current year
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let year = currentYear; year >= 2020; year--) {
    yearOptions.push(
      <option key={year} value={year.toString()}>
        {year}
      </option>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo/20 lg:pl-64 pb-28 lg:pb-12">
      {/* Shared Responsive Sidebar/Bottom-Bar Nav */}
      <Navigation />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Main Page Sandbox */}
      <div ref={dashboardRef} className="container mx-auto px-6 py-8 lg:px-12 max-w-7xl">
        
        {/* Page Hero Header */}
        <header className="flex flex-col gap-4 py-6 border-b border-foreground-tertiary/10 mb-8">
          <div className="flex justify-between items-center">
            <span className="text-xs font-accent uppercase tracking-widest text-foreground-tertiary">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
              {(!user && localStorage.getItem('skippedAuth') === 'true') ? null : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-indigo hover:bg-clay text-background text-xs font-sans font-medium uppercase tracking-wider transition duration-300 rounded-none shadow-sm cursor-pointer"
                >
                  {user ? 'Account' : 'Sign In to Sync'}
                </button>
              )}
          </div>
          
          <h1 className="text-5xl font-serif font-normal text-foreground leading-tight">
            Your Quiet Library
          </h1>
          
          <p className="text-foreground-secondary font-sans text-base max-w-md">
            A visual, tactile collection of stories, thoughts, and reading journeys.
          </p>
        </header>

        {/* Tactical Statistics Section */}
        <section className="grid grid-cols-3 gap-6 p-6 bg-background-secondary rounded-none border border-foreground-tertiary/10 mb-10">
          <div className="text-center space-y-1.5 border-r border-foreground-tertiary/10">
            <p className="text-3xl font-serif font-normal text-foreground">{stats.total}</p>
            <p className="text-xs font-accent text-foreground-tertiary uppercase tracking-wider">Volumes Collected</p>
          </div>
          <div className="text-center space-y-1.5 border-r border-foreground-tertiary/10">
            <p className="text-3xl font-serif font-normal text-moss">{stats.reading}</p>
            <p className="text-xs font-accent text-foreground-tertiary uppercase tracking-wider">Currently Reading</p>
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-3xl font-serif font-normal text-clay">{stats.completed}</p>
            <p className="text-xs font-accent text-foreground-tertiary uppercase tracking-wider">Completed</p>
          </div>
        </section>

        {/* Custom Search bar & Format Controls */}
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Muted Translucent Search Bar */}
          <div className="relative w-full max-w-md">
            <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-tertiary" size={18} weight="thin" />
            <input 
              type="text" 
              placeholder="Search your quiet collection…" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-none border border-foreground-tertiary/20 bg-background-secondary/50 backdrop-blur py-3 pl-12 pr-4 text-sm font-sans outline-none transition duration-200 placeholder:text-foreground-tertiary/60 focus:border-indigo focus:bg-background"
            />
          </div>

          {/* Format & Date Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Format Selectors */}
            <div className="flex gap-2">
              {['all', 'ebook', 'pdf', 'physical'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`h-9 px-5 text-xs font-sans font-medium uppercase tracking-wider rounded-none border transition duration-300 inline-flex items-center justify-center ${
                    filterType === type 
                      ? 'border-indigo bg-indigo text-background' 
                      : 'border-foreground-tertiary/20 bg-transparent text-foreground hover:bg-background-secondary hover:border-indigo'
                  }`}
                >
                  {type === 'all' 
                    ? 'All Formats' 
                    : type === 'ebook' 
                      ? 'Ebooks' 
                      : type === 'pdf' 
                        ? 'PDFs' 
                        : 'Physical'}
                </button>
              ))}
            </div>

            {/* Date Filter Select */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 pl-4 pr-10 py-0 text-xs font-sans font-medium uppercase tracking-wider bg-background-secondary border border-foreground-tertiary/20 rounded-none text-foreground outline-none transition duration-200 focus:border-indigo cursor-pointer appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238c857b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '14px',
              }}
            >
              <option value="all">All Time</option>
              <option value="thisMonth">This Month</option>
              <option value="last3Months">Last 3 Months</option>
              {yearOptions}
            </select>
          </div>
        </div>

        {/* Editorial Tab Status Filter */}
        <div className="border-b border-foreground-tertiary/10 mb-8 overflow-x-auto scrollbar-none">
          <div className="flex gap-8 whitespace-nowrap min-w-max pb-px">
            {statusFilters.map((tab) => {
              const isActive = filterStatus === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilterStatus(tab.value)}
                  className={`text-base font-sans font-medium pb-3 transition-colors duration-300 relative rounded-none border-b-2 ${
                    isActive 
                      ? 'border-moss text-foreground font-semibold' 
                      : 'border-transparent text-foreground-tertiary hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Grid View */}
        {books === undefined ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-none border-2 border-indigo border-r-transparent"></div>
          </div>
        ) : books.length === 0 ? (
          <div className="flex min-h-[350px] flex-col items-center justify-center rounded-none border border-dashed border-foreground-tertiary/30 bg-background-secondary/30 text-center p-8">
            <Books size={48} weight="thin" className="mb-4 text-foreground-tertiary/40" />
            <h3 className="text-xl font-serif text-foreground-secondary">Your shelf awaits its first story.</h3>
            <p className="mb-6 mt-2 text-sm text-foreground-tertiary max-w-sm">
              Browse your collection or add a new volume to begin your reading log.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
            {books.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
