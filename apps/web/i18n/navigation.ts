import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Typed navigation APIs derived from the routing config.
 *
 * Use these instead of the native Next.js navigation APIs so that:
 *   1. Localized pathnames (e.g. `/privacy` → `/aviso-de-privacidad`) are
 *      resolved automatically for the active locale.
 *   2. TypeScript catches incorrect internal route paths at compile time.
 *
 * Usage (Server Components):
 *   import { Link } from '@/i18n/navigation';
 *   <Link href="/privacy">Aviso de Privacidad</Link>
 *   // Renders as /aviso-de-privacidad (es) or /en/privacy-policy (en)
 *
 * Usage (Client Components):
 *   import { useRouter, usePathname } from '@/i18n/navigation';
 *   const router = useRouter();  // locale-aware router
 *   const pathname = usePathname();  // returns internal path, e.g. '/privacy'
 *
 * See: docs/adr/0010-next-intl-localized-pathnames.md
 * Ticket: CU-869d8202d
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
