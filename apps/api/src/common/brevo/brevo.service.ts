import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

/** Brevo transactional email send request shape (v3 API). */
interface BrevoEmailRequest {
  sender: { name: string; email: string };
  to: Array<{ email: string }>;
  subject: string;
  htmlContent: string;
}

/** Brevo transactional email send response shape. */
interface BrevoEmailResponse {
  messageId: string;
}

/**
 * BrevoService — sends transactional emails via the Brevo HTTP API.
 *
 * Used by: NestJS admin approval flow (welcome email).
 * NOT used for: magic-link request emails (those go via Supabase Auth → Brevo SMTP).
 *
 * Brevo HTTP API endpoint: POST https://api.brevo.com/v3/smtp/email
 * Credential: BREVO_API_KEY env var (distinct from the SMTP key used by Supabase).
 *
 * See: docs/adr/0008-studio-onboarding-self-signup.md §2
 *      docs/adr/0009-bilingual-supabase-email-templates.md §2
 */
@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);
  private readonly apiUrl = 'https://api.brevo.com/v3/smtp/email';
  private readonly sender = { name: 'Massage Tulum', email: 'noreply@massage-tulum.com' };

  /**
   * Sends the bilingual welcome email after admin approval.
   *
   * Locale-specific content:
   *   es — "Bienvenido a Massage Tulum — tu estudio ha sido aprobado"
   *   en — "Welcome to Massage Tulum — your studio has been approved"
   *
   * @param to          Recipient email (PII — logged only as message ID returned from Brevo)
   * @param studioName  Approved studio name
   * @param magicLink   Supabase-generated magic-link (expires per otp_expiry)
   * @param locale      'es' | 'en' — used to select bilingual content
   * @returns           Brevo message ID for correlation logging
   */
  async sendWelcomeEmail(
    to: string,
    studioName: string,
    magicLink: string,
    locale: 'es' | 'en',
  ): Promise<string> {
    const { subject, body, cta, footer } = this.getWelcomeContent(locale, studioName);

    const htmlContent = this.renderWelcomeTemplate({ body, magicLink, cta, footer, subject });

    return this.sendEmail({ to, subject, htmlContent });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private getWelcomeContent(
    locale: 'es' | 'en',
    studioName: string,
  ): { subject: string; body: string; cta: string; footer: string } {
    if (locale === 'es') {
      return {
        subject: 'Bienvenido a Massage Tulum — tu estudio ha sido aprobado',
        body: `Hola ${studioName}, tu solicitud ha sido aprobada. Haz clic en el enlace para acceder a tu cuenta.`,
        cta: 'Acceder a mi cuenta →',
        footer: 'Si tienes alguna pregunta, responde a este correo y te ayudaremos.',
      };
    }
    return {
      subject: 'Welcome to Massage Tulum — your studio has been approved',
      body: `Hi ${studioName}, your application has been approved. Click the link to sign in to your account.`,
      cta: 'Sign in to my account →',
      footer: 'If you have any questions, reply to this email and we’ll help you.',
    };
  }

  /**
   * Renders the welcome.html template by replacing placeholder tokens.
   *
   * welcome.html uses double-brace tokens: {{BODY}}, {{MAGIC_LINK}}, {{CTA}},
   * {{FOOTER}}, {{SUBJECT}} — replaced by simple string substitution.
   */
  private renderWelcomeTemplate(opts: {
    body: string;
    magicLink: string;
    cta: string;
    footer: string;
    subject: string;
  }): string {
    // Load the template relative to the repo root. The relative path is the
    // same in dev (src/common/brevo) and prod (dist/common/brevo) — both are
    // 5 levels deep from the repo root.
    const templatePath = join(__dirname, '../../../../../supabase/templates/welcome.html');
    const raw = readFileSync(templatePath, 'utf-8');

    return raw
      .replace(/\{\{SUBJECT\}\}/g, opts.subject)
      .replace(/\{\{BODY\}\}/g, opts.body)
      .replace(/\{\{MAGIC_LINK\}\}/g, opts.magicLink)
      .replace(/\{\{CTA\}\}/g, opts.cta)
      .replace(/\{\{FOOTER\}\}/g, opts.footer);
  }

  private async sendEmail(opts: {
    to: string;
    subject: string;
    htmlContent: string;
  }): Promise<string> {
    const apiKey = process.env['BREVO_API_KEY'];
    if (!apiKey) {
      throw new InternalServerErrorException(
        'BREVO_API_KEY is not configured. Cannot send welcome email.',
      );
    }

    const payload: BrevoEmailRequest = {
      sender: this.sender,
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.htmlContent,
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Log status only — no PII, no recipient email.
      this.logger.error(`Brevo API error: HTTP ${response.status.toString()}`);
      throw new InternalServerErrorException('Failed to send welcome email via Brevo');
    }

    const json = (await response.json()) as BrevoEmailResponse;
    // Log message ID for correlation — no PII.
    this.logger.log(`Welcome email sent via Brevo — messageId=${json.messageId}`);
    return json.messageId;
  }
}
