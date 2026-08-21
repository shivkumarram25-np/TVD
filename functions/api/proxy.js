// Cloudflare Pages Function: /api/proxy?url=...&name=...
// Streams remote media through our origin so the browser can force-download it
// (bypasses CORS / hotlink protection on TikTok, Instagram & Pinterest CDNs).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const target = searchParams.get("url");
  const name = searchParams.get("name") || "video";

  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response("Invalid url", { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": UA,
        Referer: new URL(target).origin,
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response("Failed to fetch media", { status: 502 });
    }

    const contentType =
      upstream.headers.get("Content-Type") || "application/octet-stream";
    const ext = contentType.includes("mp4")
      ? "mp4"
      : contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("png")
      ? "png"
      : contentType.includes("mpegurl") || target.includes(".m3u8")
      ? "m3u8"
      : "bin";

    const safeName = name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60);

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}.${ext}"`,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response("Proxy error: " + err.message, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
