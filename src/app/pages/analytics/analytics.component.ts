import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BlogService } from '../../services/blog.service';

@Component({
  selector: 'app-analytics',
  imports: [RouterLink, DatePipe],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  data = signal<any>(null);
  loading = signal(true);

  constructor(private blogService: BlogService) {}

  ngOnInit() {
    this.blogService.getMyAnalytics().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  maxViews(): number {
    return Math.max(1, ...(this.data()?.monthlyViews ?? []).map((m: any) => m.views));
  }
}
