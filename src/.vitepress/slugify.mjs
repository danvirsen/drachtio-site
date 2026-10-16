// Heading anchors: lower-case, punctuation removed, spaces to hyphens ("drachtio.conf.xml" ->
// "drachtioconfxml"). Kept instead of VitePress's default so that existing links and anchors
// stay stable.
export function slugify(text) {
  return text.normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
    .replace(/[^\w\s-]/g, '').trim().toLowerCase()
    .replace(/[-\s]+/g, '-');
}
