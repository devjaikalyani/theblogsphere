import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.component.html',
})
export class SignupComponent {
  name = '';
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  get passwordChecks() {
    const p = this.password;
    return [
      { label: '8+ characters', met: p.length >= 8 },
      { label: 'Uppercase letter', met: /[A-Z]/.test(p) },
      { label: 'Number', met: /[0-9]/.test(p) },
      { label: 'Special character', met: /[^A-Za-z0-9]/.test(p) },
    ];
  }

  get passwordScore(): number {
    const p = this.password;
    return [p.length >= 8, /[A-Z]/.test(p), /[a-z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
  }

  get passwordStrength(): { label: string; pct: number; color: string } {
    if (!this.password) return { label: '', pct: 0, color: '' };
    const s = this.passwordScore;
    if (s <= 2) return { label: 'Weak', pct: 25, color: '#C0392B' };
    if (s === 3) return { label: 'Fair', pct: 50, color: '#C97B53' };
    if (s === 4) return { label: 'Good', pct: 75, color: '#8A8B5B' };
    return { label: 'Strong', pct: 100, color: '#4A5740' };
  }

  submit() {
    this.error.set('');
    if (this.passwordScore < 4) {
      this.error.set('Password is too weak. Please meet all requirements below.');
      return;
    }
    this.loading.set(true);
    const parts = this.name.trim().split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ') || firstName;
    this.auth.signup({ name: this.name.trim(), email: this.email, password: this.password, firstName, lastName }).subscribe({
      next: () => {
        this.auth.refreshSession().subscribe(() => this.router.navigate(['/']));
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'Could not create account.');
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
