import { Component, ElementRef, Inject, OnInit, PLATFORM_ID, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AiService } from '../../services/ai.service';
import { BillingService, PlanStatus } from '../../services/billing.service';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

@Component({
  selector: 'app-ai-assistant',
  imports: [FormsModule, RouterLink, MarkdownPipe],
  templateUrl: './ai-assistant.component.html',
})
export class AiAssistantComponent implements OnInit {
  @ViewChild('scrollAnchor') scrollAnchor!: ElementRef<HTMLElement>;

  prompt = '';
  output = signal('');
  loading = signal(false);
  history = signal<{ prompt: string; response: string }[]>([]);

  plan = signal<PlanStatus | null>(null);
  quotaReached = signal(false);
  quotaMessage = signal('');

  constructor(
    private aiService: AiService,
    private billing: BillingService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    this.refreshPlan();
  }

  private refreshPlan() {
    this.billing.status().subscribe({
      next: (s) => {
        this.plan.set(s);
        if (!s.paid && s.ai.remaining !== null && s.ai.remaining <= 0) this.quotaReached.set(true);
      },
      error: () => {},
    });
  }

  private scrollToBottom() {
    if (!isPlatformBrowser(this.platformId)) return;
    requestAnimationFrame(() => {
      this.scrollAnchor?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }

  generate(prefill?: string) {
    const text = prefill ?? this.prompt;
    if (!text.trim() || this.loading() || this.quotaReached()) return;
    this.output.set('');
    this.loading.set(true);
    if (!prefill) this.prompt = '';

    this.aiService.generateStream(text).subscribe({
      next: (chunk) => {
        this.output.update(v => v + chunk);
        this.scrollToBottom();
      },
      error: (e) => {
        this.loading.set(false);
        if (e?.status === 429 || e?.error === 'ai_quota_exceeded') {
          this.quotaReached.set(true);
          this.quotaMessage.set(e?.message || 'You have reached your free AI limit this month.');
          this.refreshPlan();
        }
      },
      complete: () => {
        this.history.update(h => [...h, { prompt: text, response: this.output() }]);
        this.output.set('');
        this.loading.set(false);
        this.scrollToBottom();
        this.refreshPlan();
      },
    });
  }

  onEnter(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.generate(); }
  }

  clearHistory() { this.history.set([]); }
}
