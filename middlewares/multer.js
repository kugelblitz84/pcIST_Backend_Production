import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, "/");
  },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  },
});

const uploadEventImages = multer({ storage }).array("images", 30);

// const uploadEventImages = parser.fields([
//   { name: 'image1', maxCount: 1 },
//   { name: 'image2', maxCount: 1 },
//   { name: 'image3', maxCount: 1 },
//   { name: 'image4', maxCount: 1 },
// ]);

export default uploadEventImages;
