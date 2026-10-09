import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { AppError } from '../utils/errors.js';

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Upload a single image buffer to Cloudinary or local fallback
 * @param {Buffer} buffer
 * @param {string} originalName
 * @returns {Promise<string>} Image URL
 */
export async function uploadImage(buffer, originalName = 'photo.jpg') {
  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'rent-flatmate-finder/listings',
          resource_type: 'image',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      uploadStream.end(buffer);
    });
  }

  // In production, ephemeral local storage is disallowed to prevent data loss
  if (process.env.NODE_ENV === 'production') {
    throw new AppError(
      500,
      'Cloudinary persistent storage is not configured. File uploads are disabled in production without persistent object storage.'
    );
  }

  // Fallback to local storage if Cloudinary credentials are not configured in development/test
  const uploadsDir = path.resolve('uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const rawExt = path.extname(originalName) || '.jpg';
  const ext = /^\.[a-zA-Z0-9]+$/.test(rawExt) ? rawExt.toLowerCase() : '.jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
  const filepath = path.join(uploadsDir, filename);

  // Path containment guard against directory traversal
  if (!path.resolve(filepath).startsWith(uploadsDir)) {
    throw new Error('Invalid upload destination path');
  }

  fs.writeFileSync(filepath, buffer);

  const port = process.env.PORT || 5000;
  return `http://localhost:${port}/uploads/${filename}`;
}

/**
 * Upload multiple files to Cloudinary or local fallback
 * @param {Array<{ buffer: Buffer, originalname: string }>} files
 * @returns {Promise<string[]>}
 */
export async function uploadImages(files = []) {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    const url = await uploadImage(file.buffer, file.originalname);
    urls.push(url);
  }
  return urls;
}
