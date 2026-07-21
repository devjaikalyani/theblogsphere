import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BlogService } from '../../services/blog.service';
import { ToastService } from '../../services/toast.service';
import { RevealDirective } from '../../directives/reveal.directive';
import { HoverDirective } from '../../directives/hover.directive';

@Component({
  selector: 'app-my-stories',
  imports: [RouterLink, DatePipe, RevealDirective, HoverDirective],
  templateUrl: './my-stories.component.html',
})
export class MyStoriesComponent implements OnInit {
  blogs = signal<any[]>([]);
  loading = signal(true);
  deleting = signal<number | null>(null);
  importing = signal(false);

  published = computed(() => this.blogs().filter(b => b.status === 'published'));
  drafts = computed(() => this.blogs().filter(b => b.status === 'draft'));

  constructor(
    private blogService: BlogService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.loadStories();
  }

  private loadStories() {
    this.blogService.getMyBlogs().subscribe({
      next: (b) => { this.blogs.set(b); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /** Medium import: the writer selects the HTML files from the posts/ folder
   *  of their Medium export zip; everything lands here as drafts to review. */
  onImportFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    this.importing.set(true);
    this.blogService.importMedium(files).subscribe({
      next: (r) => {
        this.importing.set(false);
        if (r.imported.length) {
          this.toast.show(`Imported ${r.imported.length} ${r.imported.length === 1 ? 'story' : 'stories'} as drafts. Review and publish when ready.`, 'success');
          this.loadStories();
        }
        if (r.skipped.length && !r.imported.length) {
          this.toast.show('Nothing imported. Select the HTML files inside the posts folder of your Medium export.', 'error');
        } else if (r.skipped.length) {
          this.toast.show(`${r.skipped.length} file${r.skipped.length === 1 ? '' : 's'} skipped (not Medium stories).`, 'info');
        }
      },
      error: () => {
        this.importing.set(false);
        this.toast.show('Import failed. Are the files from your Medium export?', 'error');
      },
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
    return (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/gi, ' ').replace(/\s+/g, ' ').trim();
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
