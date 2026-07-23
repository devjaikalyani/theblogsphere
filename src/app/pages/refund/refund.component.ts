import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo.service';

// DRAFT TEMPLATE, starting point only. Have a qualified lawyer/CA review before
// launch, and confirm it matches what your Razorpay/Stripe accounts declare.
@Component({
  selector: 'app-refund',
  imports: [RouterLink],
  template: `
    <div class="bg-page min-h-screen">
      <div class="border-b border-gray-200 bg-paper">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <p class="eyebrow eyebrow-clay mb-4">Legal</p>
          <h1 class="font-display text-gray-900 font-semibold tracking-[-0.02em] text-[clamp(2rem,5vw,3rem)] mb-4">Refund &amp; Cancellation Policy</h1>
          <p class="text-sm text-gray-500">Last updated 1 July 2026</p>
        </div>
      </div>

      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          This policy explains how billing, cancellation, and refunds work for TheBlogSphere's paid subscription
          ("Writer Pro"). It forms part of our <a routerLink="/terms" class="link-underline text-gray-800 font-medium">Terms of Service</a>.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">1. What you are paying for</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          Writer and Writer Pro are paid upgrades to your account that unlock features such as unlimited AI writing
          assistance, a monthly human-quality narration allowance (with optional prepaid top-up packs), unlimited
          replay of already-narrated stories, and premium analytics. Writer Pro adds a larger monthly narration
          budget. Current pricing (for example, Writer at ₹149/mo or ₹999/year, and Writer Pro at ₹399/mo or ₹2,999
          for a 365-day annual pass in India, with international card prices shown alongside) is on the
          <a routerLink="/pricing" class="link-underline text-gray-800 font-medium">Pricing</a> page. Applicable taxes, if any, are
          charged as required by law.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">2. Billing and renewal</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          Writer Pro is currently sold as a one-time purchase that unlocks a fixed period of access (30 days, or 365 days
          for the annual pass). It does not auto-renew: your
          access ends automatically when that period expires unless you choose to buy again. Payments are handled by our
          partners (Razorpay for India, Stripe for international cards). Where an auto-renewing subscription option is
          offered instead, its recurring terms (amount, interval, and how to cancel) are disclosed at checkout before you
          pay, and by subscribing you authorise those recurring charges until you cancel. We will give notice of any price
          change before it applies to a future purchase or renewal.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">3. Free tier</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          You can use TheBlogSphere for free, including a limited number of free AI actions and free narrations, without any
          charge. You only pay if you choose to upgrade to Writer Pro.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">4. Cancellation</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          If you bought a one-time pass (30-day or annual), there is nothing to cancel: access simply ends on the expiry date shown in
          your account, and you are not charged again. If you are on an auto-renewing subscription, you may cancel at any
          time from your account (Settings or the <a routerLink="/pricing" class="link-underline text-gray-800 font-medium">Pricing</a> page) or by contacting us; cancelling stops future
          charges, and you keep Pro access until the end of the period you have already paid for.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">5. Refunds</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          Because Writer Pro is a digital service delivered immediately, subscription fees are generally non-refundable, and
          we do not provide pro-rated refunds for the unused part of a billing period after cancellation. However, we will
          issue a refund where required by applicable law, or in cases of a clear duplicate charge, a technical billing
          error on our side, or a charge you did not authorise. Approved refunds are made to your original payment method,
          typically within 5–7 business days (bank timelines may vary).
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">6. Failed payments</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          If a payment does not go through, Pro is simply not activated and you are not charged; you can try again. For an
          auto-renewing subscription, if a renewal payment fails we may retry it and may pause Pro features until payment
          succeeds. Either way, you will not lose your account or your content.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">7. Tips</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          Tips sent to writers are voluntary payments made directly to the writer and are non-refundable by us. We are not a
          party to those payments.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">8. Taxes</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          Prices are stated inclusive of applicable taxes (including Goods and Services Tax, GST) where such taxes apply.
          A payment receipt is issued for every charge, and a tax invoice is provided where we are required to do so.
          You are responsible for any taxes that apply to you personally.
        </p>

        <h2 class="font-display text-xl sm:text-2xl text-gray-900 mt-10 mb-3">9. How to request a refund</h2>
        <p class="font-reading text-gray-600 leading-relaxed mb-4">
          To request a refund or ask a billing question, contact us via the <a routerLink="/contact" class="link-underline text-gray-800 font-medium">Contact</a> page with your
          account email and the charge details. We aim to acknowledge requests within 48 hours and resolve them promptly.
        </p>
      </div>
    </div>
  `,
})
export class RefundComponent {
  constructor(seo: SeoService) {
    seo.set({
      title: 'Refund & Cancellation Policy, TheBlogSphere',
      description: 'How billing, cancellation, and refunds work for Writer Pro.',
      canonicalPath: '/refund',
    });
  }
}
