import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BlogService } from '../../services/blog.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { SeoService } from '../../services/seo.service';
import { HoverDirective } from '../../directives/hover.directive';

@Component({
  selector: 'app-author',
  imports: [RouterLink, DatePipe, HoverDirective],
  templateUrl: './author.component.html',
})
export class AuthorComponent implements OnInit {
  profile = signal<any>(null);
  loading = signal(true);
  notFound = signal(false);
  authorId = '';

  following = signal(false);
  followers = signal(0);
  followLoading = signal(false);

  blogs = computed<any[]>(() => this.profile()?.blogs ?? []);
  totalWords = computed(() =>
    this.blogs().reduce((sum, b) => sum + ((b.content ?? '').trim().split(/\s+/).length), 0)
  );

  isOwnProfile = computed(() => {
    const session = this.auth.session();
    return session && this.authorId && session.user.id === this.authorId;
  });

  constructor(
    private route: ActivatedRoute,
    private blogService: BlogService,
    readonly auth: AuthService,
    private toast: ToastService,
    private seo: SeoService,
  ) {}

  ngOnInit() {
    this.authorId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.authorId) { this.notFound.set(true); this.loading.set(false); return; }

    this.blogService.getAuthorProfile(this.authorId).subscribe({
      next: (p) => {
        if (!p) { this.notFound.set(true); }
        else {
          this.profile.set(p);
          this.following.set(p.isFollowing ?? false);
          this.followers.set(p._count?.followers ?? 0);
          const name = p.name || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Author';
          this.seo.set({
            title: `${name} | TheBlogSphere`,
            description: (p.bio ?? `Stories and essays by ${name} on TheBlogSphere.`).slice(0, 160),
            image: p.profilePicture,
            type: 'profile',
            canonicalPath: `/author/${this.authorId}`,
          });
        }
        this.loading.set(false);
      },
      error: () => { this.notFound.set(true); this.loading.set(false); },
    });
  }

  toggleFollow() {
    if (!this.auth.session()) { this.toast.show('Sign in to follow authors.', 'info'); return; }
    this.followLoading.set(true);
    if (this.following()) {
      this.blogService.unfollow(this.authorId).subscribe({
        next: () => {
          this.following.set(false);
          this.followers.update(n => Math.max(0, n - 1));
          this.followLoading.set(false);
        },
        error: () => this.followLoading.set(false),
      });
    } else {
      this.blogService.follow(this.authorId).subscribe({
        next: () => {
          this.following.set(true);
          this.followers.update(n => n + 1);
          this.followLoading.set(false);
          this.toast.show('Now following ' + (this.profile()?.name ?? 'this author') + '.', 'success');
        },
        error: () => this.followLoading.set(false),
      });
    }
  }

  excerpt(content: string): string {
    const plain = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/gi, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > 140 ? plain.slice(0, 140) + '...' : plain;
  }

  readTime(content: string): number {
    const plain = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/gi, ' ').replace(/\s+/g, ' ').trim();
    return Math.max(1, Math.ceil(plain.split(/\s+/).length / 200));
  }

  blogTags(blog: any): string[] {
    return (blog.tags ?? []).map((bt: any) => bt.tag.name);
  }

  avatarGradient(name: string): string {
    const gradients = [
      'linear-gradient(135deg,#C15C3D,#A8472E)',
      'linear-gradient(135deg,#4A443C,#1A1714)',
      'linear-gradient(135deg,#B5894E,#8C6A36)',
      'linear-gradient(135deg,#6E7E5B,#4A5740)',
      'linear-gradient(135deg,#C97B53,#A8472E)',
      'linear-gradient(135deg,#8A8378,#4A443C)',
    ];
    return gradients[(name?.charCodeAt(0) ?? 0) % gradients.length];
  }
}
