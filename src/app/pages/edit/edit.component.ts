import { Component, OnInit, ViewChild, ElementRef, signal, SecurityContext } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { BlogService } from '../../services/blog.service';
import { AiService } from '../../services/ai.service';
import { ToastService } from '../../services/toast.service';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { BlogTag } from '../../types/blog.types';
import { marked } from 'marked';

@Component({
  selector: 'app-edit',
  imports: [FormsModule, MarkdownPipe],
  templateUrl: './edit.component.html',
})
export class EditComponent implements OnInit {
  @ViewChild('editor') editorRef!: ElementRef<HTMLDivElement>;

  blogId = 0;
  title = '';
  content = '';
  aiPrompt = '';
  aiOutput = signal('');
  aiLoading = signal(false);
  submitting = signal(false);
  savingDraft = signal(false);
  uploadingCover = signal(false);
  loading = signal(true);
  error = signal('');
  aiPanelOpen = signal(false);
  tags = signal<string[]>([]);
  tagInput = '';
  currentStatus = signal('published');
  coverImage = signal('');

  constructor(
    private blogService: BlogService,
    private aiService: AiService,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { this.router.navigate(['/my-stories']); return; }
    this.blogId = id;
    this.blogService.getBlogById(id).subscribe({
      next: (b) => {
        if (!b) { this.router.navigate(['/my-stories']); return; }
        this.title = b.title;
        this.content = b.content;
        this.currentStatus.set(b.status ?? 'published');
        this.tags.set((b.tags ?? []).map((bt: BlogTag) => bt.tag.name));
        this.coverImage.set(b.coverImage ?? '');
        this.loading.set(false);
        setTimeout(() => {
          if (this.editorRef) {
            const safe = this.sanitizer.sanitize(SecurityContext.HTML, marked.parse(b.content) as string) ?? '';
            this.editorRef.nativeElement.innerHTML = safe;
          }
        });
      },
      error: () => this.router.navigate(['/my-stories']),
    });
  }

  wordCount(): number {
    const plain = this.content.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return plain ? plain.split(/\s+/).length : 0;
  }

  readTime(): number {
    return Math.max(1, Math.ceil(this.wordCount() / 200));
  }

  addTag() {
    const name = this.tagInput.trim().replace(/,$/, '');
    if (!name || this.tags().includes(name) || this.tags().length >= 5) {
      this.tagInput = '';
      return;
    }
    this.tags.update(t => [...t, name]);
    this.tagInput = '';
  }

  onTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      this.addTag();
    }
    if (e.key === 'Backspace' && !this.tagInput && this.tags().length > 0) {
      this.tags.update(t => t.slice(0, -1));
    }
  }

  removeTag(name: string) {
    this.tags.update(t => t.filter(x => x !== name));
  }

  onCoverImageChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingCover.set(true);
    this.blogService.uploadCoverImage(file).subscribe({
      next: (r) => { this.coverImage.set(r.url); this.uploadingCover.set(false); },
      error: () => { this.toast.show('Cover image upload failed.', 'error'); this.uploadingCover.set(false); },
    });
  }

  removeCover() { this.coverImage.set(''); }

  generateWithAI() {
    if (!this.aiPrompt.trim()) return;
    this.aiOutput.set('');
    this.aiLoading.set(true);
    this.aiService.generateStream(this.aiPrompt).subscribe({
      next: (chunk) => this.aiOutput.update(v => v + chunk),
      error: () => { this.aiLoading.set(false); this.toast.show('AI generation failed.', 'error'); },
      complete: () => this.aiLoading.set(false),
    });
  }

  onEditorInput(event: Event) {
    this.content = (event.target as HTMLElement).innerHTML;
  }

  useAIContent() {
    const html = marked.parse(this.aiOutput()) as string;
    const safe = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
    this.editorRef.nativeElement.innerHTML = safe;
    this.content = safe;
    this.toast.show('AI content applied to editor.', 'info');
  }

  saveDraft() {
    if (!this.title.trim()) {
      this.toast.show('Title is required.', 'error');
      return;
    }
    this.savingDraft.set(true);
    this.blogService.updateBlog(this.blogId, {
      title: this.title,
      content: this.content,
      status: 'draft',
      tags: this.tags(),
      coverImage: this.coverImage() || undefined,
    }).subscribe({
      next: () => {
        this.currentStatus.set('draft');
        this.savingDraft.set(false);
        this.toast.show('Draft saved.', 'success');
      },
      error: () => {
        this.toast.show('Could not save draft.', 'error');
        this.savingDraft.set(false);
      },
    });
  }

  submit() {
    if (!this.title.trim() || !this.content.trim()) {
      this.toast.show('Title and content are required.', 'error');
      return;
    }
    this.submitting.set(true);
    this.blogService.updateBlog(this.blogId, {
      title: this.title,
      content: this.content,
      status: 'published',
      tags: this.tags(),
      coverImage: this.coverImage() || undefined,
    }).subscribe({
      next: () => {
        this.toast.show('Story updated and published!', 'success');
        this.router.navigate(['/blog', this.blogId]);
      },
      error: (e) => {
        const msg = e?.error?.error ?? 'Failed to update story.';
        this.toast.show(msg, 'error');
        this.submitting.set(false);
      },
    });
  }
}
