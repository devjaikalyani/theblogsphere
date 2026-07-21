import { Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild, afterNextRender, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { BlogService } from '../../services/blog.service';
import { SeoService } from '../../services/seo.service';
import { RevealDirective } from '../../directives/reveal.directive';
import { HoverDirective } from '../../directives/hover.directive';
import { AmbientDirective } from '../../directives/ambient.directive';
import { GenCoverComponent } from '../../components/gen-cover/gen-cover.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink, RevealDirective, HoverDirective, AmbientDirective, GenCoverComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('promo') promoRef?: ElementRef<HTMLVideoElement>;

  /** Hero promo film. It starts muted because every browser blocks autoplay
   *  with sound, and the sound button is the only way back to audio. */
  promoReady = signal(false);
  promoPlaying = signal(false);
  promoMuted = signal(true);

  blogs = signal<any[]>([]);
  loading = signal(true);
  typewriterText = signal('');
  cursorX = signal(0);
  cursorY = signal(0);
  cursorVisible = signal(false);

  private readonly phrases = ['your next great idea.', 'stories that matter.', 'thoughts worth sharing.', 'your writing journey.'];
  private phraseIndex = 0;
  private charIndex = 0;
  private deleting = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private blogService: BlogService,
    @Inject(PLATFORM_ID) private platformId: object,
    seo: SeoService,
  ) {
    seo.set({
      title: 'TheBlogSphere, Write, Publish, and Discover Stories',
      description: 'Discover stories from writers around the world. Use AI to write more and write better on TheBlogSphere.',
      canonicalPath: '/',
    });
    afterNextRender(() => {
      this.tick();
      this.startPromo();
    });
  }

  // ── Hero promo film ──────────────────────────────────────────────────────
  /** Autoplay is a courtesy, not a right. The audience is largely on Indian
   *  mobile data and this file is a few megabytes, so skip the auto-download
   *  when the reader has asked for less motion or less data, and let them
   *  press play instead. */
  private startPromo() {
    if (!isPlatformBrowser(this.platformId)) return;
    const video = this.promoRef?.nativeElement;
    if (!video) return;

    const win = video.ownerDocument?.defaultView;
    const reducedMotion = win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const conn = (win?.navigator as any)?.connection;
    const frugal = !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '');
    if (reducedMotion || frugal) return;

    video.muted = true; // belt and braces: play() is refused otherwise
    video.play().catch(() => {
      // Autoplay refused (a stricter policy, low power mode). The play button
      // is already on screen, so there is nothing to recover from.
    });
  }

  togglePromoPlay() {
    const video = this.promoRef?.nativeElement;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  /** Unmuting counts as a user gesture, so this also rescues the film when
   *  autoplay was refused: give it sound and it starts. */
  togglePromoSound() {
    const video = this.promoRef?.nativeElement;
    if (!video) return;
    video.muted = !video.muted;
    this.promoMuted.set(video.muted);
    if (!video.muted && video.paused) video.play().catch(() => {});
  }

  ngOnInit() {
    this.blogService.getBlogs(1).subscribe({
      next: (data) => { this.blogs.set(data.blogs ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private tick() {
    if (!isPlatformBrowser(this.platformId)) return;
    const phrase = this.phrases[this.phraseIndex];

    if (!this.deleting) {
      this.charIndex++;
      this.typewriterText.set(phrase.slice(0, this.charIndex));
      if (this.charIndex === phrase.length) {
        this.deleting = true;
        this.timer = setTimeout(() => this.tick(), 2200);
        return;
      }
      this.timer = setTimeout(() => this.tick(), 55);
    } else {
      this.charIndex--;
      this.typewriterText.set(phrase.slice(0, this.charIndex));
      if (this.charIndex === 0) {
        this.deleting = false;
        this.phraseIndex = (this.phraseIndex + 1) % this.phrases.length;
        this.timer = setTimeout(() => this.tick(), 350);
        return;
      }
      this.timer = setTimeout(() => this.tick(), 28);
    }
  }

  onHeroMouseMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.cursorX.set(e.clientX - rect.left);
    this.cursorY.set(e.clientY - rect.top);
    this.cursorVisible.set(true);
  }

  onHeroMouseLeave() {
    this.cursorVisible.set(false);
  }

  excerpt(content: string, len = 140) {
    const plain = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/gi, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > len ? plain.slice(0, len) + '...' : plain;
  }

  formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  readTime(content: string): number {
    const plain = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/gi, ' ').replace(/\s+/g, ' ').trim();
    return Math.max(1, Math.ceil(plain.split(/\s+/).length / 200));
  }

  avatarGradient(name: string): string {
    const gradients = [
      'linear-gradient(135deg, #C15C3D, #A8472E)',
      'linear-gradient(135deg, #4A443C, #1A1714)',
      'linear-gradient(135deg, #B5894E, #8C6A36)',
      'linear-gradient(135deg, #6E7E5B, #4A5740)',
      'linear-gradient(135deg, #C97B53, #A8472E)',
      'linear-gradient(135deg, #8A8378, #4A443C)',
    ];
    return gradients[name.charCodeAt(0) % gradients.length];
  }
}
