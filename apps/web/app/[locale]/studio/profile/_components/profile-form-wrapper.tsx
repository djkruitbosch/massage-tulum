'use client';

/**
 * ProfileFormWrapper — client component.
 *
 * Thin client boundary that wraps StudioProfileForm and provides the
 * onReload handler (requires window.location, which is a browser API).
 *
 * This component exists to separate the client-side reload logic from
 * the server component page.tsx, which fetches the initial data.
 *
 * Ticket: CU-869d8cp2d
 */

import { type StudioProfile } from '@massage-tulum/shared';
import { StudioProfileForm } from './studio-profile-form';

interface ProfileFormWrapperProps {
  initialData: StudioProfile | null;
  locale: string;
}

export function ProfileFormWrapper({ initialData, locale }: ProfileFormWrapperProps) {
  const handleReload = () => {
    // Navigate to the same page to re-run the server component and re-fetch
    window.location.href = locale === 'en' ? '/en/studio/profile' : '/studio/profile';
  };

  return <StudioProfileForm initialData={initialData} onReload={handleReload} />;
}
