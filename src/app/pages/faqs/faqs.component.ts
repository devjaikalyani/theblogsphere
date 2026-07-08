import { Component, Inject, signal, DOCUMENT } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SeoService } from '../../services/seo.service';
import { RevealDirective } from '../../directives/reveal.directive';

interface Faq {
  q: string;
  a: string;
}

@Component({
  selector: 'app-faqs',
  imports: [RouterLink, RevealDirective],
  templateUrl: './faqs.component.html',
  styleUrl: './faqs.component.css',
})
export class FaqsComponent {
  open = signal<number | null>(null);

  constructor(seo: SeoService, @Inject(DOCUMENT) private doc: Document) {
    seo.set({
      title: 'FAQ | TheBlogSphere',
      description: 'Answers to common questions about publishing, drafts, tags, the AI writing assistant, and content ownership on TheBlogSphere.',
      canonicalPath: '/faq',
    });
    queueMicrotask(() => this.setFaqJsonLd());
  }

  /** FAQPage structured data, eligible for rich results in search. */
  private setFaqJsonLd() {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    };
    const existing = this.doc.getElementById('faq-jsonld');
    if (existing) existing.remove();
    const script = this.doc.createElement('script');
    script.id = 'faq-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(ld);
    this.doc.head.appendChild(script);
  }

  toggle(i: number) {
    this.open.set(this.open() === i ? null : i);
  }

  faqs: Faq[] = [
    {
      q: 'Is TheBlogSphere free to use?',
      a: 'Yes. Reading and publishing stories on TheBlogSphere is completely free. We may introduce optional premium features in the future, but core writing and publishing will always remain free.',
    },
    {
      q: 'Who can publish on TheBlogSphere?',
      a: 'Anyone. Create an account and you can start writing immediately. We welcome writers from every country, language, and discipline.',
    },
    {
      q: 'Can I save a story as a draft before publishing?',
      a: 'Yes. When writing or editing a story, click "Save draft" to save your work privately. Drafts are only visible to you and can be published whenever you are ready.',
    },
    {
      q: 'How do tags work?',
      a: 'You can add up to 5 tags to each story. Tags help readers find your content through search and the tag filter on the Explore page. Use clear, descriptive tags that reflect what your story is about.',
    },
    {
      q: 'Does TheBlogSphere use AI?',
      a: 'TheBlogSphere offers an optional AI writing assistant that can help you brainstorm, draft, or expand your ideas. The assistant is a tool, your words and your voice are always what gets published.',
    },
    {
      q: 'How is my reading time calculated?',
      a: 'Read time is calculated based on average adult reading speed of approximately 200 words per minute. It is an estimate to help readers decide if they have time to read a story right now.',
    },
    {
      q: 'Can I delete my stories?',
      a: 'Yes. You can delete any of your stories at any time from your My Stories page. Deletion is permanent and cannot be undone.',
    },
    {
      q: 'Is my content mine?',
      a: 'Absolutely. You retain full ownership of everything you write and publish on TheBlogSphere. We do not claim any rights over your content.',
    },
  ];
}
