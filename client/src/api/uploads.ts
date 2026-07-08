import { apiFetch } from './http'

export interface UploadSignature {
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

export interface UploadStatus {
  enabled: boolean
  maxPhotos: number
  maxBytes: number
  allowedFormats: string[]
}

/** Whether photo uploads are configured server-side — checked once to decide if the UI should render. */
export async function fetchUploadStatus(): Promise<UploadStatus> {
  return apiFetch<UploadStatus>('/api/uploads/status', { auth: false })
}

export async function requestUploadSignature(): Promise<UploadSignature> {
  return apiFetch<UploadSignature>('/api/uploads/sign', { method: 'POST', auth: true })
}

interface CloudinaryUploadResponse {
  public_id: string
  secure_url: string
  error?: { message: string }
}

/** Uploads directly to Cloudinary (binary never touches our server) with progress reporting. */
export function uploadFileToCloudinary(
  file: File,
  sig: UploadSignature,
  onProgress?: (percent: number) => void,
): Promise<{ publicId: string; url: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', sig.apiKey)
    formData.append('timestamp', String(sig.timestamp))
    formData.append('signature', sig.signature)
    formData.append('folder', sig.folder)
    formData.append('transformation', sig.transformation)
    formData.append('allowed_formats', sig.allowedFormats)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      let data: CloudinaryUploadResponse | null = null
      try {
        data = JSON.parse(xhr.responseText) as CloudinaryUploadResponse
      } catch {
        // fall through to error below
      }

      if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) {
        resolve({ publicId: data.public_id, url: data.secure_url })
      } else {
        reject(new Error(data?.error?.message || 'Upload failed. Please try again.'))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload.'))
    xhr.send(formData)
  })
}

/** Server verifies size/format/ownership via the Cloudinary Admin API before we trust the URL. */
export async function confirmUpload(publicId: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/api/uploads/confirm', {
    method: 'POST',
    body: { publicId },
    auth: true,
  })
}
