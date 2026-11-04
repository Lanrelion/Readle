import { Link, useLocation } from 'react-router-dom';
import { Books, PlusCircle, Compass, Quotes } from '@phosphor-icons/react';
import gsap from 'gsap';

export default function Navigation() {
  const location = useLocation();
  const buildId = import.meta.env.VITE_BUILD_ID || 'local';

  const animateClick = (element) => {
    gsap.timeline()
      .to(element, { scale: 0.94, duration: 0.1, ease: 'power1.out' })
      .to(element, { scale: 1, duration: 0.2, ease: 'back.out' });
  };

  const navItems = [
    { path: '/', label: 'Library', icon: Books },
    { path: '/add', label: 'Add Book', icon: PlusCircle },
    { path: '/explore', label: 'Explore', icon: Compass },
    { path: '/quotes', label: 'Quotes', icon: Quotes },
  ];

  return (
    <>
      {/* Mobile Top Bar Logo (< 1024px) */}
      <div className="lg:hidden flex flex-col items-center justify-center pt-6 pb-0">
        <Link to="/" className="hover:opacity-80 transition-opacity flex items-center justify-center">
          <span className="font-serif text-3xl font-normal tracking-tight text-foreground">
            Garder
          </span>
        </Link>
        <span className="mt-1 font-sans text-[9px] tracking-wide text-foreground-tertiary" title={`Build ${buildId}`}>
          Build {buildId}
        </span>
      </div>

      {/* Desktop Navigation Sidebar (>= 1024px) */}
      <nav className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-foreground-tertiary/20 bg-background-secondary p-6 z-40 lg:flex">
        <div className="mb-10 flex items-center justify-center">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <span className="font-serif text-3xl font-normal tracking-tight text-foreground">
              Garder
            </span>
          </Link>
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
                    ? 'bg-indigo text-white font-medium'
                    : 'text-foreground hover:bg-background/50 hover:text-indigo'
                }`}
              >
                <Icon size={22} weight={isActive ? 'regular' : 'thin'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        <span className="pt-4 text-center font-sans text-[10px] tracking-wide text-foreground-tertiary" title={`Build ${buildId}`}>
          Build {buildId}
        </span>
      </nav>

      {/* Mobile Navigation Bottom Bar (< 1024px) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-foreground-tertiary/20 bg-background/95 backdrop-blur z-40 flex justify-around items-center px-4 lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => animateClick(e.currentTarget)}
              className={`
                flex flex-col items-center gap-1 px-3 py-2 transition
                ${isActive
                  ? 'text-indigo border-t-2 border-indigo'
                  : 'text-foreground-tertiary border-t-2 border-transparent'
                }
              `}
            >
              <Icon size={22} weight={isActive ? 'regular' : 'thin'} />
              <span className="text-[10px] font-accent tracking-widest uppercase">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
