import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TutorialService } from '../../services/tutorial.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);
  resetSent = signal(false);

  constructor(private auth: AuthService, private router: Router, private tutorial: TutorialService) {}

  requestReset() {
    if (!this.email) {
      this.error.set('Enter your email address first, then tap "Forgot password?" again.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    // Same response whether or not the account exists — no email enumeration.
    this.auth.forgetPassword(this.email).subscribe({
      next: () => { this.loading.set(false); this.resetSent.set(true); },
      error: () => { this.loading.set(false); this.resetSent.set(true); },
    });
  }

  submit() {
    this.error.set('');
    this.loading.set(true);
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.auth.refreshSession().subscribe(() => {
          this.router.navigate(['/']);
          this.tutorial.maybeStart();
        });
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'Invalid email or password.');
        this.loading.set(false);
      },
    });
  }

  loginWithGoogle() {
    // Relative URL so it routes through the dev proxy locally and the same-origin
    // reverse proxy in production; callbackURL follows the current origin.
    fetch('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider: 'google', callbackURL: window.location.origin }),
    })
      .then(r => r.json())
      .then((data: any) => { if (data?.url) window.location.href = data.url; });
  }
}
