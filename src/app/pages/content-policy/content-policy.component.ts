import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo.service';

// DRAFT TEMPLATE, starting point only. Have a lawyer review the wording and
// tailor the prohibited-content list to your jurisdiction before launch.
@Component({
  selector: 'app-content-policy',
  imports: [RouterLink],
  template: `
    <div class="bg-page min-h-screen">
      <div class="border-b border-gray-200 bg-paper">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <p class="eyebrow eyebrow-clay mb-4">Community</p>
          <h1 class="font-display text-gray-900 font-semibold tracking-[-0.02em] text-[clamp(2rem,5vw,3rem)] mb-4">Content Policy</h1>
          <p class="font-reading text-gray-600 text-lg leading-relaxed max-w-xl">
            TheBlogSphere is a home for honest, original writing. These rules keep it that way. They apply to every
            story, comment, profile, and image on the platform.
          </p>
        </div>
      </div>

      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <section>
          <h2 class="font-display text-xl sm:text-2xl text-gray-900 mb-3">You own what you publish</h2>
          <p class="font-reading text-gray-600 leading-relaxed">
            You are responsible for everything you post and you must have the rights to it. Don't publish work that
            isn't yours, and don't copy other writers. By posting, you confirm the content is yours or properly licensed,
            as set out in our <a routerLink="/terms" class="link-underline text-gray-800 font-medium">Terms of Service</a>.
          </p>
        </section>

        <section>
          <h2 class="font-display text-xl sm:text-2xl text-gray-900 mb-3">What isn't allowed</h2>
          <p class="font-reading text-gray-600 leading-relaxed mb-4">Do not post content that:</p>
          <ul class="list-disc pl-6 space-y-2 font-reading text-gray-600">
            <li>infringes anyone's copyright, trademark, or other intellectual-property rights;</li>
            <li>is unlawful, or promotes, incites, or facilitates illegal acts;</li>
            <li>harasses, bullies, threatens, or targets a person or group with hate on the basis of religion, caste, sex, gender, sexual orientation, disability, ethnicity, or nationality;</li>
            <li>is sexually explicit, or sexualises or endangers minors in any way;</li>
            <li>depicts or glorifies graphic violence, self-harm, or cruelty;</li>
            <li>is deliberately false or misleading in a way that can cause real-world harm (health, safety, elections, finance);</li>
            <li>is spam, a scam, a phishing attempt, malware, or purely promotional filler;</li>
            <li>publishes someone's private or personal information without consent (doxxing);</li>
            <li>impersonates another person, brand, or TheBlogSphere itself.</li>
          </ul>
        </section>

        <section>
          <h2 class="font-display text-xl sm:text-2xl text-gray-900 mb-3">AI-assisted writing</h2>
          <p class="font-reading text-gray-600 leading-relaxed">
            Our writing assistant and narration features use third-party AI (see the
            <a routerLink="/privacy" class="link-underline text-gray-800 font-medium">Privacy Policy</a>). AI output can be
            inaccurate or biased, you are responsible for reviewing, fact-checking, and standing behind anything you
            publish with its help. Don't use AI to mass-produce low-value or deceptive content.
          </p>
        </section>

        <section>
          <h2 class="font-display text-xl sm:text-2xl text-gray-900 mb-3">Copyright &amp; DMCA takedowns</h2>
          <p class="font-reading text-gray-600 leading-relaxed mb-4">
            If you own a work that has been posted here without your permission, tell us and we will act on valid
            notices. You can:
          </p>
          <ul class="list-disc pl-6 space-y-2 font-reading text-gray-600 mb-4">
            <li>use the <strong class="text-gray-900">Report</strong> button on the story and choose &ldquo;Copyright infringement&rdquo;; or</li>
            <li>email our Grievance Officer via the <a routerLink="/contact" class="link-underline text-gray-800 font-medium">Contact &amp; Grievances</a> page.</li>
          </ul>
          <p class="font-reading text-gray-600 leading-relaxed">
            Include the link to the content, identification of the work you own and proof of ownership, your contact
            details, and a good-faith statement that the use is unauthorised. Submitting a knowingly false claim may make
            you liable for damages. We may remove content, notify the poster, and, where appropriate, reinstate it if a
            valid counter-notice is received.
          </p>
        </section>

        <section>
          <h2 class="font-display text-xl sm:text-2xl text-gray-900 mb-3">Reporting &amp; how we respond</h2>
          <p class="font-reading text-gray-600 leading-relaxed">
            Anyone can flag content with the Report button or by contacting our Grievance Officer. We acknowledge
            grievances within 24 hours and aim to resolve them within 15 days, in line with the Information Technology
            (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. Depending on the severity we may warn the
            author, remove or restrict the content, or suspend or terminate the account. We may act faster on content
            that poses an immediate risk of harm.
          </p>
        </section>

        <section>
          <h2 class="font-display text-xl sm:text-2xl text-gray-900 mb-3">Our role</h2>
          <p class="font-reading text-gray-600 leading-relaxed">
            TheBlogSphere is an intermediary that hosts user-generated content; we do not pre-screen everything that is
            posted. Enforcement of this policy is at our reasonable discretion and does not make us the author of, or
            liable for, user content. This page works alongside our
            <a routerLink="/terms" class="link-underline text-gray-800 font-medium">Terms of Service</a> and
            <a routerLink="/privacy" class="link-underline text-gray-800 font-medium">Privacy Policy</a>.
          </p>
        </section>
      </div>
    </div>
  `,
})
export class ContentPolicyComponent {
  constructor(seo: SeoService) {
    seo.set({
      title: 'Content Policy, TheBlogSphere',
      description: 'What is and isn’t allowed on TheBlogSphere, plus how to report content and file a copyright/DMCA takedown.',
      canonicalPath: '/content-policy',
    });
  }
}
