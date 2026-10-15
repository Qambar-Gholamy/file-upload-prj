const express = require('express');
const {
  getAudioList,
  uploadAudioHandler,
  bulkUploadAudioHandler,
  deleteAudioHandler,
} = require('../controllers/audioController');

const { upload } = require('../utils/uploadMiddleware');

const router = express.Router();

// GET all audios
// http://localhost:3000/api/audio
router.get('/', getAudioList);

// Upload audio
// http://localhost:3000/api/audio/upload
router.post('/upload', upload.any(), uploadAudioHandler);
router.post('/bulk-upload', upload.any(), bulkUploadAudioHandler);

// Delete audio by id, publicId, or filename
// DELETE http://localhost:3000/api/audio/:id or /api/audio/sounds/:id
router.delete('/{*id}', deleteAudioHandler);
router.delete('/', deleteAudioHandler);

module.exports = router;