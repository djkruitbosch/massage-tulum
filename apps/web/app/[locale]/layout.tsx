import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale, getTranslations } from 'next-intl/server';
import '../globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
  // latin-ext covers Spanish accented characters: á é í ó ú ñ ü
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-plus-jakarta-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
});

/**
 * Localized default metadata for every page under `[locale]`.
 *
 * - `title.default` is what the browser tab shows when a page does not
 *   override it. `title.template` lets per-page metadata exports like
 *   `title: 'Servicios'` produce `'Servicios · Massage Tulum'`
 *   automatically — keeps the brand suffix consistent without each
 *   page having to repeat it.
 * - `description` is localised so the meta description and OG share
 *   blurbs render in the user's language.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: {
      default: t('title'),
      template: t('titleTemplate'),
    },
    description: t('description'),
  };
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  // params.locale comes from the [locale] segment; getLocale() reads the
  // same value from the next-intl request context established by middleware.
  // Using getLocale() here is idiomatic for server layouts.
  await params; // consume params to satisfy Next.js async params contract
  const locale = await getLocale();

  // Load all messages server-side; pass them to NextIntlClientProvider so
  // Client Components nested anywhere in the tree can use useTranslations().
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${plusJakartaSans.variable}`}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
