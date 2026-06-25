import { Component, ElementRef, Inject, PLATFORM_ID, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { AiService } from '../../services/ai.service';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

@Component({
  selector: 'app-ai-assistant',
  imports: [FormsModule, MarkdownPipe],
  templateUrl: './ai-assistant.component.html',
})
export class AiAssistantComponent {
  @ViewChild('scrollAnchor') scrollAnchor!: ElementRef<HTMLElement>;

  prompt = '';
  output = signal('');
  loading = signal(false);
  history = signal<{ prompt: string; response: string }[]>([]);

  constructor(
    private aiService: AiService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  private scrollToBottom() {
    if (!isPlatformBrowser(this.platformId)) return;
    requestAnimationFrame(() => {
      this.scrollAnchor?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }

  generate(prefill?: string) {
    const text = prefill ?? this.prompt;
    if (!text.trim() || this.loading()) return;
    this.output.set('');
    this.loading.set(true);
    if (!prefill) this.prompt = '';

    this.aiService.generateStream(text).subscribe({
      next: (chunk) => {
        this.output.update(v => v + chunk);
        this.scrollToBottom();
      },
      error: () => this.loading.set(false),
      complete: () => {
        this.history.update(h => [...h, { prompt: text, response: this.output() }]);
        this.output.set('');
        this.loading.set(false);
        this.scrollToBottom();
      },
    });
  }

  onEnter(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.generate(); }
  }

  clearHistory() { this.history.set([]); }
}
