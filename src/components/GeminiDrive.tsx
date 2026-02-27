import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { FileEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, File, Trash2, Download, Search, HardDrive, Loader2, X, FileText, Image as ImageIcon, Music, Video, Archive, MessageSquare, Sparkles, Save } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, storage, db } from '../firebase';

export default function GeminiDrive() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFiles();
    console.log('GeminiDrive Mounted. Firebase User:', auth.currentUser?.uid);
  }, []);

  const fetchFiles = async () => {
    const uid = auth.currentUser?.uid;
    try {
      const res = await fetch('/api/drive/files');
      if (res.ok) {
        const localFiles: FileEntry[] = await res.json();
        
        if (uid) {
          // Merge with Firestore data (notes, ai_summary)
          const syncedFiles = await Promise.all(localFiles.map(async (file) => {
            try {
              const fileDoc = await getDoc(doc(db, 'users', uid, 'files', file.id.toString()));
              if (fileDoc.exists()) {
                const cloudData = fileDoc.data();
                return {
                  ...file,
                  notes: cloudData.notes || file.notes,
                  ai_summary: cloudData.ai_summary || file.ai_summary,
                  storagePath: cloudData.storagePath || file.storagePath
                };
              }
            } catch (e) {
              console.error('Error fetching cloud data for file', file.id, e);
            }
            return file;
          }));
          setFiles(syncedFiles);
        } else {
          setFiles(localFiles);
        }
      }
    } catch (err) {
      console.error('Failed to fetch files', err);
    } finally {
      setLoading(false);
    }
  };

  const syncToFirebase = async (file: FileEntry, blob?: Blob) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.error('Firebase Sync Error: No authenticated user found in Firebase SDK.');
      return;
    }

    try {
      // 1. Sync to Storage if blob provided
      if (blob) {
        console.log(`Uploading to Firebase Storage: user_uploads/${uid}/${file.filename}`);
        const storageRef = ref(storage, `user_uploads/${uid}/${file.filename}`);
        await uploadBytes(storageRef, blob);
        console.log('Firebase Storage upload successful');
      }

      // 2. Sync to Firestore
      console.log(`Syncing to Firestore: users/${uid}/files/${file.id}`);
      const fileDocRef = doc(db, 'users', uid, 'files', file.id.toString());
      await setDoc(fileDocRef, {
        ...file,
        storagePath: `user_uploads/${uid}/${file.filename}`,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      console.log('Firestore sync successful');
    } catch (err) {
      console.error('Firebase sync failed:', err);
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Upload to local server
      const uploadRes = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const newFile: FileEntry = await uploadRes.json();
        
        // 2. Sync to Firebase
        await syncToFirebase(newFile, file);
        
        // 3. Refresh local list
        setFiles(prev => [newFile, ...prev]);
      } else {
        const errData = await uploadRes.json();
        console.error('Server upload failed:', errData.error);
      }
    } catch (err) {
      console.error('Upload process failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    const uid = auth.currentUser?.uid;
    const fileToDelete = files.find(f => f.id === id);

    try {
      // 1. Delete from local server
      const res = await fetch(`/api/drive/files/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFiles(files.filter((f) => f.id !== id));

        // 2. Delete from Firebase if UID exists
        if (uid && fileToDelete) {
          try {
            const storageRef = ref(storage, `user_uploads/${uid}/${fileToDelete.filename}`);
            await deleteObject(storageRef);
            await deleteDoc(doc(db, 'users', uid, 'files', id.toString()));
          } catch (fbErr) {
            console.error('Firebase delete failed', fbErr);
          }
        }
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleSaveNotes = async () => {
    if (!editingFile || !auth.currentUser) return;
    setSavingNotes(true);
    try {
      const uid = auth.currentUser.uid;
      const fileDocRef = doc(db, 'users', uid, 'files', editingFile.id.toString());
      
      const updatedData = {
        notes,
        updatedAt: serverTimestamp(),
      };

      await setDoc(fileDocRef, updatedData, { merge: true });
      
      // Update local state
      setFiles(files.map(f => f.id === editingFile.id ? { ...f, notes } : f));
      setEditingFile({ ...editingFile, notes });
      alert('Notes saved to cloud!');
    } catch (err) {
      console.error('Failed to save notes', err);
      alert('Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDownload = async (id: number, name: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert('You must be signed in to download files.');
      return;
    }

    const file = files.find(f => f.id === id);
    if (!file) return;

    try {
      // 1. Try to find the storage path from Firestore
      const fileDocRef = doc(db, 'users', uid, 'files', id.toString());
      const fileDoc = await getDoc(fileDocRef);
      
      let storagePath = fileDoc.exists() ? fileDoc.data()?.storagePath : null;

      // 2. If path is missing but we have the filename, try the default pattern
      if (!storagePath && file.filename) {
        storagePath = `user_uploads/${uid}/${file.filename}`;
      }

      if (storagePath) {
        try {
          // 3. Get the download URL from Firebase Storage
          const storageRef = ref(storage, storagePath);
          const downloadUrl = await getDownloadURL(storageRef);
          window.open(downloadUrl, '_blank');
          return;
        } catch (storageErr) {
          console.warn('Cloud storage download failed, falling back to local:', storageErr);
        }
      }

      // 4. Fallback to local server download
      console.log('Falling back to local download for file:', id);
      window.open(`/api/drive/download/${id}`, '_blank');
    } catch (err: any) {
      console.error('Download process failed:', err);
      // Final fallback
      window.open(`/api/drive/download/${id}`, '_blank');
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return ImageIcon;
    if (mime.startsWith('video/')) return Video;
    if (mime.startsWith('audio/')) return Music;
    if (mime.includes('pdf') || mime.includes('text')) return FileText;
    if (mime.includes('zip') || mime.includes('rar')) return Archive;
    return File;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter((f) =>
    f.original_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-white">Gemini Drive</h2>
          <p className="text-white/70">Manage and store your important files.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          className="input-field !pl-12"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-white/80 mx-auto" />
          </div>
        ) : filteredFiles.length > 0 ? (
          filteredFiles.map((file) => {
            const Icon = getFileIcon(file.mime_type);
            return (
              <motion.div
                layout
                key={file.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-4 group flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors border border-white/20">
                    <Icon className="w-6 h-6 text-white/70 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(file.id, file.original_name)}
                      className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-2 text-white/60 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-auto">
                  <h3 className="font-semibold text-white truncate text-sm" title={file.original_name}>
                    {file.original_name}
                  </h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-white/50 font-medium uppercase tracking-wider">
                      {formatSize(file.size)}
                    </span>
                    <span className="text-[10px] text-white/50 font-medium uppercase tracking-wider">
                      {new Date(file.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingFile(file);
                      setNotes(file.notes || '');
                    }}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2 text-xs font-bold text-white/80 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    AI Insights & Notes
                  </button>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center glass-card border-dashed border-white/20 bg-white/5">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <HardDrive className="w-8 h-8 text-white/40" />
            </div>
            <h3 className="text-lg font-medium text-white">No files found</h3>
            <p className="text-white/60">Upload your first file to Gemini Drive.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingFile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card shadow-2xl w-full max-w-2xl overflow-hidden border-0"
            >
              <div className="p-6 border-b border-white/20 flex items-center justify-between bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg border border-white/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-white">{editingFile.original_name}</h3>
                    <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">Cloud Synced Insights</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingFile(null)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-white/5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white">
                    <Sparkles className="w-4 h-4 text-indigo-300" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">AI Summary</h4>
                  </div>
                  <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-400/20 italic text-indigo-200 text-sm leading-relaxed">
                    {editingFile.ai_summary || "AI summary will appear here once processed. This record is synced to your cloud history."}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white">
                    <MessageSquare className="w-4 h-4 text-white/60" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Personal Notes</h4>
                  </div>
                  <textarea
                    className="input-field min-h-[150px] resize-none text-sm"
                    placeholder="Add your thoughts about this file..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-6 bg-white/10 border-t border-white/20 flex justify-end gap-3">
                <button
                  onClick={() => setEditingFile(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="btn-primary flex items-center gap-2"
                >
                  {savingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save to Cloud
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
