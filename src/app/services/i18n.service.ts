import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Locale = 'en' | 'ar';

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.explore': 'Explore',
    'nav.write': 'Write',
    'nav.ai': 'AI',
    'nav.myStories': 'My Stories',
    'nav.writeStory': 'Write a story',
    'nav.feed': 'My Feed',
    'nav.bookmarks': 'Bookmarks',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',
    'nav.signOut': 'Sign out',
    'nav.signIn': 'Sign in',
    'nav.getStarted': 'Get started',
    'explore.heading': 'Explore Stories',
    'explore.searchPlaceholder': 'Search stories by title or content...',
    'home.heroSubtext': 'Discover stories from writers around the world. Use AI to help you write more, write better.',
    'home.exploreStories': 'Explore Stories',
    'home.startWriting': 'Start writing',
    'home.recentStories': 'Recent Stories',
    'home.viewAll': 'View all',
    'common.minRead': 'min read',
    'common.views': 'views',
    'common.featured': 'Featured',
  },
  ar: {
    'nav.home': 'الرئيسية',
    'nav.explore': 'استكشف',
    'nav.write': 'اكتب',
    'nav.ai': 'ذكاء اصطناعي',
    'nav.myStories': 'قصصي',
    'nav.writeStory': 'اكتب قصة',
    'nav.feed': 'خلاصتي',
    'nav.bookmarks': 'المحفوظات',
    'nav.analytics': 'التحليلات',
    'nav.settings': 'الإعدادات',
    'nav.signOut': 'تسجيل الخروج',
    'nav.signIn': 'تسجيل الدخول',
    'nav.getStarted': 'ابدأ الآن',
    'explore.heading': 'استكشف القصص',
    'explore.searchPlaceholder': 'ابحث بالعنوان أو المحتوى...',
    'home.heroSubtext': 'اكتشف قصصاً من كتّاب حول العالم. استخدم الذكاء الاصطناعي لتكتب أكثر وأفضل.',
    'home.exploreStories': 'استكشف القصص',
    'home.startWriting': 'ابدأ الكتابة',
    'home.recentStories': 'أحدث القصص',
    'home.viewAll': 'عرض الكل',
    'common.minRead': 'د قراءة',
    'common.views': 'مشاهدة',
    'common.featured': 'مميز',
  },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  locale = signal<Locale>('en');

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('locale') as Locale | null;
      if (saved === 'en' || saved === 'ar') {
        this.applyLocale(saved);
      }
    }
  }

  setLocale(locale: Locale) {
    this.applyLocale(locale);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('locale', locale);
    }
  }

  private applyLocale(locale: Locale) {
    this.locale.set(locale);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    }
  }

  t(key: string): string {
    return TRANSLATIONS[this.locale()][key] ?? key;
  }

  get isRtl(): boolean {
    return this.locale() === 'ar';
  }
}
