import multer from "multer";

/**
 * Memory-based multer — files are held in memory as Buffer,
 * then converted to a data URI for Cloudinary upload.
 */
const storage = multer.memoryStorage();

export const upload = multer({ storage });
