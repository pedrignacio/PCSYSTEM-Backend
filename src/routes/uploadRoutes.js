const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const upload = require('../config/multer');

router.post('/image', upload.single('file'), uploadController.uploadImage);
router.post('/video', upload.single('file'), uploadController.uploadVideo);

module.exports = router;