/**
 * FormSection — server-renderable section wrapper.
 *
 * Renders a labeled section divider within the studio profile form.
 * Wraps children in a white card with a heading and optional description.
 *
 * Ref: docs/design/studio-profile.md §3
 * Ticket: CU-869d8cp2d
 */

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="font-heading text-lg font-semibold text-neutral-800">{title}</h2>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}
