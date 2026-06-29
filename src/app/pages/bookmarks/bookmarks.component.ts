import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { ToastService } from '../../services/toast.service';
import { RevealDirective } from '../../directives/reveal.directive';
import { HoverDirective } from '../../directives/hover.directive';

@Component({
  selector: 'app-bookmarks',
  imports: [RouterLink, RevealDirective, HoverDirective],
  templateUrl: './bookmarks.component.html',
})
export class BookmarksComponent implements OnInit {
  blogs = signal<any[]>([]);
  loading = signal(true);
  removing = signal<number | null>(null);

  constructor(private blogService: BlogService, private toast: ToastService) {}

  ngOnInit() {
    this.blogService.getBookmarks().subscribe({
      next: (b) => { this.blogs.set(b); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  remove(blogId: number) {
    this.removing.set(blogId);
    this.blogService.removeBookmark(blogId).subscribe({
      next: () => {
        this.blogs.update(b => b.filter(x => x.id !== blogId));
        this.removing.set(null);
        this.toast.show('Removed from bookmarks.', 'info');
      },
      error: () => { this.removing.set(null); this.toast.show('Could not remove bookmark.', 'error'); },
    });
  }

  excerpt(content: string): string {
    const plain = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > 140 ? plain.slice(0, 140) + '...' : plain;
  }

  readTime(content: string): number {
    const plain = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return Math.max(1, Math.ceil(plain.split(/\s+/).length / 200));
  }

  blogTags(blog: any): string[] {
    return (blog.tags ?? []).map((bt: any) => bt.tag.name);
  }

  avatarGradient(name: string): string {
    const g = ['linear-gradient(135deg,#C15C3D,#A8472E)','linear-gradient(135deg,#4A443C,#1A1714)','linear-gradient(135deg,#B5894E,#8C6A36)','linear-gradient(135deg,#6E7E5B,#4A5740)','linear-gradient(135deg,#C97B53,#A8472E)','linear-gradient(135deg,#8A8378,#4A443C)'];
    return g[(name?.charCodeAt(0) ?? 0) % g.length];
  }
}
