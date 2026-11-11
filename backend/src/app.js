const express = require('express');
const { createDocumentRepository } = require('./repositories/documentRepository');
const { createDocumentService } = require('./services/documentService');
const { createDocumentRouter, getAllowedMimeTypes, getMaxFileSizeBytes } = require('./routes/documentRoutes');
const { storageDirectory: defaultStorageDirectory } = require('./config/upload');

const PORT = process.env.PORT || 3000;

function createApp({
  storageDirectory = defaultStorageDirectory,
  maxFileSizeBytes = getMaxFileSizeBytes(),
  allowedMimeTypes = getAllowedMimeTypes(),
} = {}) {
  const app = express();
  const documentRepository = createDocumentRepository(storageDirectory);
  const documentService = createDocumentService(documentRepository);

  app.use(express.json());
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(createDocumentRouter({
    documentService,
    storageDirectory,
    maxFileSizeBytes,
    allowedMimeTypes,
  }));
  app.use((req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
    });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o limite permitido.' },
      });
      return;
    }

    if (error.code && error.code.startsWith('LIMIT_')) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'O formulário de upload é inválido.' },
      });
      return;
    }

    const statusCode = error.statusCode || 500;
    const isInternalError = statusCode >= 500;
    res.status(statusCode).json({
      error: {
        code: isInternalError ? 'INTERNAL_SERVER_ERROR' : error.code,
        message: isInternalError ? 'Não foi possível processar a solicitação.' : error.message,
      },
    });
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
