

exports.validateEmail = (email) => {
  return typeof email === 'string' && email.includes('@');
};

exports.validatePassword = (password) => {
  return typeof password === 'string' && password.length >= 6;
};

exports.validateRequiredFields = (fields) => {
  for (const key in fields) {
    if (!fields[key]) {
      return `${key} is required`;
    }
  }
  return null;
};