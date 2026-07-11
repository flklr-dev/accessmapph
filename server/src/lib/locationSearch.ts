import { Location, type ILocation } from '../models/Location.js'

/** MongoDB text index minimum token length is 3 for the default analyzer. */
const TEXT_SEARCH_MIN_LEN = 3

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Strip text-search operator characters; keep word tokens for $text.
 * Substring-style regex fallback is used when $text cannot run.
 */
export function sanitizeTextSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .join(' ')
}

async function searchByTextIndex(terms: string, limit: number): Promise<ILocation[]> {
  return Location.find(
    { $text: { $search: terms } },
    { score: { $meta: 'textScore' } },
  )
    .sort({ score: { $meta: 'textScore' }, name: 1 })
    .limit(limit)
}

/**
 * Prefix match on name — indexed-friendly for 2-char queries and as a
 * fallback when $text returns no hits (e.g. uncommon abbreviations).
 */
async function searchByNamePrefix(query: string, limit: number): Promise<ILocation[]> {
  const regex = new RegExp(`^${escapeRegex(query)}`, 'i')
  return Location.find({ name: regex }).sort({ name: 1 }).limit(limit)
}

/**
 * Bounded regex on name/address/city — last resort when text index misses
 * but user expects substring match (e.g. "asia" inside a long mall name).
 */
async function searchBySubstring(query: string, limit: number): Promise<ILocation[]> {
  const regex = new RegExp(escapeRegex(query), 'i')
  return Location.find({
    $or: [{ name: regex }, { address: regex }, { city: regex }],
  })
    .sort({ name: 1 })
    .limit(limit)
}

/**
 * Search locations by name/address/city using the text index when possible,
 * with smaller scoped fallbacks instead of a full-collection regex scan.
 */
export async function findLocationsBySearchQuery(
  rawQuery: string,
  limit = 6,
): Promise<ILocation[]> {
  const trimmed = rawQuery.trim()
  if (trimmed.length < 2) return []

  const cappedLimit = Math.min(Math.max(limit, 1), 20)

  if (trimmed.length < TEXT_SEARCH_MIN_LEN) {
    return searchByNamePrefix(trimmed, cappedLimit)
  }

  const terms = sanitizeTextSearchQuery(trimmed)
  if (!terms) return []

  const textHits = await searchByTextIndex(terms, cappedLimit)
  if (textHits.length > 0) return textHits

  const prefixHits = await searchByNamePrefix(trimmed, cappedLimit)
  if (prefixHits.length > 0) return prefixHits

  return searchBySubstring(trimmed, cappedLimit)
}
