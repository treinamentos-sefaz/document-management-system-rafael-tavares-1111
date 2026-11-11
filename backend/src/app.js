const express = require('express');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { createDocumentRepository } = require('./repositories/documentRepository');
const { createUserRepository } = require('./repositories/userRepository');
const { createDocumentService } = require('./services/documentService');
const { createAuthService } = require('./services/authService');
const { createAuthRouter } = require('./routes/authRoutes');
const { createAuthenticateUser } = require('./middleware/authenticateUser');
const {
  createDocumentRouter,
  getAllowedMimeTypes,
  getMaxFileSizeBytes,
  getMaxUploadsPerMinute,
} = require('./routes/documentRoutes');
const { storageDirectory: defaultStorageDirectory } = require('./config/upload');

const PORT = process.env.PORT || 3000;

function createApp({
  storageDirectory = defaultStorageDirectory,
  dataDirectory = path.resolve(__dirname, '../data'),
  maxFileSizeBytes = getMaxFileSizeBytes(),
  maxUploadsPerMinute = getMaxUploadsPerMinute(),
  allowedMimeTypes = getAllowedMimeTypes(),
  jwtSecret = process.env.JWT_SECRET,
  jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h',
  maxAuthAttempts = 20,
} = {}) {
  if (typeof jwtSecret !== 'string' || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET deve conter pelo menos 32 bytes.');
  }
  try {
    const payload = jwt.decode(jwt.sign({}, jwtSecret, { expiresIn: jwtExpiresIn }));
    if (payload.exp <= payload.iat) throw new Error('Expiração inválida.');
  } catch {
    throw new Error('JWT_EXPIRES_IN deve ser uma duração válida e positiva.');
  }

  const app = express();
  const documentRepository = createDocumentRepository(storageDirectory);
  const documentService = createDocumentService(documentRepository);
  const userRepository = createUserRepository(dataDirectory);
  const authService = createAuthService(userRepository, jwtSecret, jwtExpiresIn);
  const authenticateOwner = createAuthenticateUser(userRepository, jwtSecret);

  app.use(express.json());
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(createAuthRouter(authService, maxAuthAttempts));
  app.use(createDocumentRouter({
    documentService,
    storageDirectory,
    maxFileSizeBytes,
    maxUploadsPerMinute,
    allowedMimeTypes,
    authenticateOwner,
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
