const path = require('node:path');

const storageDirectory = path.resolve(__dirname, '../../storage');
const megabyte = 1024 * 1024;
const defaultMaxFileSizeBytes = 10 * megabyte;

const supportedFileTypes = {
  '.csv': ['text/csv'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.pdf': ['application/pdf'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.txt': ['text/plain'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

function getMaxFileSizeBytes(value = process.env.MAX_FILE_SIZE_MB) {
  if (value === undefined || value === '') {
    return defaultMaxFileSizeBytes;
  }

  const sizeInMegabytes = Number(value);
  if (!Number.isFinite(sizeInMegabytes) || sizeInMegabytes <= 0) {
    throw new Error('MAX_FILE_SIZE_MB deve ser um número maior que zero.');
  }

  return Math.floor(sizeInMegabytes * megabyte);
}

function getAllowedMimeTypes(value = process.env.ALLOWED_MIME_TYPES) {
  const defaultMimeTypes = Object.values(supportedFileTypes).flat();
  const mimeTypes = value === undefined
    ? defaultMimeTypes
    : value.split(',').map((mimeType) => mimeType.trim().toLowerCase()).filter(Boolean);

  if (mimeTypes.length === 0) {
    throw new Error('ALLOWED_MIME_TYPES deve conter ao menos um tipo MIME.');
  }

  return new Set(mimeTypes);
}

function isAllowedFileType(file, allowedMimeTypes) {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();
  const supportedMimeTypes = supportedFileTypes[extension];

  return Boolean(
    supportedMimeTypes
    && supportedMimeTypes.includes(mimeType)
    && allowedMimeTypes.has(mimeType),
  );
}

module.exports = {
  getAllowedMimeTypes,
  getMaxFileSizeBytes,
  isAllowedFileType,
  storageDirectory,
};