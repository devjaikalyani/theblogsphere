import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlogService } from '../../services/blog.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
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

  constructor(
    private blogService: BlogService,
    readonly auth: AuthService,
    private toast: ToastService,
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
