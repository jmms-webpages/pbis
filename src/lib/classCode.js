// Unambiguous alphabet: no 0/O, 1/I/L confusion — these codes get read
// aloud in a classroom and typed by 11-year-olds, so legibility matters
// more than entropy. 6 chars from a 31-symbol alphabet is ~1.4 billion
// possibilities, plenty for a school with a few hundred classes.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateClassCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
