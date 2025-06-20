// YouTube transcript helpers for deferred-fetch-mcp

// Extracts the video ID from a YouTube URL
export function parseVideoId(url: string): string {
  try {
    const u = new URL(url);
    if (
      u.hostname.endsWith("youtube.com") &&
      (u.pathname === "/watch" ||
        u.pathname === "/embed/" ||
        u.pathname === "/shorts/")
    ) {
      // Standard or embed or shorts
      if (u.searchParams.has("v")) {
        const vid = u.searchParams.get("v")!;
        if (/^[a-zA-Z0-9_-]{11}$/.test(vid)) return vid;
      }
      // /embed/VIDEOID or /shorts/VIDEOID
      const match = u.pathname.match(/\/(embed|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[2];
    } else if (u.hostname === "youtu.be") {
      // Short link
      const vid = u.pathname.replace(/^\//, "");
      if (/^[a-zA-Z0-9_-]{11}$/.test(vid)) return vid;
    }
    throw new Error("Not a recognized YouTube video URL");
  } catch (err) {
    throw new Error("Invalid YouTube URL");
  }
}
