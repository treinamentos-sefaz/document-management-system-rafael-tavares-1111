const jwt = require('jsonwebtoken');

function createAuthenticateUser(userRepository, jwtSecret) {
  return async (req, res, next) => {
    const match = /^Bearer\s+([^\s]+)$/i.exec(req.get('Authorization') || '');
    let payload;
    try {
      if (!match) throw new Error('Token ausente.');
      payload = jwt.verify(match[1], jwtSecret, { algorithms: ['HS256'] });
      if (typeof payload !== 'object' || typeof payload.sub !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sub)
        || typeof payload.exp !== 'number') throw new Error('Token inválido.');
    } catch {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' } });
    }

    try {
      const user = await userRepository.findById(payload.sub);
      if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' } });
      req.user = { id: user.id };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createAuthenticateUser };