# Component: SignupForm

**Used in:** Studio Owner Authentication (CU-869d29f1f) — self-signup flow
**Designer doc:** `docs/design/CU-869d29f1f-studio-owner-auth.md`
**Status:** Spec
**Date:** 2026-05-03

---

## Purpose

A multi-field form allowing a studio owner to submit a registration application. On successful submission, the form is replaced by a confirmation message. Manages its own loading and error states. This is a Client Component because it uses react-hook-form for validation state management.

---

## Anatomy

**Idle state:**
```
┌────────────────────────────────────────────────────────────────┐
│  Correo electrónico *                        (label + required)│
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ejemplo@tuestudio.com                    (placeholder)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  [field error — hidden]                                        │
│                                                                │
│  Nombre del estudio *                        (label + required)│
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Ej. Tulum Healing Studio                 (placeholder)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  [field error — hidden]                                        │
│                                                                │
│  Teléfono de contacto   [Opcional]           (label + badge)  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  +52 984 000 0000                         (placeholder)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Cuéntanos sobre tu estudio                  (label)          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │  Servicios que ofreces...                 (placeholder)  │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  [field error — hidden]                                        │
│                                                                │
│  [ Enviar solicitud — Button primary/lg fullWidth ]            │
│                                                                │
│  ¿Ya tienes cuenta? Accede aquí →            (text link)      │
└────────────────────────────────────────────────────────────────┘
```

**Success state (replaces form content):**
```
┌────────────────────────────────────────────────────────────────┐
│  [CheckCircle2 icon, 32px, text-success-500, mx-auto]         │
│                                                                │
│  Solicitud recibida           (h3, text-center, text-2xl)     │
│                                                                │
│  Revisaremos tu solicitud y te enviaremos un correo           │
│  cuando tu estudio sea aprobado.  (text-sm text-center)       │
└────────────────────────────────────────────────────────────────┘
```

---

## Props

```typescript
interface SignupFormProps {
  locale: string; // 'es' | 'en'
  // No initialError prop — signup form does not receive errors via URL params.
  // All errors are API-response driven.
}
```

---

## Fields

### Email (required)

```typescript
{
  id: 'email',
  type: 'email',
  autoComplete: 'email',
  autoCapitalize: 'none',
  autoCorrect: 'off',
  inputMode: 'email',
  validation: {
    required: true,
    maxLength: 254,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,  // basic RFC-compliant check
  }
}
```

Error keys:
- Empty → `auth.signup.errors.emailRequired`
- Invalid format → `auth.signup.errors.emailInvalid`

### Studio Name (required)

```typescript
{
  id: 'studioName',
  type: 'text',
  autoComplete: 'organization',
  maxLength: 100,
  validation: {
    required: true,
    maxLength: 100,
  }
}
```

Error keys:
- Empty → `auth.signup.errors.studioNameRequired`
- Too long → `auth.signup.errors.studioNameTooLong`

Character counter: Show a `text-xs text-neutral-400` counter `{current}/{max}` below the field only when the user has typed more than 80 characters (80% of max). This prevents visual noise for short inputs while warning before the limit. Format: "87/100".

### Contact Phone (optional)

```typescript
{
  id: 'contactPhone',
  type: 'tel',
  autoComplete: 'tel',
  inputMode: 'tel',
  validation: {
    required: false,
    // No strict validation — international numbers vary widely.
    // Basic: trim whitespace, store as-is.
  }
}
```

The "Opcional / Optional" badge appears inline with the label, to the right:
```
<span className="ml-2 text-xs text-neutral-400 font-normal border border-neutral-200 rounded px-1.5 py-0.5">
  {t('auth.signup.fields.contactPhoneOptional')}
</span>
```

No error state for this field — it is optional with no format requirement.

### Description (required)

```typescript
{
  id: 'description',
  type: 'textarea',
  rows: 4,  // desktop; reduces to 3 on mobile
  maxLength: 1000,
  validation: {
    required: false,  // spec does not mark this required
    maxLength: 1000,
  }
}
```

The description field does not have a required indicator (`*`). It is encouraged but optional in practice (the spec does not mark it required in the database schema beyond `text` type). If the product decision is to make it required, update here.

Character counter: same pattern as studio name — show at 800+ characters. Format: "842/1000".

Error keys:
- Too long (>1000 chars) → `auth.signup.errors.descriptionTooLong`

---

## Form-Level Error Banner

Displayed above all fields when an API-level error occurs (not field validation errors). Same visual treatment as LoginForm: `role="alert"`, `bg-danger-50 border border-danger-500 rounded-lg`.

Key used: `auth.signup.errors.genericError`.

---

## State Machine

```
idle
  → (user submits with validation errors) → idle (field errors shown, focus moves to first error)
  → (user submits valid form) → loading

loading
  → (API success) → success
  → (API error) → idle (form-level error banner shown)

success
  (terminal — user cannot return to form without page reload)
```

---

## States

### Default (idle, no errors)

All fields show their labels and placeholders. No error indicators. Submit button is enabled.

### Field Error

Each field that fails validation shows an inline error below it:
```
<p id="{fieldId}-error" role="alert" className="flex items-center gap-1 text-xs text-danger-700 mt-1">
  <AlertCircle size={12} aria-hidden="true" />
  {errorMessage}
</p>
```

The input itself receives `aria-invalid="true"` and `aria-describedby="{fieldId}-error"` and `border-danger-500`.

Focus management on submit with errors: focus is moved programmatically to the first invalid field.

### Hover (inputs)

Border: `border-neutral-200` → `border-neutral-400` (all text inputs and textarea).

### Focus-visible (inputs and textarea)

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0
focus-visible:ring-brand-600 focus-visible:border-brand-600
```

Error state overrides:
```
border-danger-500 focus-visible:ring-danger-500 focus-visible:border-danger-500
```

### Loading

- Submit button: `loading={true}`, label → `auth.signup.submittingButton`.
- All form fields: `disabled={true}` — `bg-neutral-100 opacity-70 cursor-not-allowed`.
- "Already have an account?" link: pointer-events disabled during loading.

### Success

Form content is replaced by the success card:
- `CheckCircle2` Lucide icon, `size={32}`, `text-success-500`, `mx-auto`, `aria-hidden="true"`.
- `<h3>` with `auth.signup.successTitle`, `tabIndex={-1}` for focus management.
- Body text with `auth.signup.successMessage`.

Focus management: move focus to the `<h3>` on success state transition. `aria-live="polite"` on the card container announces the state change.

No CTA in the success state — there is nothing for the user to do. They wait for an email.

### Disabled (submit button)

The submit button is never pre-disabled. Validation runs on submit, not as the user types, so the button is always enabled in `idle` state.

---

## Input Specification (shared across all text-type inputs)

Tailwind classes (default state):
```
w-full h-11 rounded-lg border border-neutral-200 bg-white px-4
text-base text-neutral-700 placeholder:text-neutral-400
hover:border-neutral-400
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0
focus-visible:ring-brand-600 focus-visible:border-brand-600
disabled:bg-neutral-100 disabled:opacity-70 disabled:cursor-not-allowed
motion-safe:transition-colors motion-safe:duration-150
```

Textarea adds `py-3 resize-none` and uses `rows` for height instead of `h-11`.

---

## Label Specification

```
<label htmlFor="{fieldId}" className="block text-sm font-medium text-neutral-700 mb-1">
  {labelText}
  {required && <span className="text-danger-500 ml-0.5" aria-hidden="true">*</span>}
  {/* screen readers get "required" from the input's required attribute, not the * */}
</label>
```

The `*` asterisk is decorative (`aria-hidden="true"`). The `required` attribute on the input communicates required status to screen readers.

---

## Variants

This component has a single variant — the full multi-field registration form. No sub-variants.

---

## Accessibility

- **Form label:** `aria-label={t('auth.signup.title')}` on the `<form>` element.
- **Required fields:** Marked with `required` attribute and a decorative `*` in the label (`aria-hidden`). Screen readers hear "required" from the input's native semantics.
- **Optional field:** The contact phone label includes the "Opcional / Optional" badge. No `required` attribute on that input. Screen readers will not announce it as required.
- **Field errors:** `role="alert"` ensures immediate announcement. `aria-invalid="true"` and `aria-describedby` link the error message to its input.
- **Form-level error:** `role="alert"` on the banner div. Focus moves to the banner when a form-level error appears (developer-fe to add `tabIndex={-1}` and call `.focus()` on the banner ref).
- **Loading state:** `aria-busy="true"` on the form. `aria-disabled="true"` on all fields (alongside `disabled` attribute). Submit button `aria-busy="true"`.
- **Success state:** `aria-live="polite"` on the outer card container detects content change and announces it. Focus moves to success heading (`tabIndex={-1}`).
- **Character counter:** Has `aria-live="polite"` so it is announced when it first appears (at 80% threshold). Not announced on every keystroke — only when it first becomes visible.
- **Keyboard:** Tab order flows top-to-bottom through all fields, then submit button, then the "already have account" link.

---

## Responsive Behavior

**Desktop (≥1024px):**
- Card `p-8`. All fields stacked vertically (single-column — no two-column layout). Textarea `rows={4}`.
- Submit button `lg fullWidth`.

**Tablet (768–1023px):**
- Card `p-6`. Textarea `rows={4}`. No layout changes.

**Mobile (375–767px):**
- Card fills available width. Contact phone uses `type="tel"` and `inputMode="tel"` — opens numeric keyboard on iOS/Android.
- Textarea reduces to `rows={3}` to reduce initial page height.
- Submit button `lg fullWidth`.
- Character counter uses `text-xs` — same as desktop.
- No horizontal scroll: all fields `w-full` within the container's `px-4`.

---

## Tokens Used

- **Colors:** `brand.600`, `brand.700`, `neutral.100`, `neutral.200`, `neutral.400`, `neutral.700`, `neutral.800`, `danger.50`, `danger.500`, `danger.700`, `success.500`
- **Spacing:** `p-8`, `p-6`, `px-4`, `py-3`, `h-11`, `mt-1`, `mb-1`, `mb-4`, `mt-6`
- **Typography:** `text-sm font-medium` (labels), `text-base` (inputs), `text-xs` (errors, character counter), `text-2xl font-semibold font-heading` (success heading)
- **Border radius:** `rounded-lg` (inputs, error banner), `rounded-2xl` (card), `rounded` (optional badge)
- **Shadow:** `shadow-md` (card)
- **Motion:** `duration-150 ease-out`

---

## Copy Keys

| Key | es | en |
|---|---|---|
| `auth.signup.title` | Registra tu estudio | Register your studio |
| `auth.signup.subtitle` | Cuéntanos sobre tu estudio y te contactaremos cuando sea aprobado. | Tell us about your studio and we'll contact you when it's approved. |
| `auth.signup.fields.email` | Correo electrónico | Email address |
| `auth.signup.fields.emailPlaceholder` | ejemplo@tuestudio.com | example@yourstudio.com |
| `auth.signup.fields.studioName` | Nombre del estudio | Studio name |
| `auth.signup.fields.studioNamePlaceholder` | Ej. Tulum Healing Studio | E.g. Tulum Healing Studio |
| `auth.signup.fields.contactPhone` | Teléfono de contacto | Contact phone |
| `auth.signup.fields.contactPhonePlaceholder` | +52 984 000 0000 | +52 984 000 0000 |
| `auth.signup.fields.contactPhoneOptional` | Opcional | Optional |
| `auth.signup.fields.description` | Cuéntanos sobre tu estudio | Tell us about your studio |
| `auth.signup.fields.descriptionPlaceholder` | Servicios que ofreces, número de terapeutas, horarios, etc. | Services you offer, number of therapists, hours, etc. |
| `auth.signup.submitButton` | Enviar solicitud | Submit application |
| `auth.signup.submittingButton` | Enviando... | Submitting... |
| `auth.signup.alreadyHaveAccount` | ¿Ya tienes cuenta? Accede aquí | Already have an account? Sign in here |
| `auth.signup.successTitle` | Solicitud recibida | Application received |
| `auth.signup.successMessage` | Revisaremos tu solicitud y te enviaremos un correo cuando tu estudio sea aprobado. | We'll review your application and email you when your studio is approved. |
| `auth.signup.errors.emailRequired` | Ingresa tu correo electrónico | Enter your email address |
| `auth.signup.errors.emailInvalid` | Ingresa un correo electrónico válido | Enter a valid email address |
| `auth.signup.errors.studioNameRequired` | Ingresa el nombre de tu estudio | Enter your studio name |
| `auth.signup.errors.studioNameTooLong` | El nombre no puede tener más de 100 caracteres | Studio name cannot exceed 100 characters |
| `auth.signup.errors.descriptionTooLong` | La descripción no puede tener más de 1000 caracteres | Description cannot exceed 1000 characters |
| `auth.signup.errors.genericError` | Algo salió mal. Por favor intenta de nuevo. | Something went wrong. Please try again. |
| `auth.signup.charCount` | {current}/{max} | {current}/{max} |

---

## Examples

### Example 1: Idle state, English locale

```
locale="en"
```
All labels in English. "Optional" badge next to phone label.

### Example 2: Validation errors after submit

User submits with email "not-an-email" and empty studio name.
- Email field: `border-danger-500`, inline error "Enter a valid email address", `aria-invalid="true"`.
- Studio name field: `border-danger-500`, inline error "Enter your studio name", `aria-invalid="true"`.
- Focus moves to email field (first invalid).

### Example 3: Success state

API returns success. Form content replaced by success card. Focus moves to `<h3>` "Solicitud recibida / Application received".

---

## Don'ts

- Don't validate on blur or on keystroke — validate on submit only. This prevents frustrating "you're wrong" messages while the user is still typing.
- Don't show a toast for the success state — replace the form with the inline success card. The user needs a persistent, readable confirmation.
- Don't pre-disable the submit button pending validation — let the user attempt submission and receive clear errors.
- Don't use `type="number"` for the phone field — use `type="tel"`. Phone numbers are not numeric (they include +, (, ), -).
- Don't require strict phone format validation — international phone numbers have too many formats. Trim and store as-is.
- Don't add a CAPTCHA in v1 — it is explicitly out of scope in the spec. The anti-abuse mechanism (IP rate limiting) is a backend concern.
