const crypto = require('crypto');

// Alphabet excludes ambiguous characters (0/O, 1/I/L) to keep codes easy to type from an email.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode() {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3) code += '-';
  }
  return code;
}

async function generateUniqueCode(db, collection = 'couples') {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const snap = await db.collection(collection).doc(code).get();
    if (!snap.exists) return code;
  }
  throw new Error('Impossible de générer un code unique après plusieurs tentatives.');
}

module.exports = { generateCode, generateUniqueCode };
