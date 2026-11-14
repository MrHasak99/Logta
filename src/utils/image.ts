export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const MAX_WIDTH = 1024
const JPEG_QUALITY = 0.8

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })

/**
 * Resizes the image to max 1024px width via canvas and re-encodes as JPEG
 * at 0.8 quality before base64 encoding. Phone photos (4-8 MB) shrink to
 * roughly 100-250 KB, so the vision call is fast and memory stays small.
 * The image is only held in component state - never written to localStorage.
 */
export const compressImage = async (file: File): Promise<string> => {
  const original = await readAsDataUrl(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Invalid image'))
      el.src = original
    })
    const scale = Math.min(1, MAX_WIDTH / img.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.fillStyle = '#fff' // flatten PNG/WEBP transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } catch {
    return original
  }
}
