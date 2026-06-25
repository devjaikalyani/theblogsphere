import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BlogService } from '../../services/blog.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-my-stories',
  imports: [RouterLink, DatePipe],
  templateUrl: './my-stories.component.html',
})
export class MyStoriesComponent implements OnInit {
  blogs = signal<any[]>([]);
  loading = signal(true);
  deleting = signal<number | null>(null);

  published = computed(() => this.blogs().filter(b => b.status === 'published'));
  drafts = computed(() => this.blogs().filter(b => b.status === 'draft'));

  constructor(
    private blogService: BlogService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.blogService.getMyBlogs().subscribe({
      next: (b) => { this.blogs.set(b); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  delete(id: number) {
    this.deleting.set(id);
    this.blogService.deleteBlog(id).subscribe({
      next: () => {
        this.blogs.update(b => b.filter(x => x.id !== id));
        this.deleting.set(null);
        this.toast.show('Story deleted.', 'info');
      },
      error: () => {
        this.deleting.set(null);
        this.toast.show('Could not delete story.', 'error');
      },
    });
  }

  private stripHtml(content: string): string {
    return (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  wordCount(content: string): number {
    const plain = this.stripHtml(content);
    return plain ? plain.split(/\s+/).length : 0;
  }

  readTime(content: string): number {
    return Math.max(1, Math.ceil(this.wordCount(content) / 200));
  }

  excerpt(content: string): string {
    const plain = this.stripHtml(content);
    return plain.length > 160 ? plain.slice(0, 160) + '...' : plain;
  }

  tags(blog: any): string[] {
    return (blog.tags ?? []).map((bt: any) => bt.tag.name);
  }
}
