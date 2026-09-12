import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const nano = customAlphabet(alphabet, 14);

/** Prefixed, sortable-enough identifiers that read well in audit logs. */
export function id(prefix = 'id') {
  return `${prefix}_${nano()}`;
}

export function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Next sequence number for a reference series such as POL-IAM-00x. */
export function padNumber(n, width = 3) {
  return String(n).padStart(width, '0');
}
