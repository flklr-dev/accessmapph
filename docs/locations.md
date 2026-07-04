# Location Deduplication Architecture

How AccessMap PH ensures multiple users reporting the same place share **one pin**, not duplicates.

## User flow

```
User taps map → draft pin appears + action bar
      ↓
User clicks "Report here"
      ↓
POST /api/locations/resolve { lat, lng }
      ↓
┌─────────────────────────────────────────────────────┐
│ 1. placeKey match (OSM ID from reverse geocode)     │ → use existing pin
│ 2. proximity match (within 75 m)                    │ → use existing or pick from list
│ 3. no match                                         │ → suggest name, create new pin
└─────────────────────────────────────────────────────┘
      ↓
User confirms → Report form → POST /api/reports
```

## Dedup layers (priority order)

| Layer | Method | Purpose |
|-------|--------|---------|
| **1. Place key** | `osm:way:123456` from Nominatim | Same building even if tap points differ |
| **2. Proximity** | Haversine ≤ **75 m** | Same venue when OSM ID unavailable |
| **3. Separation guard** | Block new pin if < **15 m** | Prevents accidental double pins |
| **4. Hard floor** | Block even `forceNew` if < **5 m** | Last-resort anti-spam |
| **5. Report dedup** | Same location + feature within **24 h** | Prevents duplicate reports (moderation) |

## Constants

Defined in `server/src/lib/geo.ts`:

- `MATCH_RADIUS_METERS = 75` — search radius for existing pins
- `STRONG_MATCH_RADIUS_METERS = 25` — labeled as strong proximity match
- `MIN_SEPARATION_METERS = 15` — minimum gap for new community pins
- `GEOHASH_PRECISION = 7` — stored for future PostGIS indexing (~153 m cells)

## Data model fields

```typescript
Location {
  geohash: string      // spatial index (PostGIS migration)
  placeKey: string | null  // "osm:way:123" — canonical place identity
  source: 'seed' | 'community'
}
```

## Edge cases

| Situation | Handling |
|-----------|----------|
| Two users tap same mall simultaneously | Server re-checks proximity on `POST /api/locations`; second gets **409** with existing pin |
| User taps parking lot vs mall entrance | Within 75 m → matched to same pin (correct for accessibility reporting) |
| User insists it's a different place | **"No — different place"** → `forceNew: true` (still blocked if < 5 m) |
| Multiple pins within 75 m | **nearby** action → user picks from list |
| Nominatim rate limit / offline | Client falls back to local proximity match only |
| Same feature reported twice in 24 h | Report moderation flags as duplicate |

## Future (Phase 1c — PostgreSQL + PostGIS)

- Replace linear scan with `ST_DWithin(location, point, 75)`
- Unique partial index on `place_key WHERE place_key IS NOT NULL`
- Admin merge tool for incorrectly split pins

## API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/locations/resolve` | Tap → matched / nearby / new |
| `POST /api/locations` | Create community pin (dedup enforced) |
| `POST /api/reports` | Attach report to resolved `locationId` |
