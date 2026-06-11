import { useState, useEffect, useCallback } from 'react';
import SongRequestForm from './SongRequestForm';
import SongList from './SongList';
import AdminPanel from './AdminPanel';

export default function App() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('public');

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

  return (
    <>
      <header>
        <h1>Radio</h1>
        <p><small>Zgłaszanie piosenek do odtworzenia</small></p>
      </header>

      <nav aria-label="Nawigacja główna">
        <menu>
          <li>
            <button
              onClick={() => setTab('public')}
              aria-current={tab === 'public' ? 'page' : undefined}
            >
              Zgłoś piosenkę
            </button>
          </li>
          <li>
            <button
              onClick={() => setTab('admin')}
              aria-current={tab === 'admin' ? 'page' : undefined}
            >
              Panel administratora
            </button>
          </li>
        </menu>
      </nav>

      <hr />

      <main>
        {tab === 'public' ? (
          <>
            <SongRequestForm onSubmitted={fetchSongs} />
            <hr />
            <SongList songs={songs} loading={loading} />
          </>
        ) : (
          <AdminPanel onRefresh={fetchSongs} />
        )}
      </main>

      <hr />

      <footer>
        <p><small>Radio &mdash; system kolejkowania utworów</small></p>
      </footer>
    </>
  );
}
