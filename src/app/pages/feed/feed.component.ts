import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { HoverDirective } from '../../directives/hover.directive';
import { AmbientDirective } from '../../directives/ambient.directive';
import { GenCoverComponent } from '../../components/gen-cover/gen-cover.component';

@Component({
  selector: 'app-feed',
  imports: [RouterLink, HoverDirective, AmbientDirective, GenCoverComponent],
  templateUrl: './feed.component.html',
})
export class FeedComponent implements OnInit {
  blogs = signal<any[]>([]);
  loading = signal(true);

  constructor(private blogService: BlogService) {}

  ngOnInit() {
    this.blogService.getFeed().subscribe({
      next: (b) => { this.blogs.set(b); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  excerpt(content: string): string {
    const plain = (content ?? '')
      .replace(/#{1,6}\s+/g, '').replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/_([^_]+)_/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1').replace(/^\s*[-*+]\s+/gm, '').replace(/\n+/g, ' ').trim();
    return plain.length > 140 ? plain.slice(0, 140) + '...' : plain;
  }

  readTime(content: string): number {
    return Math.max(1, Math.ceil((content ?? '').trim().split(/\s+/).length / 200));
  }

  blogTags(blog: any): string[] {
    return (blog.tags ?? []).map((bt: any) => bt.tag.name);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  avatarGradient(name: string): string {
    const g = ['linear-gradient(135deg,#C15C3D,#A8472E)','linear-gradient(135deg,#4A443C,#1A1714)','linear-gradient(135deg,#B5894E,#8C6A36)','linear-gradient(135deg,#6E7E5B,#4A5740)','linear-gradient(135deg,#C97B53,#A8472E)','linear-gradient(135deg,#8A8378,#4A443C)'];
    return g[(name?.charCodeAt(0) ?? 0) % g.length];
  }
}
