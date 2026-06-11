import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  initAdmin,
  addSong,
  getAllSongs,
  getPendingSongs,
  acceptSong,
  removeSong,
  findAdmin,
} from './db.js';
import { extractMetadata } from './extract.js';

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  JWT_SECRET = 'radio-secret-change-in-production',
  PORT = '3001',
} = process.env;

let spotifyToken = { access_token: '', expires_at: 0 };

// --- search cache with TTL ---
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const searchCache = new Map();

function cacheSet(key, value) {
  searchCache.set(key, value);
  setTimeout(() => searchCache.delete(key), CACHE_TTL);
}

// --- traffic queue (keeps Spotify requests under rate limit) ---
const QUEUE_DELAY = 500; // ms between requests (2/sec, safe under 180/min limit)
const spotifyQueue = [];
let queueRunning = false;

async function drainQueue() {
  if (queueRunning || spotifyQueue.length === 0) return;
  queueRunning = true;
  const { resolve, run } = spotifyQueue.shift();
  try {
    const result = await run();
    resolve(result);
  } catch (err) {
    resolve({ _error: err.message });
  }
  setTimeout(() => {
    queueRunning = false;
    drainQueue();
  }, QUEUE_DELAY);
}

function enqueue(run) {
  return new Promise((resolve) => {
    spotifyQueue.push({ resolve, run });
    drainQueue();
  });
}

async function getSpotifyToken() {
  if (Date.now() < spotifyToken.expires_at) return spotifyToken.access_token;
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await resp.json();
  spotifyToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  return spotifyToken.access_token;
}

initAdmin();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2kb' }));

// --- input sanitization ---

const MAX_TEXT = 200;
const MAX_URL = 500;
const STRIP_HTML = /<[^>]*>/g;
const SAFE_TEXT = /[^\w\s.,!?()\-\u0100-\u024F\u0400-\u04FF\u0027\u0022\u0142]/g;

function clean(v) {
  if (typeof v !== 'string') return '';
  return v.replace(STRIP_HTML, '').trim();
}

function cleanText(v, max = MAX_TEXT) {
  return clean(v).replace(SAFE_TEXT, '').slice(0, max);
}

function cleanUrl(v) {
  const s = clean(v).slice(0, MAX_URL);
  return /^https?:\/\/.+/.test(s) ? s : null;
}

// --- rate limiter for song submissions (per IP, in-memory) ---
const submitCooldowns = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip;
  const last = submitCooldowns.get(ip);
  if (last && Date.now() - last < 3000) {
    return res.status(429).json({ error: 'Za Dużo Zapytań, Spróbuj Później' });
  }
  submitCooldowns.set(ip, Date.now());
  next();
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- public routes ---

app.get('/api/spotify/search', async (req, res) => {
  const title = cleanText(req.query.title || '', 100);
  const artist = cleanText(req.query.artist || '', 100);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 25);
  const query = [title, artist].filter(Boolean).join(' ');
  if (!query) return res.status(400).json({ error: 'title or artist parameter required' });

  const cacheKey = `${query}:${limit || 12}`.toLowerCase();
  if (searchCache.has(cacheKey)) {
    return res.json(searchCache.get(cacheKey));
  }

  try {
    const token = await getSpotifyToken();
    const params = new URLSearchParams({
      q: `track:${query}`,
      type: 'track',
      limit: limit || '12',
    });
    const searchUrl = `https://api.spotify.com/v1/search?${params}`;

    const result = await enqueue(async () => {
      const resp = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 429) {
        throw new Error('Spotify rate limit hit');
      }
      return resp.json();
    });

    if (result._error) throw new Error(result._error);

    const tracks = (result.tracks?.items || []).map((track) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      album: track.album.name,
      art_url: track.album.images?.[0]?.url || null,
      art_thumb: track.album.images?.[2]?.url || track.album.images?.[0]?.url || null,
    }));

    cacheSet(cacheKey, tracks);
    res.json(tracks);
  } catch (err) {
    if (err.message === 'Spotify rate limit hit') {
      return res.status(429).json({ error: 'Za Dużo Zapytań, Spróbuj Później' });
    }
    res.status(502).json({ error: 'Spotify API unavailable' });
  }
});

app.post('/api/songs', rateLimit, (req, res) => {
  const title = cleanText(req.body.title);
  const artist = cleanText(req.body.artist);
  const requested_by = cleanText(req.body.requested_by, 100);
  const url = cleanUrl(req.body.url);
  const art_url = cleanUrl(req.body.art_url);
  const source = cleanText(req.body.source, 50);

  if (!title || !artist || !requested_by) {
    return res.status(400).json({ error: 'title, artist, and requested_by are required' });
  }
  if (title.length < 1 || artist.length < 1 || requested_by.length < 1) {
    return res.status(400).json({ error: 'Fields cannot be empty' });
  }

  const result = addSong.run(title, artist, requested_by, url, source, art_url);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Song request submitted' });
});

app.get('/api/songs', (_req, res) => {
  const songs = getAllSongs.all();
  res.json(songs);
});

app.post('/api/login', (req, res) => {
  const username = cleanText(req.body.username, 50);
  const password = req.body.password || '';
  const admin = findAdmin.get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username: admin.username, id: admin.id }, JWT_SECRET, {
    expiresIn: '24h',
  });
  res.json({ token, username: admin.username });
});

// --- admin routes ---

app.post('/api/songs/:id/accept', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
  acceptSong.run('accepted', id);
  res.json({ message: 'Song accepted' });
});

app.delete('/api/songs/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
  removeSong.run(id);
  res.json({ message: 'Song removed' });
});

// --- serve frontend in production ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'frontend', 'dist');

if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => {
    res.sendFile(join(dist, 'index.html'));
  });
  console.log('Serving frontend from dist/');
}

app.listen(PORT, () => {
  console.log(`Radio backend running on http://localhost:${PORT}`);
});
