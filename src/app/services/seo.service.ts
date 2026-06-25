import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoTags {
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  /** Path for the canonical URL, e.g. '/explore'. Defaults to current URL. */
  canonicalPath?: string;
}

/**
 * Centralises per-route document title, meta description, Open Graph / Twitter
 * tags and the canonical link. Works during SSR (so crawlers and link unfurlers
 * see the right tags in the server-rendered HTML).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(
    private title: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private doc: Document,
  ) {}

  set(tags: SeoTags): void {
    const pageTitle = tags.title.includes('TheBlogSphere')
      ? tags.title
      : `${tags.title} | TheBlogSphere`;

    this.title.setTitle(pageTitle);
    this.meta.updateTag({ property: 'og:title', content: tags.title });
    this.meta.updateTag({ name: 'twitter:title', content: tags.title });
    this.meta.updateTag({ property: 'og:type', content: tags.type ?? 'website' });

    if (tags.description) {
      this.meta.updateTag({ name: 'description', content: tags.description });
      this.meta.updateTag({ property: 'og:description', content: tags.description });
      this.meta.updateTag({ name: 'twitter:description', content: tags.description });
    }
    if (tags.image) {
      this.meta.updateTag({ property: 'og:image', content: tags.image });
      this.meta.updateTag({ name: 'twitter:image', content: tags.image });
    }

    this.setCanonical(tags.canonicalPath);
  }

  private setCanonical(path?: string): void {
    const origin = this.doc.location?.origin;
    const href = path && origin ? new URL(path, origin).href : this.doc.location?.href;
    if (!href) return;

    let link = this.doc.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}
