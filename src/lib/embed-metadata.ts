// B4: Client resolve metadata embed (oEmbed) dùng chung.
// Mọi fetch tới noembed / spotify-oembed đi qua đây, component
// không hardcode URL endpoint.

export interface EmbedMetadata {
  title?: string;
  author?: string;
  thumbnail?: string;
}

const NOEMBED_ENDPOINT = "https://noembed.com/embed?url=";
const SPOTIFY_OEMBED_ENDPOINT = "https://open.spotify.com/oembed?url=";

async function fetchJson(url: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, string>;
  } catch (err) {
    console.warn("[StudyEmbed] Failed to fetch oEmbed:", err);
    return null;
  }
}

/** Metadata video/playlist YouTube qua noembed. */
export async function fetchYoutubeMetadata(
  pageUrl: string
): Promise<EmbedMetadata | null> {
  const data = await fetchJson(
    `${NOEMBED_ENDPOINT}${encodeURIComponent(pageUrl)}`
  );
  if (!data?.title) return null;
  return {
    title: data.title,
    author: data.author_name,
    thumbnail: data.thumbnail_url,
  };
}

/** Metadata Spotify (track/playlist/album...) qua oEmbed chính chủ. */
export async function fetchSpotifyMetadata(
  pageUrl: string
): Promise<EmbedMetadata | null> {
  const data = await fetchJson(
    `${SPOTIFY_OEMBED_ENDPOINT}${encodeURIComponent(pageUrl)}`
  );
  if (!data?.title) return null;
  return { title: data.title, thumbnail: data.thumbnail_url };
}
