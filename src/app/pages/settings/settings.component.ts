import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  saving = signal(false);

  plan = signal<PlanStatus | null>(null);
  billingLoading = signal(false);

  constructor(
    private blogService: BlogService,
    readonly auth: AuthService,
    private toast: ToastService,
    private billing: BillingService,
    private route: ActivatedRoute,
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

  upgrade() {
    this.billingLoading.set(true);
    this.billing.checkout().subscribe({
      next: (r) => { if (r.url) window.location.href = r.url; else this.billingFail(); },
      error: (e) => this.billingFail(e),
    });
  }

  manageBilling() {
    this.billingLoading.set(true);
    this.billing.portal().subscribe({
      next: (r) => { if (r.url) window.location.href = r.url; else this.billingFail(); },
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
    }).subscribe({
      next: () => { this.saving.set(false); this.toast.show('Settings saved.', 'success'); },
      error: () => { this.saving.set(false); this.toast.show('Could not save settings.', 'error'); },
    });
  }
}
