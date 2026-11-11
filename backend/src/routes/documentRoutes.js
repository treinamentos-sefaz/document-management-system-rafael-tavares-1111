const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const express = require('express');
const multer = require('multer');
const {
  getAllowedMimeTypes,
  getMaxFileSizeBytes,
  isAllowedFileType,
} = require('../config/upload');
const { createDocumentController } = require('../controllers/documentController');

function createDocumentRouter({ documentService, storageDirectory, maxFileSizeBytes, allowedMimeTypes }) {
  const router = express.Router();
  const controller = createDocumentController(documentService);
  const storage = multer.diskStorage({
    destination(req, file, callback) {
      fs.mkdir(storageDirectory, { recursive: true }, (error) => {
        callback(error, storageDirectory);
      });
    },
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: maxFileSizeBytes },
    fileFilter(req, file, callback) {
      if (!isAllowedFileType(file, allowedMimeTypes)) {
        const error = new Error('Tipo de arquivo não permitido.');
        error.statusCode = 415;
        error.code = 'UNSUPPORTED_MEDIA_TYPE';
        callback(error);
        return;
      }

      callback(null, true);
    },
  });

  function validateOwner(req, res, next) {
    const owner = req.get('X-User-Id')?.trim();
    if (!owner || owner.length > 100) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'O cabeçalho X-User-Id é obrigatório e deve ter até 100 caracteres.',
        },
      });
      return;
    }

    req.owner = owner;
    next();
  }

  router.post('/upload', validateOwner, upload.single('file'), controller.upload);
  router.get('/documents', validateOwner, controller.list);
  router.get('/documents/:id/download', validateOwner, controller.download);

  return router;
}

module.exports = {
  createDocumentRouter,
  getAllowedMimeTypes,
  getMaxFileSizeBytes,
};