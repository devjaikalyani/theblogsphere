import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { SeoService } from '../../services/seo.service';
import { RevealDirective } from '../../directives/reveal.directive';
import { HoverDirective } from '../../directives/hover.directive';

@Component({
  selector: 'app-trending',
  imports: [RouterLink, RevealDirective, HoverDirective],
  templateUrl: './trending.component.html',
})
export class TrendingComponent implements OnInit {
  blogs = signal<any[]>([]);
  loading = signal(true);

  constructor(
    private blogService: BlogService,
    seo: SeoService,
  ) {
    seo.set({
      title: 'Trending Stories | TheBlogSphere',
      description: 'The 100 most popular stories on TheBlogSphere right now, ranked by readership and engagement.',
      canonicalPath: '/trending',
    });
  }

  ngOnInit() {
    this.blogService.getTrending().subscribe({
      next: (b) => { this.blogs.set(b ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  blogTags(blog: any): string[] {
    return (blog.tags ?? []).map((bt: any) => bt.tag.name);
  }

  formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** Compact view count: 1234 -> "1.2k", 12345 -> "12k". */
  formatViews(n: number): string {
    const v = n ?? 0;
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return `${v}`;
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
}
