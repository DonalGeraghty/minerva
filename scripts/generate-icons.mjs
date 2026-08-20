import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const filePath = (relativePath) => fileURLToPath(new URL(relativePath, import.meta.url))
const source = filePath('../artwork/Minerva-icon-source.png')
const iconsDirectory = filePath('../public/icons/')

await mkdir(iconsDirectory, { recursive: true })

const maskableArtwork = await sharp(source)
  .resize(410, 410, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer()

await Promise.all([
  sharp(source)
    .resize(32, 32, { fit: 'cover' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(filePath('../public/minerva-favicon-32.png')),
  sharp(source)
    .resize(180, 180, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(filePath('../public/apple-touch-icon.png')),
  sharp(source)
    .resize(192, 192, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(filePath('../public/icons/minerva-192.png')),
  sharp(source)
    .resize(512, 512, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(filePath('../public/icons/minerva-512.png')),
  sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 3, g: 3, b: 3, alpha: 1 },
    },
  })
    .composite([{ input: maskableArtwork, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(filePath('../public/icons/minerva-maskable-512.png')),
])

console.log('Generated optimized Minerva icons')
