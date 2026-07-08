export const MAX_PHOTOS_PER_REPORT = 3
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Client-side pre-check only — the server independently verifies every upload. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Only JPG, PNG, or WEBP images are allowed.'
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'Photo must be 5 MB or smaller.'
  }
  return null
}
