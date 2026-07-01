import { Component, HostListener, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TutorialService } from '../../services/tutorial.service';

interface TourStep {
  key: 'welcome' | 'discover' | 'write' | 'ai' | 'listen';
  title: string;
  body: string;
}

/**
 * First-run onboarding tour — a centered, step-through welcome overlay (not a
 * DOM-anchored coach-mark tour, so it survives navigation and SSR). Driven by
 * TutorialService; rendered once at the app root.
 */
@Component({
  selector: 'app-tutorial',
  standalone: true,
  template: `
    @if (tour.visible()) {
      <div class="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50"
           role="dialog" aria-modal="true" aria-label="Welcome tour">
        <div class="w-full max-w-md bg-raised border border-gray-200 rounded-2xl elev-3 p-7 sm:p-8">

          <!-- progress -->
          <div class="flex items-center gap-1.5 mb-7">
            @for (s of steps; track s.key; let i = $index) {
              <span class="h-1.5 rounded-full transition-all duration-300"
                [class]="i === step() ? 'w-6 bg-clay' : (i < step() ? 'w-1.5 bg-clay/50' : 'w-1.5 bg-gray-200')"></span>
            }
          </div>

          <!-- icon -->
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
               style="background: color-mix(in srgb, var(--clay) 12%, transparent); color: var(--clay)">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              @switch (current().key) {
                @case ('welcome') {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.247m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.247"/>
                }
                @case ('discover') {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M21 21l-5.2-5.2m2.2-5.3a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"/>
                }
                @case ('write') {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                }
                @case ('ai') {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M5 3v4M3 5h4m10-2l1.7 5.1L24 10l-5.3 1.9L17 17l-1.7-5.1L10 10l5.3-1.9L17 3zM6 16v4m-2-2h4"/>
                }
                @case ('listen') {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 6a8 8 0 010 12"/>
                }
              }
            </svg>
          </div>

          <p class="eyebrow eyebrow-clay mb-2">Step {{ step() + 1 }} of {{ steps.length }}</p>
          <h2 class="font-display text-2xl text-gray-900 mb-2.5">{{ current().title }}</h2>
          <p class="font-reading text-gray-600 leading-relaxed">{{ current().body }}</p>

          <!-- actions -->
          <div class="flex items-center justify-between mt-8">
            <button type="button" (click)="skip()"
              class="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors">
              Skip
            </button>
            <div class="flex items-center gap-2.5">
              @if (step() > 0) {
                <button type="button" (click)="back()"
                  class="text-sm font-semibold px-4 py-2 rounded-full border border-gray-300 text-gray-600 hover:border-gray-400 transition-colors">
                  Back
                </button>
              }
              @if (isLast()) {
                <button type="button" (click)="startWriting()"
                  class="btn-ink btn-press text-sm font-semibold px-5 py-2 rounded-full">
                  Start writing
                </button>
              } @else {
                <button type="button" (click)="next()"
                  class="btn-ink btn-press text-sm font-semibold px-5 py-2 rounded-full">
                  Next
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class TutorialComponent {
  steps: TourStep[] = [
    {
      key: 'welcome',
      title: 'Welcome to TheBlogSphere',
      body: 'A quiet, ad-free home for real writing. Here is a 30-second tour of what you can do.',
    },
    {
      key: 'discover',
      title: 'Find stories worth your time',
      body: 'Browse Explore and Trending, search by topic, then bookmark what you love, like a story, and follow writers you enjoy.',
    },
    {
      key: 'write',
      title: 'Publish your own',
      body: 'Hit Write to open the editor, add a cover image, and publish. Your stories live under My Stories, ready to edit anytime.',
    },
    {
      key: 'ai',
      title: 'Write faster with AI',
      body: 'The assistant can draft, rewrite, and polish in your own voice. The free plan includes 25 AI actions a month; Writer Pro is unlimited.',
    },
    {
      key: 'listen',
      title: 'Listen to any story',
      body: 'Tap Read aloud to have a story narrated in a natural voice. Set your profile, writing style, and tips in Settings. That is it — enjoy.',
    },
  ];

  step = signal(0);
  current = computed(() => this.steps[this.step()]);
  isLast = computed(() => this.step() === this.steps.length - 1);

  constructor(readonly tour: TutorialService, private router: Router) {}

  next() {
    if (!this.isLast()) this.step.update((s) => s + 1);
  }

  back() {
    this.step.update((s) => Math.max(0, s - 1));
  }

  skip() {
    this.tour.complete();
    this.step.set(0);
  }

  startWriting() {
    this.tour.complete();
    this.step.set(0);
    this.router.navigate(['/create']);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.tour.visible()) this.skip();
  }
}
