import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-journal-app";
const PORT = 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Initialize Database
const db = new Database("journal.db");

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    mood TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      req.userId = decoded.userId;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // API Routes
  app.post("/api/signup", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)");
      const info = stmt.run(email, hashedPassword, name || "");
      
      const token = jwt.sign({ userId: info.lastInsertRowid }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
      res.json({ message: "User created", userId: info.lastInsertRowid });
    } catch (err: any) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Email already exists" });
      }
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ message: "Logged in", user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ message: "Logged out" });
  });

  app.get("/api/me", authenticate, (req: any, res) => {
    const user: any = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(req.userId);
    res.json(user);
  });

  app.post("/api/auth/sync", async (req, res) => {
    const { email, name, uid } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });

    try {
      // Check if user exists by email (or UID if we want to be more robust)
      let user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      
      if (!user) {
        // Create user if they don't exist in our SQLite DB
        const stmt = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)");
        const info = stmt.run(email, 'FIREBASE_AUTH', name || "");
        user = { id: info.lastInsertRowid, email, name };
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
      res.json({ message: "Synced", user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
      res.status(500).json({ error: "Server error during sync" });
    }
  });

  app.post("/api/auth/delete", authenticate, (req: any, res) => {
    try {
      db.prepare("DELETE FROM users WHERE id = ?").run(req.userId);
      db.prepare("DELETE FROM entries WHERE user_id = ?").run(req.userId);
      db.prepare("DELETE FROM files WHERE user_id = ?").run(req.userId);
      res.clearCookie("token");
      res.json({ message: "Account deleted" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Journal Entry Routes
  app.get("/api/entries", authenticate, (req: any, res) => {
    const entries = db.prepare("SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC, created_at DESC").all(req.userId);
    res.json(entries);
  });

  app.post("/api/entries", authenticate, (req: any, res) => {
    const { title, content, date, mood } = req.body;
    if (!title || !content || !date) return res.status(400).json({ error: "Missing fields" });

    const stmt = db.prepare("INSERT INTO entries (user_id, title, content, date, mood) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run(req.userId, title, content, date, mood || "neutral");
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/entries/:id", authenticate, (req: any, res) => {
    const { title, content, date, mood } = req.body;
    const { id } = req.params;

    const entry: any = db.prepare("SELECT * FROM entries WHERE id = ? AND user_id = ?").get(id, req.userId);
    if (!entry) return res.status(404).json({ error: "Entry not found" });

    const stmt = db.prepare("UPDATE entries SET title = ?, content = ?, date = ?, mood = ? WHERE id = ?");
    stmt.run(title || entry.title, content || entry.content, date || entry.date, mood || entry.mood, id);
    res.json({ message: "Entry updated" });
  });

  app.delete("/api/entries/:id", authenticate, (req: any, res) => {
    const { id } = req.params;
    const stmt = db.prepare("DELETE FROM entries WHERE id = ? AND user_id = ?");
    const info = stmt.run(id, req.userId);
    
    if (info.changes === 0) return res.status(404).json({ error: "Entry not found" });
    res.json({ message: "Entry deleted" });
  });

  // Gemini Drive Routes
  app.get("/api/drive/files", authenticate, (req: any, res) => {
    const files = db.prepare("SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC").all(req.userId);
    res.json(files);
  });

  app.post("/api/drive/upload", authenticate, upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const stmt = db.prepare("INSERT INTO files (user_id, original_name, filename, mime_type, size) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run(req.userId, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size);
    
    const newFile = db.prepare("SELECT * FROM files WHERE id = ?").get(info.lastInsertRowid);
    res.json(newFile);
  });

  app.get("/api/drive/download/:id", authenticate, (req: any, res) => {
    const file: any = db.prepare("SELECT * FROM files WHERE id = ? AND user_id = ?").get(req.params.id, req.userId);
    if (!file) return res.status(404).json({ error: "File not found" });

    const filePath = path.join(uploadDir, file.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on disk" });

    res.download(filePath, file.original_name);
  });

  app.delete("/api/drive/files/:id", authenticate, (req: any, res) => {
    const file: any = db.prepare("SELECT * FROM files WHERE id = ? AND user_id = ?").get(req.params.id, req.userId);
    if (!file) return res.status(404).json({ error: "File not found" });

    const filePath = path.join(uploadDir, file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.prepare("DELETE FROM files WHERE id = ?").run(req.params.id);
    res.json({ message: "File deleted" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
