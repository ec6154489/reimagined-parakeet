import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { User as UserIcon, Mail, Camera, Save, Trash2, Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { deleteUser, updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import { User } from '../types';

interface ProfileProps {
  user: User;
  onUpdate: (user: User) => void;
  onLogout: () => void;
  onBack: () => void;
}

export default function Profile({ user, onUpdate, onLogout, onBack }: ProfileProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    photoURL: null as string | null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, [user.id]);

  const fetchProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser?.uid || ''));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfileData({
          name: data.name || '',
          email: data.email || '',
          photoURL: data.photoURL || null,
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData({ ...profileData, photoURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // 1. Update Firebase Auth Profile
      await updateProfile(auth.currentUser, {
        displayName: profileData.name,
        photoURL: profileData.photoURL,
      });

      // 2. Update Firestore
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: profileData.name,
        photoURL: profileData.photoURL,
      });

      // 3. Update local state
      onUpdate({ ...user, name: profileData.name });
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    if (!window.confirm('Are you absolutely sure? This will permanently delete your account and all your data.')) return;

    setDeleting(true);
    setError('');

    try {
      const uid = auth.currentUser.uid;
      
      // 1. Delete from Firestore
      await deleteDoc(doc(db, 'users', uid));
      
      // 2. Delete from SQLite (optional, but good practice)
      await fetch('/api/auth/delete', { method: 'POST' });

      // 3. Delete Firebase Auth User
      await deleteUser(auth.currentUser);
      
      onLogout();
    } catch (err: any) {
      console.error('Error deleting account:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Please log out and log back in to delete your account for security reasons.');
      } else {
        setError(err.message || 'Failed to delete account.');
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white/80" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-8 group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium">Back to Dashboard</span>
      </button>

      <div className="text-center mb-10">
        <h1 className="text-4xl font-serif font-bold text-white mb-2">Your Profile</h1>
        <p className="text-white/60 text-lg italic">Manage your personal information and account settings.</p>
      </div>

      <div className="glass-card p-8 md:p-12">
        <div className="flex flex-col items-center mb-10">
          <div className="relative group">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 rounded-full bg-white/10 border-2 border-white/20 shadow-xl flex items-center justify-center cursor-pointer overflow-hidden transition-transform hover:scale-105"
            >
              {profileData.photoURL ? (
                <img src={profileData.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-12 h-12 text-white/40" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>
          <p className="mt-4 text-xs font-bold text-white/50 uppercase tracking-widest">Click to change photo</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-white/60 uppercase tracking-wider ml-1">Full Name</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                className="input-field !pl-12"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                placeholder="Your Name"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-white/60 uppercase tracking-wider ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="email"
                disabled
                className="input-field !pl-12 bg-white/10 text-white/50 cursor-not-allowed"
                value={profileData.email}
              />
            </div>
            <p className="text-[10px] text-white/50 ml-1 italic">Email cannot be changed for security reasons.</p>
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-400/30 text-red-300 rounded-xl text-sm flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-xl text-sm">
              {success}
            </div>
          )}

          <div className="pt-6 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="px-6 py-2.5 rounded-xl border border-red-400/50 text-red-300 font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
            >
              {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
