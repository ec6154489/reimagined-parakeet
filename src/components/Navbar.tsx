import { User } from '../types';
import { LogOut, Book, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onNavigateHome: () => void;
  onNavigateProfile: () => void;
}

export default function Navbar({ user, onLogout, onNavigateHome, onNavigateProfile }: NavbarProps) {
  return (
    <nav className="fixed top-4 left-4 right-4 bg-white/10 backdrop-blur-lg border border-white/20 z-50 rounded-2xl shadow-lg">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <button 
          onClick={onNavigateHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/20">
            <Book className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-white">Daily Journal</span>
        </button>

        <div className="flex items-center gap-2">
          <button 
            onClick={onNavigateProfile}
            className="flex items-center gap-3 pl-2 pr-4 py-2 rounded-full hover:bg-white/20 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20">
              <UserIcon className="w-5 h-5 text-white/70" />
            </div>
            <span className="text-sm font-medium text-white/80 group-hover:text-white">{user.name || user.email}</span>
          </button>
          <button
            onClick={onLogout}
            className="w-11 h-11 flex items-center justify-center text-white/70 hover:text-red-400 hover:bg-red-500/20 rounded-full transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
