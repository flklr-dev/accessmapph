import { v2 as cloudinary } from 'cloudinary'

/**
 * Photo upload security model:
 *  1. Client asks us for a short-lived signed upload (this file, `signUpload`).
 *     The signature is scoped to a per-user folder and a fixed transformation,
 *     so a stolen signature can't be replayed into someone else's folder or
 *     used to skip our resize/format pipeline.
 *  2. Client uploads the file directly to Cloudinary — binary bytes never
 *     touch our server, so this scales independently of our API.
 *  3. Client calls back with the returned `publicId`; we verify the asset
 *     server-side via the Cloudinary Admin API (`confirmUpload`) before ever
 *     trusting the URL. Anything that fails our checks (wrong owner, wrong
 *     size/format) is deleted immediately. Only the *server-fetched*
 *     `secure_url` is trusted — we never store a client-supplied URL string.
 */

export const MAX_PHOTOS_PER_REPORT = 3
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5 MB
export const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp']
/** Downscale + compress on upload so oversized phone photos never hit storage at full size. */
const UPLOAD_TRANSFORMATION = 'c_limit,w_1600,h_1600,q_auto:good,f_auto'
const ROOT_FOLDER = 'accessmapph/reports'

let configured = false

function configureOnce(): boolean {
  if (configured) return true

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return false
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
  configured = true
  return true
}

export function isCloudinaryReady(): boolean {
  return configureOnce()
}

function userFolder(uid: string): string {
  // uid is a Firebase UID (opaque, alphanumeric) — safe to use directly in a path segment.
  return `${ROOT_FOLDER}/${uid}`
}

export interface UploadSignaturePayload {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
  transformation: string
  allowedFormats: string
  maxPhotoBytes: number
  maxPhotos: number
}

/** Generates a signed, per-user-scoped upload authorization for direct-to-Cloudinary uploads. */
export function signUpload(uid: string): UploadSignaturePayload {
  if (!configureOnce()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED')
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder = userFolder(uid)
  const paramsToSign = {
    timestamp,
    folder,
    transformation: UPLOAD_TRANSFORMATION,
    allowed_formats: ALLOWED_FORMATS.join(','),
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET as string,
  )

  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    timestamp,
    signature,
    folder,
    transformation: UPLOAD_TRANSFORMATION,
    allowedFormats: ALLOWED_FORMATS.join(','),
    maxPhotoBytes: MAX_PHOTO_BYTES,
    maxPhotos: MAX_PHOTOS_PER_REPORT,
  }
}

export interface ConfirmedUpload {
  url: string
  publicId: string
}

/**
 * Verifies an uploaded asset actually belongs to this user and satisfies our
 * size/format limits, using the Cloudinary Admin API (not client-supplied
 * data). Deletes and rejects anything that fails.
 */
export async function confirmUpload(uid: string, publicId: string): Promise<ConfirmedUpload> {
  if (!configureOnce()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED')
  }

  if (!publicId.startsWith(`${userFolder(uid)}/`)) {
    throw new Error('UPLOAD_OWNER_MISMATCH')
  }

  const resource = await cloudinary.api.resource(publicId, { resource_type: 'image' })

  const format = String(resource.format ?? '').toLowerCase()
  const bytes = Number(resource.bytes ?? 0)

  if (!ALLOWED_FORMATS.includes(format) || bytes > MAX_PHOTO_BYTES || bytes <= 0) {
    await destroyUpload(publicId)
    throw new Error('UPLOAD_REJECTED')
  }

  return { url: String(resource.secure_url), publicId }
}

export async function destroyUpload(publicId: string): Promise<void> {
  if (!configureOnce()) return
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
  } catch (error) {
    console.error('[cloudinary] Failed to destroy asset:', publicId, error)
  }
}

/** Extract Cloudinary public_id from a secure_url we issued (for account deletion cleanup). */
export function publicIdFromCloudinaryUrl(url: string): string | null {
  if (!isOwnCloudinaryUrl(url)) return null
  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/** True if the URL is one of our own confirmed Cloudinary assets (defense in depth for report writes). */
export function isOwnCloudinaryUrl(url: string): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) return false

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    if (parsed.hostname !== 'res.cloudinary.com') return false
    return parsed.pathname.startsWith(`/${cloudName}/image/upload/`) &&
      parsed.pathname.includes(`/${ROOT_FOLDER}/`)
  } catch {
    return false
  }
}
