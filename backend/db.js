import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'radio.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    url TEXT,
    source TEXT,
    art_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  );
`);

for (const col of [
  ['songs', 'url', 'TEXT'],
  ['songs', 'source', 'TEXT'],
  ['songs', 'art_url', 'TEXT'],
]) {
  try { db.exec(`ALTER TABLE ${col[0]} ADD COLUMN ${col[1]} ${col[2]}`); } catch {}
}

try { db.exec('ALTER TABLE songs DROP COLUMN requested_by'); } catch {}

const BCRYPT_ROUNDS = 10;

const insertAdmin = db.prepare(
  'INSERT OR IGNORE INTO admins (username, password_hash) VALUES (?, ?)'
);

export function initAdmin() {
  const hash = bcrypt.hashSync('admin123', BCRYPT_ROUNDS);
  insertAdmin.run('admin', hash);
}

export const addSong = db.prepare(
  'INSERT INTO songs (title, artist, url, source, art_url) VALUES (?, ?, ?, ?, ?)'
);

export const getAllSongs = db.prepare(
  'SELECT * FROM songs ORDER BY created_at DESC'
);

export const getPendingSongs = db.prepare(
  'SELECT * FROM songs WHERE status = ? ORDER BY created_at ASC'
);

export const acceptSong = db.prepare(
  'UPDATE songs SET status = ? WHERE id = ?'
);

export const removeSong = db.prepare(
  'DELETE FROM songs WHERE id = ?'
);

export const findAdmin = db.prepare(
  'SELECT * FROM admins WHERE username = ?'
);

export default db;
