const UA = 'Mozilla/5.0 (compatible; RadioBot/1.0)';

function detectPlatform(url) {
  try {
    const host = new URL(url).host.replace(/^www\./, '');
    if (host === 'open.spotify.com') return 'spotify';
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') return 'youtube';
    if (host === 'soundcloud.com' || host === 'on.soundcloud.com') return 'soundcloud';
    if (host === 'tidal.com' || host === 'listen.tidal.com') return 'tidal';
    if (host === 'deezer.com' || host === 'www.deezer.com') return 'deezer';
    if (host === 'music.apple.com') return 'applemusic';
    if (host.endsWith('.bandcamp.com') || host === 'bandcamp.com') return 'bandcamp';
    return null;
  } catch {
    return null;
  }
}

function stripHtml(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d));
}

async function fetchTitle(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) return '';
  const html = await res.text();
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? stripHtml(match[1].trim()) : '';
}

async function fetchOembed(oembedUrl) {
  const res = await fetch(oembedUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  return res.json();
}

function splitArtistTitle(text, sep) {
  const idx = text.lastIndexOf(sep);
  if (idx > 0) return { artist: text.slice(0, idx).trim(), title: text.slice(idx + sep.length).trim() };
  return null;
}

export async function extractMetadata(url) {
  const platform = detectPlatform(url);
  if (!platform) return { platform: null, title: '', artist: '', info: 'Nieobsługiwana platforma.' };

  try {
    switch (platform) {
      case 'spotify': return await extractSpotify(url);
      case 'youtube': return await extractYouTube(url);
      case 'soundcloud': return await extractSoundCloud(url);
      case 'deezer': return await extractDeezer(url);
      default:
        return { platform, title: '', artist: '', info: 'Wykryto platformę. Uzupełnij tytuł i wykonawcę ręcznie.' };
    }
  } catch {
    return { platform, title: '', artist: '', info: 'Nie udało się pobrać danych. Uzupełnij ręcznie.' };
  }
}

async function extractSpotify(url) {
  const title = await fetchTitle(url);
  // "Never Gonna Give You Up - song and lyrics by Rick Astley | Spotify"
  const m = title.match(/^(.+?)\s+-\s+song\s+and\s+lyrics\s+by\s+(.+?)\s+\|\s+Spotify$/);
  if (m) return { platform: 'spotify', title: m[1].trim(), artist: m[2].trim() };

  const s = splitArtistTitle(title, ' | ');
  if (s) return { platform: 'spotify', title: s.title, artist: s.artist };
  if (s) return { platform: 'spotify', title: s.title, artist: s.artist };

  return { platform: 'spotify', title: title.replace(/\s*\|\s*Spotify$/, ''), artist: '' };
}

async function extractYouTube(url) {
  const data = await fetchOembed(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  if (!data?.title) throw new Error('No title');

  for (const sep of [' – ', ' - ', ' | ', ' — ']) {
    const s = splitArtistTitle(data.title, sep);
    if (s) return { platform: 'youtube', ...s };
  }
  return { platform: 'youtube', title: data.title, artist: data.author_name || '' };
}

async function extractSoundCloud(url) {
  const data = await fetchOembed(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  if (!data?.title) throw new Error('No title');

  const m = data.title.match(/^(.+?)\s+by\s+(.+)$/);
  if (m) return { platform: 'soundcloud', title: m[1].trim(), artist: m[2].trim() };

  for (const sep of [' – ', ' - ', ' | ', ' — ']) {
    const s = splitArtistTitle(data.title, sep);
    if (s) return { platform: 'soundcloud', ...s };
  }
  return { platform: 'soundcloud', title: data.title, artist: data.author_name || '' };
}

async function extractDeezer(url) {
  const title = await fetchTitle(url);
  // "Daft Punk - Harder, Better, Faster, Stronger | Deezer"
  const body = title.replace(/\s*\|\s*Deezer\s*$/, '');
  const s = splitArtistTitle(body, ' - ');
  if (s) return { platform: 'deezer', title: s.title, artist: s.artist };
  return { platform: 'deezer', title: body, artist: '' };
}

export { detectPlatform };
