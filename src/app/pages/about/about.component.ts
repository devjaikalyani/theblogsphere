import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo.service';
import { RevealDirective } from '../../directives/reveal.directive';
import { HoverDirective } from '../../directives/hover.directive';

@Component({
  selector: 'app-about',
  imports: [RouterLink, RevealDirective, HoverDirective],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent {
  constructor(seo: SeoService) {
    seo.set({
      title: 'About TheBlogSphere',
      description: 'Why TheBlogSphere exists: a writer-first, open, built-to-last home for long-form writing and the people who read it.',
      canonicalPath: '/about',
    });
  }

  values = [
    {
      title: 'Writer-first',
      desc: 'Every decision we make starts with: does this help the writer? No dark patterns, no engagement traps.',
      icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
    },
    {
      title: 'Open to all',
      desc: 'TheBlogSphere is for everyone, any language, any topic, any background. Your perspective matters here.',
      icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
    },
    {
      title: 'Built to last',
      desc: 'We are not chasing trends. We are building infrastructure for long-form writing that will still be here in 2035.',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    },
  ];
}
