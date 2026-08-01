import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Plus, Quotes, Sun, Moon } from '@phosphor-icons/react';
import { useTheme } from '../hooks/useTheme';

import gsap from 'gsap';

export default function Navigation() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const animateClick = (element) => {
    gsap.timeline()
      .to(element, { scale: 0.94, duration: 0.1, ease: 'power1.out' })
      .to(element, { scale: 1, duration: 0.2, ease: 'back.out' });
  };

  const navItems = [
    { path: '/', label: 'Library', icon: BookOpen },
    { path: '/add', label: 'Add Book', icon: Plus },
    { path: '/quotes', label: 'Quotes', icon: Quotes },
  ];

  return (
    <>
      {/* Desktop Navigation Sidebar (>= 1024px) */}
      <nav className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-foreground-tertiary/20 bg-background-secondary p-6 z-40 lg:flex">
        <div className="mb-10 flex items-center justify-center">
          <span className="font-serif text-3xl font-normal tracking-tight text-foreground">
            Garder
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => animateClick(e.currentTarget)}
                className={`flex items-center gap-4 px-4 py-3 font-sans text-base font-normal rounded-none transition duration-300 ${
                  isActive
                    ? 'bg-indigo text-background'
                    : 'text-foreground hover:bg-background/50 hover:text-indigo'
                }`}
              >
                <Icon size={22} weight={isActive ? 'fill' : 'thin'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Theme Controller at the bottom */}
        <div className="mt-auto border-t border-foreground-tertiary/20 pt-6">
          <button
            onClick={(e) => {
              animateClick(e.currentTarget);
              toggleTheme();
            }}
            className="flex w-full items-center gap-4 px-4 py-3 font-sans text-base font-normal text-foreground hover:bg-background/50 hover:text-indigo rounded-none transition duration-300"
          >
            {theme === 'dark' ? (
              <>
                <Sun size={22} weight="thin" className="text-gold" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon size={22} weight="thin" className="text-foreground-secondary" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Bottom Bar (< 1024px) */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 border-t border-foreground-tertiary/20 bg-background/95 backdrop-blur z-40 flex justify-around items-center px-4 lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => animateClick(e.currentTarget)}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-16 transition duration-300 ${
                isActive ? 'text-indigo' : 'text-foreground-secondary hover:text-indigo'
              }`}
            >
              <Icon size={24} weight={isActive ? 'fill' : 'thin'} />
              <span className="text-[11px] font-accent font-medium tracking-wide uppercase">
                {item.label}
              </span>
            </Link>
          );
        })}
        
        {/* Toggle Theme Mobile Button */}
        <button
          onClick={(e) => {
            animateClick(e.currentTarget);
            toggleTheme();
          }}
          className="flex flex-col items-center justify-center gap-1 w-16 h-16 text-foreground-secondary hover:text-indigo transition duration-300"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={24} weight="thin" className="text-gold" />
              <span className="text-[11px] font-accent font-medium tracking-wide uppercase">Light</span>
            </>
          ) : (
            <>
              <Moon size={24} weight="thin" />
              <span className="text-[11px] font-accent font-medium tracking-wide uppercase">Dark</span>
            </>
          )}
        </button>
      </nav>
    </>
  );
}
