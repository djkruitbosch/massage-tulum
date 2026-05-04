# Component: LoginForm

**Used in:** Studio Owner Authentication (CU-869d29f1f)
**Designer doc:** `docs/design/CU-869d29f1f-studio-owner-auth.md`
**Status:** Spec
**Date:** 2026-05-03

---

## Purpose

A single-field email form that requests a magic link for authentication. Manages its own internal state machine: `idle` → `loading` → `sent` (success) or `error`. The success state replaces the form with a confirmation message inside the same card container. This is a Client Component (`"use client"`) because it manages form state.

---

## Anatomy

**Idle state:**
```
┌─────────────────────────────────────────────────────────────┐
│  [error banner — hidden unless ?error param or API error]   │
│                                                             │
│  Correo electrónico                          (visible label)│
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ejemplo@tuestudio.com                  (placeholder) │  │
│  └───────────────────────────────────────────────────────┘  │
│  [inline field error — hidden unless validation fails]      │
│                                                             │
│  [ Enviar enlace de acceso — Button primary/lg fullWidth ]  │
│                                                             │
│  ¿Primera vez? Crea tu cuenta →             (text link)    │
└─────────────────────────────────────────────────────────────┘
```

**Success state (replaces the form content, not the card):**
```
┌─────────────────────────────────────────────────────────────┐
│  [Mail icon, 24px, text-success-500, mx-auto mt-2]         │
│                                                             │
│  Revisa tu correo          (h3, text-center, text-2xl)     │
│                                                             │
│  Te enviamos un enlace a [email].           (text-sm)      │
│  Haz clic en él para acceder.               (text-center)  │
│                                                             │
│  ¿No recibiste el correo? Revisa tu carpeta de spam, o     │
│  [solicita otro enlace]  (text link, triggers resend)      │
│  (text-xs text-neutral-500 text-center, mt-6)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Props

```typescript
interface LoginFormProps {
  // The initial error from the URL query param (?error=link_expired | invalid_link)
  // Read by the Server Component wrapper and passed to the Client Component.
  initialError?: 'link_expired' | 'invalid_link' | null;

  // The locale is used for the success/error copy and for passing to signInWithOtp
  // as options.data.locale per the R2 research finding.
  locale: string; // 'es' | 'en'
}
```

The form does not need an `onSubmit` prop — it handles its own submission via a Server Action or the Supabase JS client. Developer-fe chooses the implementation; the component spec describes the states and behavior.

---

## State Machine

```
idle
  → (user submits valid email) → loading
  → (user submits invalid email) → idle (with field error shown)

loading
  → (API returns success) → sent
  → (API returns rate-limit error) → idle (with rate-limit banner)
  → (API returns generic error) → idle (with generic error banner)

sent
  → (user clicks "request another link") → idle (banner cleared, form re-shown)
```

Initial state is `idle`. If `initialError` prop is provided, start in `idle` with the error banner pre-shown.

---

## States

### Default (idle, no error)

- Email input: normal. Placeholder text visible. No error styling.
- Submit button: `variant="primary" size="lg" fullWidth`. Label: `auth.login.submitButton`.
- Error banner: hidden (`display: none` or conditional render — not just opacity 0, to avoid screen reader leakage).
- Inline field error: hidden.

### Error Banner (idle, with error)

Appears above the email input inside the card. Rendered as a `<div role="alert">` so screen readers announce it immediately when it appears.

```
┌──────────────────────────────────────────────────────────────┐
│  bg-danger-50  border border-danger-500  rounded-lg p-3 mb-4 │
│                                                               │
│  [AlertCircle icon 16px text-danger-500 aria-hidden]         │
│  [error text — text-sm text-danger-700]                      │
└──────────────────────────────────────────────────────────────┘
```

Tailwind:
```
flex items-start gap-2 rounded-lg bg-danger-50 border border-danger-500 p-3 mb-4
```

Error text per `initialError` prop:
- `link_expired` → `auth.login.errors.linkExpired`
- `invalid_link` → `auth.login.errors.invalidLink`
- API rate limit error → `auth.login.errors.tooManyRequests`
- API generic error → `auth.login.errors.genericError`

### Field Error (validation)

Shown inline below the email input when the field is invalid after a submit attempt. Not shown on blur — only on submit (spec AC-3).

```
<p
  id="email-error"
  role="alert"
  className="text-xs text-danger-700 mt-1 flex items-center gap-1"
>
  <AlertCircle size={12} aria-hidden="true" />
  {errorMessage}
</p>
```

The input gains:
- `aria-invalid="true"`
- `aria-describedby="email-error"`
- Border changes to `border-danger-500 focus-visible:ring-danger-500`

### Hover (email input)

Input border changes from `border-neutral-200` to `border-neutral-400` on hover.

### Focus-visible (email input)

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-brand-600 focus-visible:border-brand-600
```

### Loading

- Submit button: `loading={true}` — shows Loader2 spinner, text fades to partial opacity, pointer-events disabled.
- Email input: `readOnly={true}` — visually unchanged but not editable. Background changes to `bg-neutral-100` to signal non-editable state.
- Submit button label changes to: `auth.login.submittingButton` ("Enviando... / Sending...").
- The `auth.login.firstTime` link is still visible but cannot be interacted with (pointer-events-none) to prevent navigation during an in-flight request. (Optional: hide it during loading for simplicity.)

### Success (sent state)

Form DOM is replaced with the success card content:
- `Mail` Lucide icon, `size={24}`, `text-success-500`, `mx-auto`, `aria-hidden="true"`.
- `<h3>` with `auth.login.successTitle`, `text-2xl font-semibold text-neutral-800 text-center mt-4`, `tabIndex={-1}` (so focus can be programmatically moved here on state change).
- Body paragraph with `auth.login.successMessage`, interpolating the submitted email in bold.
- Resend prompt: `auth.login.resendPrompt` + inline text link `auth.login.resendButton`. Clicking the link transitions back to `idle` state.

Focus management on transition to success: move focus to the `<h3>` success title (it has `tabIndex={-1}` for this purpose). Announce to screen reader via `aria-live="polite"` on the card container.

### Error (loading → error, banner shown)

The form returns to `idle` state with the error banner populated. Focus moves to the error banner element (which has `role="alert"` — screen reader announces immediately). The email input retains its value so the user can retry without re-typing.

---

## Input Specification

```typescript
// The email input element attributes
type="email"
id="email"
name="email"
autoComplete="email"
autoCapitalize="none"
autoCorrect="off"
spellCheck={false}
inputMode="email"  // opens email keyboard on mobile
placeholder={t('auth.login.emailPlaceholder')}
```

Tailwind classes (default state):
```
w-full h-11 rounded-lg border border-neutral-200 bg-white px-4
text-base text-neutral-700 placeholder:text-neutral-400
hover:border-neutral-400
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0
focus-visible:ring-brand-600 focus-visible:border-brand-600
motion-safe:transition-colors motion-safe:duration-150
```

Height `h-11` (44px) meets the 44px minimum touch target requirement at all breakpoints.

Error state adds:
```
border-danger-500 focus-visible:ring-danger-500 focus-visible:border-danger-500
```

Read-only state (loading) adds:
```
bg-neutral-100 cursor-default
```

---

## Variants

This component has a single visual variant — the card form. The internal state (idle, loading, sent, error) controls what is shown. There are no separate visual variants.

---

## Accessibility

- **ARIA role:** The card container wrapping the form has `aria-live="polite"` so that state transitions (loading → success) are announced to screen readers without being intrusive.
- **Form element:** `<form>` with no explicit ARIA role (implicit `form` role requires an accessible name; use `aria-label={t('auth.login.title')}`).
- **Email label:** `<label htmlFor="email">` is always visible — never hidden, never placeholder-only.
- **Error banner:** `role="alert"` on the error banner — announces immediately on appearance.
- **Field error:** `role="alert"` on the inline error message; linked to the input via `aria-describedby`.
- **Submit button:** `aria-busy="true"` during loading; label change to `auth.login.submittingButton` communicates state to screen readers.
- **Success heading:** `tabIndex={-1}` allows programmatic focus after state transition. Screen readers hear the heading content when focus moves there.
- **Keyboard navigation:** Tab order: (error banner, if shown) → email input → submit button → "first time" link. No non-standard keyboard behavior.
- **`Enter` to submit:** Natural behavior of `<button type="submit">` inside a `<form>`. No special handling needed.

---

## Responsive Behavior

**Desktop (≥1024px):**
- Card has `p-8`. Email input is `h-11`. Submit button is `lg fullWidth`.
- "First time?" link: `text-sm text-center mt-4`.

**Tablet (768–1023px):**
- Card padding reduces to `p-6`. All other sizing unchanged.

**Mobile (375–767px):**
- Card fills available width: outer wrapper uses `mx-4` (or the container's `px-4` is sufficient). No card `max-w` override needed — the narrow page container handles this.
- Input `h-11` (44px) already meets touch target.
- Submit button `lg fullWidth` — visually unchanged, already full-width.
- Typography: form title remains `text-2xl` (24px) on mobile — acceptable, no scaling needed.
- No horizontal scroll: all elements use `w-full` within the container.

---

## Tokens Used

- **Colors:** `brand.600`, `brand.700`, `neutral.100`, `neutral.200`, `neutral.400`, `neutral.700`, `neutral.800`, `danger.50`, `danger.500`, `danger.700`, `success.500`
- **Spacing:** `p-8`, `p-6`, `p-5`, `px-4`, `h-11`, `mt-1`, `mt-4`, `mt-6`, `mb-4`
- **Typography:** `text-2xl font-semibold font-heading` (card title), `text-sm` (subtitle, resend prompt), `text-xs` (field error), `text-base` (input text), `text-base font-medium` (button label)
- **Border radius:** `rounded-lg` (input, error banner), `rounded-2xl` (card)
- **Shadow:** `shadow-md` (card)
- **Motion:** `duration-150 ease-out` on input border transitions

---

## Copy Keys

| Key | es | en |
|---|---|---|
| `auth.login.title` | Accede a tu estudio | Sign in to your studio |
| `auth.login.subtitle` | Te enviaremos un enlace mágico a tu correo. | We'll send a magic link to your email. |
| `auth.login.emailLabel` | Correo electrónico | Email address |
| `auth.login.emailPlaceholder` | ejemplo@tuestudio.com | example@yourstudio.com |
| `auth.login.submitButton` | Enviar enlace de acceso | Send sign-in link |
| `auth.login.submittingButton` | Enviando... | Sending... |
| `auth.login.firstTime` | ¿Primera vez? Crea tu cuenta | First time? Create your account |
| `auth.login.successTitle` | Revisa tu correo | Check your email |
| `auth.login.successMessage` | Te enviamos un enlace a {email}. Haz clic en él para acceder. | We sent a link to {email}. Click it to sign in. |
| `auth.login.resendPrompt` | ¿No recibiste el correo? Revisa tu carpeta de spam, o | Didn't receive it? Check your spam folder, or |
| `auth.login.resendButton` | solicita otro enlace | request a new link |
| `auth.login.errors.emailRequired` | Ingresa tu correo electrónico | Enter your email address |
| `auth.login.errors.emailInvalid` | Ingresa un correo electrónico válido | Enter a valid email address |
| `auth.login.errors.tooManyRequests` | Espera un momento antes de volver a intentarlo. | Please wait a moment before trying again. |
| `auth.login.errors.genericError` | Algo salió mal. Por favor intenta de nuevo. | Something went wrong. Please try again. |
| `auth.login.errors.linkExpired` | Ese enlace ha expirado. Ingresa tu correo para solicitar uno nuevo. | That link has expired. Enter your email to request a new one. |
| `auth.login.errors.invalidLink` | Ese enlace no es válido. Ingresa tu correo para solicitar uno nuevo. | That link is not valid. Enter your email to request a new one. |

---

## Examples

### Example 1: Default idle state, Spanish locale

```
locale="es"
initialError={null}
```
Renders the form with Spanish labels. Error banner hidden.

### Example 2: Arrived from expired magic link

```
locale="es"
initialError="link_expired"
```
Renders the form with the error banner pre-shown containing `auth.login.errors.linkExpired`. The email input is focused. The banner is `role="alert"`.

### Example 3: Success state (after submit)

Internal state transitions to `sent`. The form DOM is replaced with the success card. Focus moves to the success heading.

---

## Don'ts

- Don't validate on blur — validate on submit only (spec AC-3). Overly eager validation creates a frustrating experience for users who tab through the form.
- Don't use a toast for the success state — use the inline success card. The toast is too transient for a critical "check your email" message.
- Don't use a toast for inline field validation errors — use the `aria-describedby` field error pattern.
- Don't hide the "First time?" link in the error state — it remains accessible so the user can navigate to signup if needed.
- Don't use `type="text"` for the email input — use `type="email"` for mobile keyboard and browser autocomplete.
- Don't clear the email value after a generic API error — the user should be able to retry without retyping.
