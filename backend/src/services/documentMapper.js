const { randomUUID } = require('node:crypto');
const path = require('node:path');

function createDocumentRecord(file, owner) {
  return {
    id: randomUUID(),
    originalName: path.basename(file.originalname.replace(/\\/g, '/')) || 'document',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    mimeType: file.mimetype,
    storageName: file.filename,
  };
}

function toPublicDocument(document) {
  return {
    id: document.id,
    originalName: document.originalName,
    size: document.size,
    uploadedAt: document.uploadedAt,
    owner: document.owner,
  };
}

module.exports = { createDocumentRecord, toPublicDocument };