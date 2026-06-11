import { useState, useRef, useEffect, useCallback } from 'react';

export const statusLabels = {
  pending: 'oczekuje',
  accepted: 'zaakceptowano',
};

const DEEZER_API = '/api/deezer/search';

function useDebounce(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SongRequestForm({ onSubmitted }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const titleRef = useRef(null);
  const cache = useRef(new Map());

  const debouncedTitle = useDebounce(title, 500);
  const debouncedArtist = useDebounce(artist, 500);

  useEffect(() => {
    if (debouncedTitle.length < 2 && debouncedArtist.length < 2) {
      setResults([]);
      return;
    }
    const key = `${debouncedTitle}:${debouncedArtist}`;
    const cached = cache.current.get(key);
    if (cached) {
      setResults(cached);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const params = new URLSearchParams({ limit: '12' });
    if (debouncedTitle.length >= 2) params.set('title', debouncedTitle);
    if (debouncedArtist.length >= 2) params.set('artist', debouncedArtist);

    fetch(`${DEEZER_API}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const next = Array.isArray(data) ? data : [];
          cache.current.set(key, next);
          setResults(next);
          setSearching(false);
        }
      })
      .catch(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedTitle, debouncedArtist]);

  const handleSelect = useCallback((track) => {
    setSelected(track);
    setTitle('');
    setArtist('');
    setResults([]);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelected(null);
    setTimeout(() => titleRef.current?.focus(), 0);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setMessage('');
    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selected.title,
          artist: selected.artist,
          requested_by: 'Anonim',
          art_url: selected.art_url || null,
          source: 'deezer',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Nie udało się wysłać zgłoszenia');
      }
      setSelected(null);
      setMessage('Piosenka została zgłoszona!');
      onSubmitted();
    } catch (err) {
      setMessage('Błąd: ' + err.message);
    }
  };

  const hasQuery = debouncedTitle.length >= 2 || debouncedArtist.length >= 2;

  return (
    <article>
      <header>
        <h2>Zgłoś piosenkę</h2>
        <p><small>Wyszukaj utwór po tytule i&nbsp;wykonawcy, wybierz go i&nbsp;podaj swoje imię.</small></p>
      </header>

      {!selected ? (
        <section>
          <fieldset>
            <legend>Wyszukaj utwór</legend>
            <dl>
              <dt><label htmlFor="search-title">Tytuł</label></dt>
              <dd>
                <input
                  ref={titleRef}
                  id="search-title"
                  type="search"
                  autoComplete="off"
                  placeholder="Np. Bohemian Rhapsody"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </dd>

              <dt><label htmlFor="search-artist">Wykonawca</label></dt>
              <dd>
                <input
                  id="search-artist"
                  type="search"
                  autoComplete="off"
                  placeholder="Np. Queen"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                />
              </dd>
            </dl>
            <p><small>Wypełnij przynajmniej jedno pole, aby wyszukać. Oba pola zawężają wyniki.</small></p>
          </fieldset>

          {searching && <p><em>Szukam…</em></p>}

          {!searching && results.length > 0 && (
            <menu aria-label="Wyniki wyszukiwania">
              {results.map((track) => (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(track)}
                    aria-label={`Wybierz ${track.title} – ${track.artist}`}
                  >
                    {track.art_thumb ? (
                      <img
                        src={track.art_thumb}
                        alt=""
                        width={60}
                        height={60}
                        loading="lazy"
                      />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <span>
                      <strong>{track.title}</strong>
                      <small>{track.artist}{track.album ? ` \u2022 ${track.album}` : ''}</small>
                    </span>
                  </button>
                </li>
              ))}
            </menu>
          )}

          {!searching && hasQuery && results.length === 0 && (
            <p><small>Nic nie znaleziono. Spróbuj innych słów kluczowych.</small></p>
          )}
        </section>
      ) : (
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Wybrany utwór</legend>

            <dl>
              <dt>Tytuł</dt>
              <dd><strong>{selected.title}</strong></dd>

              <dt>Wykonawca</dt>
              <dd>{selected.artist}</dd>

              {selected.album && (
                <><dt>Album</dt><dd><small>{selected.album}</small></dd></>
              )}

              <dt>Okładka</dt>
              <dd>
                {selected.art_url ? (
                  <img
                    src={selected.art_url}
                    alt={`Ok\u0142adka ${selected.album || selected.title}`}
                    width={150}
                    height={150}
                  />
                ) : (
                  <span aria-hidden="true" />
                )}
              </dd>
            </dl>
          </fieldset>

          <footer>
            <button type="submit">Wyślij zgłoszenie</button>
            <button type="button" onClick={handleDeselect}>Zmień utwór</button>
          </footer>
        </form>
      )}

      {message && <output role="status"><p>{message}</p></output>}
    </article>
  );
}
