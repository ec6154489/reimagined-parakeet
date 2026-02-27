import { useState, FormEvent, useRef, ChangeEvent } from 'react';
import { User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, Book, Camera, ShieldCheck, MailCheck, KeyRound } from 'lucide-react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup
} from 'firebase/auth';

interface AuthProps {
  onAuthSuccess: (user: User) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const syncWithBackend = async (firebaseUser: any) => {
    try {
      // 1. Sync with Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || formData.name || (userDoc.exists() ? userDoc.data()?.name : ''),
        photoURL: profileImage || firebaseUser.photoURL || (userDoc.exists() ? userDoc.data()?.photoURL : null),
        updatedAt: serverTimestamp(),
      };

      if (!userDoc.exists()) {
        // @ts-ignore
        userData.createdAt = serverTimestamp();
      }

      await setDoc(userDocRef, userData, { merge: true });

      // 2. Sync with SQLite backend (for Journal/Drive session)
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: firebaseUser.email,
          name: userData.name,
          uid: firebaseUser.uid
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        onAuthSuccess(data.user);
      } else {
        throw new Error('Failed to sync with backend');
      }
    } catch (err: any) {
      console.error('Sync Error:', err);
      setError('Failed to sync user data. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await syncWithBackend(result.user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
          const user = userCredential.user;
          
          if (!user.emailVerified) {
            await sendEmailVerification(user);
            setVerificationEmail(user.email || '');
            await signOut(auth);
            setShowVerification(true);
            setLoading(false);
            return;
          }

          await syncWithBackend(user);
        } catch (err: any) {
          setError('Password or Email Incorrect');
        }
      } else {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          const user = userCredential.user;
          
          if (formData.name) {
            await updateProfile(user, { displayName: formData.name });
          }
          
          await sendEmailVerification(user);
          setVerificationEmail(user.email || '');
          await signOut(auth);
          setShowVerification(true);
        } catch (err: any) {
          if (err.code === 'auth/email-already-in-use') {
            setError('User already exists. Sign in?');
          } else {
            setError(err.message);
          }
        }
      }
    } catch (err: any) {
      if (!error) setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (showVerification) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="glass-card p-8 text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <MailCheck className="w-10 h-10 text-emerald-300" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-white mb-4">Verify your email</h2>
          <p className="text-white/70 mb-8 leading-relaxed">
            We have sent you a verification email to <span className="font-semibold text-white">{verificationEmail}</span>. 
            Verify it and log in to access your journal.
          </p>
          <button
            onClick={() => {
              setShowVerification(false);
              setIsLogin(true);
            }}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Go to Login
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    );
  }

  if (showForgotPassword) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="glass-card p-8 text-center">
          {resetSent ? (
            <>
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <MailCheck className="w-10 h-10 text-emerald-300" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-white mb-4">Check your email</h2>
              <p className="text-white/70 mb-8 leading-relaxed">
                We sent you a password change link to <span className="font-semibold text-white">{formData.email}</span>.
              </p>
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setIsLogin(true);
                }}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                Sign In
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <KeyRound className="w-10 h-10 text-white/80" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-white mb-2">Forgot Password?</h2>
              <p className="text-white/70 mb-8">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1 text-left">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                      type="email"
                      required
                      className="input-field !pl-12"
                      placeholder="hello@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-red-300 bg-red-500/20 p-3 rounded-lg border border-red-400/30">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Get Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError('');
                  }}
                  className="text-sm text-white/60 hover:text-white transition-colors"
                >
                  Back to Login
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl mb-4 shadow-lg border border-white/20">
          <Book className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-white mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-white/70">
          {isLogin ? 'Your thoughts are waiting for you.' : 'Start your journey of self-reflection today.'}
        </p>
      </div>

      <div className="glass-card p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 pb-2"
              >
                <div className="flex flex-col items-center gap-3 mb-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-full bg-white/10 border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-white/40 transition-colors"
                  >
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-white/50 group-hover:text-white/80" />
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Upload Photo</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                      type="text"
                      required
                      className="input-field !pl-12"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="email"
                required
                className="input-field !pl-12"
                placeholder="hello@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between ml-1">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Password</label>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError('');
                  }}
                  className="text-xs font-semibold text-white/50 hover:text-white transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="password"
                required
                className="input-field !pl-12"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1"
            >
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Repeat Password</label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="password"
                  required
                  className="input-field !pl-12"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-sm p-3 rounded-lg border flex items-center justify-between ${                error.includes('Sign in?') 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' 
                  : 'bg-red-500/20 text-red-300 border-red-400/30'
              }`}
            >
              <span>{error}</span>
              {error.includes('Sign in?') && (
                <button 
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError('');
                  }}
                  className="text-xs font-bold underline uppercase tracking-tighter"
                >
                  Sign In
                </button>
              )}
            </motion.div>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900/60 px-2 text-white/60 font-medium backdrop-blur-sm">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn-secondary w-full flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-white/20 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
