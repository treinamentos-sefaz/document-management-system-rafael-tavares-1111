const { randomUUID } = require('node:crypto');
const path = require('node:path');

function createServiceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
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

function createDocumentService(documentRepository) {
  return {
    async createDocument(file, owner) {
      if (!file) {
        throw createServiceError(400, 'VALIDATION_ERROR', 'O arquivo é obrigatório.');
      }

      if (file.size === 0) {
        await documentRepository.removeFile(file.filename);
        throw createServiceError(400, 'VALIDATION_ERROR', 'O arquivo não pode estar vazio.');
      }

      const originalName = path.basename(file.originalname.replace(/\\/g, '/')) || 'document';
      const document = {
        id: randomUUID(),
        originalName,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        owner,
        mimeType: file.mimetype,
        storageName: file.filename,
      };

      try {
        documentRepository.save(document);
      } catch (error) {
        try {
          await documentRepository.removeFile(file.filename);
        } catch {
          // Mantém a falha original; a limpeza é apenas compensatória.
        }
        throw error;
      }

      return toPublicDocument(document);
    },

    listDocuments(owner) {
      return documentRepository.findAllByOwner(owner).map(toPublicDocument);
    },

    findDocumentForDownload(id, owner) {
      const document = documentRepository.findByIdAndOwner(id, owner);
      if (!document) {
        return undefined;
      }

      return {
        filePath: documentRepository.getFilePath(document.storageName),
        mimeType: document.mimeType,
        originalName: document.originalName,
      };
    },
  };
}

module.exports = { createDocumentService };