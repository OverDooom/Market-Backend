

module.exports = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      
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