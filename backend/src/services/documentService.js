const { createDocumentRecord, toPublicDocument } = require('./documentMapper');

function createServiceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function removeUploadedFile(documentRepository, fileName) {
  try {
    await documentRepository.removeFile(fileName);
    return true;
  } catch {
    return false;
  }
}

function createDocumentService(documentRepository) {
  return {
    async createDocument(file, owner) {
      if (!file) {
        throw createServiceError(400, 'VALIDATION_ERROR', 'O arquivo é obrigatório.');
      }

      if (file.size === 0) {
        const wasRemoved = await removeUploadedFile(documentRepository, file.filename);
        if (!wasRemoved) {
          throw createServiceError(500, 'FILE_CLEANUP_FAILED', 'Não foi possível limpar o arquivo inválido.');
        }
        throw createServiceError(400, 'VALIDATION_ERROR', 'O arquivo não pode estar vazio.');
      }

      const document = createDocumentRecord(file, owner);

      try {
        documentRepository.save(document);
      } catch (error) {
        await removeUploadedFile(documentRepository, file.filename);
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