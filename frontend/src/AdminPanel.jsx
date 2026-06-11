import { useState, useEffect } from 'react';
import { statusLabels } from './SongRequestForm';

export default function AdminPanel({ onRefresh, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Logowanie nie powiodło się');
      }
      const data = await res.json();
      localStorage.setItem('admin_token', data.token);
      setToken(data.token);
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    onBack();
  };

  if (!token) {
    return (
      <article>
        <header>
          <button className="back-btn" onClick={onBack} aria-label="Wróć">&larr; Powrót</button>
          <h2>Menedżer kolejki</h2>
          <p><small>Zaloguj się, aby zarządzać kolejką utworów.</small></p>
        </header>

        <form onSubmit={handleLogin} aria-label="Formularz logowania">
          <fieldset>
            <legend>Dane logowania</legend>

            <dl>
              <dt><label htmlFor="admin-user">Nazwa użytkownika</label></dt>
              <dd>
                <input
                  id="admin-user"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-required="true"
                />
              </dd>

              <dt><label htmlFor="admin-pass">Hasło</label></dt>
              <dd>
                <input
                  id="admin-pass"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-required="true"
                />
              </dd>
            </dl>
          </fieldset>

          <footer>
            <button type="submit">Zaloguj się</button>
          </footer>
        </form>

        {error && <output role="alert"><p>{error}</p></output>}
      </article>
    );
  }

  return (
    <article>
      <header>
        <aside>
          <button className="back-btn" onClick={onBack} aria-label="Wróć">&larr; Powrót</button>
          <button onClick={handleLogout}>Wyloguj się</button>
        </aside>
        <h2>Menedżer kolejki</h2>
        <p><small>Zalogowano jako <strong>admin</strong>. Akceptuj oczekujące utwory lub usuwaj niechciane zgłoszenia.</small></p>
      </header>

      <hr />

      <AdminQueue token={token} onRefresh={onRefresh} />
    </article>
  );
}

function AdminQueue({ token, onRefresh }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSongs();
  }, []);

  async function fetchSongs() {
    setLoading(true);
    try {
      const res = await fetch('/api/songs');
      const data = await res.json();
      setSongs(data);
    } finally {
      setLoading(false);
    }
  }

  const handleAccept = async (id) => {
    await fetch(`/api/songs/${id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    onRefresh();
    fetchSongs();
  };

  const handleRemove = async (id) => {
    await fetch(`/api/songs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    onRefresh();
    fetchSongs();
  };

  if (loading) return <p><em>Ładowanie…</em></p>;
  if (songs.length === 0) return <p>Brak piosenek w kolejce.</p>;

  const pending = songs.filter((s) => s.status === 'pending');
  const accepted = songs.filter((s) => s.status === 'accepted');

  return (
    <section>
      <table>
        <caption>Kolejka utworów — {songs.length} zgłoszeń</caption>
        <colgroup>
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Tytuł</th>
            <th scope="col">Wykonawca</th>
            <th scope="col">Status</th>
            <th scope="col">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song) => (
            <tr key={song.id}>
              <td>
                {song.art_url ? (
                  <img src={song.art_url} alt="" width="40" height="40" loading="lazy" />
                ) : null}
              </td>
              <td><strong>{song.title}</strong></td>
              <td>{song.artist}</td>
              <td data-status={song.status}>
                <small>{statusLabels[song.status] || song.status}</small>
              </td>
              <td>
                {song.status === 'pending' && (
                  <button
                    onClick={() => handleAccept(song.id)}
                    title="Zaakceptuj tę piosenkę do odtworzenia"
                  >
                    Akceptuj
                  </button>
                )}
                <button
                  onClick={() => handleRemove(song.id)}
                  title="Usuń to zgłoszenie z kolejki"
                >
                  Usuń
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>
              <small>
                Oczekujące: <strong>{pending.length}</strong> &bull; Zaakceptowane: <strong>{accepted.length}</strong>
              </small>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
