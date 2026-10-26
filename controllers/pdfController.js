const path = require('path');
const {
  uploadPdf,
  uploadBulkPdf,
  getAllPdfs,
  deletePdf,
} = require('../models/pdfModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const getFolderName = (folderName) => {
  if (folderName === undefined || folderName === '') {
    return '';
  }

  if (
    typeof folderName !== 'string' ||
    folderName.trim() !== folderName ||
    folderName.includes('\\') ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f]/.test(folderName) ||
    folderName.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new AppError('folderName must be a valid folder path', 400);
  }

  return folderName;
};

// GET /api/pdf
const getPdfList = catchAsync(async (req, res, next) => {
  const { cursor, limit, prefix } = req.query;
  const limitNum = Number(limit);

  // Input validation
  if (limit && (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 500)) {
    return next(new AppError('Limit must be a number between 1 and 500', 400));
  }
  if (prefix && typeof prefix !== 'string') {
    return next(new AppError('Prefix must be a string', 400));
  }

  const data = await getAllPdfs({
    cursor: cursor || null,
    limit: limitNum || 100,
    prefix: prefix || 'pdfs/',
  });

  res.status(200).json({
    success: true,
    data,
  });
});

// POST /api/pdf/upload
const uploadPdfHandler = catchAsync(async (req, res, next) => {
  const file = req.file || (req.files && req.files[0]);

  if (!file) {
    return next(new AppError('File is required', 400));
  }

  if (file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
    return next(new AppError('Only PDF files are allowed', 400));
  }

  const folderName = getFolderName(req.body.folderName);
  const { name } = path.parse(file.originalname);
  const publicId = ['pdfs', folderName, name].filter(Boolean).join('/');

  const result = await uploadPdf(file.buffer, publicId);

  res.status(201).json({
    publicId: result.public_id,
    url: result.secure_url,
  });
});

// BULK upload
const bulkUploadPdfHandler = catchAsync(async (req, res, next) => {
  let files = [];
  if (req.files && req.files.length > 0) {
    // eslint-disable-next-line prefer-destructuring
    files = req.files;
  } else if (req.file) {
    files = [req.file];
  }

  if (!files || files.length === 0) {
    return next(new AppError('No files uploaded', 400));
  }

  if (files.length > 200) {
    return next(new AppError('Max 200 files allowed', 400));
  }

  const hasInvalidFile = files.some(
    (file) =>
      file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')
  );
  if (hasInvalidFile) {
    return next(new AppError('Only PDF files are allowed', 400));
  }

  const folderName = getFolderName(req.body.folderName);
  const publicIds = files.map((file) => {
    const { name } = path.parse(file.originalname);
    return ['pdfs', folderName, name].filter(Boolean).join('/');
  });

  const results = await uploadBulkPdf(files, publicIds);

  res.status(201).json({
    total: files.length,
    uploaded: results.filter((r) => r.publicId).length,
    failed: results.filter((r) => r.error).length,
    results,
  });
});

// DELETE /api/pdf/:id
const deletePdfHandler = catchAsync(async (req, res, next) => {
  let identifier =
    req.params.id ||
    req.params.filename ||
    req.query.publicId ||
    req.query.id ||
    req.query.filename ||
    (req.body && (req.body.publicId || req.body.id || req.body.filename || req.body.url));

  if (Array.isArray(identifier)) {
    identifier = identifier.join('/');
  }

  if (!identifier) {
    return next(new AppError('Please provide a PDF id, publicId, or filename to delete', 400));
  }

  // Resolve publicId: strip file extension and guarantee pdfs/ prefix
  let cleanId = identifier.trim();
  if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
    const match = cleanId.match(/pdfs\/(.+)$/);
    if (match) {
      cleanId = `pdfs/${match[1]}`;
    } else {
      const urlParts = cleanId.split('/');
      cleanId = urlParts.slice(-2).join('/');
    }
  }
  const withoutPrefix = cleanId.replace(/^pdfs\//, '');
  const { dir, name } = path.parse(withoutPrefix);
  const publicId = dir ? `pdfs/${dir}/${name}` : `pdfs/${name}`;

  const result = await deletePdf(publicId);

  if (result.result === 'not found') {
    return next(new AppError(`PDF with id/filename '${identifier}' not found`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'PDF deleted successfully',
    publicId,
    result,
  });
});

module.exports = {
  getPdfList,
  uploadPdfHandler,
  bulkUploadPdfHandler,
  deletePdfHandler,
};
