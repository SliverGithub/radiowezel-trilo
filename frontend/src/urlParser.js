export const SOURCE_NAMES = {
  spotify: 'Spotify',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  tidal: 'Tidal',
  deezer: 'Deezer',
  applemusic: 'Apple Music',
  bandcamp: 'Bandcamp',
};

export async function extractMetadata(url) {
  const res = await fetch(`/api/extract?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    return { platform: null, title: '', artist: '', info: 'Nie udało się pobrać danych.' };
  }
  const data = await res.json();
  if (!data.platform) {
    return { platform: null, title: '', artist: '', info: data.info || 'Nieobsługiwana platforma.' };
  }
  return data;
}
