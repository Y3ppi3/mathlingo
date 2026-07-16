import DOMPurify from 'dompurify';

// Wraps DOMPurify for any dangerouslySetInnerHTML call site. Task content,
// answer options, and rendered LaTeX are all admin-authored today, but this
// stays cheap defense-in-depth against a compromised admin account or a
// future less-trusted content source. See .claude/skills/secure-coding.
export function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html);
}
