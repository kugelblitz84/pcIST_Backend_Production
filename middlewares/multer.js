import multer from "multer";

// Try to import sharp, but handle gracefully if not available
let sharp = null;
let sharpAvailable = false;

try {
  const sharpModule = await import("sharp");
  sharp = sharpModule.default;
  sharpAvailable = true;
  //console.log("Sharp image compression is available");
} catch (error) {
  console.warn(
    "Sharp not available, image compression disabled:",
    error.message
  );
  sharp = null;
  sharpAvailable = false;
}

// Use memory storage instead of disk storage
const storage = multer.memoryStorage();

// Image compression middleware
export const compressImages = async (req, res, next) => {
  // Skip compression entirely for now (can be enabled later)
  console.log("Image compression is currently disabled");
  return next();

  /* 
  // Compression code (disabled for now but kept for future use)
  if (!req.files || req.files.length === 0) {
    return next();
  }

  // If Sharp is not available, skip compression
  if (!sharpAvailable || !sharp) {
    console.warn("Skipping image compression - Sharp not installed");
    return next();
  }

  try {
    // Compress each uploaded image
    const compressedFiles = await Promise.all(
      req.files.map(async (file) => {
        try {
          const compressedBuffer = await sharp(file.buffer)
            .resize(1920, 1080, {
              fit: "inside",
              withoutEnlargement: true,
            }) // Max dimensions
            .jpeg({
              quality: 80, // Adjust quality (1-100)
              progressive: true,
            })
            .toBuffer();

          return {
            ...file,
            buffer: compressedBuffer,
            size: compressedBuffer.length,
            mimetype: "image/jpeg", // Convert all to JPEG
            originalname: file.originalname.replace(
              /\.(png|gif|webp)$/i,
              ".jpg"
            ),
          };
        } catch (sharpError) {
          console.warn(
            `Failed to compress ${file.originalname}, using original:`,
            sharpError.message
          );
          return file; // Return original file if compression fails
        }
      })
    );

    req.files = compressedFiles;
    next();
  } catch (error) {
    console.error("Image compression error:", error);
    // Continue with original files if compression fails
    next();
  }
  */
};

const uploadEventImages = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
}).array("images", 30);

export default uploadEventImages;
