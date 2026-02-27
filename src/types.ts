export interface User {
  id: number;
  email: string;
  name: string;
}

export interface JournalEntry {
  id: number;
  user_id: number;
  title: string;
  content: string;
  date: string;
  mood: string;
  created_at: string;
}

export interface FileEntry {
  id: number;
  user_id: number;
  original_name: string;
  filename: string;
  mime_type: string;
  size: number;
  created_at: string;
  notes?: string;
  ai_summary?: string;
  storagePath?: string;
}

export type Mood = 'happy' | 'sad' | 'neutral' | 'excited' | 'tired' | 'productive';

