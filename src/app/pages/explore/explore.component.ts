import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { SeoService } from '../../services/seo.service';
import { RevealDirective } from '../../directives/reveal.directive';
import { HoverDirective } from '../../directives/hover.directive';
import { AmbientDirective } from '../../directives/ambient.directive';
import { GenCoverComponent } from '../../components/gen-cover/gen-cover.component';

@Component({
  selector: 'app-explore',
  imports: [FormsModule, RouterLink, RevealDirective, HoverDirective, AmbientDirective, GenCoverComponent],
  templateUrl: './explore.component.html',
})
export class ExploreComponent implements OnInit {
  blogs = signal<any[]>([]);
  tags = signal<any[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  /** Mirrors the server's BLOGS_PER_PAGE so the running index stays a stable,
   *  continuous ordinal across pages (page 2 starts at 11, not 01). */
  readonly pageSize = 10;
  search = '';
  selectedTag = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private blogService: BlogService,
    seo: SeoService,
  ) {
    seo.set({
      title: 'Explore Stories | TheBlogSphere',
      description: 'Browse and discover stories across all topics on TheBlogSphere. Search by keyword or filter by tag.',
      canonicalPath: '/explore',
    });
  }

  ngOnInit() {
    this.load(1);
    this.blogService.getTags().subscribe({ next: (t) => this.tags.set(t), error: () => {} });
  }

  load(page: number) {
    this.loading.set(true);
    this.blogService.getBlogs(page, this.search, this.selectedTag()).subscribe({
      next: (data) => {
        this.blogs.set(data.blogs ?? []);
        this.totalPages.set(data.totalPages ?? 1);
        this.total.set(data.total ?? 0);
        this.currentPage.set(page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(1), 350);
  }

  selectTag(slug: string) {
    this.selectedTag.set(this.selectedTag() === slug ? '' : slug);
    this.load(1);
  }

  clearFilters() {
    this.search = '';
    this.selectedTag.set('');
    this.load(1);
  }

  get hasFilters(): boolean {
    return !!this.search || !!this.selectedTag();
  }

  /** Continuous 1-based position across pages, for the editorial running index. */
  globalIndex(i: number): number {
    return (this.currentPage() - 1) * this.pageSize + i + 1;
  }

  blogTags(blog: any): string[] {
    return (blog.tags ?? []).map((bt: any) => bt.tag.name);
  }

  excerpt(content: string) {
    const plain = (content ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return plain.length > 150 ? plain.slice(0, 150) + '...' : plain;
  }

  formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  readTime(content: string): number {
    return Math.max(1, Math.ceil((content ?? '').split(' ').length / 200));
  }

  avatarGradient(name: string): string {
    const gradients = [
      'linear-gradient(135deg, #C15C3D, #A8472E)',
      'linear-gradient(135deg, #4A443C, #1A1714)',
      'linear-gradient(135deg, #B5894E, #8C6A36)',
      'linear-gradient(135deg, #6E7E5B, #4A5740)',
      'linear-gradient(135deg, #C97B53, #A8472E)',
      'linear-gradient(135deg, #8A8378, #4A443C)',
    ];
    return gradients[(name ?? '?').charCodeAt(0) % gradients.length];
  }

  pages() {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }
}
