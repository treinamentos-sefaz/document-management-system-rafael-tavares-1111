const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const express = require('express');
const multer = require('multer');
const {
  getAllowedMimeTypes,
  getMaxFileSizeBytes,
  getMaxUploadsPerMinute,
  isAllowedFileType,
} = require('../config/upload');
const { createDocumentController } = require('../controllers/documentController');

function createDocumentRouter({
  documentService,
  storageDirectory,
  maxFileSizeBytes,
  maxUploadsPerMinute,
  allowedMimeTypes,
  authenticateOwner,
}) {
  const router = express.Router();
  const controller = createDocumentController(documentService);
  const uploadWindows = new Map();
  let lastWindowCleanup = 0;
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
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
      fields: 0,
      parts: 1,
      fieldNameSize: 64,
      headerPairs: 50,
    },
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

  function limitUploadRate(req, res, next) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    if (now - lastWindowCleanup >= windowMs) {
      for (const [ip, window] of uploadWindows) {
        if (window.resetAt <= now) {
          uploadWindows.delete(ip);
        }
      }
      lastWindowCleanup = now;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const currentWindow = uploadWindows.get(ip);
    const window = currentWindow && currentWindow.resetAt > now
      ? currentWindow
      : { count: 0, resetAt: now + windowMs };

    if (window.count >= maxUploadsPerMinute) {
      res.set('Retry-After', String(Math.ceil((window.resetAt - now) / 1000)));
      res.status(429).json({
        error: { code: 'UPLOAD_RATE_LIMITED', message: 'Limite de uploads atingido. Tente novamente em breve.' },
      });
      return;
    }

    window.count += 1;
    uploadWindows.set(ip, window);
    next();
  }

  function validateDemoOwner(req, res, next) {
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

  function validateAuthenticatedOwner(req, res, next) {
    const owner = req.user?.id;
    if (typeof owner !== 'string' || !owner.trim() || owner.trim().length > 100) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' },
      });
      return;
    }

    req.owner = owner.trim();
    next();
  }

  const ownerMiddleware = authenticateOwner
    ? [authenticateOwner, validateAuthenticatedOwner]
    : [validateDemoOwner];

  router.post('/upload', ownerMiddleware, limitUploadRate, upload.single('file'), controller.upload);
  router.get('/documents', ownerMiddleware, controller.list);
  router.get('/documents/:id/download', ownerMiddleware, controller.download);

  return router;
}

module.exports = {
  createDocumentRouter,
  getAllowedMimeTypes,
  getMaxFileSizeBytes,
  getMaxUploadsPerMinute,
};