import { Component, Inject, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

/**
 * Self-contained in-app report / takedown flow (audit fix #6). Renders a subtle
 * "Report" trigger; the modal collects a reason + details and posts to
 * /api/reports. Signed-in reporters are recorded by id; anonymous readers are
 * asked for an email so the Grievance Officer can follow up (IT Rules 2021).
 */
@Component({
  selector: 'app-report-dialog',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <button type="button" (click)="open()"
      class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 2H21l-3 6 3 6h-8.5l-1-2H5a2 2 0 00-2 2z"/>
      </svg>
      Report
    </button>

    @if (visible()) {
      <div class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/40"
           (click)="close()" role="dialog" aria-modal="true" aria-label="Report this story">
        <div class="w-full max-w-md bg-raised border border-gray-200 rounded-2xl elev-3 p-6" (click)="$event.stopPropagation()">
          <h2 class="font-display text-lg text-gray-900 mb-1">Report this story</h2>
          <p class="text-sm text-gray-500 mb-5">
            Tell us what's wrong and we'll review it against our
            <a routerLink="/content-policy" target="_blank" class="link-underline text-gray-700 font-medium">Content Policy</a>.
          </p>

          <div class="space-y-4">
            <div>
              <label class="block eyebrow !text-[11px] mb-2" for="report-reason">Reason</label>
              <select id="report-reason" [(ngModel)]="reason"
                class="w-full text-sm text-gray-800 border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-clay bg-sunken transition-colors">
                @for (r of reasons; track r.value) {
                  <option [value]="r.value">{{ r.label }}</option>
                }
              </select>
            </div>

            <div>
              <label class="block eyebrow !text-[11px] mb-2" for="report-details">Details <span class="normal-case text-gray-400">&mdash; optional</span></label>
              <textarea id="report-details" [(ngModel)]="details" rows="3" maxlength="4000"
                placeholder="Add anything that helps us understand the issue. For copyright, include proof you own the work."
                class="w-full text-sm text-gray-800 border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-clay resize-none bg-sunken transition-colors"></textarea>
            </div>

            @if (!signedIn()) {
              <div>
                <label class="block eyebrow !text-[11px] mb-2" for="report-email">Your email</label>
                <input id="report-email" type="email" [(ngModel)]="email" [placeholder]="emailPlaceholder" autocomplete="email"
                  class="w-full text-sm text-gray-800 border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-clay bg-sunken transition-colors"/>
                <p class="text-xs text-gray-400 mt-1.5">So we can acknowledge and follow up on your report.</p>
              </div>
            }
          </div>

          <div class="flex items-center justify-end gap-3 mt-6">
            <button type="button" (click)="close()"
              class="text-sm font-semibold px-5 py-2.5 rounded-full border border-gray-300 text-gray-600 hover:border-gray-400 transition-colors">
              Cancel
            </button>
            <button type="button" (click)="submit()" [disabled]="submitting()"
              class="btn-ink btn-press text-sm font-semibold px-5 py-2.5 rounded-full disabled:opacity-50">
              {{ submitting() ? 'Sending…' : 'Submit report' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ReportDialogComponent {
  @Input() blogId?: number;

  // Placeholder held in a TS field — a literal "@" in an inline template is
  // parsed as an Angular control-flow block and breaks the build (NG5002).
  emailPlaceholder = 'you@example.com';

  reasons = [
    { value: 'spam', label: 'Spam or misleading' },
    { value: 'harassment', label: 'Harassment or hate' },
    { value: 'copyright', label: 'Copyright infringement (DMCA)' },
    { value: 'illegal', label: 'Illegal or dangerous content' },
    { value: 'misinformation', label: 'Misinformation' },
    { value: 'other', label: 'Something else' },
  ];

  visible = signal(false);
  submitting = signal(false);
  reason = 'spam';
  details = '';
  email = '';

  constructor(
    @Inject(HttpClient) private http: HttpClient,
    @Inject(AuthService) private auth: AuthService,
    @Inject(ToastService) private toast: ToastService,
  ) {}

  signedIn() {
    return !!this.auth.session()?.user;
  }

  open() {
    this.reason = 'spam';
    this.details = '';
    this.email = '';
    this.visible.set(true);
  }

  close() {
    this.visible.set(false);
  }

  submit() {
    if (!this.signedIn() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
      this.toast.show('Please enter a valid email so we can respond.', 'error');
      return;
    }
    this.submitting.set(true);
    this.http.post('/api/reports', {
      blogId: this.blogId,
      reason: this.reason,
      details: this.details.trim() || undefined,
      email: this.signedIn() ? undefined : this.email.trim(),
    }, { withCredentials: true }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.close();
        this.toast.show('Thanks — your report has been submitted.', 'success');
      },
      error: (e) => {
        this.submitting.set(false);
        this.toast.show(e?.error?.error || 'Could not submit your report. Please try again.', 'error');
      },
    });
  }
}
