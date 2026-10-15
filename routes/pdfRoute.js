const express = require('express');
const {
  getPdfList,
  uploadPdfHandler,
  bulkUploadPdfHandler,
  deletePdfHandler,
} = require('../controllers/pdfController');

const { upload } = require('../utils/uploadMiddleware');

const router = express.Router();

// GET all pdfs
// http://localhost:3000/api/pdf
router.get('/', getPdfList);

// Upload single pdf
// http://localhost:3000/api/pdf/upload
router.post('/upload', upload.any(), uploadPdfHandler);

// Bulk upload pdfs
// http://localhost:3000/api/pdf/bulk-upload
router.post('/bulk-upload', upload.any(), bulkUploadPdfHandler);

// Delete pdf by id, publicId, or filename
// DELETE http://localhost:3000/api/pdf/:id or /api/pdf/pdfs/:id
router.delete('/{*id}', deletePdfHandler);
router.delete('/', deletePdfHandler);

module.exports = router;
