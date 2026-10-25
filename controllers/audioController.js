const path = require('path');
const {
  uploadAudio,
  uploadBulkAudio,
  getAllAudios,
  deleteAudio,
} = require('../models/audioModel');
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

// GET /api/audio
const getAudioList = catchAsync(async (req, res, next) => {
  const { cursor, limit, prefix } = req.query;
  const limitNum = Number(limit);

  // Input validation
  if (limit && (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 500)) {
    return next(new AppError('Limit must be a number between 1 and 500', 400));
  }
  if (prefix && typeof prefix !== 'string') {
    return next(new AppError('Prefix must be a string', 400));
  }

  const data = await getAllAudios({
    cursor: cursor || null,
    limit: limitNum || 100,
    prefix: prefix || 'sounds/'
  });

  res.status(200).json({
    success: true,
    data,
  });
});

// POST /api/audio/upload
const uploadAudioHandler = catchAsync(async (req, res, next) => {
  const file = req.file || (req.files && req.files[0]);

  if (!file) {
    return next(new AppError('File is required', 400));
  }

  const folderName = getFolderName(req.body && req.body.folderName);
  const { name } = path.parse(file.originalname);
  const publicId = ['sounds', folderName, name].filter(Boolean).join('/');

  const result = await uploadAudio(file.buffer, publicId);

  res.status(201).json({
    publicId: result.public_id,
    url: result.secure_url,
  });
});

// BULK upload
const bulkUploadAudioHandler = catchAsync(async (req, res, next) => {
  let files = [];
  if (req.files && req.files.length > 0) {
  ({files} = req.files);
  } else if (req.file) {
    files = [req.file];
  }

  if (!files || files.length === 0) {
    return next(new AppError('No files uploaded', 400));
  }

  if (files.length > 200) {
    return next(new AppError('Max 200 files allowed', 400));
  }

  const folderName = getFolderName(req.body && req.body.folderName);
  const publicIds = files.map((file) => {
    const { name } = path.parse(file.originalname);
    return ['sounds', folderName, name].filter(Boolean).join('/');
  });

  const results = await uploadBulkAudio(files, publicIds);

  res.status(201).json({
    total: files.length,
    uploaded: results.filter(r => r.publicId).length,
    failed: results.filter(r => r.error).length,
    results,
  });
});

// DELETE /api/audio/:id
const deleteAudioHandler = catchAsync(async (req, res, next) => {
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
    return next(new AppError('Please provide an audio id, publicId, or filename to delete', 400));
  }

  // Resolve publicId: strip file extension and guarantee sounds/ prefix
  let cleanId = identifier.trim();
  if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
    const match = cleanId.match(/sounds\/(.+)$/);
    if (match) {
      cleanId = `sounds/${match[1]}`;
    } else {
      const urlParts = cleanId.split('/');
      cleanId = urlParts.slice(-2).join('/');
    }
  }
  const withoutPrefix = cleanId.replace(/^sounds\//, '');
  const { dir, name } = path.parse(withoutPrefix);
  const publicId = dir ? `sounds/${dir}/${name}` : `sounds/${name}`;

  const result = await deleteAudio(publicId);

  if (result.result === 'not found') {
    return next(new AppError(`Audio with id/filename '${identifier}' not found`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Audio deleted successfully',
    publicId,
    result,
  });
});

module.exports = {
  getAudioList,
  uploadAudioHandler,
  bulkUploadAudioHandler,
  deleteAudioHandler,
};
