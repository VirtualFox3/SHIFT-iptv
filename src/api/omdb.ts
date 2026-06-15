// OMDB API — provides Rotten Tomatoes + Metacritic scores + fills IMDB ratings.
// Free API key: register at https://www.omdbapi.com/apikey.aspx (1,000 req/day).
// Add your key in Settings → Integrations → OMDB API Key.

export interface OMDBResult {
  imdb?: string;      // e.g. "8.1"
  rt?: number;        // Rotten Tomatoes %
  metacritic?: number;
}

export async function fetchOMDB(
  title: string,
  year?: number,
  apiKey?: string,
): Promise<OMDBResult> {
  if (!apiKey) return {};
  try {
    const params = new URLSearchParams({ apikey: apiKey, t: title });
    if (year) params.set('y', String(year));
    const res = await fetch(`https://www.omdbapi.com/?${params}`);
    if (!res.ok) return {};
    const data = await res.json();
    if (data.Response === 'False') return {};
    const result: OMDBResult = {};
    if (data.imdbRating && data.imdbRating !== 'N/A') result.imdb = data.imdbRating;
    const ratings: { Source: string; Value: string }[] = data.Ratings || [];
    const rt = ratings.find((r) => r.Source === 'Rotten Tomatoes');
    if (rt) result.rt = parseInt(rt.Value);
    const meta = ratings.find((r) => r.Source === 'Metacritic');
    if (meta) result.metacritic = parseInt(meta.Value);
    return result;
  } catch {
    return {};
  }
}
