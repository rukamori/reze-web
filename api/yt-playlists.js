/**
 * GET /api/yt-playlists
 * Live title, cover and track count for the five YouTube Music playlists shown
 * in the Music tab. YouTube oEmbed has no CORS headers, so this runs server-side.
 *
 * - With YOUTUBE_API_KEY set: one Data API call (exact counts).
 * - Without it: oEmbed for title + cover, plus a best-effort count from the
 *   playlist page. Every lookup fails soft (null), and the response is always 200.
 */

const IDS = [
  "PL-fWIzgBd5AweOlOuudT-f9fqY1x-bR_O", // Japanese
  "PL-fWIzgBd5Az5euaBV1M5HElAKC8kzdYC", // English
  "PL-fWIzgBd5AyeDYfArAo6ZEKl3xxeG7mc", // Hindi
  "PL-fWIzgBd5AxneK5vQfmaQskYmuwbXZ_k", // Phonk
  "PL-fWIzgBd5Aw0-x8aDOYMOZcoD6jmzPWs", // Mix
];

const TIMEOUT_MS = 6000;

async function getJSON(url, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function getText(url, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function viaDataApi(key) {
  const url =
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&maxResults=50&id=" +
    IDS.join(",") +
    "&key=" +
    encodeURIComponent(key);
  const data = await getJSON(url);
  const items = Array.isArray(data.items) ? data.items : [];
  return IDS.map((id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return { id, title: null, thumbnail: null, itemCount: null };
    const th = (it.snippet && it.snippet.thumbnails) || {};
    const best = th.maxres || th.standard || th.high || th.medium || th.default || {};
    return {
      id,
      title: (it.snippet && it.snippet.title) || null,
      thumbnail: best.url || null,
      itemCount: it.contentDetails ? Number(it.contentDetails.itemCount) : null,
    };
  });
}

async function viaPublic(id) {
  const out = { id, title: null, thumbnail: null, itemCount: null };
  const pageUrl = "https://www.youtube.com/playlist?list=" + id;

  try {
    const o = await getJSON(
      "https://www.youtube.com/oembed?url=" + encodeURIComponent(pageUrl) + "&format=json"
    );
    out.title = o.title || null;
    out.thumbnail = o.thumbnail_url || null;
  } catch (_) {
    /* keep nulls */
  }

  try {
    const html = await getText(pageUrl, {
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (compatible; v3rsi0n-site/1.0)",
    });
    const m =
      html.match(/"text":"([\d,]+)"\},\{"text":" videos"/) || html.match(/([\d,]+) videos/);
    if (m) out.itemCount = Number(m[1].replace(/,/g, ""));
  } catch (_) {
    /* keep null */
  }

  return out;
}

module.exports = async function handler(req, res) {
  let playlists = [];
  try {
    const key = process.env.YOUTUBE_API_KEY;
    if (key) {
      try {
        playlists = await viaDataApi(key);
      } catch (_) {
        playlists = await Promise.all(IDS.map(viaPublic));
      }
    } else {
      playlists = await Promise.all(IDS.map(viaPublic));
    }
  } catch (_) {
    playlists = [];
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
  res.statusCode = 200;
  res.end(JSON.stringify({ playlists, fetchedAt: new Date().toISOString() }));
};
