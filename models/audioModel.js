const cloudinary = require('../utils/cloudinary');

const uploadAudio = (buffer, publicId) =>
 new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        public_id: publicId,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });

const getAllAudios = async ({
  cursor = null,
  limit = 100,
  prefix = 'sounds/',
  folderName = '',
} = {}) => {
  // Basic validation
  if (limit > 1000 || limit < 1) throw new Error('Limit must be between 1 and 1000');
  if (cursor && typeof cursor !== 'string') throw new Error('Cursor must be a string');

  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const params = {
    resource_type: 'video',
    type: 'upload',
    max_results: Math.min(limit, 1000),
    total_count: true,
    prefix: folderName
      ? `${normalizedPrefix}${folderName.replace(/^\/+|\/+$/g, '')}/`
      : normalizedPrefix,
  };
  if (cursor) {
    params.next_cursor = cursor;
  }

  const result = await cloudinary.api.resources(params);

  // Stable ID from public_id basename
  const audios = result.resources.map((r) => ({
    id: r.public_id.split('/').pop().replace(/[^a-zA-Z0-9]/g, '_'),
    publicId: r.public_id,
    url: r.secure_url,
  })).filter((audio) => (
    !folderName ||
    (audio.publicId.includes(folderName) && audio.url.includes(folderName))
  ));

  return {
    audios,
    nextCursor: result.next_cursor,
    hasMore: !!result.next_cursor,
    totalCount: result.total_count || 0,
  };
};


// bulk upload
const uploadBulkAudio = async (files, publicIds) => {
  const results = [];

  // ⚠️ sequential to avoid rate limit
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const publicId = publicIds[i];

    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await uploadAudio(file.buffer, publicId);

      results.push({
        index: i + 1,
        publicId: res.public_id,
        url: res.secure_url,
      });
    } catch (error) {
      results.push({
        success: false,
        index: i + 1,
        error: error.message,
      });
    }
  }

  return results;
};

// delete audio
const deleteAudio = (publicId) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: 'video' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
  });

module.exports = {
  uploadAudio,
  uploadBulkAudio,
  getAllAudios,
  deleteAudio,
};