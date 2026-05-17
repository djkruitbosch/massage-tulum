# Component: Button

**Used in:** Foundation (all features)
**Designer doc:** `docs/design/foundation-home.md`
**Status:** Spec
**Date:** 2026-04-26

---

## Purpose

The Button is the primary interactive action element across the studio-owner UI. It is the canonical action affordance — every form submit, navigation action, and modal trigger routes through this component.

---

## Anatomy

```
[ leading-icon? ] [ label ] [ trailing-icon? ]
     optional         required        optional
```

The label is always required (even on icon-only variants — the visual icon is paired with a required `aria-label`). Leading and trailing icons are optional. The loading state replaces the leading icon slot with a spinner.

---

## Props

```typescript
interface ButtonProps {
  // Content
  children: React.ReactNode;           // Required: button label text
  leadingIcon?: React.ReactNode;       // Optional: Lucide icon component
  trailingIcon?: React.ReactNode;      // Optional: Lucide icon component

  // Behavior
  type?: 'button' | 'submit' | 'reset'; // Default: 'button'
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  href?: string;                       // When set, renders as <a> via Next.js <Link>
  disabled?: boolean;                  // Default: false
  loading?: boolean;                   // Default: false — shows spinner, disables interaction

  // Appearance
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'; // Default: 'primary'
  size?: 'sm' | 'md' | 'lg';          // Default: 'md'
  fullWidth?: boolean;                 // Default: false — stretches to container width

  // Accessibility
  'aria-label'?: string;               // Required when children is an icon only
  'aria-describedby'?: string;
}
```

---

## Sizes

| Size | Height | Padding (h × v) | Font size | Icon size | Tailwind classes |
|---|---|---|---|---|---|
| `sm` | 32px | `px-3 py-1.5` | `text-sm` (14px) | 16px | `h-8 px-3 py-1.5 text-sm` |
| `md` | 40px | `px-4 py-2` | `text-base` (16px) | 20px | `h-10 px-4 py-2 text-base` |
| `lg` | 48px | `px-6 py-3` | `text-base` (16px) | 20px | `h-12 px-6 py-3 text-base` |

**Touch target note:** All sizes meet the minimum 44×44px touch target on mobile because the `lg` button exceeds 44px and the `md`/`sm` buttons should have sufficient surrounding whitespace. When a `sm` button appears in a dense mobile layout, ensure the parent element provides at least 44px of tappable area (padding or margin).

---

## Variants and States

### Variant: `primary`

The most prominent action. One primary button per visible screen section.

| State | Background | Text | Border | Ring |
|---|---|---|---|---|
| Default | `bg-brand-700` | `text-white` | none | none |
| Hover | `bg-brand-600` (lighter — interactive feel) | `text-white` | none | none |
| Focus-visible | `bg-brand-700` | `text-white` | none | `ring-2 ring-offset-2 ring-brand-500` |
| Active | `bg-brand-800` | `text-white` | none | none |
| Disabled | `bg-neutral-200` | `text-neutral-400` | none | none |
| Loading | `bg-brand-700` | `text-white/70` | none | none |

**Tailwind class string (default/md):**
```
inline-flex items-center justify-center gap-2 rounded-lg font-medium
h-10 px-4 py-2 text-base
bg-brand-700 text-white
hover:bg-brand-600
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500
active:bg-brand-800
disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed
motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out
```

### Variant: `secondary`

Paired with primary for secondary actions. Outlined style.

| State | Background | Text | Border | Ring |
|---|---|---|---|---|
| Default | `bg-white` | `text-brand-700` | `border border-brand-300` | none |
| Hover | `bg-brand-50` | `text-brand-700` | `border-brand-400` | none |
| Focus-visible | `bg-white` | `text-brand-700` | `border-brand-300` | `ring-2 ring-offset-2 ring-brand-500` |
| Active | `bg-brand-100` | `text-brand-700` | `border-brand-500` | none |
| Disabled | `bg-white` | `text-neutral-400` | `border-neutral-200` | none |
| Loading | `bg-white` | `text-brand-700/60` | `border-brand-200` | none |

**Tailwind class string (default/md):**
```
inline-flex items-center justify-center gap-2 rounded-lg font-medium
h-10 px-4 py-2 text-base
bg-white text-brand-700 border border-brand-300
hover:bg-brand-50 hover:border-brand-400
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500
active:bg-brand-100 active:border-brand-500
disabled:bg-white disabled:text-neutral-400 disabled:border-neutral-200 disabled:cursor-not-allowed
motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out
```

### Variant: `ghost`

Minimal. Used for tertiary actions, toolbar actions, and icon-only buttons.

| State | Background | Text | Border | Ring |
|---|---|---|---|---|
| Default | transparent | `text-neutral-600` | none | none |
| Hover | `bg-neutral-100` | `text-neutral-700` | none | none |
| Focus-visible | transparent | `text-neutral-600` | none | `ring-2 ring-offset-2 ring-brand-500` |
| Active | `bg-neutral-200` | `text-neutral-800` | none | none |
| Disabled | transparent | `text-neutral-300` | none | none |
| Loading | transparent | `text-neutral-600/60` | none | none |

**Tailwind class string (default/md):**
```
inline-flex items-center justify-center gap-2 rounded-lg font-medium
h-10 px-4 py-2 text-base
text-neutral-600
hover:bg-neutral-100 hover:text-neutral-700
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500
active:bg-neutral-200 active:text-neutral-800
disabled:text-neutral-300 disabled:cursor-not-allowed
motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out
```

### Variant: `destructive`

For dangerous, irreversible actions (delete, remove). Should be used sparingly and ideally paired with a confirmation step.

| State | Background | Text | Border | Ring |
|---|---|---|---|---|
| Default | `bg-danger-500` | `text-white` | none | none |
| Hover | `bg-danger-700` | `text-white` | none | none |
| Focus-visible | `bg-danger-500` | `text-white` | none | `ring-2 ring-offset-2 ring-danger-500` |
| Active | `bg-danger-700` | `text-white` | none | none |
| Disabled | `bg-neutral-200` | `text-neutral-400` | none | none |
| Loading | `bg-danger-500` | `text-white/70` | none | none |

**Tailwind class string (default/md):**
```
inline-flex items-center justify-center gap-2 rounded-lg font-medium
h-10 px-4 py-2 text-base
bg-danger-500 text-white
hover:bg-danger-700
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-danger-500
active:bg-danger-700
disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed
motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out
```

---

## Loading State

When `loading={true}`:
1. The button is `disabled` (pointer-events-none, no click fires).
2. A spinner replaces the `leadingIcon` slot (or appears as the sole content if no icon).
3. The label text remains visible but at reduced opacity (`text-white/70` for primary/destructive, `text-brand-700/60` for secondary, `text-neutral-600/60` for ghost).
4. ARIA: `aria-busy="true"` is added to the button element.
5. ARIA: `aria-label` changes to include the loading suffix (see Copy section below), or a visually-hidden `<span>` with the loading text is added for screen readers.

**Spinner:** A circular Lucide `Loader2` icon (`lucide-react`) at the relevant size (16px for `sm`, 20px for `md`/`lg`), animated with `motion-safe:animate-spin` (gated per `docs/design/accessibility.md` §Reduced Motion). Class: `motion-safe:animate-spin text-current`.

---

## Full-Width

When `fullWidth={true}`, add `w-full` to the class list. The inner flex container remains `justify-center`.

---

## Icon-Only Button

When the button contains only an icon (no visible text label):
- `aria-label` is **required** (TypeScript should enforce this — developer-fe to add a runtime warning if both `children` is icon-only and `aria-label` is missing).
- Size recommendation: use `md` or `lg`. Avoid `sm` for icon-only on mobile (touch target risk).
- Visually, remove horizontal padding: replace `px-4` with `px-2.5` for `md`, giving a square appearance.

---

## Accessibility

- **ARIA role:** implicit `button` role via `<button>` element. When `href` is set, renders as `<a>` and has implicit `link` role.
- **Keyboard:** activated with `Space` and `Enter`. No custom keyboard handling needed beyond browser defaults.
- **Focus management:** focus ring uses `focus-visible:ring-*` (not `:focus`) — only shows for keyboard navigation, not mouse clicks. This is CSP-safe (class-based, not inline style).
- **Disabled state:** uses the `disabled` HTML attribute (not just `aria-disabled`) so the browser natively prevents all interaction. When `disabled={true}` and a tooltip explanation is needed, use `aria-describedby` pointing to a visually-hidden explanation.
- **Loading state:** `aria-busy="true"` signals to screen readers that the button is processing. Screen reader users hear the loading label (see Copy section).
- **Icon-only:** `aria-label` required; icon has `aria-hidden="true"`.
- **Color alone:** The destructive variant is red, but it must also be accompanied by label text that communicates danger (e.g., "Eliminar" / "Delete"), not color alone.

---

## Responsive Behavior

- **Desktop (≥1024px):** All sizes available.
- **Tablet (768–1023px):** All sizes available. Prefer `md` for touch comfort.
- **Mobile (375–767px):** Prefer `md` or `lg`. Ensure minimum 44×44px touch target. `fullWidth` is useful for mobile form submit buttons.

---

## Tokens Used

- **Colors:** `brand.700`, `brand.600`, `brand.800`, `brand.500`, `brand.50`, `brand.100`, `brand.300`, `brand.400`, `brand.200`, `neutral.100`, `neutral.200`, `neutral.300`, `neutral.400`, `neutral.600`, `neutral.700`, `neutral.800`, `danger.500`, `danger.700`
- **Spacing:** Tailwind default scale (`px-3`, `px-4`, `px-6`, `py-1.5`, `py-2`, `py-3`)
- **Typography:** `text-sm` / `text-base`, `font-medium`
- **Border radius:** `rounded-lg` (8px, `radius.md`)
- **Motion:** `duration-150`, `ease-out` (base transition)
- **Shadow:** Focus ring via `ring-*` utilities (no custom shadow class needed)

---

## Copy Keys

| Key | es | en |
|---|---|---|
| `common.button.loading` | Cargando... | Loading... |
| `common.button.retry` | Reintentar | Retry |
| `common.button.cancel` | Cancelar | Cancel |
| `common.button.save` | Guardar | Save |
| `common.button.delete` | Eliminar | Delete |
| `common.button.confirm` | Confirmar | Confirm |
| `common.button.close` | Cerrar | Close |

---

## Examples

### Example 1: Primary submit button in a form
```
variant="primary" size="md" type="submit"
children="Guardar cambios" / "Save changes"
```
Full-width on mobile (`fullWidth` on screens <768px).

### Example 2: Secondary cancel button alongside primary
```
variant="secondary" size="md" type="button"
children="Cancelar" / "Cancel"
```
Appears to the left of the primary button on desktop; stacks below on mobile (with `fullWidth`).

### Example 3: Ghost icon-only toolbar action
```
variant="ghost" size="md"
children=<Pencil size={20} aria-hidden="true" />
aria-label="Editar terapeuta" / "Edit therapist"
```

### Example 4: Destructive delete button (confirmation modal)
```
variant="destructive" size="md"
leadingIcon=<Trash2 size={20} aria-hidden="true" />
children="Eliminar reserva" / "Delete booking"
```

---

## Don'ts

- Don't use `primary` for more than one action per screen section. Use `secondary` or `ghost` for the supporting action.
- Don't use `destructive` without a confirmation step (at minimum, a modal asking the user to confirm).
- Don't set `disabled={true}` without providing context via tooltip or adjacent text about why the action is unavailable.
- Don't use `ghost` for the main CTA on a screen — it lacks visual weight.
- Don't animate with `transition-all` on buttons — it's too broad and can cause unexpected visual glitches. Use `transition-colors` specifically.
