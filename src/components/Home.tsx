import { motion } from 'motion/react';
import { Book, HardDrive, ArrowRight } from 'lucide-react';

interface HomeProps {
  onNavigate: (view: 'journal' | 'drive') => void;
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div>
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-serif font-bold text-white mb-4">Welcome to your Workspace</h1>
        <p className="text-white/70 max-w-xl mx-auto text-lg">
          Manage your thoughts in your personal journal or store your important files in Gemini Drive.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.button
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('journal')}
          className="glass-card p-8 text-left group backdrop-blur-xl"
        >
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 border border-white/20 group-hover:scale-110 transition-transform">
            <Book className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-white mb-2">Your Journal</h2>
          <p className="text-white/70 mb-6">
            Write down your daily thoughts, track your moods, and reflect on your journey.
          </p>
          <div className="flex items-center gap-2 text-white font-semibold group-hover:gap-3 transition-all">
            Open Journal <ArrowRight className="w-5 h-5" />
          </div>
        </motion.button>

        <motion.button
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('drive')}
          className="glass-card p-8 text-left group backdrop-blur-xl"
        >
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 border border-white/20 group-hover:scale-110 transition-transform">
            <HardDrive className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-white mb-2">Gemini Drive</h2>
          <p className="text-white/70 mb-6">
            Securely upload and manage all your important files in one place.
          </p>
          <div className="flex items-center gap-2 text-white font-semibold group-hover:gap-3 transition-all">
            Open Drive <ArrowRight className="w-5 h-5" />
          </div>
        </motion.button>
      </div>
    </div>
  );
}
