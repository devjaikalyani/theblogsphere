import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'explore',
    loadComponent: () => import('./pages/explore/explore.component').then(m => m.ExploreComponent),
  },
  {
    path: 'trending',
    loadComponent: () => import('./pages/trending/trending.component').then(m => m.TrendingComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.component').then(m => m.SignupComponent),
  },
  {
    path: 'create',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/create/create.component').then(m => m.CreateComponent),
  },
  {
    path: 'ai-assistant',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/ai-assistant/ai-assistant.component').then(m => m.AiAssistantComponent),
  },
  {
    path: 'my-stories',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/my-stories/my-stories.component').then(m => m.MyStoriesComponent),
  },
  {
    path: 'edit/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/edit/edit.component').then(m => m.EditComponent),
  },
  {
    path: 'author/:id',
    loadComponent: () => import('./pages/author/author.component').then(m => m.AuthorComponent),
  },
  {
    path: 'pricing',
    loadComponent: () => import('./pages/pricing/pricing.component').then(m => m.PricingComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
  },
  {
    path: 'faq',
    loadComponent: () => import('./pages/faqs/faqs.component').then(m => m.FaqsComponent),
  },
  {
    path: 'bookmarks',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/bookmarks/bookmarks.component').then(m => m.BookmarksComponent),
  },
  {
    path: 'feed',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/feed/feed.component').then(m => m.FeedComponent),
  },
  {
    path: 'analytics',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/analytics/analytics.component').then(m => m.AnalyticsComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'blog/:id',
    loadComponent: () => import('./pages/blog-detail/blog-detail.component').then(m => m.BlogDetailComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
