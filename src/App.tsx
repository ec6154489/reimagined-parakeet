import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from './types';
import Auth from './components/Auth';
import Journal from './components/Journal';
import GeminiDrive from './components/GeminiDrive';
import Home from './components/Home';
import Profile from './components/Profile';
import Navbar from './components/Navbar';
import { Loader2 } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

type View = 'home' | 'journal' | 'drive' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('home');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.emailVerified) {
        // If Firebase user exists and is verified, sync with backend to get SQLite session
        try {
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              uid: firebaseUser.uid
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          } else {
            setUser(null);
          }
        } catch (err) {
          console.error('Sync failed', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setView('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/80" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md">
              <Auth onAuthSuccess={(u) => setUser(u)} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Navbar user={user} onLogout={handleLogout} onNavigateHome={() => setView('home')} onNavigateProfile={() => setView('profile')} />
            <main className="max-w-5xl mx-auto px-4 pt-28 pb-12">
              <AnimatePresence mode="wait">
                {view === 'home' && (
                  <motion.div
                    key="home"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <Home onNavigate={(v) => setView(v)} />
                  </motion.div>
                )}
                {view === 'journal' && (
                  <motion.div
                    key="journal"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Journal user={user} />
                  </motion.div>
                )}
                {view === 'drive' && (
                  <motion.div
                    key="drive"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <GeminiDrive />
                  </motion.div>
                )}
                {view === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <Profile 
                      user={user} 
                      onUpdate={(u) => setUser(u)} 
                      onLogout={handleLogout} 
                      onBack={() => setView('home')} 
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
