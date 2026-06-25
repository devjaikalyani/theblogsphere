/** URL-safe slug from a title (accents stripped, length-capped).
 *  Shared by BlogService (on create) and the backfill script so they always
 *  agree. The full slug stored on a post is `${slugify(title)}-${id}`. */
export function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '') || 'post';
}
