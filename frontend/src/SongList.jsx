import { statusLabels } from './SongRequestForm';

export default function SongList({ songs, loading }) {
  const pending = songs?.filter((s) => s.status === 'pending') ?? [];
  const accepted = songs?.filter((s) => s.status === 'accepted') ?? [];

  if (loading) return <p><em>Ładowanie piosenek…</em></p>;

  if (!songs || songs.length === 0) {
    return (
      <article>
        <h2>Kolejka utworów</h2>
        <p><small>Nikt jeszcze nie zgłosił żadnej piosenki. Bądź pierwszy!</small></p>
      </article>
    );
  }

  return (
    <article>
      <header>
        <h2>Kolejka utworów</h2>
        <p><small>Łącznie: <strong>{songs.length}</strong> zgłoszeń ({pending.length} oczekujących, {accepted.length} zaakceptowanych)</small></p>
      </header>

      {pending.length > 0 && (
        <section>
          <h3>Oczekujące na akceptację</h3>
          <SongsTable songs={pending} />
        </section>
      )}

      {accepted.length > 0 && (
        <details open>
          <summary>
            <h3>Zaakceptowane ({accepted.length})</h3>
          </summary>
          <SongsTable songs={accepted} />
        </details>
      )}

      <hr />
    </article>
  );
}

function SongsTable({ songs }) {
  return (
    <table>
      <caption hidden>Lista zgłoszonych utworów</caption>
      <thead>
        <tr>
          <th scope="col" />
          <th scope="col">Tytuł</th>
          <th scope="col">Wykonawca</th>
          <th scope="col">Zgłoszony przez</th>
          <th scope="col">Status</th>
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
            <td>{song.requested_by}</td>
            <td>{statusLabels[song.status] || song.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
