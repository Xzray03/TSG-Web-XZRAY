/**
 * Lightweight stdlib XSS sanitizer — no dependencies.
 * Strips HTML tags, dangerous protocols, and escapes characters.
 * ponytail: use DOMPurify if rehype/remark/MDX added later.
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
};

const ESCAPE_RE = /[&<>"'`]/g;
const PROTOCOL_RE = /(javascript|vbscript|data|file):/gi;
// Block event handler assignments (oNcLiCk=, onload=, etc.) and eval().
// Pattern `on\w+\s*=` only matches when followed by =, so "only"/"online" pass through.
const EVENT_HANDLER_RE = /\bon[a-z]+\s*=/gi;

export function escapeHtml(str: string): string {
  return str.replace(ESCAPE_RE, (c) => ESCAPE_MAP[c]);
}

export function stripHtml(str: string): string {
  return str
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Block dangerous protocol schemes
    .replace(PROTOCOL_RE, '[blocked-protocol]:')
    // Block event handler assignments that survive tag stripping
    .replace(EVENT_HANDLER_RE, 'blocked-handler=');
}

/** Sanitize user text input: strip tags, dangerous protocols, escape entities, trim, cap length. */
export function sanitize(input: string, maxLength = 2000): string {
  if (!input || typeof input !== 'string') return '';
  return escapeHtml(stripHtml(input)).trim().slice(0, maxLength);
}

/** Sanitize URL (allow http/https and data:image/, block javascript: scheme). */
export function sanitizeUrl(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:image\/[a-z0-9+.-]+;base64,/i.test(trimmed) && trimmed.length <= 4_000_000) return trimmed;
  return '';
}
