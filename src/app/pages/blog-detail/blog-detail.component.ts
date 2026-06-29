import { Component, Inject, OnInit, OnDestroy, PLATFORM_ID, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DOCUMENT, DatePipe, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title, Meta } from '@angular/platform-browser';
import { BlogService } from '../../services/blog.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { HoverDirective } from '../../directives/hover.directive';
import { BlogTag } from '../../types/blog.types';

@Component({
  selector: 'app-blog-detail',
  imports: [RouterLink, DatePipe, FormsModule, MarkdownPipe, NgTemplateOutlet, HoverDirective],
  templateUrl: './blog-detail.component.html',
})
export class BlogDetailComponent implements OnInit, OnDestroy {
  blog = signal<any>(null);
  loading = signal(true);
  notFound = signal(false);

  // Table of contents + reading progress (desktop margin rail)
  toc = signal<{ id: string; text: string; level: number; active: boolean }[]>([]);
  readProgress = signal(0);
  private headings: HTMLElement[] = [];
  private onScroll?: () => void;

  bookmarked = signal(false);
  bookmarkLoading = signal(false);

  comments = signal<any[]>([]);
  commentsLoading = signal(true);
  commentText = '';
  submittingComment = signal(false);
  deletingComment = signal<number | null>(null);

  // Read-next, AI key takeaways, and author-follow state
  related = signal<any[]>([]);
  summary = signal<string[]>([]);
  summaryLoading = signal(false);
  following = signal(false);
  followers = signal(0);
  followLoading = signal(false);

  isOwner = computed(() => {
    const b = this.blog();
    const user = this.auth.session()?.user;
    return b && user && b.userId === user.id;
  });

  authorId = computed<string>(() => this.blog()?.user?.id ?? this.blog()?.userId ?? '');
  canFollow = computed<boolean>(() => {
    const uid = this.auth.session()?.user?.id;
    const aid = this.authorId();
    return !!aid && uid !== aid;
  });

  /** Only decorate the body with a drop cap when the first block is a genuine
   *  paragraph — never a heading, list, quote, image, or a bold pseudo-title
   *  (which is what made it look broken). */
  useDropCap = computed<boolean>(() => {
    const content = (this.blog()?.content ?? '').trim();
    if (!content) return false;
    const firstLine = content.split('\n').map((l: string) => l.trim()).find(Boolean) ?? '';
    if (/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|```|~~~|!\[|<|\|)/.test(firstLine)) return false; // heading/list/quote/code/img/html/table
    if (/^(\*\*|__).+(\*\*|__)$/.test(firstLine) && firstLine.length < 120) return false; // bold-only pseudo-heading
    return firstLine.replace(/[*_`#>]/g, '').length >= 40; // long enough to anchor a drop cap
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private blogService: BlogService,
    readonly auth: AuthService,
    private toast: ToastService,
    private titleService: Title,
    private metaService: Meta,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit() {
    const param = this.route.snapshot.paramMap.get('id') ?? '';
    if (!param) { this.router.navigate(['/explore']); return; }

    this.blogService.getBlog(param).subscribe({
      next: (b) => {
        if (!b) { this.notFound.set(true); }
        else {
          this.blog.set(b);
          const id = b.id as number;
          const description = (b.content ?? '').replace(/[#*`>_~\[\]]/g, '').slice(0, 160).trim();
          const author = b.user ? `${b.user.firstName ?? ''} ${b.user.lastName ?? ''}`.trim() : '';
          this.titleService.setTitle(`${b.title} | TheBlogSphere`);
          this.metaService.updateTag({ name: 'description', content: description });
          this.metaService.updateTag({ property: 'og:title', content: b.title });
          this.metaService.updateTag({ property: 'og:description', content: description });
          if (b.coverImage) this.metaService.updateTag({ property: 'og:image', content: b.coverImage });
          if (author) this.metaService.updateTag({ name: 'author', content: author });
          this.metaService.updateTag({ property: 'og:type', content: 'article' });
          const canonical = this.doc.querySelector('link[rel="canonical"]');
          if (canonical && this.doc.location) canonical.setAttribute('href', this.doc.location.href);
          this.setArticleJsonLd(b, description, author);
          this.blogService.incrementViews(id).subscribe();
          if (this.auth.session()) {
            this.blogService.checkBookmark(id).subscribe(r => this.bookmarked.set(r.bookmarked));
          }
          this.loadComments(id);
          this.loadExtras(id, b);
          if (isPlatformBrowser(this.platformId)) {
            // Enhance the body (promote pseudo-headings) and index it once painted.
            this.enhanceArticle();
          }
        }
        this.loading.set(false);
      },
      error: () => { this.notFound.set(true); this.loading.set(false); },
    });
  }

  private loadComments(id: number) {
    this.blogService.getComments(id).subscribe({
      next: (c) => { this.comments.set(c); this.commentsLoading.set(false); },
      error: () => this.commentsLoading.set(false),
    });
  }

  /** Read-next, AI takeaways, and follow status — all non-blocking. */
  private loadExtras(id: number, blog: any) {
    this.blogService.getRelated(id).subscribe({
      next: (r) => this.related.set(r ?? []),
      error: () => {},
    });

    // AI summary is browser-only — never block SSR prerender on a Groq call.
    if (isPlatformBrowser(this.platformId)) {
      this.summaryLoading.set(true);
      this.blogService.getSummary(id).subscribe({
        next: (r) => { this.summary.set(r?.summary ?? []); this.summaryLoading.set(false); },
        error: () => this.summaryLoading.set(false),
      });
    }

    const aid = blog?.user?.id ?? blog?.userId;
    if (aid) {
      this.blogService.getFollowStatus(aid).subscribe({
        next: (s) => { this.following.set(s.following); this.followers.set(s.followers); },
        error: () => {},
      });
    }
  }

  toggleFollow() {
    if (!this.auth.session()) { this.toast.show('Sign in to follow writers.', 'info'); return; }
    const aid = this.authorId();
    if (!aid || this.followLoading()) return;
    this.followLoading.set(true);
    const req = this.following() ? this.blogService.unfollow(aid) : this.blogService.follow(aid);
    req.subscribe({
      next: () => {
        const now = !this.following();
        this.following.set(now);
        this.followers.update((n) => Math.max(0, n + (now ? 1 : -1)));
        this.followLoading.set(false);
        if (now) this.toast.show('Following — new stories will appear in your feed.', 'success');
      },
      error: () => this.followLoading.set(false),
    });
  }

  tagsOf(blog: any): string[] {
    return (blog?.tags ?? []).map((bt: any) => bt.tag?.name).filter(Boolean);
  }

  /** Inject Article structured data (JSON-LD) so search engines and social
   *  previews understand the story. Rendered server-side during SSR. */
  private setArticleJsonLd(blog: any, description: string, author: string) {
    const ld: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: blog.title,
      description,
      datePublished: blog.publishDate ?? blog.createdAt,
      dateModified: blog.updatedAt ?? blog.publishDate ?? blog.createdAt,
      author: author ? { '@type': 'Person', name: author } : undefined,
      publisher: { '@type': 'Organization', name: 'TheBlogSphere' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': this.doc.location?.href },
    };
    if (blog.coverImage) ld['image'] = blog.coverImage;

    const existing = this.doc.getElementById('article-jsonld');
    if (existing) existing.remove();
    const script = this.doc.createElement('script');
    script.id = 'article-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(ld);
    this.doc.head.appendChild(script);
  }

  toggleBookmark() {
    if (!this.auth.session()) { this.toast.show('Sign in to bookmark stories.', 'info'); return; }
    const id = this.blog()?.id;
    if (!id) return;
    this.bookmarkLoading.set(true);
    if (this.bookmarked()) {
      this.blogService.removeBookmark(id).subscribe({
        next: () => { this.bookmarked.set(false); this.bookmarkLoading.set(false); },
        error: () => this.bookmarkLoading.set(false),
      });
    } else {
      this.blogService.addBookmark(id).subscribe({
        next: () => { this.bookmarked.set(true); this.bookmarkLoading.set(false); this.toast.show('Saved to bookmarks.', 'success'); },
        error: () => this.bookmarkLoading.set(false),
      });
    }
  }

  submitComment() {
    if (!this.commentText.trim()) return;
    if (!this.auth.session()) { this.toast.show('Sign in to comment.', 'info'); return; }
    const blogId = this.blog()?.id;
    if (!blogId) return;
    this.submittingComment.set(true);
    this.blogService.addComment(blogId, this.commentText).subscribe({
      next: (c) => {
        this.comments.update(list => [c, ...list]);
        this.commentText = '';
        this.submittingComment.set(false);
      },
      error: () => { this.toast.show('Could not post comment.', 'error'); this.submittingComment.set(false); },
    });
  }

  deleteComment(id: number) {
    this.deletingComment.set(id);
    this.blogService.deleteComment(id).subscribe({
      next: () => { this.comments.update(c => c.filter(x => x.id !== id)); this.deletingComment.set(null); },
      error: () => this.deletingComment.set(null),
    });
  }

  readTime(content: string): number {
    const plain = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return Math.max(1, Math.ceil(plain.split(/\s+/).length / 200));
  }

  // ── Sharing ───────────────────────────────────────────────
  private get currentUrl(): string {
    return this.doc.location?.href ?? '';
  }

  copyLink() {
    const nav = this.doc.defaultView?.navigator as Navigator | undefined;
    if (nav?.clipboard) {
      nav.clipboard.writeText(this.currentUrl)
        .then(() => this.toast.show('Link copied to clipboard.', 'success'))
        .catch(() => this.toast.show('Could not copy link.', 'error'));
    }
  }

  sharePost() {
    const nav = this.doc.defaultView?.navigator as (Navigator & { share?: (d: any) => Promise<void> }) | undefined;
    if (nav?.share) {
      nav.share({ title: this.blog()?.title ?? 'TheBlogSphere', url: this.currentUrl }).catch(() => {});
    } else {
      this.copyLink();
    }
  }

  shareUrl(network: 'x' | 'linkedin'): string {
    const url = encodeURIComponent(this.currentUrl);
    const text = encodeURIComponent(this.blog()?.title ?? '');
    return network === 'x'
      ? `https://twitter.com/intent/tweet?url=${url}&text=${text}`
      : `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
  }

  scrollToTop() {
    this.doc.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Article enhancement + table of contents ──────────────────
  /** Much real-world content is written with bold paragraphs instead of real
   *  headings (`<p><strong>Section</strong></p>`). We promote those into a deck
   *  + proper <h2> sections so the page gains hierarchy, a contents rail, and
   *  accessible structure. Retries until the markdown body has painted. */
  private enhanceArticle(attempt = 0) {
    const root = this.doc.querySelector('.article-prose') as HTMLElement | null;
    if (!root || root.childElementCount === 0) {
      if (attempt < 12) {
        this.doc.defaultView?.requestAnimationFrame(() => this.enhanceArticle(attempt + 1));
      }
      return;
    }
    if (root.dataset['enhanced'] === '1') return;
    root.dataset['enhanced'] = '1';

    let deckDone = false;
    for (const node of Array.from(root.children)) {
      if (node.tagName !== 'P' || node.children.length !== 1) continue;
      const strong = node.firstElementChild as HTMLElement;
      if (strong.tagName !== 'STRONG') continue;
      const text = (node.textContent ?? '').trim();
      // The <strong> must span the entire paragraph, and be short enough to read
      // as a heading rather than an emphasised sentence.
      if (!text || text !== (strong.textContent ?? '').trim() || text.length > 110) continue;

      if (!deckDone) {
        // First bold line = the article's standfirst / deck.
        const deck = this.doc.createElement('p');
        deck.className = 'article-deck';
        deck.textContent = text;
        node.replaceWith(deck);
        deckDone = true;
      } else {
        const h2 = this.doc.createElement('h2');
        h2.textContent = text;
        node.replaceWith(h2);
      }
    }

    this.buildToc(root);
  }

  /** Index every heading (promoted or native), give them stable ids, and wire
   *  up scroll-spy for the contents rail. */
  private buildToc(root: HTMLElement) {
    const nodes = Array.from(root.querySelectorAll('h2, h3')) as HTMLElement[];
    const seen = new Set<string>();
    const items: { id: string; text: string; level: number; active: boolean }[] = [];
    const headings: HTMLElement[] = [];
    for (const el of nodes) {
      const text = (el.textContent ?? '').trim();
      if (!text) continue;
      let id = el.id || this.slugify(text);
      while (seen.has(id)) id = `${id}-x`;
      seen.add(id);
      el.id = id;
      el.style.scrollMarginTop = '108px';
      items.push({ id, text, level: el.tagName === 'H3' ? 3 : 2, active: false });
      headings.push(el);
    }

    this.headings = headings;
    this.toc.set(items);
    if (items.length) this.setupScrollSpy();
  }

  private slugify(s: string): string {
    return (
      s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) ||
      'section'
    );
  }

  private setupScrollSpy() {
    const view = this.doc.defaultView;
    if (!view) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const scrollTop = view.scrollY;
      const docH = this.doc.documentElement.scrollHeight - view.innerHeight;
      this.readProgress.set(docH > 0 ? Math.min(100, Math.max(0, (scrollTop / docH) * 100)) : 0);

      let activeId = this.toc()[0]?.id;
      for (const el of this.headings) {
        if (el.getBoundingClientRect().top <= 120) activeId = el.id;
        else break;
      }
      this.toc.update((list) => list.map((i) => ({ ...i, active: i.id === activeId })));
    };
    this.onScroll = () => {
      if (!ticking) {
        ticking = true;
        view.requestAnimationFrame(update);
      }
    };
    view.addEventListener('scroll', this.onScroll, { passive: true });
    update();
  }

  scrollToHeading(id: string, ev: Event) {
    ev.preventDefault();
    const el = this.doc.getElementById(id);
    const view = this.doc.defaultView;
    if (el && view) {
      const top = el.getBoundingClientRect().top + view.scrollY - 100;
      view.scrollTo({ top, behavior: 'smooth' });
    }
  }

  ngOnDestroy() {
    if (this.onScroll) this.doc.defaultView?.removeEventListener('scroll', this.onScroll);
  }

  wordCount(content: string): number {
    const plain = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return plain ? plain.split(/\s+/).length : 0;
  }

  blogTags(): BlogTag['tag'][] {
    return (this.blog()?.tags ?? []).map((bt: BlogTag) => bt.tag);
  }

  avatarGradient(name: string): string {
    const gradients = [
      'linear-gradient(135deg,#C15C3D,#A8472E)',
      'linear-gradient(135deg,#4A443C,#1A1714)',
      'linear-gradient(135deg,#B5894E,#8C6A36)',
      'linear-gradient(135deg,#6E7E5B,#4A5740)',
      'linear-gradient(135deg,#C97B53,#A8472E)',
      'linear-gradient(135deg,#8A8378,#4A443C)',
    ];
    return gradients[(name?.charCodeAt(0) ?? 0) % gradients.length];
  }
}
