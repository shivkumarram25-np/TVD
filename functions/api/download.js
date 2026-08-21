// Cloudflare Pages Function: /api/download
// Nepal TVD - Universal Video Downloader (TikTok / Instagram / Pinterest)
// No login required. Extracts direct (no-watermark) media URLs server-side.

const UA_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function detectPlatform(url) {
  if (/tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/pinterest\.[a-z.]+|pin\.it/i.test(url)) return "pinterest";
  return null;
}

async function resolveShortUrl(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": UA_MOBILE },
    });
    return res.url || url;
  } catch (e) {
    return url;
  }
}

// ---------------- TikTok ----------------
async function handleTikTok(url) {
  const finalUrl = /vt\.tiktok|vm\.tiktok|\/t\//i.test(url)
    ? await resolveShortUrl(url)
    : url;

  const apiUrl = "https://www.tikwm.com/api/";
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA_MOBILE,
    },
    body: `url=${encodeURIComponent(finalUrl)}&hd=1`,
  });

  if (!res.ok) throw new Error("TikTok service unavailable");
  const data = await res.json();
  if (data.code !== 0 || !data.data) {
    throw new Error(data.msg || "Could not fetch TikTok video");
  }

  const d = data.data;
  const base = "https://www.tikwm.com";
  const fixUrl = (u) => (u && u.startsWith("http") ? u : u ? base + u : null);

  return {
    platform: "tiktok",
    title: d.title || "TikTok Video",
    author: d.author?.nickname || d.author?.unique_id || "",
    thumbnail: fixUrl(d.cover || d.origin_cover),
    duration: d.duration || 0,
    media: [
      d.hdplay
        ? {
            type: "video",
            quality: "HD (No Watermark)",
            url: fixUrl(d.hdplay),
          }
        : null,
      d.play
        ? { type: "video", quality: "No Watermark", url: fixUrl(d.play) }
        : null,
      d.wmplay
        ? { type: "video", quality: "With Watermark", url: fixUrl(d.wmplay) }
        : null,
      d.music
        ? { type: "audio", quality: "Original Audio", url: fixUrl(d.music) }
        : null,
    ].filter(Boolean),
  };
}

// ---------------- Instagram ----------------
async function handleInstagram(url) {
  // normalize url, strip query
  const clean = url.split("?")[0].replace(/\/$/, "");
  const embedUrl = `${clean}/embed/captioned/`;

  const res = await fetch(embedUrl, {
    headers: {
      "User-Agent": UA_MOBILE,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error("Instagram post not accessible / private");
  const html = await res.text();

  // Instagram embed page double-escapes its inline JSON, so keys look like
  // \"video_url\":\"https:\\/\\/...\"  (literal backslash-quote sequences).
  const videoMatch = html.match(/\\"video_url\\":\\"(.+?)\\"/);
  const imageMatch = html.match(/\\"display_url\\":\\"(.+?)\\"/);
  const ownerMatch = html.match(/\\"username\\":\\"([^"\\]+)\\"/);
  const captionMatch = html.match(/\\"caption\\":\\"(.*?)\\"\s*,\s*\\"/);

  const unescapeUrl = (s) =>
    (s || "")
      .replace(/\\+u0026/g, "&")
      .replace(/\\+\//g, "/");

  if (!videoMatch && !imageMatch) {
    throw new Error(
      "Could not extract media. Post may be private or link invalid."
    );
  }

  const media = [];
  if (videoMatch) {
    media.push({
      type: "video",
      quality: "Original (No Watermark)",
      url: unescapeUrl(videoMatch[1]),
    });
  }
  if (imageMatch) {
    media.push({
      type: "image",
      quality: "Photo",
      url: unescapeUrl(imageMatch[1]),
    });
  }

  return {
    platform: "instagram",
    title: captionMatch ? unescapeUrl(captionMatch[1]).slice(0, 120) : "Instagram Media",
    author: ownerMatch ? ownerMatch[1] : "",
    thumbnail: imageMatch ? unescapeUrl(imageMatch[1]) : null,
    duration: 0,
    media,
  };
}

// ---------------- Pinterest ----------------
async function handlePinterest(url) {
  const finalUrl = /pin\.it/i.test(url) ? await resolveShortUrl(url) : url;

  const res = await fetch(finalUrl, {
    headers: { "User-Agent": UA_DESKTOP },
  });
  if (!res.ok) throw new Error("Pinterest pin not accessible");
  const html = await res.text();

  const mp4Match = html.match(
    /https:\/\/v1\.pinimg\.com\/videos\/[^"'\\]*\.mp4/
  );
  const m3u8Match = html.match(
    /https:\/\/v1\.pinimg\.com\/videos\/[^"'\\]*\.m3u8/
  );
  const imgMatch = html.match(
    /"images":\{"orig":\{"url":"([^"]+)"/
  );
  const titleMatch = html.match(/"seoTitle":"([^"]+)"/) ||
    html.match(/<title>([^<]+)<\/title>/);

  const unescapeUrl = (s) => (s || "").replace(/\\\//g, "/");

  const media = [];
  if (mp4Match) {
    media.push({
      type: "video",
      quality: "720p MP4",
      url: mp4Match[0],
    });
  } else if (m3u8Match) {
    media.push({
      type: "video",
      quality: "HLS Stream",
      url: m3u8Match[0],
    });
  }
  if (imgMatch) {
    media.push({
      type: "image",
      quality: "Original Photo",
      url: unescapeUrl(imgMatch[1]),
    });
  }

  if (media.length === 0) {
    throw new Error("Could not extract media from this Pinterest pin.");
  }

  return {
    platform: "pinterest",
    title: titleMatch ? titleMatch[1].replace(/\| Pinterest.*/, "").trim() : "Pinterest Pin",
    author: "",
    thumbnail: imgMatch ? unescapeUrl(imgMatch[1]) : null,
    duration: 0,
    media,
  };
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const url = (body.url || "").trim();

    if (!url) return json({ success: false, error: "Please paste a valid link." }, 400);

    const platform = detectPlatform(url);
    if (!platform) {
      return json(
        {
          success: false,
          error:
            "Unsupported link. Please paste a TikTok, Instagram, or Pinterest URL.",
        },
        400
      );
    }

    let result;
    if (platform === "tiktok") result = await handleTikTok(url);
    else if (platform === "instagram") result = await handleInstagram(url);
    else if (platform === "pinterest") result = await handlePinterest(url);

    return json({ success: true, data: result });
  } catch (err) {
    return json(
      { success: false, error: err.message || "Something went wrong." },
      500
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
