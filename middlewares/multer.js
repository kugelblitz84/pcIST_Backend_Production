import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, "/event_images");
  },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  },
});

const parser = multer({ storage });

export default parser;
