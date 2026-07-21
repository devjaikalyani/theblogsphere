import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { BillingService, PlanStatus } from '../../services/billing.service';
import { RevealDirective } from '../../directives/reveal.directive';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink, RevealDirective],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  firstName = '';
  lastName = '';
  bio = '';
  website = '';
  writingStyle = '';
  tippingEnabled = false;
  tipUrl = '';
  upiId = '';
  notifyFollowedPosts = true;
  saving = signal(false);

  plan = signal<PlanStatus | null>(null);
  billingLoading = signal(false);

  exporting = signal(false);
  showDelete = signal(false);
  deleteConfirm = '';
  deleting = signal(false);

  constructor(
    private blogService: BlogService,
    readonly auth: AuthService,
    private toast: ToastService,
    private billing: BillingService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    const user = this.auth.session()?.user;
    if (!user) return;
    this.firstName = user.firstName ?? '';
    this.lastName = user.lastName ?? '';
    this.blogService.getAuthorProfile(user.id).subscribe({
      next: (p) => {
        this.bio = p.bio ?? '';
        this.website = p.website ?? '';
        this.tippingEnabled = p.tippingEnabled ?? false;
        this.tipUrl = p.tipUrl ?? '';
        this.upiId = p.upiId ?? '';
        this.notifyFollowedPosts = p.notifyFollowedPosts ?? true;
      },
    });
    fetch('/api/users/me/writing-style', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { this.writingStyle = d.writingStyle ?? ''; })
      .catch(() => {});

    this.loadPlan();
    // Returning from a successful Stripe Checkout.
    if (this.route.snapshot.queryParamMap.get('upgrade') === 'success') {
      this.toast.show('Welcome to Pro! Your upgrade is active.', 'success');
    }
  }

  private loadPlan() {
    this.billing.status().subscribe({ next: (s) => this.plan.set(s), error: () => {} });
  }

  manageBilling() {
    this.billingLoading.set(true);
    this.billing.manage().subscribe({
      next: (r) => {
        if (r.url) { window.location.href = r.url; return; }
        this.billingLoading.set(false);
        if (r.cancelled) {
          this.toast.show('Your plan will not renew. You keep Pro until the period ends.', 'success');
          this.loadPlan();
        }
      },
      error: (e) => this.billingFail(e),
    });
  }

  private billingFail(e?: any) {
    this.billingLoading.set(false);
    this.toast.show(e?.error?.message || 'Billing is not available yet.', 'error');
  }

  save() {
    this.saving.set(true);
    this.blogService.updateProfile({
      firstName: this.firstName,
      lastName: this.lastName,
      bio: this.bio,
      website: this.website,
      writingStyle: this.writingStyle,
      tippingEnabled: this.tippingEnabled,
      tipUrl: this.tipUrl || undefined,
      upiId: this.upiId || undefined,
      notifyFollowedPosts: this.notifyFollowedPosts,
    }).subscribe({
      next: () => { this.saving.set(false); this.toast.show('Settings saved.', 'success'); },
      error: () => { this.saving.set(false); this.toast.show('Could not save settings.', 'error'); },
    });
  }

  // Download a machine-readable copy of everything we hold (DPDP/GDPR portability).
  async exportData() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.exporting.set(true);
    try {
      const res = await fetch('/api/users/me/export', { credentials: 'include' });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `theblogsphere-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.toast.show('Your data export has downloaded.', 'success');
    } catch {
      this.toast.show('Could not export your data. Please try again.', 'error');
    } finally {
      this.exporting.set(false);
    }
  }

  deleteAccount() {
    if (this.deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      this.toast.show('Type DELETE to confirm.', 'error');
      return;
    }
    this.deleting.set(true);
    this.auth.deleteAccount().subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.show('Your account and all your data have been deleted.', 'success');
        this.router.navigate(['/']);
      },
      error: () => {
        this.deleting.set(false);
        this.toast.show('Could not delete your account. Please contact support.', 'error');
      },
    });
  }
}
