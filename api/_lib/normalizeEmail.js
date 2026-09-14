function normalizeEmail(raw) {
  return (raw || '').toString().trim().toLowerCase();
}

module.exports = { normalizeEmail };
