import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DOCUMENT, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title, Meta } from '@angular/platform-browser';
import { BlogService } from '../../services/blog.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { BlogTag } from '../../types/blog.types';

@Component({
  selector: 'app-blog-detail',
  imports: [RouterLink, DatePipe, FormsModule, MarkdownPipe],
  templateUrl: './blog-detail.component.html',
})
export class BlogDetailComponent implements OnInit {
  blog = signal<any>(null);
  loading = signal(true);
  notFound = signal(false);

  bookmarked = signal(false);
  bookmarkLoading = signal(false);

  comments = signal<any[]>([]);
  commentsLoading = signal(true);
  commentText = '';
  submittingComment = signal(false);
  deletingComment = signal<number | null>(null);

  isOwner = computed(() => {
    const b = this.blog();
    const user = this.auth.session()?.user;
    return b && user && b.userId === user.id;
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
