# Design: Studio Owner Authentication

**Spec:** `docs/specs/CU-869d29f1f-studio-owner-auth.md`
**Ticket:** CU-869d29f1f
**Date:** 2026-05-03
**Author:** designer (agent)

---

## 1. Screens Involved

### Screen 1: Login Page

- **URL (es):** `/login`
- **URL (en):** `/en/login`
- **Primary user goal:** Enter email address and receive a magic link to sign in.
- **Layout:** LayoutShell (header + main + footer). No sidebar. Single-column centered form in a `max-w-[640px]` (narrow) container. Header shows logo and LanguageSwitcher only — no user menu (user is not authenticated).

### Screen 2: Signup Page

- **URL (es):** `/signup`
- **URL (en):** `/en/signup`
- **Primary user goal:** Submit studio registration details and await admin approval.
- **Layout:** LayoutShell (header + main + footer). No sidebar. Single-column form in a `max-w-[640px]` narrow container. Header shows logo and LanguageSwitcher.

### Screen 3: Auth Callback Transitional State

- **URL:** `/auth/callback` (no locale prefix — this is a Route Handler, not a Next.js page)
- **Primary user goal:** None — the user lands here for milliseconds while the OTP is exchanged. This is a server-rendered transitional state.
- **Layout:** A minimal full-page centered state — no LayoutShell header/footer chrome (the user is mid-redirect). A centered spinner with localized "Signing you in..." text. The locale is derived from the `next` query param if present.

### Screen 4: Dashboard Stub

- **URL (es):** `/dashboard`
- **URL (en):** `/en/dashboard`
- **Primary user goal (approved):** Confirm successful sign-in and access the studio management entry point.
- **Primary user goal (pending):** Understand that the studio is under review; no action needed besides waiting.
- **Layout:** LayoutShell with user menu in the header right slot (replacing the language switcher position — language switcher moves to sit left of the user menu trigger). Main content changes based on approval state.

### Screen 5: Admin — Pending Studios

- **URL (es):** `/admin/pending-studios`
- **URL (en):** `/en/admin/pending-studios`
- **Primary user goal:** Review submitted studio applications and approve or reject them.
- **Layout:** LayoutShell (header with user menu). Main area contains page heading, filter/sort controls, and the PendingStudiosTable. Approve/reject confirmations use a modal overlay.

---

## 2. User Flows

### Flow A: Returning studio owner logs in

1. User navigates to `/login` (or is redirected there from a protected route with `?next=/dashboard`).
2. User sees LoginForm with email input, submit button, and a "first time? sign up" link.
3. User types their email and clicks submit.
4. LoginForm enters loading state (submit button shows spinner, email field becomes read-only within 300ms).
5. On success: LoginForm transitions to the "sent" state — email input and submit button are replaced by a success card showing "Check your email" with a resend link.
6. User opens their email, clicks the magic link.
7. Browser navigates to `/auth/callback?token_hash=...&type=email&next=/dashboard`.
8. AuthCallback page shows brief "Signing you in..." spinner.
9. Server exchanges the OTP token for a session; sets auth cookies.
10. User is redirected to `/dashboard` (or the `next` path preserved from step 1).
11. Dashboard stub loads, showing studio name and user menu.

### Flow B: First-time studio owner signs up

1. User lands on `/login` and clicks "Don't have an account? Sign up here."
2. User navigates to `/signup`.
3. User fills in email, studio name, contact phone (optional), and description, then submits.
4. SignupForm enters loading state.
5. On success: form is replaced by a success confirmation card — "Thank you — we'll review your application and email you when your studio is approved."
6. User waits. No dashboard access yet.
7. Admin opens `/admin/pending-studios`, reviews the application, and clicks Approve.
8. Approval action creates the studio row and sends a welcome email with a magic link.
9. User receives the welcome email, clicks the link, and follows Flow A from step 7.

### Flow C: Studio owner logs out (local)

1. Authenticated user clicks user menu trigger (their email address) in the dashboard header.
2. User menu dropdown opens, showing email, "Log out", and "Log out of all devices".
3. User clicks "Log out".
4. Server Action clears the session cookie (local scope).
5. User is redirected to `/login` within 500ms.

### Flow D: Studio owner logs out of all devices

1. Steps 1–2 same as Flow C.
2. User clicks "Log out of all devices".
3. A confirmation dialog appears: "This will sign you out on all devices. Continue?"
4. User clicks Confirm.
5. Server Action calls `signOut({ scope: 'global' })`.
6. User is redirected to `/login`.

### Flow E: User returns with expired session

1. User opens `/dashboard` with a stale or missing session.
2. Middleware detects no valid session; redirects to `/login?next=/dashboard`.
3. No error shown — session simply ended naturally.
4. User sees the standard login form.

### Flow F: User clicks an expired magic link

1. User clicks a magic link that is older than 1 hour or already used.
2. Browser arrives at `/auth/callback?token_hash=...&type=email`.
3. Server attempts token exchange; receives an expiry error.
4. User is redirected to `/login?error=link_expired`.
5. LoginForm detects the `error` query param and displays an inline error banner above the form: "That link has expired. Enter your email to request a new one."

### Flow G: Pre-approval login attempt

1. A user who has not yet been approved (their `auth.users` row exists but no `studio_profiles` row) clicks a stale magic link or logs in again.
2. Dashboard middleware detects authenticated user but no studio profile.
3. Dashboard renders the PendingApprovalState component instead of studio content.
4. User sees: "Your studio application is still under review. We'll email you when it's approved."
5. Log out button is available.

### Flow H: Admin approves a studio

1. Admin navigates to `/admin/pending-studios`.
2. PendingStudiosTable loads, showing rows sorted oldest-first.
3. Admin reviews a row (submitted date, email, studio name, phone, description).
4. Admin clicks "Approve" on the row.
5. Confirmation dialog opens: "Approve [Studio Name]? This will create their account and send a welcome email."
6. Admin clicks Confirm.
7. Success toast: "Studio approved. Welcome email sent."
8. Row is updated in the table (or removed from the pending list — see section 8).

### Flow I: Admin rejects a studio

1. Admin finds a row in PendingStudiosTable.
2. Admin clicks "Reject".
3. Rejection modal opens, offering an optional reason text input.
4. Admin clicks Confirm Rejection.
5. Success toast: "Application rejected."
6. Row moves out of the pending list.

---

## 3. Component Inventory

### Screen 1 — Login Page

| Component | Source | Notes |
|---|---|---|
| `LayoutShell` | Existing — `docs/design/components/LayoutShell.md` | Public variant: no user menu in header |
| `LanguageSwitcher` | Existing — `docs/design/components/LanguageSwitcher.md` | Stays in header right slot |
| `LoginForm` | New — `docs/design/components/LoginForm.md` | Email input + submit/loading/success/error states |
| `Toast` | Existing — `docs/design/components/Toast.md` | Used for generic errors only; the success state is inline |
| `Button` | Existing — `docs/design/components/Button.md` | Used inside LoginForm |

### Screen 2 — Signup Page

| Component | Source | Notes |
|---|---|---|
| `LayoutShell` | Existing | Public variant |
| `LanguageSwitcher` | Existing | |
| `SignupForm` | New — `docs/design/components/SignupForm.md` | Multi-field form with per-field validation |
| `Button` | Existing | |
| `Toast` | Existing | |

### Screen 3 — Auth Callback

| Component | Source | Notes |
|---|---|---|
| (no shell — bare page) | — | Full-viewport centered layout only |
| `Button` | Existing | "Return to login" button shown on error state only |

### Screen 4 — Dashboard Stub

| Component | Source | Notes |
|---|---|---|
| `LayoutShell` | Existing | Authenticated variant: user menu in header |
| `UserMenu` | New — `docs/design/components/UserMenu.md` | Header dropdown: email + logout actions |
| `PendingApprovalState` | New — `docs/design/components/PendingApprovalState.md` | Card shown when no studio_profiles row exists |
| `Button` | Existing | Log out on pending approval card |
| `Toast` | Existing | Session-level notifications |

### Screen 5 — Admin: Pending Studios

| Component | Source | Notes |
|---|---|---|
| `LayoutShell` | Existing | Authenticated variant |
| `UserMenu` | New | Same component as dashboard |
| `PendingStudiosTable` | New — `docs/design/components/PendingStudiosTable.md` | Review table with approve/reject actions |
| `Button` | Existing | Approve (primary), Reject (secondary/ghost) |
| `Toast` | Existing | Success/error notifications for approve/reject |
| `LoadingSkeleton` | Existing — `docs/design/components/LoadingSkeleton.md` | While table data loads |

---

## 4. New Components

All new components are fully specified in their individual files under `docs/design/components/`. See:
- `LoginForm.md`
- `SignupForm.md`
- `UserMenu.md`
- `PendingApprovalState.md`
- `PendingStudiosTable.md`
- `EmailLayout.md`

---

## 5. Wireframes

### Screen 1: Login Page (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [skip link — visually hidden, focused on Tab]                       │
├─────────────────────────────────────────────────────────────────────┤
│  HEADER  bg-white border-b border-neutral-200 shadow-sm  h-16       │
│  [ Massage Tulum ]                              [ ES | EN ]          │
├─────────────────────────────────────────────────────────────────────┤
│  MAIN  bg-neutral-50  flex-1                                        │
│                                                                      │
│   ┌──────── max-w-[640px] mx-auto px-4 sm:px-6 lg:px-8 ──────────┐ │
│   │                                                                │ │
│   │  (vertically centered, ~60vh)                                  │ │
│   │                                                                │ │
│   │  ┌───────────────── bg-white rounded-2xl shadow-md p-8 ────┐  │ │
│   │  │                                                          │  │ │
│   │  │  Accede a tu estudio                                     │  │ │
│   │  │  (h2, font-heading text-2xl font-bold text-neutral-800)  │  │ │
│   │  │                                                          │  │ │
│   │  │  Te enviaremos un enlace mágico a tu correo.            │  │ │
│   │  │  (text-sm text-neutral-500 mt-1)                        │  │ │
│   │  │                                                          │  │ │
│   │  │  [error banner — hidden by default]                      │  │ │
│   │  │  ┌─ bg-danger-50 border border-danger-500 rounded-lg ─┐ │  │ │
│   │  │  │ [!] Ese enlace ha expirado. Ingresa tu correo para  │ │  │ │
│   │  │  │     solicitar uno nuevo.  (text-sm danger-700)      │ │  │ │
│   │  │  └────────────────────────────────────────────────────┘ │  │ │
│   │  │                                                          │  │ │
│   │  │  Correo electrónico                                      │  │ │
│   │  │  (label text-sm font-medium text-neutral-700 mb-1)      │  │ │
│   │  │  ┌─────────────────────────────────────────────────┐    │  │ │
│   │  │  │ ejemplo@tuestudio.com          (input, h-11)     │    │  │ │
│   │  │  └─────────────────────────────────────────────────┘    │  │ │
│   │  │  [inline error — hidden by default]                     │  │ │
│   │  │  [!] Ingresa un correo válido  (text-xs danger-700)     │  │ │
│   │  │                                                          │  │ │
│   │  │  [ Enviar enlace de acceso — Button primary/lg fullWidth ]│ │ │
│   │  │                                                          │  │ │
│   │  │  ¿Primera vez? Crea tu cuenta →                         │  │ │
│   │  │  (text-sm, link brand-600, centered, mt-4)              │  │ │
│   │  │                                                          │  │ │
│   │  └──────────────────────────────────────────────────────────┘  │ │
│   └────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  FOOTER  bg-white border-t border-neutral-200  h-12                 │
│         © 2026 Massage Tulum. Todos los derechos reservados.        │
└─────────────────────────────────────────────────────────────────────┘
```

**Login — Success State (magic link sent):**

```
│   ┌──────── bg-white rounded-2xl shadow-md p-8 ──────────────────┐  │
│   │                                                               │  │
│   │  [Mail icon — text-success-500 24px, centered]               │  │
│   │                                                               │  │
│   │  Revisa tu correo                                            │  │
│   │  (h2, font-heading text-2xl font-bold text-neutral-800,      │  │
│   │   text-center, mt-4)                                         │  │
│   │                                                               │  │
│   │  Te enviamos un enlace a example@domain.com.                 │  │
│   │  Haz clic en él para acceder.                                │  │
│   │  (text-sm text-neutral-500 text-center mt-2, email in bold)  │  │
│   │                                                               │  │
│   │  ¿No recibiste el correo? Revisa tu carpeta de spam,        │  │
│   │  o [ solicita otro enlace ] (text link brand-600)            │  │
│   │  (text-xs text-neutral-500 text-center mt-6)                │  │
│   │                                                               │  │
│   └───────────────────────────────────────────────────────────────┘  │
```

---

### Screen 2: Signup Page (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER  (same as login — no user menu)                             │
├─────────────────────────────────────────────────────────────────────┤
│  MAIN  bg-neutral-50                                                │
│                                                                      │
│   ┌──────── max-w-[640px] mx-auto ──────────────────────────────┐  │
│   │                                                              │  │
│   │  ┌── bg-white rounded-2xl shadow-md px-8 py-8 ───────────┐  │  │
│   │  │                                                         │  │  │
│   │  │  Registra tu estudio                                    │  │  │
│   │  │  (h2 font-heading text-2xl font-bold text-neutral-800)  │  │  │
│   │  │                                                         │  │  │
│   │  │  Cuéntanos sobre tu estudio y te contactaremos          │  │  │
│   │  │  cuando sea aprobado.                                   │  │  │
│   │  │  (text-sm text-neutral-500 mt-1)                       │  │  │
│   │  │                                                         │  │  │
│   │  │  Correo electrónico *                                   │  │  │
│   │  │  ┌─────────────────────────────────────────────────┐   │  │  │
│   │  │  │ ejemplo@tuestudio.com                            │   │  │  │
│   │  │  └─────────────────────────────────────────────────┘   │  │  │
│   │  │                                                         │  │  │
│   │  │  Nombre del estudio *                                   │  │  │
│   │  │  ┌─────────────────────────────────────────────────┐   │  │  │
│   │  │  │ Ej. Tulum Healing Studio                         │   │  │  │
│   │  │  └─────────────────────────────────────────────────┘   │  │  │
│   │  │                                                         │  │  │
│   │  │  Teléfono de contacto  (optional badge)                │  │  │
│   │  │  ┌─────────────────────────────────────────────────┐   │  │  │
│   │  │  │ +52 984 ...                                      │   │  │  │
│   │  │  └─────────────────────────────────────────────────┘   │  │  │
│   │  │                                                         │  │  │
│   │  │  Cuéntanos sobre tu estudio                            │  │  │
│   │  │  ┌─────────────────────────────────────────────────┐   │  │  │
│   │  │  │                                                  │   │  │  │
│   │  │  │  (textarea, 4 rows)                              │   │  │  │
│   │  │  │                                                  │   │  │  │
│   │  │  └─────────────────────────────────────────────────┘   │  │  │
│   │  │                                                         │  │  │
│   │  │  [ Enviar solicitud — Button primary/lg fullWidth ]     │  │  │
│   │  │                                                         │  │  │
│   │  │  ¿Ya tienes cuenta? Accede aquí →  (link brand-600)   │  │  │
│   │  │  (text-sm text-center mt-4)                            │  │  │
│   │  │                                                         │  │  │
│   │  └─────────────────────────────────────────────────────────┘  │  │
│   └────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  FOOTER                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Signup — Success State:**

```
│   ┌──── bg-white rounded-2xl shadow-md p-8 ─────────────────────┐   │
│   │                                                               │   │
│   │  [CheckCircle2 icon — text-success-500 32px, centered]       │   │
│   │                                                               │   │
│   │  Solicitud recibida                                          │   │
│   │  (h2, text-2xl font-bold, text-center, mt-4)                │   │
│   │                                                               │   │
│   │  Revisaremos tu solicitud y te enviaremos un correo          │   │
│   │  cuando tu estudio sea aprobado.                             │   │
│   │  (text-sm text-neutral-500 text-center mt-2)                │   │
│   │                                                               │   │
│   └───────────────────────────────────────────────────────────────┘  │
```

---

### Screen 3: Auth Callback Transitional State

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   (full viewport, bg-neutral-50, flex items-center justify-center)  │
│                                                                      │
│   ┌───────────────────── centered card ────────────────────────┐    │
│   │                                                             │    │
│   │   [Loader2 icon, animate-spin, text-brand-600, 32px]       │    │
│   │                                                             │    │
│   │   Iniciando sesión...                                       │    │
│   │   (text-base text-neutral-600, text-center, mt-4)          │    │
│   │                                                             │    │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   (aria-live="polite" aria-busy="true" on the card container)       │
└─────────────────────────────────────────────────────────────────────┘
```

**Error state on callback (redirect handles this, but if JS is slow):**
The server-side redirect handles all error cases. No error state is shown on `/auth/callback` itself — errors redirect to `/login?error=...` which the LoginForm handles.

---

### Screen 4: Dashboard Stub — Approved State (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER  bg-white border-b shadow-sm  h-16                          │
│  [ Massage Tulum ]    [ ES | EN ]  [ owner@studio.com ▾ ]           │
│                                    ↑ UserMenu trigger               │
├─────────────────────────────────────────────────────────────────────┤
│  MAIN  bg-neutral-50                                                │
│                                                                      │
│   ┌──── max-w-[960px] mx-auto px-8 py-8 ──────────────────────┐    │
│   │                                                             │    │
│   │  Buenos días, [Studio Name]                                 │    │
│   │  (h1, font-heading text-3xl font-bold text-neutral-800)    │    │
│   │  (greeting adapts to time of day in locale)                │    │
│   │                                                             │    │
│   │  ┌── bg-neutral-100 border border-neutral-200 rounded-2xl  │    │
│   │  │   p-8 mt-6 ─────────────────────────────────────────┐   │    │
│   │  │                                                      │   │    │
│   │  │   [LayoutGrid icon, 24px, text-neutral-400]         │   │    │
│   │  │                                                      │   │    │
│   │  │   Panel completo próximamente                       │   │    │
│   │  │   (text-base text-neutral-500, mt-2)                │   │    │
│   │  │                                                      │   │    │
│   │  │   Estamos preparando las herramientas de gestión    │   │    │
│   │  │   para tu estudio. Vuelve pronto.                   │   │    │
│   │  │   (text-sm text-neutral-400, mt-1)                  │   │    │
│   │  │                                                      │   │    │
│   │  └──────────────────────────────────────────────────────┘   │    │
│   └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  FOOTER                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**UserMenu dropdown (open):**

```
                                    ┌─────────────────────────────┐
                                    │  owner@studio.com            │
                                    │  (text-sm text-neutral-500,  │
                                    │   px-4 py-3, truncate)       │
                                    ├─────────────────────────────┤
                                    │  [LogOut icon 16px]          │
                                    │  Cerrar sesión               │
                                    │  (text-sm text-neutral-700)  │
                                    ├─────────────────────────────┤
                                    │  [LogOut icon 16px muted]    │
                                    │  Cerrar en todos los         │
                                    │  dispositivos                │
                                    │  (text-xs text-neutral-500)  │
                                    └─────────────────────────────┘
```

---

### Screen 4: Dashboard Stub — Pending Approval State

```
│  HEADER  (same, with user menu — log out is still available)        │
├─────────────────────────────────────────────────────────────────────┤
│  MAIN  bg-neutral-50                                                │
│                                                                      │
│   ┌──── max-w-[640px] mx-auto px-8 py-16 ─────────────────────┐    │
│   │                                                             │    │
│   │  ┌── bg-warning-50 border border-warning-500 rounded-2xl   │    │
│   │  │   p-8 ───────────────────────────────────────────────┐  │    │
│   │  │                                                       │  │    │
│   │  │  [Clock icon, 32px, text-warning-500, centered]      │  │    │
│   │  │                                                       │  │    │
│   │  │  Tu estudio está en revisión                         │  │    │
│   │  │  (h2, text-xl font-semibold text-warning-700,        │  │    │
│   │  │   text-center, mt-4)                                 │  │    │
│   │  │                                                       │  │    │
│   │  │  Estamos revisando tu solicitud. Te enviaremos       │  │    │
│   │  │  un correo cuando tu estudio sea aprobado.           │  │    │
│   │  │  (text-sm text-warning-700, text-center, mt-2)       │  │    │
│   │  │                                                       │  │    │
│   │  │  [ Cerrar sesión — Button secondary/md fullWidth,    │  │    │
│   │  │    mt-6 ]                                             │  │    │
│   │  │                                                       │  │    │
│   │  └───────────────────────────────────────────────────────┘  │    │
│   └─────────────────────────────────────────────────────────────┘   │
```

---

### Screen 5: Admin — Pending Studios (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER  (authenticated — user menu in header)                      │
├─────────────────────────────────────────────────────────────────────┤
│  MAIN  bg-neutral-50                                                │
│                                                                      │
│   ┌──── max-w-[1280px] mx-auto px-8 py-8 ─────────────────────┐    │
│   │                                                             │    │
│   │  Solicitudes pendientes                                     │    │
│   │  (h1, font-heading text-3xl font-bold text-neutral-800)    │    │
│   │  3 solicitudes  (text-sm text-neutral-500, ml-3 inline)    │    │
│   │                                                             │    │
│   │  ┌── bg-white rounded-2xl shadow-sm overflow-hidden ────┐  │    │
│   │  │                                                       │  │    │
│   │  │  TABLE HEADER (bg-neutral-50)                        │  │    │
│   │  │  Fecha  │ Email         │ Estudio   │ Teléfono │ ... │  │    │
│   │  │  ───────────────────────────────────────────────── │  │    │
│   │  │                                                       │  │    │
│   │  │  ROW 1                                               │  │    │
│   │  │  2026-05-01 │ owner@x.com │ Studio X │ +52... │ ... │  │    │
│   │  │  [Descripción — collapsible, 2 lines visible]        │  │    │
│   │  │  [Aprobar] [Rechazar]                                │  │    │
│   │  │  ───────────────────────────────────────────────── │  │    │
│   │  │                                                       │  │    │
│   │  │  ROW 2  ...                                          │  │    │
│   │  │                                                       │  │    │
│   │  └───────────────────────────────────────────────────────┘  │    │
│   └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  FOOTER                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Approval Confirmation Modal:**

```
┌─── modal overlay (bg-black/40) ─────────────────────────────────────┐
│                                                                      │
│   ┌── bg-white rounded-2xl shadow-lg p-6 max-w-[480px] mx-auto ──┐  │
│   │                                                                │  │
│   │  Aprobar estudio                                               │  │
│   │  (h3, text-xl font-semibold text-neutral-800)                 │  │
│   │                                                                │  │
│   │  ¿Confirmas la aprobación de "Studio Name"?                   │  │
│   │  Se creará su cuenta y se enviará un correo de                │  │
│   │  bienvenida con un enlace de acceso.                          │  │
│   │  (text-sm text-neutral-600 mt-2)                              │  │
│   │                                                                │  │
│   │  [ Cancelar — Button secondary/md ]  [ Aprobar — primary/md ] │  │
│   │  (flex gap-3 justify-end mt-6)                                │  │
│   │                                                                │  │
│   └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Rejection Modal:**

```
│   ┌── bg-white rounded-2xl shadow-lg p-6 max-w-[480px] mx-auto ──┐  │
│   │                                                                │  │
│   │  Rechazar solicitud                                            │  │
│   │  (h3, text-xl font-semibold text-neutral-800)                 │  │
│   │                                                                │  │
│   │  Razón (opcional)                                              │  │
│   │  ┌───────────────────────────────────────────────────────┐    │  │
│   │  │  Ingresa un motivo para tu registro interno...         │    │  │
│   │  │  (textarea, 3 rows, placeholder text-neutral-400)      │    │  │
│   │  └───────────────────────────────────────────────────────┘    │  │
│   │                                                                │  │
│   │  [ Cancelar — secondary/md ]  [ Rechazar — destructive/md ]   │  │
│   │  (flex gap-3 justify-end mt-6)                                │  │
│   │                                                                │  │
│   └────────────────────────────────────────────────────────────────┘  │
```

---

## 6. Design Tokens Used / Added

### Tokens Reused (no additions needed)

All screens in this feature use existing tokens from `docs/design/tokens.md`:

**Colors:**
- `neutral.50` — page background
- `neutral.100` — table header background, dashboard stub placeholder
- `neutral.200` — borders, dividers, input backgrounds
- `neutral.400` — placeholder text
- `neutral.500` — secondary / muted text
- `neutral.600` — body text
- `neutral.700` — primary body text, label text
- `neutral.800` — headings
- `brand.50` — subtle hover tints
- `brand.100` — active tints
- `brand.200` — input focus-visible border fallback
- `brand.600` — text links (never brand.500 per contrast rules)
- `brand.700` — primary button background, logo
- `danger.50` — inline error background
- `danger.500` — inline error icon/border
- `danger.700` — inline error text
- `warning.50` — pending approval card background
- `warning.500` — pending approval border, icon
- `warning.700` — pending approval text
- `success.50` — success confirmation backgrounds
- `success.500` — success icon, progress bar

**Spacing:** Tailwind default scale as documented.
**Typography:** `font-heading` (Plus Jakarta Sans), `font-body` (Inter). Type scale per `tokens.md`.
**Shadows:** `shadow-sm`, `shadow-md`, `shadow-lg` per token definitions.

### New Tokens

None required. The existing palette fully covers all new screens.

---

## 7. Copy

Both locales are required simultaneously. Tone: professional, calm, direct. No tourist clichés.

### `auth.login.*` namespace

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

### `auth.signup.*` namespace

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

### `auth.callback.*` namespace

| Key | es | en |
|---|---|---|
| `auth.callback.redirecting` | Iniciando sesión... | Signing you in... |
| `auth.callback.errors.linkExpired` | Ese enlace ha expirado. | That link has expired. |
| `auth.callback.errors.invalidLink` | Enlace no válido. | Invalid link. |
| `auth.callback.errors.networkError` | Error de red. Por favor intenta de nuevo. | Network error. Please try again. |

### `auth.logout.*` namespace

| Key | es | en |
|---|---|---|
| `auth.logout.button` | Cerrar sesión | Log out |
| `auth.logout.allDevices` | Cerrar en todos los dispositivos | Log out of all devices |
| `auth.logout.allDevices.confirmTitle` | Cerrar sesión en todos los dispositivos | Log out of all devices |
| `auth.logout.allDevices.confirmBody` | Se cerrará tu sesión en todos los dispositivos donde estés conectado. ¿Continuar? | You'll be signed out on all devices where you're currently logged in. Continue? |

### `auth.dashboard.*` namespace

| Key | es | en |
|---|---|---|
| `auth.dashboard.greeting.morning` | Buenos días, {name} | Good morning, {name} |
| `auth.dashboard.greeting.afternoon` | Buenas tardes, {name} | Good afternoon, {name} |
| `auth.dashboard.greeting.evening` | Buenas noches, {name} | Good evening, {name} |
| `auth.dashboard.stub.title` | Panel completo próximamente | Full dashboard coming soon |
| `auth.dashboard.stub.body` | Estamos preparando las herramientas de gestión para tu estudio. Vuelve pronto. | We're preparing your studio management tools. Check back soon. |
| `auth.dashboard.pendingApproval.title` | Tu estudio está en revisión | Your studio is under review |
| `auth.dashboard.pendingApproval.body` | Estamos revisando tu solicitud. Te enviaremos un correo cuando tu estudio sea aprobado. | We're reviewing your application. We'll email you when your studio is approved. |

### `admin.pendingStudios.*` namespace

| Key | es | en |
|---|---|---|
| `admin.pendingStudios.title` | Solicitudes pendientes | Pending applications |
| `admin.pendingStudios.count` | {count, plural, one {# solicitud} other {# solicitudes}} | {count, plural, one {# application} other {# applications}} |
| `admin.pendingStudios.empty` | No hay solicitudes pendientes. | No pending applications. |
| `admin.pendingStudios.columns.submittedAt` | Fecha | Date |
| `admin.pendingStudios.columns.email` | Correo | Email |
| `admin.pendingStudios.columns.studioName` | Estudio | Studio |
| `admin.pendingStudios.columns.contactPhone` | Teléfono | Phone |
| `admin.pendingStudios.columns.description` | Descripción | Description |
| `admin.pendingStudios.columns.actions` | Acciones | Actions |
| `admin.pendingStudios.actions.approve` | Aprobar | Approve |
| `admin.pendingStudios.actions.reject` | Rechazar | Reject |
| `admin.pendingStudios.approveModal.title` | Aprobar estudio | Approve studio |
| `admin.pendingStudios.approveModal.body` | ¿Confirmas la aprobación de "{studioName}"? Se creará su cuenta y se enviará un correo de bienvenida con un enlace de acceso. | Confirm approval of "{studioName}"? Their account will be created and a welcome email with a sign-in link will be sent. |
| `admin.pendingStudios.rejectModal.title` | Rechazar solicitud | Reject application |
| `admin.pendingStudios.rejectModal.reasonLabel` | Razón (opcional) | Reason (optional) |
| `admin.pendingStudios.rejectModal.reasonPlaceholder` | Ingresa un motivo para tu registro interno... | Enter a reason for your internal records... |
| `admin.pendingStudios.rejectModal.confirmButton` | Rechazar | Reject |
| `admin.pendingStudios.toast.approveSuccess` | Estudio aprobado. Correo de bienvenida enviado. | Studio approved. Welcome email sent. |
| `admin.pendingStudios.toast.approveError` | No se pudo aprobar el estudio. Intenta de nuevo. | Could not approve the studio. Please try again. |
| `admin.pendingStudios.toast.rejectSuccess` | Solicitud rechazada. | Application rejected. |
| `admin.pendingStudios.toast.rejectError` | No se pudo rechazar la solicitud. Intenta de nuevo. | Could not reject the application. Please try again. |
| `admin.pendingStudios.loading` | Cargando solicitudes... | Loading applications... |

### `userMenu.*` namespace

| Key | es | en |
|---|---|---|
| `userMenu.trigger.label` | Menú de usuario | User menu |
| `userMenu.signedInAs` | Conectado como | Signed in as |

---

## 8. Email Template Designs

Both email types use the `EmailLayout` base (see `docs/design/components/EmailLayout.md`). Content is bilingual via a single Go-template conditional (R2 research finding).

### Email 1: Magic-Link Login Email

**Template type:** Supabase `confirm` / `magic_link` type.
**Trigger:** `signInWithOtp({ email, options: { data: { locale } } })`.
**Locale selection:** Go template conditional on `{{ .Data.locale }}`.

**Subject line (Go template):**
```
{{ if eq .Data.locale "es" }}Tu enlace para acceder a Massage Tulum{{ else }}Your sign-in link for Massage Tulum{{ end }}
```

**Spanish body content:**

```
[EmailLayout header: "Massage Tulum" logo placeholder]

Hola,

Haz clic en el enlace a continuación para acceder a tu cuenta de Massage Tulum.

[ Acceder a mi estudio → ]  (CTA button, brand-700 bg, white text)
                             (links to {{ .ConfirmationURL }})

Este enlace expira en 1 hora. Solo puede usarse una vez.

Si no solicitaste este enlace, puedes ignorar este mensaje con seguridad.

───────────────────────────────────────────────────────────
[EmailLayout footer]
Massage Tulum · Tulum, México
© 2026 Massage Tulum
[Footer note: "Sent with Brevo" — free tier, remove on upgrade]
```

**English body content:**

```
[EmailLayout header]

Hi,

Click the link below to sign in to your Massage Tulum account.

[ Sign in to my studio → ]  (CTA button)
                             (links to {{ .ConfirmationURL }})

This link expires in 1 hour and can only be used once.

If you didn't request this, you can safely ignore this email.

───────────────────────────────────────────────────────────
[EmailLayout footer]
Massage Tulum · Tulum, Mexico
© 2026 Massage Tulum
```

**Plain text fallback (ES):**
```
Hola,

Haz clic en el enlace a continuación para acceder a tu cuenta de Massage Tulum.

{{ .ConfirmationURL }}

Este enlace expira en 1 hora. Solo puede usarse una vez.

Si no solicitaste este enlace, puedes ignorar este mensaje.

– Massage Tulum
```

**Plain text fallback (EN):**
```
Hi,

Click the link below to sign in to your Massage Tulum account.

{{ .ConfirmationURL }}

This link expires in 1 hour and can only be used once.

If you didn't request this, you can safely ignore this email.

– Massage Tulum
```

---

### Email 2: Welcome Email (sent on admin approval)

**Trigger:** NestJS backend, called from the admin approval Server Action. Uses `supabase.auth.admin.generateLink()` with service role key to create the magic link, then Brevo HTTP API to send (not Supabase's default send path — architect to confirm the exact mechanism per ADR).
**Locale:** Determined at approval time from the locale stored in `pending_studios` (which was the UI locale at signup time — see note in §11 open questions).

**Subject line (Go template or handled by Brevo template):**

Spanish: `Bienvenido a Massage Tulum — tu estudio ha sido aprobado`
English: `Welcome to Massage Tulum — your studio has been approved`

**Spanish body content:**

```
[EmailLayout header]

Hola,

Tu estudio ha sido aprobado. Ya puedes acceder a Massage Tulum y empezar a gestionar tus reservas.

[ Acceder a mi estudio → ]  (CTA button)
                             (links to the generated magic link)

Este enlace de bienvenida expira en 24 horas.

Si tienes alguna pregunta, responde a este correo.

───────────────────────────────────────────────────────────
[EmailLayout footer]
```

**English body content:**

```
[EmailLayout header]

Hi,

Your studio has been approved. You can now sign in to Massage Tulum and start managing your bookings.

[ Sign in to my studio → ]  (CTA button)

This welcome link expires in 24 hours.

If you have any questions, reply to this email.

───────────────────────────────────────────────────────────
[EmailLayout footer]
```

**Plain text fallback (ES):**
```
Hola,

Tu estudio ha sido aprobado. Accede a Massage Tulum usando el siguiente enlace:

[magic link URL]

Este enlace expira en 24 horas.

– Massage Tulum
```

**Plain text fallback (EN):**
```
Hi,

Your studio has been approved. Sign in to Massage Tulum using the link below:

[magic link URL]

This link expires in 24 hours.

– Massage Tulum
```

**Email translation keys (for developer reference — these live in Brevo template or Go template, not in messages/es.json):**

| Key | es | en |
|---|---|---|
| `email.login.subject` | Tu enlace para acceder a Massage Tulum | Your sign-in link for Massage Tulum |
| `email.login.greeting` | Hola, | Hi, |
| `email.login.body` | Haz clic en el enlace a continuación para acceder a tu cuenta de Massage Tulum. | Click the link below to sign in to your Massage Tulum account. |
| `email.login.cta` | Acceder a mi estudio | Sign in to my studio |
| `email.login.expiry` | Este enlace expira en 1 hora. Solo puede usarse una vez. | This link expires in 1 hour and can only be used once. |
| `email.login.ignoreNote` | Si no solicitaste este enlace, puedes ignorar este mensaje con seguridad. | If you didn't request this, you can safely ignore this email. |
| `email.welcome.subject` | Bienvenido a Massage Tulum — tu estudio ha sido aprobado | Welcome to Massage Tulum — your studio has been approved |
| `email.welcome.greeting` | Hola, | Hi, |
| `email.welcome.body` | Tu estudio ha sido aprobado. Ya puedes acceder a Massage Tulum y empezar a gestionar tus reservas. | Your studio has been approved. You can now sign in to Massage Tulum and start managing your bookings. |
| `email.welcome.cta` | Acceder a mi estudio | Sign in to my studio |
| `email.welcome.expiry` | Este enlace de bienvenida expira en 24 horas. | This welcome link expires in 24 hours. |
| `email.footer.address` | Massage Tulum · Tulum, México | Massage Tulum · Tulum, Mexico |
| `email.footer.support` | Si tienes alguna pregunta, responde a este correo. | If you have any questions, reply to this email. |

---

## 9. Interaction & Motion

All motion respects `prefers-reduced-motion: reduce` via `motion-safe:` Tailwind modifier.

| Interaction | Effect | Duration | Easing |
|---|---|---|---|
| Form submit → loading | Button label fades, spinner replaces leading icon, email input becomes read-only | 150ms | ease-out |
| Loading → success state | Cross-fade from form to success card | 200ms | ease-out |
| Error banner appearance | Slides down from above the form field, opacity 0→1 | 150ms | ease-out |
| UserMenu open | Dropdown slides down from header, opacity 0→1 | 150ms | ease-out |
| UserMenu close | Dropdown slides up and fades out | 100ms | ease-in |
| Modal open | Overlay fades in (150ms), modal slides up (200ms ease-out) | 200ms | ease-out |
| Modal close | Reverse of open | 150ms | ease-in |
| Toast enter | Slides in from right (desktop) or up from bottom (mobile) | 250ms | ease-out |
| Auth callback spinner | Loader2 `animate-spin` at 1s linear | continuous | linear |
| Table row action hover | Row background: `neutral.50` → `brand.50` | 100ms | ease-out |

---

## 10. Empty / Error / Loading States

### Screen 1: Login Page

**Loading (initial page):** Server Component — renders immediately. No loading state needed.

**Loading (after submit):** LoginForm loading state — submit button shows Loader2 spinner with "Enviando... / Sending...", email field becomes `readOnly`, the Button has `loading={true}` (aria-busy="true"). See LoginForm.md for exact states.

**Success (magic link sent):** Inline success state inside the card — the form is replaced by the success message. No Toast (the inline state is more prominent and focused).

**Error — link expired (arriving from `/login?error=link_expired`):** An inline error banner above the email input with `danger.50` background, `danger.500` left border, `danger.700` text. The form is still functional so the user can immediately request a new link. Copy: `auth.login.errors.linkExpired`.

**Error — invalid email:** Inline field error below the email input. `aria-invalid="true"` on input. `aria-describedby` pointing to error element.

**Error — rate limit:** Inline field error or error banner. Copy: `auth.login.errors.tooManyRequests`.

**Error — generic API error:** Error toast (`variant="error"`, no auto-dismiss) using `toast.error.generic.*` keys.

### Screen 2: Signup Page

**Loading (initial page):** Server Component. No loading needed.

**Loading (after submit):** SignupForm loading state — same pattern as LoginForm.

**Success:** Form is replaced by the success confirmation card (CheckCircle2 icon, title, message). No redirect needed.

**Error — field validation:** Inline error per field. Focus moves to the first invalid field on submit.

**Error — generic:** Error toast, no auto-dismiss.

### Screen 3: Auth Callback

**Loading (normal):** The spinner state described in the wireframe. `aria-live="polite"` `aria-busy="true"` on the container.

**Error (network failure during exchange):** If the server redirect fails for a network reason and the page is actually rendered with an error (unlikely but possible), show: heading "Error al iniciar sesión / Sign-in error", `auth.callback.errors.networkError` message, and a Button secondary linking back to `/login`. This is a fallback — the server redirect normally handles all error cases before the page renders.

### Screen 4: Dashboard Stub

**Loading (session check in middleware):** Middleware handles session check server-side. If the dashboard page itself needs to fetch studio data (studio name for the greeting), show a text skeleton:
- Heading area: `<LoadingSkeleton height="2rem" width="300px" />` (simulates h1)
- Stub card: `<LoadingSkeleton height="120px" width="100%" />` (simulates the placeholder card)
- Container: `aria-busy="true" aria-label={t('common.loading.generic')}`

**Approved — normal:** Studio name in heading, stub card with "coming soon" message.

**Pending approval:** PendingApprovalState card (warning-toned). No studio data shown. Log out available via user menu and also as a Button inside the card.

**Error (failed to load studio name):** The greeting falls back to a generic form: "Bienvenido / Welcome" without the name. A non-blocking info toast may appear, but the page remains functional.

### Screen 5: Admin — Pending Studios

**Loading (initial table):** While the pending applications are fetching, show 3 skeleton table rows (using LoadingSkeleton pattern C — table row skeleton). `aria-busy="true"` on the table container.

**Empty (no pending applications):** The table area is replaced by a centered empty state:
- `ClipboardCheck` Lucide icon, 48px, `text-neutral-300`
- "No hay solicitudes pendientes. / No pending applications." in `text-neutral-500`
- No CTA (nothing to do when the queue is empty)

**Loading (approve action in progress):** The Approve button on the row enters `loading={true}` state. The Reject button on the same row is disabled while the approve is in flight.

**Loading (reject action in progress):** Same pattern, reversed.

**Success (approve):** Toast `variant="success"`, `admin.pendingStudios.toast.approveSuccess`. Row is removed from the table (or status updates, depending on whether the admin UI shows approved studios too — for v1, remove from view on approval).

**Success (reject):** Toast `variant="success"`, `admin.pendingStudios.toast.rejectSuccess`. Row is removed from the table.

**Error (approve fails):** Toast `variant="error"`, `admin.pendingStudios.toast.approveError`, no auto-dismiss. The row remains in the table.

**Error (reject fails):** Toast `variant="error"`, `admin.pendingStudios.toast.rejectError`, no auto-dismiss.

---

## 11. Accessibility Checklist

### All Screens

- [x] Keyboard reachable — all interactive elements are in natural DOM tab order; no `tabindex > 0`
- [x] Focus visible — all interactive elements use `focus-visible:ring-2 ring-offset-2 ring-brand-600`
- [x] Color contrast — all text pairs verified in `docs/design/tokens.md §1.5`; error/warning/success text uses the `*-700` semantic tokens on their `*-50` backgrounds (AAA level); no text uses `brand.500` or `neutral.400` per accessibility rules
- [x] Screen reader labels — all icon-only buttons have `aria-label`; form inputs have visible `<label>` elements with `htmlFor`; error messages use `aria-describedby` from the input; loading containers use `aria-busy` + `aria-live`
- [x] No information conveyed by color alone — error states use both color (red border) AND icon (AlertCircle) AND text message; warning state uses Clock icon + text; success uses CheckCircle2 + text
- [x] Form errors announced — `aria-invalid="true"` + `aria-describedby` on all form fields; focus moves to first invalid field on submit attempt

### Login Form Specific

- [x] Email input has `type="email"` for mobile keyboard optimization and basic browser validation
- [x] Submit button has `aria-busy="true"` during loading
- [x] Error banner appears before the form field in DOM order (read first by screen reader)
- [x] Success state has `role="status"` or equivalent `aria-live="polite"` announcement

### Auth Callback Specific

- [x] Spinner container has `aria-live="polite"` `aria-busy="true"` for screen reader awareness
- [x] No content is conveyed by the spinner animation alone — text label "Signing you in..." is present

### Modal Specific (Approve/Reject dialogs)

- [x] Modal has `role="dialog"` and `aria-modal="true"`
- [x] Modal heading is referenced via `aria-labelledby`
- [x] Focus is trapped within the modal while open
- [x] First focusable element (Cancel button or the reason textarea) receives focus on open
- [x] ESC closes the modal and returns focus to the triggering button
- [x] When modal closes, focus returns to the row action button that triggered it

### UserMenu Specific

- [x] Trigger button has `aria-haspopup="true"` and `aria-expanded` (true/false)
- [x] Dropdown uses `role="menu"` with `role="menuitem"` children
- [x] Arrow keys navigate between menu items
- [x] ESC closes the menu and returns focus to the trigger
- [x] Clicking outside the menu closes it

---

## 12. Responsive Notes

### Screen 1: Login Page

**Desktop (≥1024px):** Card centered within `max-w-[640px]` container. `p-8` inside the card. Submit button `lg` size.

**Tablet (768–1023px):** Same layout. Container padding reduces to `px-6`. Card padding reduces to `p-6`.

**Mobile (375–767px):** Card fills the available width with `mx-4` side margins. Card padding `p-5`. Submit button `lg fullWidth`. The "First time?" link sits below the button at `text-sm text-center`. No horizontal scroll: card uses `max-w-full` minus margins.

### Screen 2: Signup Page

**Desktop (≥1024px):** Same `max-w-[640px]` container as login. Fields stacked vertically (already single-column). Textarea 4 rows.

**Tablet (768–1023px):** Same as desktop with reduced padding.

**Mobile (375–767px):** Card fills width with `mx-4`. Fields remain single-column (no reflow needed). Submit button `fullWidth`. Phone field type is `tel` for mobile numeric keyboard. Textarea reduces to 3 rows.

### Screen 3: Auth Callback

**All breakpoints:** Centered spinner fills the viewport. No layout complexity.

### Screen 4: Dashboard Stub

**Desktop (≥1024px):** `max-w-[960px]` content container. Heading `text-3xl`. UserMenu in header right slot, adjacent to LanguageSwitcher.

**Tablet (768–1023px):** Same layout. Heading `text-2xl`. UserMenu remains in header.

**Mobile (375–767px):** Heading `text-xl`. The UserMenu trigger truncates the email with `truncate max-w-[140px]` to avoid header overflow. PendingApprovalState card: `mx-4`, full-width within margins.

### Screen 5: Admin — Pending Studios

**Desktop (≥1024px):** Full table view with all columns visible. Actions in the last column (Approve + Reject buttons side by side in a row).

**Tablet (768–1023px):** Table still fits in most cases. Description column truncates to 1 line with `truncate`. Actions remain in the last column but with `sm` sized buttons.

**Mobile (375–767px):** The table converts to a stacked card list. Each pending studio becomes a card (`bg-white rounded-2xl shadow-sm p-4 mb-3`). Card shows:
- Studio name (heading)
- Email (text-sm muted)
- Submitted date (text-xs muted, right-aligned)
- Description (truncated to 2 lines, expandable via "show more" link)
- Phone if present
- Full-width buttons: [Approve — primary] stacked above [Reject — secondary] with `mt-2`
The table header is hidden on mobile; card layout makes column labels unnecessary. The `overflow-x-auto` fallback wraps the table container anyway as a safety net.

---

## 13. Open Questions for GATE 2

1. **Welcome email expiry:** The welcome magic link (sent on approval) is described as expiring in 24 hours. Supabase default OTP expiry is 1 hour (`otp_expiry = 3600`). If the admin approves a studio late on a Friday and the owner doesn't check email until Monday, the link will be expired. Should the welcome link have a longer expiry (e.g., 7 days), or should the dashboard handle "expired welcome link" gracefully by showing a re-request flow? This is a product decision with UX implications.

2. **Signup locale storage:** To send the welcome email in the user's preferred locale, the `pending_studios` table should store the locale at signup time. The spec's `pending_studios` schema does not include a `locale` column. This column should be added (architect to confirm in the ADR). The designer has assumed this column exists in the welcome email flow.

3. **Admin route protection UI:** Spec AC-22 states non-admins get a 404 (not a 403) to avoid revealing the route. This means the admin `/admin/pending-studios` page looks like a standard 404 to non-admins. The 404 page is not in scope for this feature — is there an existing 404 page design, or should one be noted for a follow-up ticket?

4. **"Log out of all devices" confirmation:** The spec says to design this with a confirmation dialog. The flow is designed accordingly in this doc. However, for the simple local "Log out" button, no confirmation is shown (the user is redirected immediately). Please confirm this asymmetry is correct: confirmation only for global logout, not local logout.

5. **Greeting time-of-day logic:** The dashboard greeting (`Buenos días / Good morning`, etc.) uses time-of-day segmentation. This requires a client-side time check (or timezone-aware server component). Should the greeting be time-aware from day one, or should a simpler static greeting be used for the v1 stub (e.g., just the studio name, no time-based variation)? A static greeting reduces implementation complexity for a placeholder screen.

6. **Admin table vs. card list on mobile:** The pending studios table converts to stacked cards on mobile. On mobile, there is no separate "description" expansion — the description is truncated at 2 lines with a "show more" inline toggle. Is inline expansion acceptable, or should tapping a row open a detail drawer/sheet?

7. **Dark mode note (deferred):** The pending approval state uses `warning.50` background and `warning.700` text on a white surface. When dark mode is added, this card will need a dark-mode variant. Noted here so the token naming convention is not broken.

8. **Email footer content:** The current email footer shows only the address and copyright. Should a link to an unsubscribe mechanism be included for compliance (CAN-SPAM / GDPR)? For transactional-only emails (magic links), unsubscribe is not legally required, but a note in the footer is good practice. Brevo free tier also adds its own footer.
