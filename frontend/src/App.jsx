import { useState, useEffect, useCallback } from 'react';
import SongRequestForm from './SongRequestForm';
import SongList from './SongList';
import AdminPanel from './AdminPanel';

export default function App() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  const fetchSongs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/songs');
      const data = await res.json();
      setSongs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSongs();
    const interval = setInterval(fetchSongs, 5000);
    return () => clearInterval(interval);
  }, [fetchSongs]);

  if (showAdmin) {
    return (
      <AdminPanel
        onRefresh={fetchSongs}
        onBack={() => setShowAdmin(false)}
      />
    );
  }

  return (
    <>
      <header>
        <h1>Trilo Radio</h1>
        <p><small>Zgłaszanie piosenek do odtworzenia</small></p>
      </header>

      <main>
        <SongRequestForm onSubmitted={fetchSongs} />
        <hr />
        <SongList songs={songs} loading={loading} />
      </main>

      <hr />

      <footer>
        <p><small>Trilo Radio &mdash; system kolejkowania utworów</small></p>
      </footer>

      <button
        className="admin-fab"
        onClick={() => setShowAdmin(true)}
        aria-label="Menedżer kolejki"
        title="Menedżer kolejki"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>
    </>
  );
}
