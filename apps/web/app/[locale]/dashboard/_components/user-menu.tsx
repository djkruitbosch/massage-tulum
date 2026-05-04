'use client';

/**
 * UserMenu — client component.
 *
 * Dropdown menu anchored to the authenticated user's email in the header.
 * Provides local logout and global logout (all devices) actions.
 *
 * Implements WAI-ARIA Menu Button pattern:
 *   - Trigger: aria-haspopup="menu", aria-expanded
 *   - Dropdown: role="menu"
 *   - Items: role="menuitem"
 *   - Arrow keys navigate between items
 *   - ESC closes and returns focus to trigger
 *   - Click outside closes
 *
 * Global logout shows a confirmation dialog before proceeding.
 * Local logout fires immediately (no confirmation — per OQ-5 decision).
 *
 * Ref: docs/design/components/UserMenu.md
 * Ticket: CU-869d4za67
 */

import { ChevronDown, Loader2, LogOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { logout, logoutAllDevices } from '../../../../actions/auth';

interface UserMenuProps {
  email: string;
}

export function UserMenu({ email }: UserMenuProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [isLoggingOutAll, startLogoutAllTransition] = useTransition();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogCancelRef = useRef<HTMLButtonElement>(null);
  const logoutItemRef = useRef<HTMLButtonElement>(null);
  const logoutAllItemRef = useRef<HTMLButtonElement>(null);

  // Ordered refs for arrow-key navigation. Must stay stable across renders.
  const menuItemRefs = [logoutItemRef, logoutAllItemRef] as const;
  const menuItems = [
    { id: 'logout', ref: logoutItemRef },
    { id: 'logout-all', ref: logoutAllItemRef },
  ] as const;

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeMenu]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex(0);
      requestAnimationFrame(() => {
        menuItemRefs[0].current?.focus();
      });
    } else if (e.key === 'Escape') {
      closeMenu();
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % menuItemRefs.length;
      setActiveIndex(nextIndex);
      menuItemRefs[nextIndex]?.current?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + menuItemRefs.length) % menuItemRefs.length;
      setActiveIndex(prevIndex);
      menuItemRefs[prevIndex]?.current?.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    }
  };

  const handleLogout = () => {
    closeMenu();
    startLogoutTransition(async () => {
      await logout();
    });
  };

  const handleLogoutAllClick = () => {
    closeMenu();
    setShowConfirmDialog(true);
    requestAnimationFrame(() => {
      dialogCancelRef.current?.focus();
    });
  };

  const handleConfirmLogoutAll = () => {
    setShowConfirmDialog(false);
    startLogoutAllTransition(async () => {
      await logoutAllDevices();
    });
  };

  const handleCancelLogoutAll = () => {
    setShowConfirmDialog(false);
    triggerRef.current?.focus();
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancelLogoutAll();
    }
  };

  return (
    <>
      <div className="relative">
        {/* Trigger button */}
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={`${t('userMenu.signedInAs')} ${email}`}
          onClick={() => {
            if (isOpen) {
              closeMenu();
            } else {
              setIsOpen(true);
              setActiveIndex(0);
              requestAnimationFrame(() => {
                menuItemRefs[0].current?.focus();
              });
            }
          }}
          onKeyDown={handleTriggerKeyDown}
          disabled={isLoggingOut || isLoggingOutAll}
          className={[
            'flex items-center gap-1.5 rounded-lg px-2 py-1 h-9',
            'text-neutral-700 text-sm font-medium',
            'border border-transparent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2',
            'motion-safe:transition-colors motion-safe:duration-150',
            'disabled:pointer-events-none',
            isOpen
              ? 'bg-neutral-100 border-neutral-200'
              : 'hover:bg-neutral-100 hover:border-neutral-200',
          ].join(' ')}
        >
          <span className="max-w-[200px] truncate md:max-w-[140px]">{email}</span>
          <ChevronDown
            size={16}
            className={[
              'text-neutral-400 shrink-0',
              'motion-safe:transition-transform motion-safe:duration-150',
              isOpen ? 'rotate-180' : '',
            ].join(' ')}
            aria-hidden="true"
          />
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-label={t('userMenu.trigger.label')}
            className={[
              'absolute right-0 top-[calc(100%+8px)]',
              'min-w-[220px] max-w-[320px]',
              'bg-white rounded-2xl shadow-lg border border-neutral-200',
              'z-[60]',
              'py-1',
            ].join(' ')}
          >
            {/* Email header (non-interactive, outside role="menu" semantics) */}
            <div
              aria-hidden="true"
              className="px-4 py-3 text-sm text-neutral-500 truncate border-b border-neutral-100"
            >
              {email}
            </div>

            {/* Log out (local) */}
            <button
              ref={menuItems[0].ref}
              type="button"
              role="menuitem"
              tabIndex={activeIndex === 0 ? 0 : -1}
              onClick={handleLogout}
              onKeyDown={(e) => handleMenuKeyDown(e, 0)}
              disabled={isLoggingOut}
              className={[
                'w-full flex items-center gap-2 px-4 py-2.5',
                'text-sm text-neutral-700 font-medium text-left cursor-pointer',
                'hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none',
                'motion-safe:transition-colors motion-safe:duration-100',
                'disabled:pointer-events-none disabled:opacity-50',
              ].join(' ')}
            >
              {isLoggingOut ? (
                <Loader2
                  size={16}
                  className="motion-safe:animate-spin text-neutral-400"
                  aria-hidden="true"
                />
              ) : (
                <LogOut size={16} className="text-neutral-500" aria-hidden="true" />
              )}
              {t('auth.logout.button')}
            </button>

            {/* Log out all devices */}
            <button
              ref={menuItems[1].ref}
              type="button"
              role="menuitem"
              tabIndex={activeIndex === 1 ? 0 : -1}
              onClick={handleLogoutAllClick}
              onKeyDown={(e) => handleMenuKeyDown(e, 1)}
              disabled={isLoggingOutAll}
              className={[
                'w-full flex items-center gap-2 px-4 py-2.5',
                'text-xs text-neutral-500 text-left cursor-pointer',
                'border-t border-neutral-100',
                'hover:bg-neutral-50 hover:text-neutral-700',
                'focus:bg-neutral-50 focus:outline-none',
                'motion-safe:transition-colors motion-safe:duration-100',
                'disabled:pointer-events-none disabled:opacity-50',
              ].join(' ')}
            >
              {isLoggingOutAll ? (
                <Loader2
                  size={14}
                  className="motion-safe:animate-spin text-neutral-400"
                  aria-hidden="true"
                />
              ) : (
                <LogOut size={14} className="text-neutral-400" aria-hidden="true" />
              )}
              {t('auth.logout.allDevices')}
            </button>
          </div>
        )}
      </div>

      {/* Confirmation dialog for global logout */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 bg-black/40 z-[90] flex items-center justify-center p-4"
          onKeyDown={handleDialogKeyDown}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-all-title"
            className="bg-white rounded-2xl shadow-lg p-6 max-w-[420px] w-full"
          >
            <h3 id="logout-all-title" className="text-xl font-semibold text-neutral-800">
              {t('auth.logout.confirmTitle')}
            </h3>
            <p className="text-sm text-neutral-600 mt-2">{t('auth.logout.confirmBody')}</p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                ref={dialogCancelRef}
                type="button"
                onClick={handleCancelLogoutAll}
                className={[
                  'h-9 rounded-lg border border-neutral-200 bg-white px-4',
                  'text-sm font-medium text-neutral-700',
                  'hover:bg-neutral-50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                ].join(' ')}
              >
                {t('common.button.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmLogoutAll}
                className={[
                  'h-9 rounded-lg bg-brand-700 px-4',
                  'text-sm font-medium text-white',
                  'hover:bg-brand-800',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                ].join(' ')}
              >
                {t('common.button.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
