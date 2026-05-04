# Component: EmailLayout

**Used in:** Studio Owner Authentication (CU-869d29f1f) — all transactional emails
**Designer doc:** `docs/design/CU-869d29f1f-studio-owner-auth.md`
**Status:** Spec
**Date:** 2026-05-03

---

## Purpose

The base HTML email template that wraps all transactional emails from Massage Tulum. Provides a consistent visual frame: a header with the brand name, a content area for variable message content, and a footer with address and legal disclaimer. This is not a React component — it is an HTML email template authored in Supabase's Go template syntax or as a Brevo email template. The spec here describes the visual design and content structure that developer-fe must translate into valid HTML email markup.

---

## Important: HTML Email Constraints

HTML emails do not support modern CSS features. The following rules apply:
- **No Flexbox, no Grid.** Use `<table>` for layout.
- **Inline styles only.** CSS class-based styles are stripped by many email clients (Gmail, Outlook). All styles must be inline.
- **No CSS variables** (custom properties). All color values must be hardcoded hex.
- **Max width: 600px.** Standard email safe width. The content table is `width="600"` centered in the email body.
- **No webfonts.** Google Fonts or Plus Jakarta Sans will not load in most email clients. Use the system font stack: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`.
- **No SVG.** Use a text-based logo placeholder in v1.
- **Images:** If added, must use absolute URLs. In v1, no images are used.

---

## Structure

```
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ email subject }}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">

    <!-- Outer wrapper table -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:#F8F9FA;padding:40px 0;">
      <tr>
        <td align="center">

          <!-- Content container -->
          <table width="600" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:600px;width:100%;background-color:#FFFFFF;
                        border-radius:16px;overflow:hidden;
                        border:1px solid #E9ECEF;">

            <!-- HEADER -->
            <tr>
              <td style="background-color:#5E3F24;padding:24px 40px;text-align:center;">
                <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                             font-size:20px;font-weight:700;color:#FFFFFF;
                             letter-spacing:0.3px;">
                  Massage Tulum
                </span>
              </td>
            </tr>

            <!-- BODY CONTENT (variable per email type) -->
            <tr>
              <td style="padding:40px 40px 32px;color:#343A40;">
                {{ content block }}
              </td>
            </tr>

            <!-- DIVIDER -->
            <tr>
              <td style="padding:0 40px;">
                <hr style="border:none;border-top:1px solid #E9ECEF;margin:0;">
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="padding:24px 40px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;color:#6C757D;">
                  Massage Tulum · Tulum, México / Tulum, Mexico
                </p>
                <p style="margin:0;font-size:11px;color:#ADB5BD;">
                  © 2026 Massage Tulum
                </p>
                <!-- Brevo free-tier note: "Sent with Brevo" footer appended automatically -->
              </td>
            </tr>

          </table>
          <!-- End content container -->

        </td>
      </tr>
    </table>
    <!-- End outer wrapper -->

  </body>
</html>
```

---

## Content Block Specification (per email type)

### Body Content — Magic-Link Login Email

The content block replaces `{{ content block }}` above:

```html
<!-- Greeting -->
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#343A40;">
  {{ if eq .Data.locale "es" }}Hola,{{ else }}Hi,{{ end }}
</p>

<!-- Body copy -->
<p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:#343A40;">
  {{ if eq .Data.locale "es" }}
    Haz clic en el enlace a continuación para acceder a tu cuenta de Massage Tulum.
  {{ else }}
    Click the link below to sign in to your Massage Tulum account.
  {{ end }}
</p>

<!-- CTA button -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding-bottom:28px;">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background-color:#5E3F24;color:#FFFFFF;
                font-size:15px;font-weight:600;text-decoration:none;
                padding:14px 32px;border-radius:8px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        {{ if eq .Data.locale "es" }}Acceder a mi estudio{{ else }}Sign in to my studio{{ end }}
      </a>
    </td>
  </tr>
</table>

<!-- Expiry notice -->
<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#6C757D;">
  {{ if eq .Data.locale "es" }}
    Este enlace expira en 1 hora. Solo puede usarse una vez.
  {{ else }}
    This link expires in 1 hour and can only be used once.
  {{ end }}
</p>

<!-- Ignore notice -->
<p style="margin:0;font-size:13px;line-height:1.5;color:#ADB5BD;">
  {{ if eq .Data.locale "es" }}
    Si no solicitaste este enlace, puedes ignorar este mensaje con seguridad.
  {{ else }}
    If you didn't request this, you can safely ignore this email.
  {{ end }}
</p>
```

### Body Content — Welcome Email (Admin Approval)

The welcome email is sent via Brevo HTTP API by the NestJS backend (not via Supabase's template engine). The Go template conditional syntax does not apply here. Instead, the NestJS service selects the correct locale body at send time and inserts it into the Brevo template.

```html
<!-- Greeting -->
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#343A40;">
  [es: "Hola," / en: "Hi,"]
</p>

<!-- Approval message -->
<p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:#343A40;">
  [es: "Tu estudio ha sido aprobado. Ya puedes acceder a Massage Tulum y empezar a gestionar tus reservas."]
  [en: "Your studio has been approved. You can now sign in to Massage Tulum and start managing your bookings."]
</p>

<!-- CTA button (same HTML structure as login email) -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding-bottom:28px;">
      <a href="[generated magic link URL]"
         style="display:inline-block;background-color:#5E3F24;color:#FFFFFF;
                font-size:15px;font-weight:600;text-decoration:none;
                padding:14px 32px;border-radius:8px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        [es: "Acceder a mi estudio" / en: "Sign in to my studio"]
      </a>
    </td>
  </tr>
</table>

<!-- Expiry notice (welcome link has longer expiry — confirm with architect) -->
<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#6C757D;">
  [es: "Este enlace de bienvenida expira en 24 horas."]
  [en: "This welcome link expires in 24 hours."]
</p>

<!-- Support note -->
<p style="margin:0;font-size:13px;line-height:1.5;color:#ADB5BD;">
  [es: "Si tienes alguna pregunta, responde a este correo."]
  [en: "If you have any questions, reply to this email."]
</p>
```

---

## Visual Specification

### Header

| Property | Value |
|---|---|
| Background | `#5E3F24` (`brand.700`) |
| Text | "Massage Tulum" |
| Text color | `#FFFFFF` |
| Font size | 20px |
| Font weight | 700 |
| Padding | 24px top/bottom, 40px left/right |
| Alignment | Center |

The header uses `brand.700` background to communicate brand identity without relying on an image or logo asset. In v1, this text-based header is sufficient and renders reliably across all email clients.

### Content Area

| Property | Value |
|---|---|
| Background | `#FFFFFF` |
| Padding | 40px top, 40px sides, 32px bottom |
| Font family | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif` |
| Default text color | `#343A40` (`neutral.700`) |
| Default font size | 16px |
| Line height | 1.5 |

### CTA Button

| Property | Value |
|---|---|
| Background | `#5E3F24` (`brand.700`) |
| Text color | `#FFFFFF` |
| Font size | 15px |
| Font weight | 600 |
| Padding | 14px top/bottom, 32px left/right |
| Border radius | 8px (email clients that support it; degrades gracefully) |
| Display | `inline-block` (required for padding to work on `<a>` in email) |
| Width | Auto (not full-width — looks more button-like centered) |

The CTA button is centered using a `<table>` with `align="center"` on the `<td>`. This is the standard email-safe centering method.

### Footer

| Property | Value |
|---|---|
| Background | `#FFFFFF` (same as content area, separated by divider) |
| Padding | 24px top/bottom, 40px sides |
| Address text | 12px, `#6C757D` (`neutral.500`), centered |
| Copyright text | 11px, `#ADB5BD` (`neutral.400`), centered |

### Divider

1px horizontal rule using `border-top:1px solid #E9ECEF` (`neutral.200`).

### Outer Body

Background: `#F8F9FA` (`neutral.50`). The email "page" background.

---

## Accessibility in Email

Email clients have limited accessibility support, but the following practices are applied:
- **`<html lang>`:** Set to `lang="es"` or `lang="en"` based on the email's locale. For the Go-template login email: `lang="{{ if eq .Data.locale "es" }}es{{ else }}en{{ end }}"`.
- **Link text:** The CTA link text is descriptive ("Acceder a mi estudio" / "Sign in to my studio") — not generic "Click here".
- **Images:** None in v1. When added, all `<img>` tags must have `alt` attributes.
- **Text-only fallback:** Both email types must have a plain-text fallback version. Supabase supports separate plain-text templates. Brevo templates support both HTML and plain-text.

---

## Plain-Text Fallback Templates

### Login Email — Plain Text (Go template)

```
{{ if eq .Data.locale "es" }}
Hola,

Haz clic en el enlace a continuación para acceder a tu cuenta de Massage Tulum.

{{ .ConfirmationURL }}

Este enlace expira en 1 hora. Solo puede usarse una vez.

Si no solicitaste este enlace, puedes ignorar este mensaje con seguridad.

– Massage Tulum
{{ else }}
Hi,

Click the link below to sign in to your Massage Tulum account.

{{ .ConfirmationURL }}

This link expires in 1 hour and can only be used once.

If you didn't request this, you can safely ignore this email.

– Massage Tulum
{{ end }}
```

### Welcome Email — Plain Text (NestJS selects locale)

Spanish:
```
Hola,

Tu estudio ha sido aprobado. Accede a Massage Tulum usando el enlace:

[magic link URL]

Este enlace expira en 24 horas.

Si tienes alguna pregunta, responde a este correo.

– Massage Tulum
```

English:
```
Hi,

Your studio has been approved. Sign in to Massage Tulum using the link below:

[magic link URL]

This link expires in 24 hours.

If you have any questions, reply to this email.

– Massage Tulum
```

---

## Sender Configuration

| Property | Value |
|---|---|
| From name | `Massage Tulum` |
| From address | `noreply@massage-tulum.com` |
| Reply-to | Same as from (or a monitored inbox if the human wants to receive replies) |

---

## Variants

**Login magic link:** Uses Supabase's built-in email delivery via Brevo SMTP. Template is a Go-template in Supabase's auth email settings.

**Welcome email:** Sent by NestJS via Brevo HTTP API. The NestJS service constructs the full HTML body with the locale-appropriate content and injects the generated magic link URL. The base HTML layout (header, wrapper, footer) is the same.

---

## Tokens Used (mapped to inline CSS hex values)

| Token | Hex used in email | Usage |
|---|---|---|
| `brand.700` | `#5E3F24` | Header background, CTA button background |
| `neutral.50` | `#F8F9FA` | Email outer background |
| `neutral.200` | `#E9ECEF` | Divider, content container border |
| `neutral.400` | `#ADB5BD` | Copyright text, ignore notice |
| `neutral.500` | `#6C757D` | Footer address, secondary body text |
| `neutral.700` | `#343A40` | Default body text |
| `white` | `#FFFFFF` | Content background, header text, CTA text |

---

## Copy Keys (email content, not in messages/es.json — managed in Supabase or Brevo)

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
| `email.welcome.support` | Si tienes alguna pregunta, responde a este correo. | If you have any questions, reply to this email. |
| `email.footer.address` | Massage Tulum · Tulum, México | Massage Tulum · Tulum, Mexico |
| `email.footer.copyright` | © 2026 Massage Tulum | © 2026 Massage Tulum |

---

## Examples

### Example 1: Login email rendered for a Spanish-locale user

`.Data.locale = "es"` in the Go template.
Subject: "Tu enlace para acceder a Massage Tulum"
Header: brand-700 background, "Massage Tulum" white text.
Body: Spanish copy with CTA button "Acceder a mi estudio".
Footer: "Massage Tulum · Tulum, México" / "© 2026 Massage Tulum"

### Example 2: Welcome email for an English-locale studio owner

NestJS selects `en` locale.
Subject: "Welcome to Massage Tulum — your studio has been approved"
Body: English copy with CTA "Sign in to my studio" linking to the generated magic link.

---

## Don'ts

- Don't use CSS classes in email HTML — all styles must be inline. Gmail strips `<style>` blocks.
- Don't use Flexbox or CSS Grid in email — use `<table>` for layout.
- Don't use web fonts — use the system font stack.
- Don't use SVG — use text for the logo in v1.
- Don't use `background-image` for the CTA button — use background-color only (supported in all email clients).
- Don't make the content container wider than 600px — it will overflow on mobile email apps.
- Don't omit the plain-text fallback — it is required by email deliverability best practices and some email clients.
- Don't include unsubscribe links for transactional emails (magic links are single-use, triggered by the user) — they are not marketing emails. However, consult the human on GDPR/CAN-SPAM compliance if any doubt remains.
