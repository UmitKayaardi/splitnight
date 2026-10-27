/** Short random ids for items and people. Not security-sensitive. */
export function newId(prefix = 'x'): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `${prefix}${bytes[0]!.toString(36)}${bytes[1]!.toString(36).slice(0, 3)}`;
}
