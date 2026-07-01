import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo.service';

// DRAFT TEMPLATE — starting point only. Have a qualified lawyer review before
// launch, and replace every [bracketed] placeholder with your real details.
@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  template: `
    <div class="bg-page min-h-screen">
      <div class="border-b border-gray-200 bg-paper">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <p class="eyebrow eyebrow-clay mb-4">Legal</p>
          <h1 class="font-display text-gray-900 font-semibold tracking-[-0.02em] text-[clamp(2rem,5vw,3rem)] mb-4">Privacy Policy</h1>
          <p class="text-sm text-gray-500">Last updated 1 July 2026</p>
        </div>
      </div>

      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          This Privacy Policy explains how TheBlogSphere ("we", "us"), operated by [your legal entity / proprietor name],
          [registered address, Nagpur, Maharashtra, India], collects, uses, and protects your personal data. We handle
          personal data in line with India's Digital Personal Data Protection Act, 2023 ("DPDP Act"), and, for users in the
          EU/UK, the GDPR. By using the Platform you acknowledge this Policy.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">1. Who is responsible for your data</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          [Your legal entity / proprietor name] is the data fiduciary/controller. For any privacy question or to exercise
          your rights, contact our Grievance Officer via the <a routerLink="/contact" class="link-underline text-gray-800 font-medium">Contact</a> page.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">2. What we collect</h2>
        <ul class="list-disc pl-6 space-y-1.5 font-reading text-gray-600 mb-4">
          <li><strong class="text-gray-800">Account data</strong> — your name, email, and password (stored hashed). If you sign in with Google, we receive your name, email, and profile photo from Google.</li>
          <li><strong class="text-gray-800">Content</strong> — the stories, comments, bio, and other material you create.</li>
          <li><strong class="text-gray-800">Usage &amp; device data</strong> — your IP address and basic request data, used for security and rate-limiting.</li>
          <li><strong class="text-gray-800">Payment data</strong> — if you subscribe, our payment partners process your payment. We receive confirmation and subscription status, but we do not store your full card or bank details.</li>
          <li><strong class="text-gray-800">Optional data</strong> — a UPI ID or tip link if you choose to accept tips.</li>
        </ul>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">3. How we use your data</h2>
        <ul class="list-disc pl-6 space-y-1.5 font-reading text-gray-600 mb-4">
          <li>to create and operate your account and publish your content;</li>
          <li>to provide AI writing and narration features you request;</li>
          <li>to process subscriptions and keep your plan status current;</li>
          <li>to keep the Platform secure and prevent abuse;</li>
          <li>to respond to you and send essential service messages;</li>
          <li>to comply with legal obligations.</li>
        </ul>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">4. Legal basis</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We process data on the basis of your consent (which you may withdraw), the performance of our contract with you
          (to provide the service), and our legitimate interests in keeping the Platform safe and functional, as permitted
          by the DPDP Act and, where applicable, the GDPR.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">5. Third parties and AI providers</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We share data with the following service providers only as needed to run the Platform. Some of them are located
          outside India, so your data may be processed abroad under appropriate safeguards.
        </p>
        <ul class="list-disc pl-6 space-y-1.5 font-reading text-gray-600 mb-4">
          <li><strong class="text-gray-800">Google</strong> — sign-in (if you use it).</li>
          <li><strong class="text-gray-800">Groq</strong> — AI text assistance. The text you submit to the assistant is sent to Groq to generate a response.</li>
          <li><strong class="text-gray-800">OpenAI</strong> — AI narration. The story text you narrate is sent to OpenAI to generate audio.</li>
          <li><strong class="text-gray-800">Cloudflare R2</strong> — storage of images and generated audio.</li>
          <li><strong class="text-gray-800">Razorpay / Stripe</strong> — subscription payments.</li>
          <li><strong class="text-gray-800">Railway</strong> — hosting of the application and database.</li>
        </ul>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We do not sell your personal data, and we do not use it for advertising. We may disclose data if required by law or
          to protect our rights and users' safety.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">6. Cookies</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We use only essential cookies &mdash; primarily to keep you signed in and remember basic preferences. We do not use
          advertising or cross-site tracking cookies. You can clear cookies in your browser, but some features (like staying
          signed in) may then stop working.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">7. Retention</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We keep your data for as long as your account is active and as needed to provide the service, then delete or
          anonymise it, unless we must keep it longer to comply with law, resolve disputes, or enforce our agreements.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">8. Security</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We use reasonable technical and organisational measures &mdash; including encrypted transport, password hashing, access
          controls, and rate-limiting &mdash; to protect your data. No system is perfectly secure, and we cannot guarantee
          absolute security.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">9. Your rights</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          Subject to applicable law, you have the right to access, correct, and delete your personal data, to withdraw
          consent, to request a copy of your data, and to raise a grievance. You can edit your profile and delete your
          content in the app, or contact us to exercise any of these rights. We will respond within the timelines required
          by law.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">10. Children</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          The Platform is not intended for children under 18 without guardian consent, and not for children under the age at
          which data-processing consent is required in your jurisdiction. We do not knowingly collect data from such
          children.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">11. Changes</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We may update this Policy. If changes are material we will update the date above and, where appropriate, notify
          you.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">12. Contact and grievances</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          To exercise your rights or raise a privacy concern, contact our Grievance Officer on the
          <a routerLink="/contact" class="link-underline text-gray-800 font-medium">Contact</a> page.
        </p>
      </div>
    </div>
  `,
})
export class PrivacyComponent {
  constructor(seo: SeoService) {
    seo.set({
      title: 'Privacy Policy — TheBlogSphere',
      description: 'How TheBlogSphere collects, uses, and protects your personal data.',
      canonicalPath: '/privacy',
    });
  }
}
