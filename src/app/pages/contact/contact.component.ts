import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo.service';

// DRAFT TEMPLATE — starting point only. Fill in the placeholder fields below
// with your real details. India's IT Rules 2021 require a named Grievance
// Officer with contact details published on the site.
@Component({
  selector: 'app-contact',
  imports: [RouterLink],
  template: `
    <div class="bg-page min-h-screen">
      <div class="border-b border-gray-200 bg-paper">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <p class="eyebrow eyebrow-clay mb-4">Support</p>
          <h1 class="font-display text-gray-900 font-semibold tracking-[-0.02em] text-[clamp(2rem,5vw,3rem)] mb-4">Contact &amp; Grievances</h1>
          <p class="font-reading text-gray-600 text-lg leading-relaxed max-w-xl">
            We're a small team and we read everything. Here's how to reach us.
          </p>
        </div>
      </div>

      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-2 mb-3">General &amp; support</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          For help, questions, or feedback, email us at
          <a [href]="'mailto:' + supportEmail" class="link-underline text-gray-800 font-medium">{{ supportEmail }}</a>.
          We aim to reply within 2&ndash;3 business days.
        </p>

        <div class="bg-raised border border-gray-200 rounded-2xl p-6 my-8">
          <h2 class="font-display text-xl sm:text-2xl text-gray-900 mb-3">Grievance Officer</h2>
          <p class="font-reading text-gray-600 leading-relaxed mb-4">
            In accordance with the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines
            and Digital Media Ethics Code) Rules, 2021, and the Digital Personal Data Protection Act, 2023, the Grievance
            Officer for TheBlogSphere is:
          </p>
          <ul class="space-y-1.5 font-reading text-gray-700 mb-4">
            <li><strong class="text-gray-900">Name:</strong> {{ grievanceName }}</li>
            <li><strong class="text-gray-900">Email:</strong> <a [href]="'mailto:' + grievanceEmail" class="link-underline text-gray-800">{{ grievanceEmail }}</a></li>
            <li><strong class="text-gray-900">Address:</strong> {{ address }}</li>
          </ul>
          <p class="font-reading text-gray-600 leading-relaxed">
            We will acknowledge complaints within 24 hours and resolve them within 15 days, as required by law.
          </p>
        </div>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">Report content or a copyright issue</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          To report content that is unlawful, abusive, or infringes your rights, email the Grievance Officer with:
        </p>
        <ul class="list-disc pl-6 space-y-1.5 font-reading text-gray-600 mb-4">
          <li>the link (URL) to the content;</li>
          <li>a description of the issue and, for copyright, proof you own the work;</li>
          <li>your name and contact details;</li>
          <li>a statement that your complaint is made in good faith and is accurate.</li>
        </ul>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We will review valid reports and act in accordance with our
          <a routerLink="/terms" class="link-underline text-gray-800 font-medium">Terms</a> and applicable law.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">Privacy &amp; data requests</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          To access, correct, or delete your personal data, or to withdraw consent, contact the Grievance Officer above. See
          our <a routerLink="/privacy" class="link-underline text-gray-800 font-medium">Privacy Policy</a> for details of your rights.
        </p>
      </div>
    </div>
  `,
})
export class ContactComponent {
  // ── Fill these in with your real details before launch ──
  supportEmail = 'support@your-domain.com';
  grievanceEmail = 'grievance@your-domain.com';
  grievanceName = '[Grievance Officer name]';
  address = '[registered address, Nagpur, Maharashtra, India]';

  constructor(seo: SeoService) {
    seo.set({
      title: 'Contact & Grievances — TheBlogSphere',
      description: 'How to reach TheBlogSphere, including our Grievance Officer for content, copyright, and privacy.',
      canonicalPath: '/contact',
    });
  }
}
