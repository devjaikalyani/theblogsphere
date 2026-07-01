import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo.service';

// DRAFT TEMPLATE — starting point only. Have a qualified lawyer review before
// launch, and replace every [bracketed] placeholder with your real details.
@Component({
  selector: 'app-terms',
  imports: [RouterLink],
  template: `
    <div class="bg-page min-h-screen">
      <div class="border-b border-gray-200 bg-paper">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <p class="eyebrow eyebrow-clay mb-4">Legal</p>
          <h1 class="font-display text-gray-900 font-semibold tracking-[-0.02em] text-[clamp(2rem,5vw,3rem)] mb-4">Terms of Service</h1>
          <p class="text-sm text-gray-500">Last updated 1 July 2026</p>
        </div>
      </div>

      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          These Terms of Service ("Terms") govern your access to and use of TheBlogSphere
          (the "Platform"), operated by Dev Jaikalyani (sole proprietor), 524, Sindhi Colony, Khamla, Nagpur,
          Maharashtra, India ("we", "us", "our"). By creating an account, or by accessing or using the
          Platform, you agree to be bound by these Terms and by our
          <a routerLink="/privacy" class="link-underline text-gray-800 font-medium">Privacy Policy</a>. If you do not
          agree, please do not use the Platform.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">1. Eligibility</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          You must be at least 18 years old, or the age of majority in your jurisdiction, to use the Platform. If you
          are a minor, you may use it only under the supervision of a parent or legal guardian who agrees to these Terms.
          By using the Platform you represent that you have the legal capacity to enter into this agreement.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">2. Your account</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          You are responsible for the information you provide, for keeping your login credentials secure, and for all
          activity under your account. Notify us immediately of any unauthorised use. We may suspend or terminate accounts
          that violate these Terms.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">3. Your content and licence</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          You retain all ownership of the stories, comments, and other content you create ("Your Content"). To operate the
          Platform, you grant us a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, display, and
          distribute Your Content solely to provide and promote the service (for example, showing your public posts to
          readers and in listings). This licence ends when you delete Your Content or your account, except for content
          others have already shared or that we must retain to comply with law.
        </p>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          You represent that you own or have the necessary rights to Your Content and that it does not infringe the rights
          of any third party.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">4. Acceptable use</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">You agree not to post, upload, or share content that:</p>
        <ul class="list-disc pl-6 space-y-1.5 font-reading text-gray-600 mb-4">
          <li>is unlawful, defamatory, obscene, hateful, or incites violence or discrimination;</li>
          <li>infringes any copyright, trademark, privacy, or other right;</li>
          <li>is sexually explicit involving minors, or is otherwise illegal under Indian law;</li>
          <li>is spam, malware, or a deceptive or fraudulent scheme;</li>
          <li>impersonates another person or misrepresents your affiliation;</li>
          <li>attempts to disrupt, reverse-engineer, scrape, or gain unauthorised access to the Platform.</li>
        </ul>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We may remove content or restrict accounts that breach this section, and we cooperate with lawful requests from
          authorities.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">5. AI features</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          The Platform offers AI writing assistance and AI narration. When you use these, the text you submit is sent to
          third-party AI providers (currently Groq for text and OpenAI for narration) to generate a result. AI output can
          be inaccurate, incomplete, or biased &mdash; you are responsible for reviewing and verifying it before you rely on or
          publish it. You are responsible for ensuring your use of AI output complies with applicable law and does not
          infringe third-party rights. See our <a routerLink="/privacy" class="link-underline text-gray-800 font-medium">Privacy Policy</a> for how this data is handled.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">6. Subscriptions and payments</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          Some features ("Writer Pro") require a paid subscription. Subscriptions are billed in advance on a recurring
          basis through our payment partners (Razorpay for India, Stripe for international cards) and renew automatically
          until cancelled. Prices are shown on the <a routerLink="/pricing" class="link-underline text-gray-800 font-medium">Pricing</a> page and may change with notice
          for future billing periods. Billing, cancellation, and refunds are governed by our
          <a routerLink="/refund" class="link-underline text-gray-800 font-medium">Refund &amp; Cancellation Policy</a>.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">7. Tips to writers</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          Readers may send optional tips to writers via UPI or a writer's own external link. Tips are paid directly to the
          writer; we are not a party to, and take no commission from, these payments, and we do not hold funds. Writers are
          solely responsible for any taxes on amounts they receive.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">8. Intellectual property of the Platform</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          The Platform's name, logo, design, and software are owned by us or our licensors and are protected by law. These
          Terms do not grant you any right to use them except as needed to use the service.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">9. Copyright complaints</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          If you believe content on the Platform infringes your copyright or other rights, contact our Grievance Officer via
          the <a routerLink="/contact" class="link-underline text-gray-800 font-medium">Contact</a> page with the details described there. We will act on valid complaints in
          accordance with applicable law.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">10. Intermediary status</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We act as an intermediary under the Information Technology Act, 2000 and the Information Technology (Intermediary
          Guidelines and Digital Media Ethics Code) Rules, 2021. We do not endorse user content, and content reflects the
          views of its authors, not ours.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">11. Disclaimers</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          The Platform is provided "as is" and "as available" without warranties of any kind, to the fullest extent
          permitted by law. We do not warrant that the service will be uninterrupted, error-free, or secure, or that AI
          output will be accurate.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">12. Limitation of liability</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          To the maximum extent permitted by law, we will not be liable for any indirect, incidental, special, or
          consequential damages, or for loss of data, profits, or goodwill. Our total liability for any claim relating to
          the Platform will not exceed the greater of the amounts you paid us in the twelve months before the claim or
          INR 1,000.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">13. Indemnity</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          You agree to indemnify us against claims arising from Your Content, your use of the Platform, or your breach of
          these Terms.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">14. Termination</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          You may stop using the Platform and delete your account at any time. We may suspend or terminate access if you
          breach these Terms or where required by law.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">15. Governing law</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          These Terms are governed by the laws of India. The courts at Nagpur, Maharashtra will have exclusive
          jurisdiction, subject to any mandatory consumer-protection rights available to you where you live.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">16. Changes</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          We may update these Terms from time to time. If we make material changes, we will update the date above and, where
          appropriate, notify you. Continued use after changes means you accept them.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">17. Contact</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          Questions about these Terms? Reach us via the <a routerLink="/contact" class="link-underline text-gray-800 font-medium">Contact</a> page.
        </p>
      </div>
    </div>
  `,
})
export class TermsComponent {
  constructor(seo: SeoService) {
    seo.set({
      title: 'Terms of Service — TheBlogSphere',
      description: 'The terms that govern your use of TheBlogSphere.',
      canonicalPath: '/terms',
    });
  }
}
