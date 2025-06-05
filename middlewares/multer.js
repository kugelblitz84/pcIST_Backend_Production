import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../configs/cloudinary.js';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'event_images', // folder in Cloudinary account
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const parser = multer({ storage });

export default parser;
