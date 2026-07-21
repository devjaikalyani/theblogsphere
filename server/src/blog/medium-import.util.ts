/** Parsing for Medium export archives, the "posts/*.html" files a writer gets
 *  from medium.com/me/export. Pure string work on the known Medium markup, no
 *  DOM dependency: the result is stored through the same sanitizer as every
 *  other write, so imperfect extraction degrades to odd formatting, never to
 *  unsafe HTML. */

export interface ParsedMediumPost {
  title: string;
  html: string;
  /** Whether Medium had published it (vs a Medium draft). Informational: the
   *  import always lands as a TheBlogSphere draft for the writer to review. */
  wasPublished: boolean;
  canonicalUrl: string | null;
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');

const stripTags = (s: string): string => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Extract one post from a Medium export HTML file. Returns null when the file
 *  is not a Medium post (profile.html, README, etc.) or is a short comment-
 *  style "response" rather than a story. */
export function parseMediumExportHtml(fileName: string, html: string): ParsedMediumPost | null {
  const bodyMarker = html.indexOf('data-field="body"');
  if (bodyMarker === -1) return null;

  // Body: from the end of the section tag carrying data-field="body" up to the
  // article footer. The section nests further <section> tags, so a balanced
  // match is not possible with the closing tag alone; the footer boundary is.
  const bodyStart = html.indexOf('>', bodyMarker) + 1;
  let bodyEnd = html.indexOf('<footer', bodyStart);
  if (bodyEnd === -1) bodyEnd = html.indexOf('</article', bodyStart);
  if (bodyEnd === -1) bodyEnd = html.length;
  let body = html.slice(bodyStart, bodyEnd);

  // Title: the h-entry heading, falling back to <title>.
  const h1 = html.match(/<h1[^>]*class="[^"]*p-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  const title = decodeEntities(stripTags(h1?.[1] ?? titleTag?.[1] ?? '')).slice(0, 200);

  // Medium repeats the title as the first heading of the body; drop that copy.
  const hadTitleHeading = /class="[^"]*graf--title[^"]*"/.test(body);
  body = body.replace(/<h[13][^>]*class="[^"]*graf--title[^"]*"[^>]*>[\s\S]*?<\/h[13]>/, '');

  // Responses (Medium comments) are exported like posts but have no title
  // heading and very little text; importing them as stories is noise.
  const plainLength = stripTags(body).length;
  if (!hadTitleHeading && plainLength < 280) return null;
  if (!title && plainLength < 280) return null;

  const canonical = html.match(/<a[^>]+class="[^"]*p-canonical[^"]*"[^>]+href="([^"]+)"/);
  const wasPublished =
    html.includes('class="dt-published"') || !/^draft[_-]/i.test(fileName.split('/').pop() ?? fileName);

  return {
    title: title || 'Untitled import',
    html: body.trim(),
    wasPublished,
    canonicalUrl: canonical?.[1] ?? null,
  };
}
