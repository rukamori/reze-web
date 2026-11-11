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
      thumbnail: noBars(best.url) || null,
      itemCount: it.contentDetails ? Number(it.contentDetails.itemCount) : null,
    };
  });
}

/**
 * Video thumbnails come back as 4:3 "hqdefault" frames with black letterbox
 * bars baked in. maxresdefault/hq720 are true 16:9 with no bars, so a square
 * object-cover crop stays clean. Custom pl_c playlist covers are left alone.
 */
function noBars(url) {
  if (!url) return url;
  const m = url.match(/i\.ytimg\.com\/vi\/([\w-]{6,})\//);
  if (!m) return url;
  return `https://i.ytimg.com/vi/${m[1]}/maxresdefault.jpg`;
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
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    // The custom square playlist cover set in YouTube Studio. Signed URL, so
    // take the widest one the page offers; square means no letterbox bars.
    const covers = [...html.matchAll(/"url":"(https:\/\/i\.ytimg\.com\/pl_c\/[^"]+)","width":(\d+)/g)].map((m) => ({
      url: m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/"),
      width: Number(m[2]),
    }));
    if (covers.length) {
      out.thumbnail = covers.sort((a, b) => b.width - a.width)[0].url;
    } else {
      const og = html.match(/<meta property="og:image" content="([^"]+)"/);
      if (og) out.thumbnail = og[1].replace(/&amp;/g, "&");
    }

    const m =
      html.match(/"text":"([\d,]+)"\},\{"text":" videos"/) || html.match(/([\d,]+) videos/);
    if (m) out.itemCount = Number(m[1].replace(/,/g, ""));
  } catch (_) {
    /* keep what we have */
  }

  out.thumbnail = noBars(out.thumbnail);
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
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
  res.statusCode = 200;
  res.end(JSON.stringify({ playlists, fetchedAt: new Date().toISOString() }));
};
