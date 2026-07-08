import { Router } from 'express'
import {
  confirmUpload,
  isCloudinaryReady,
  signUpload,
  ALLOWED_FORMATS,
  MAX_PHOTOS_PER_REPORT,
  MAX_PHOTO_BYTES,
} from '../lib/cloudinary.js'
import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../middleware/auth.js'
import { uploadRateLimit } from '../middleware/rateLimit.js'

export const uploadsRouter = Router()

/** Public — lets the client hide the photo UI entirely if uploads aren't configured. */
uploadsRouter.get('/status', (_req, res) => {
  res.json({
    enabled: isCloudinaryReady(),
    maxPhotos: MAX_PHOTOS_PER_REPORT,
    maxBytes: MAX_PHOTO_BYTES,
    allowedFormats: ALLOWED_FORMATS,
  })
})

uploadsRouter.post(
  '/sign',
  requireAuth,
  requireVerifiedEmail,
  uploadRateLimit,
  (req: AuthenticatedRequest, res) => {
    const uid = req.auth?.uid
    if (!uid) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    try {
      const payload = signUpload(uid)
      res.json(payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'CLOUDINARY_NOT_CONFIGURED') {
        res.status(503).json({ error: 'Photo uploads are not configured on the server.' })
        return
      }
      console.error('Error signing upload:', error)
      res.status(500).json({ error: 'Failed to prepare upload.' })
    }
  },
)

uploadsRouter.post(
  '/confirm',
  requireAuth,
  requireVerifiedEmail,
  uploadRateLimit,
  async (req: AuthenticatedRequest, res) => {
    const uid = req.auth?.uid
    if (!uid) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    const publicId = req.body?.publicId
    if (typeof publicId !== 'string' || !publicId.trim()) {
      res.status(400).json({ error: 'publicId is required.' })
      return
    }

    try {
      const confirmed = await confirmUpload(uid, publicId.trim())
      res.json(confirmed)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'CLOUDINARY_NOT_CONFIGURED') {
        res.status(503).json({ error: 'Photo uploads are not configured on the server.' })
        return
      }
      if (message === 'UPLOAD_OWNER_MISMATCH') {
        res.status(403).json({ error: 'This upload does not belong to your account.' })
        return
      }
      if (message === 'UPLOAD_REJECTED') {
        res.status(400).json({ error: 'Photo was rejected (wrong format or too large) and removed.' })
        return
      }
      console.error('Error confirming upload:', error)
      res.status(400).json({ error: 'Could not verify uploaded photo.' })
    }
  },
)
