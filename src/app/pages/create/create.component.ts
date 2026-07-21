import { Component, signal, ViewChild, ElementRef, AfterViewInit, SecurityContext } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { BlogService } from '../../services/blog.service';
import { AiService } from '../../services/ai.service';
import { ToastService } from '../../services/toast.service';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { marked } from 'marked';

@Component({
  selector: 'app-create',
  imports: [FormsModule, MarkdownPipe],
  templateUrl: './create.component.html',
})
export class CreateComponent implements AfterViewInit {
  @ViewChild('editor') editorRef!: ElementRef<HTMLDivElement>;

  title = '';
  content = '';
  aiPrompt = '';
  aiOutput = signal('');
  aiLoading = signal(false);
  submitting = signal(false);
  savingDraft = signal(false);
  uploadingCover = signal(false);
  error = signal('');
  aiPanelOpen = signal(true);

  ngAfterViewInit() {
    if (this.content) {
      const safe = this.sanitizer.sanitize(SecurityContext.HTML, marked.parse(this.content) as string) ?? '';
      this.editorRef.nativeElement.innerHTML = safe;
    }
  }

  onEditorInput(event: Event) {
    this.content = (event.target as HTMLElement).innerHTML;
  }
  tags = signal<string[]>([]);
  tagInput = '';
  coverImage = signal('');

  constructor(
    private blogService: BlogService,
    private aiService: AiService,
    private router: Router,
    private toast: ToastService,
    private sanitizer: DomSanitizer,
  ) {}

  wordCount(): number {
    const plain = this.content.replace(/<[^>]+>/g, ' ').replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/gi, ' ').replace(/\s+/g, ' ').trim();
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

  removeCover() {
    this.coverImage.set('');
  }

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

  useAIContent() {
    const html = marked.parse(this.aiOutput()) as string;
    const safe = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
    this.editorRef.nativeElement.innerHTML = safe;
    this.content = safe;
    this.toast.show('AI content applied to editor.', 'info');
  }

  saveDraft() {
    if (!this.title.trim()) {
      this.toast.show('Add a title before saving a draft.', 'error');
      return;
    }
    this.savingDraft.set(true);
    this.blogService.createBlog({
      title: this.title,
      content: this.content,
      status: 'draft',
      tags: this.tags(),
      coverImage: this.coverImage() || undefined,
    }).subscribe({
      next: () => {
        this.toast.show('Draft saved.', 'success');
        this.router.navigate(['/my-stories']);
      },
      error: () => {
        this.toast.show('Could not save draft. Are you signed in?', 'error');
        this.savingDraft.set(false);
      },
    });
  }

  /** Soft cover-image gate: stories with a real cover are what Google Discover
   *  and WhatsApp link previews surface, so nudge once, never block. */
  private coverNudged = false;

  submit() {
    if (!this.title.trim() || !this.content.trim()) {
      this.error.set('Title and content are required.');
      this.toast.show('Title and content are required.', 'error');
      return;
    }
    if (!this.coverImage() && !this.coverNudged) {
      this.coverNudged = true;
      this.toast.show('A cover image gets your story featured on Google and looks better when shared. Publish again to continue without one.', 'info');
      return;
    }
    this.error.set('');
    this.submitting.set(true);
    this.blogService.createBlog({
      title: this.title,
      content: this.content,
      status: 'published',
      tags: this.tags(),
      coverImage: this.coverImage() || undefined,
    }).subscribe({
      next: () => {
        this.toast.show('Story published!', 'success');
        this.router.navigate(['/explore']);
      },
      error: (e) => {
        const msg = e?.error?.error ?? 'Failed to publish. Are you signed in?';
        this.error.set(msg);
        this.toast.show(msg, 'error');
        this.submitting.set(false);
      },
    });
  }
}
