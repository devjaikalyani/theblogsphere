import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  password = '';
  confirm = '';
  error = signal('');
  done = signal(false);
  loading = signal(false);
  private token: string;

  constructor(private auth: AuthService, route: ActivatedRoute, seo: SeoService) {
    this.token = route.snapshot.queryParamMap.get('token') ?? '';
    seo.set({
      title: 'Reset password | TheBlogSphere',
      description: 'Choose a new password for your TheBlogSphere account.',
      canonicalPath: '/reset-password',
    });
  }

  submit() {
    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }
    if (this.password !== this.confirm) {
      this.error.set('Passwords do not match.');
      return;
    }
    if (!this.token) {
      this.error.set('This reset link is invalid or has expired. Request a new one from the sign-in page.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    this.auth.resetPassword(this.password, this.token).subscribe({
      next: () => {
        this.done.set(true);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'This reset link is invalid or has expired. Request a new one from the sign-in page.');
        this.loading.set(false);
      },
    });
  }
}
