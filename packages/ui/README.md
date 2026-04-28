# @massage-tulum/ui

Shared React component library for the Massage Tulum platform. At Foundation this package exports a single `Button` component — the canonical interactive action element used across all studio-owner UI screens. The package emits class name strings that reference custom Tailwind design tokens; consumers must include `packages/ui/src/**/*.{ts,tsx}` in their Tailwind `content` glob so the JIT compiler detects and compiles those classes.

## Usage

```tsx
import { Button } from '@massage-tulum/ui';

// Primary action (default)
<Button variant="primary" size="md" type="submit">
  Guardar cambios
</Button>

// Secondary alongside primary
<Button variant="secondary" size="md" type="button">
  Cancelar
</Button>

// Loading state
<Button variant="primary" loading>
  Guardando...
</Button>

// Destructive with leading icon
<Button variant="destructive" leadingIcon={<Trash2 size={20} aria-hidden="true" />}>
  Eliminar reserva
</Button>
```

Design spec: `docs/design/components/Button.md`. Token reference: `docs/design/tokens.md`.
