function createAuthController(authService) {
  return {
    async register(req, res, next) {
      try {
        const user = await authService.register(req.body);
        res.status(201).json({ user });
      } catch (error) {
        next(error);
      }
    },
    async login(req, res, next) {
      try {
        res.json(await authService.login(req.body));
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createAuthController };