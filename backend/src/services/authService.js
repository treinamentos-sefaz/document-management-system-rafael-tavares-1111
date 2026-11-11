const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const dummyHash = bcrypt.hashSync('senha-ficticia-de-autenticacao', 12);

function authError(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

function validateCredentials(email, password) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    || typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw authError(400, 'VALIDATION_ERROR', 'Informe um email e uma senha válidos.');
  }
  return email.trim().toLowerCase();
}

function createAuthService(userRepository, jwtSecret, jwtExpiresIn) {
  return {
    async register(credentials) {
      const { email, password } = credentials || {};
      const normalizedEmail = validateCredentials(email, password);
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await userRepository.create({ id: randomUUID(), email: normalizedEmail, passwordHash });
      if (!user) throw authError(409, 'EMAIL_ALREADY_REGISTERED', 'Email já cadastrado.');
      return { id: user.id, email: user.email };
    },
    async login(credentials) {
      const { email, password } = credentials || {};
      const normalizedEmail = validateCredentials(email, password);
      const user = await userRepository.findByEmail(normalizedEmail);
      const matches = await bcrypt.compare(password, user?.passwordHash || dummyHash);
      if (!user || !matches) throw authError(401, 'INVALID_CREDENTIALS', 'Email ou senha inválidos.');
      return {
        token: jwt.sign({}, jwtSecret, { algorithm: 'HS256', subject: user.id, expiresIn: jwtExpiresIn }),
        user: { id: user.id, email: user.email },
      };
    },
  };
}

module.exports = { createAuthService };