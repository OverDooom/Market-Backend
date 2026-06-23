





exports.trimStr = (val) => {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
};










exports.requireStr = (val, field, max, min = 1) => {
  const trimmed = exports.trimStr(val);

  if (!trimmed) {
    const err = new Error(`${field} is required`);
    err.status = 400;
    throw err;
  }

  if (trimmed.length < min) {
    const err = new Error(`${field} must be at least ${min} characters`);
    err.status = 400;
    throw err;
  }

  if (trimmed.length > max) {
    const err = new Error(`${field} must be at most ${max} characters`);
    err.status = 400;
    throw err;
  }

  return trimmed;
};









exports.optionalStr = (val, field, max) => {
  if (val === null || val === undefined || String(val).trim() === '') {
    return null;
  }

  const trimmed = String(val).trim();

  if (trimmed.length > max) {
    const err = new Error(`${field} must be at most ${max} characters`);
    err.status = 400;
    throw err;
  }

  return trimmed;
};

/**
 * Validate a phone number.
 * Allows optional leading +, then digits, spaces, dashes, parentheses.
 * Between 7 and 20 characters after trimming.
 */
exports.validatePhone = (val, field = 'phone') => {
  if (val === null || val === undefined || String(val).trim() === '') {
    return null;
  }

  const trimmed = String(val).trim();
  const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;

  if (!phoneRegex.test(trimmed)) {
    const err = new Error(
      `${field} is invalid. Use digits, spaces, dashes, parentheses, ` +
      `and an optional leading +. Between 7 and 20 characters.`
    );
    err.status = 400;
    throw err;
  }

  return trimmed;
};