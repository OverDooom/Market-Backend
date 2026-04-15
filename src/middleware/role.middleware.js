// src/middleware/role.middleware.js

module.exports = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // auth middleware must run before this
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: insufficient permissions'
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};