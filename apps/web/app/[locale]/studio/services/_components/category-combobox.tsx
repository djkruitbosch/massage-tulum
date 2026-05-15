'use client';

/**
 * CategoryCombobox — controlled combobox for service category selection.
 *
 * Behavior:
 *   - On first focus: calls getCategories() server action (lazy, once per session).
 *   - As user types: filters cached categories by case-insensitive prefix match.
 *   - Shows "Create '{value}'" option when typed value doesn't match any category.
 *   - Selecting an option or pressing Enter: commits the value.
 *   - On blur: accepts the typed text as-is (free-text).
 *   - On Escape: closes the dropdown.
 *   - Arrow Up/Down: navigates options.
 *
 * Accessibility: role="combobox" + aria-expanded + aria-controls + aria-autocomplete="list"
 *   Listbox has role="listbox"; options have role="option" + aria-selected.
 *
 * Ref: docs/design/service-catalog.md §8
 * Ticket: CU-869d29f21
 */

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getCategories } from '../../../../../actions/services';

interface CategoryComboboxProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  error?: string;
  /** Optional: append newly-created category to parent cache after successful save */
  onNewCategory?: (category: string) => void;
}

export function CategoryCombobox({ value, onChange, error, onNewCategory }: CategoryComboboxProps) {
  const t = useTranslations('serviceCatalog');
  const comboboxId = useId();
  const listboxId = useId();
  const errorId = useId();

  const [inputValue, setInputValue] = useState<string>(value ?? '');
  const [categories, setCategories] = useState<string[]>([]);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxRef = useRef<HTMLUListElement | null>(null);

  // Sync inputValue when controlled value changes (e.g., edit pre-fill)
  useEffect(() => {
    setInputValue(value ?? '');
  }, [value]);

  // Compute filtered options
  const trimmedInput = inputValue.trim();
  const filtered = trimmedInput
    ? categories.filter((c) => c.toLowerCase().startsWith(trimmedInput.toLowerCase()))
    : categories;

  // Whether to show "Create" option
  const showCreate =
    trimmedInput.length > 0 &&
    !categories.some((c) => c.toLowerCase() === trimmedInput.toLowerCase());

  // Total option count for arrow key navigation
  const optionCount = filtered.length + (showCreate ? 1 : 0);

  async function fetchCategoriesOnce() {
    if (fetchedOnce) return;
    setFetchedOnce(true);
    const result = await getCategories();
    if (result.success) {
      setCategories(result.data);
    }
  }

  function openDropdown() {
    setIsOpen(true);
    setActiveIndex(-1);
  }

  function closeDropdown() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function commitValue(val: string) {
    const normalized = val.trim() === '' ? null : val.trim();
    onChange(normalized);
    setInputValue(val.trim());
    closeDropdown();
    // If it's a new category, notify parent
    if (normalized && !categories.includes(normalized)) {
      setCategories((prev) => [...prev, normalized].sort());
      onNewCategory?.(normalized);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    onChange(val.trim() === '' ? null : val);
    openDropdown();
    setActiveIndex(-1);
  }

  function handleFocus() {
    fetchCategoriesOnce();
    openDropdown();
  }

  function handleBlur() {
    // Delay close to allow click on option
    setTimeout(() => {
      closeDropdown();
      // Accept current typed value as the field value on blur
      const normalized = inputValue.trim() === '' ? null : inputValue.trim();
      onChange(normalized);
    }, 150);
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown') {
          openDropdown();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % Math.max(optionCount, 1));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((prev) => (prev <= 0 ? Math.max(optionCount - 1, 0) : prev - 1));
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (activeIndex >= 0) {
            if (activeIndex < filtered.length) {
              commitValue(filtered[activeIndex]!);
            } else if (showCreate) {
              // "Create" option
              commitValue(trimmedInput);
            }
          } else if (trimmedInput) {
            commitValue(trimmedInput);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          closeDropdown();
          break;
        }
        case 'Tab': {
          // Accept typed value on Tab
          closeDropdown();
          const normalized = inputValue.trim() === '' ? null : inputValue.trim();
          onChange(normalized);
          break;
        }
      }
    },
    [isOpen, activeIndex, filtered, showCreate, trimmedInput, inputValue, onChange],
  );

  function handleOptionClick(optionValue: string) {
    commitValue(optionValue);
    inputRef.current?.focus();
  }

  const shouldShow = isOpen && (filtered.length > 0 || showCreate);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={comboboxId}
        type="text"
        role="combobox"
        aria-expanded={shouldShow}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        autoComplete="off"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={t('field.category.helper')}
        className={[
          'h-10 w-full rounded-lg border px-3 text-sm text-neutral-800 bg-white',
          'placeholder:text-neutral-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
          'focus-visible:ring-offset-2',
          'motion-safe:transition-colors motion-safe:duration-150',
          error
            ? 'border-danger-500 focus-visible:ring-danger-500'
            : 'border-neutral-200 hover:border-neutral-300',
        ].join(' ')}
      />

      {/* Dropdown */}
      {shouldShow && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={t('field.category.label')}
          className={[
            'absolute z-50 mt-1 w-full rounded-lg border border-neutral-200',
            'bg-white shadow-lg py-1 max-h-48 overflow-y-auto',
          ].join(' ')}
        >
          {filtered.length === 0 && !showCreate && (
            <li className="px-3 py-2 text-sm text-neutral-400" role="option" aria-selected="false">
              {t('field.category.noOptions')}
            </li>
          )}

          {filtered.map((category, idx) => (
            <li
              key={category}
              id={`${listboxId}-option-${idx}`}
              role="option"
              aria-selected={activeIndex === idx}
              onMouseDown={(e) => {
                e.preventDefault();
                handleOptionClick(category);
              }}
              className={[
                'px-3 py-2 text-sm cursor-pointer',
                'motion-safe:transition-colors motion-safe:duration-100',
                activeIndex === idx
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-neutral-700 hover:bg-neutral-50',
              ].join(' ')}
            >
              {category}
            </li>
          ))}

          {showCreate && (
            <li
              id={`${listboxId}-option-${filtered.length}`}
              role="option"
              aria-selected={activeIndex === filtered.length}
              onMouseDown={(e) => {
                e.preventDefault();
                handleOptionClick(trimmedInput);
              }}
              className={[
                'px-3 py-2 text-sm cursor-pointer font-medium',
                'motion-safe:transition-colors motion-safe:duration-100',
                activeIndex === filtered.length
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-brand-700 hover:bg-brand-50',
              ].join(' ')}
            >
              {t('field.category.createOption', { value: trimmedInput })}
            </li>
          )}
        </ul>
      )}

      {/* Error message */}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs text-danger-700 flex items-center gap-1"
        >
          {error}
        </p>
      )}
    </div>
  );
}
