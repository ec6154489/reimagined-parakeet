import { useState, useEffect, FormEvent } from 'react';
import { User, JournalEntry, Mood } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Calendar, Trash2, Edit3, X, Save, Smile, Frown, Meh, Zap, Coffee, Target, Book } from 'lucide-react';

interface JournalProps {
  user: User;
}

const MOODS: { type: Mood; icon: any; color: string; label: string }[] = [
  { type: 'happy', icon: Smile, color: 'text-emerald-300 bg-emerald-500/20 border-emerald-400/30', label: 'Happy' },
  { type: 'excited', icon: Zap, color: 'text-amber-300 bg-amber-500/20 border-amber-400/30', label: 'Excited' },
  { type: 'productive', icon: Target, color: 'text-blue-300 bg-blue-500/20 border-blue-400/30', label: 'Productive' },
  { type: 'neutral', icon: Meh, color: 'text-slate-300 bg-slate-500/20 border-slate-400/30', label: 'Neutral' },
  { type: 'tired', icon: Coffee, color: 'text-indigo-300 bg-indigo-500/20 border-indigo-400/30', label: 'Tired' },
  { type: 'sad', icon: Frown, color: 'text-rose-300 bg-rose-500/20 border-rose-400/30', label: 'Sad' },
];

export default function Journal({ user }: JournalProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    date: new Date().toISOString().split('T')[0],
    mood: 'neutral' as Mood,
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const res = await fetch('/api/entries');
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to fetch entries', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/entries/${editingId}` : '/api/entries';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        fetchEntries();
        resetForm();
      }
    } catch (err) {
      console.error('Failed to save entry', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEntries(entries.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete entry', err);
    }
  };

  const handleEdit = (entry: JournalEntry) => {
    setFormData({
      title: entry.title,
      content: entry.content,
      date: entry.date,
      mood: entry.mood as Mood,
    });
    setEditingId(entry.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      date: new Date().toISOString().split('T')[0],
      mood: 'neutral',
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const filteredEntries = entries.filter(
    (e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-white">Your Journal</h2>
          <p className="text-white/70">You have {entries.length} entries recorded.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="btn-primary flex items-center justify-center gap-2"
        >
          {isAdding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isAdding ? 'Cancel' : 'New Entry'}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-6 mb-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Title</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="What's on your mind?"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        type="date"
                        required
                        className="input-field !pl-12"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Mood</label>
                  <div className="flex flex-wrap gap-2">
                    {MOODS.map((m) => (
                      <button
                        key={m.type}
                        type="button"
                        onClick={() => setFormData({ ...formData, mood: m.type })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${                          formData.mood === m.type
                            ? `${m.color}`
                            : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        <m.icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider ml-1">Content</label>
                  <textarea
                    required
                    rows={6}
                    className="input-field resize-none"
                    placeholder="Write your heart out..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={resetForm} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex items-center gap-2">
                    <Save className="w-5 h-5" />
                    {editingId ? 'Update Entry' : 'Save Entry'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          className="input-field !pl-12"
          placeholder="Search your memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
          </div>
        ) : filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => {
            const moodInfo = MOODS.find((m) => m.type === entry.mood) || MOODS[3];
            return (
              <motion.div
                layout
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${moodInfo.color.split(' ')[1]}`}>
                      <moodInfo.icon className={`w-5 h-5 ${moodInfo.color.split(' ')[0]}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{entry.title}</h3>
                      <p className="text-xs text-white/60 font-medium uppercase tracking-wider">
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 text-white/60 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
              </motion.div>
            );
          })
        ) : (
          <div className="py-20 text-center glass-card border-dashed border-white/20 bg-white/5">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Book className="w-8 h-8 text-white/40" />
            </div>
            <h3 className="text-lg font-medium text-white">No entries found</h3>
            <p className="text-white/60">Start writing your first entry today.</p>
          </div>
        )}
      </div>
    </div>
  );
}
