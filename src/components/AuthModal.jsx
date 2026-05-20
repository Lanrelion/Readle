import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { clearLocalDatabase } from '../services/db';
import { X, CloudArrowUp, SignOut, EnvelopeSimple, Lock } from '@phosphor-icons/react';

export function AuthModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  
  // Email/Password state
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Check current user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
        if (event === 'SIGNED_IN') {
          onClose?.();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [onClose]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        
        if (data.session) {
          setUser(data.session.user);
          localStorage.removeItem('skippedAuth');
          setSuccessMsg('Account created and signed in successfully!');
          setTimeout(() => onClose?.(), 1500);
        } else {
          setSuccessMsg('Registration successful! Please check your email inbox to confirm your account.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        
        if (data.session) {
          setUser(data.session.user);
          localStorage.removeItem('skippedAuth');
          setSuccessMsg('Signed in successfully!');
          setTimeout(() => onClose?.(), 1500);
        }
      }
    } catch (error) {
      console.error('Email auth error:', error);
      setErrorMsg(error.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('[Auth] Supabase signOut error:', error);
    }
    
    try {
      localStorage.removeItem('skippedAuth');
      await clearLocalDatabase();
    } catch (error) {
      console.warn('[Auth] Database clear error:', error);
    }
    
    window.location.reload(); // Refresh to clear local state
  };

  const handleSkip = () => {
    localStorage.setItem('skippedAuth', 'true');
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-background-secondary rounded-none shadow-2xl border border-foreground-tertiary/20 p-8 max-w-md w-full relative">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-6 top-6 rounded-none p-1.5 hover:bg-background text-foreground-secondary hover:text-foreground transition duration-200"
          aria-label="Close modal"
        >
          <X size={16} weight="thin" />
        </button>

        {user ? (
          // Signed in state
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-moss/10 text-moss">
              <CloudArrowUp size={28} weight="thin" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-normal text-foreground">
                Cloud Sync Enabled
              </h2>
              <p className="text-sm text-foreground-secondary truncate px-4">
                Signed in as <span className="font-semibold text-foreground">{user.email}</span>
              </p>
              <p className="text-xs text-foreground-tertiary max-w-xs mx-auto leading-relaxed">
                Your reading progress, book files, and collected thoughts are securely backing up to the cloud.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-foreground-tertiary/10">
              <button
                onClick={onClose}
                className="w-full px-6 py-3.5 bg-indigo text-background text-sm font-sans font-medium hover:bg-clay transition duration-300 rounded-none shadow-md"
              >
                Continue Reading
              </button>
              <button
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 border border-vermillion/25 text-vermillion text-sm font-sans font-medium hover:bg-vermillion hover:text-background transition duration-300 rounded-none"
              >
                <SignOut size={16} weight="thin" />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          // Sign in state
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo/10 text-indigo">
              <CloudArrowUp size={28} weight="thin" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-normal text-foreground">
                Sync Your Library
              </h2>
              <p className="text-sm text-foreground-secondary leading-relaxed max-w-xs mx-auto">
                Sign in to sync your collection, reading logs, and highlights across all your devices.
              </p>
            </div>

            {/* Error Message Panel */}
            {errorMsg && (
              <div className="bg-vermillion/10 border border-vermillion/20 text-vermillion text-xs px-4 py-3 text-left leading-relaxed">
                {errorMsg}
              </div>
            )}

            {/* Success Message Panel */}
            {successMsg && (
              <div className="bg-moss/10 border border-moss/20 text-moss text-xs px-4 py-3 text-left leading-relaxed">
                {successMsg}
              </div>
            )}

            {/* Email / Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              <div className="space-y-1">
                <label htmlFor="email-input" className="text-[10px] font-accent text-foreground-tertiary uppercase tracking-widest">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-tertiary">
                    <EnvelopeSimple size={16} weight="thin" />
                  </span>
                  <input
                    id="email-input"
                    type="email"
                    required
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-foreground-tertiary/20 pl-11 pr-4 py-3 text-sm text-foreground outline-none focus:border-indigo rounded-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="password-input" className="text-[10px] font-accent text-foreground-tertiary uppercase tracking-widest">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-tertiary">
                    <Lock size={16} weight="thin" />
                  </span>
                  <input
                    id="password-input"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-foreground-tertiary/20 pl-11 pr-4 py-3 text-sm text-foreground outline-none focus:border-indigo rounded-none"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo text-background text-sm font-sans font-medium py-3.5 hover:bg-clay disabled:opacity-50 transition duration-300 rounded-none shadow-md text-center"
                >
                  {loading ? 'Authenticating...' : isSignUp ? 'Create Sync Account' : 'Sign In'}
                </button>

                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full px-6 py-3.5 border border-foreground-tertiary/40 text-foreground text-sm font-sans font-medium hover:bg-background hover:border-foreground transition duration-300 rounded-none text-center cursor-pointer"
                >
                  Skip (Local Only)
                </button>

                <div className="flex justify-center pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-indigo hover:text-clay font-medium transition duration-200"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Register"}
                  </button>
                </div>
              </div>
            </form>

            <p className="text-[10px] text-foreground-tertiary leading-relaxed max-w-xs mx-auto text-center">
              We respect your privacy. We only access your email address to authenticate your sync bucket.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
