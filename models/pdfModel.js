const cloudinary = require('../utils/cloudinary');

const uploadPdf = (buffer, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        public_id: publicId,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });

const getAllPdfs = async ({ cursor = null, limit = 100, prefix = 'pdfs/' } = {}) => {
  // Basic validation
  if (limit > 1000 || limit < 1) throw new Error('Limit must be between 1 and 1000');
  if (cursor && typeof cursor !== 'string') throw new Error('Cursor must be a string');

  const params = {
    resource_type: 'image',
    type: 'upload',
    max_results: Math.min(limit, 1000),
    total_count: true,
    prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
  };
  if (cursor) {
    params.next_cursor = cursor;
  }

  let result;
  try {
    result = await cloudinary.api.resources(params);
  } catch (error) {
    params.resource_type = 'raw';
    result = await cloudinary.api.resources(params);
  }

  // Stable ID from public_id basename
  const pdfs = result.resources.map((r) => ({
    id: r.public_id.split('/').pop().replace(/[^a-zA-Z0-9]/g, '_'),
    publicId: r.public_id,
    url: r.secure_url,
  }));

  return {
    pdfs,
    nextCursor: result.next_cursor,
    hasMore: !!result.next_cursor,
    totalCount: result.total_count || 0,
  };
};

// bulk upload
const uploadBulkPdf = async (files, publicIds) => {
  const results = [];

  // sequential to avoid rate limit
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const publicId = publicIds[i];

    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await uploadPdf(file.buffer, publicId);

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

// delete pdf
const deletePdf = (publicId) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: 'image' },
      async (error, result) => {
        if (error) return reject(error);

        // If not found under 'image', try 'raw'
        if (result && result.result === 'not found') {
          try {
            const rawResult = await cloudinary.uploader.destroy(publicId, {
              resource_type: 'raw',
            });

            if (rawResult && rawResult.result === 'not found' && !publicId.endsWith('.pdf')) {
              const rawWithExtResult = await cloudinary.uploader.destroy(`${publicId}.pdf`, {
                resource_type: 'raw',
              });
              return resolve(rawWithExtResult);
            }

            return resolve(rawResult);
          } catch (rawError) {
            return reject(rawError);
          }
        }

        resolve(result);
      }
    );
  });

module.exports = {
  uploadPdf,
  uploadBulkPdf,
  getAllPdfs,
  deletePdf,
};
