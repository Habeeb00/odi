// Room invite code: short, human-typeable, excludes visually ambiguous
// characters (0/O, 1/I/L) so it's easy to read aloud or copy-paste.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase();
}
