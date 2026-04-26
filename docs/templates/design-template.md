# Design: <Feature>

**Spec:** <link>
**Ticket:** CU-XXXX
**Date:** YYYY-MM-DD
**Author:** designer (agent)

## 1. Screens involved
List every screen / route. For each:
- URL pattern (e.g., `/dashboard/bookings/[id]`)
- Primary user goal on this screen
- Layout description (header, sidebar, main content, modals)

## 2. User flows
Step-by-step walkthrough for each user story in the spec.

## 3. Component inventory
For each screen, list components used (reuse existing > create new).

## 4. New components
For each new component:
- Name (PascalCase, e.g., `BookingStatusPill`)
- Purpose
- Props
- States: default, hover, focus, disabled, loading, empty, error
- Variants
- Accessibility: ARIA roles, keyboard navigation, focus management
- Mobile responsive behavior

## 5. Design tokens used / added
- Colors, spacing, typography.
- Justify any new tokens.

## 6. Copy
| Key | es | en |
|---|---|---|
| `bookings.list.cta.add` | Agregar reserva | Add booking |
| ... | ... | ... |

## 7. Interaction & motion
Transitions, micro-interactions. Specify duration and easing.

## 8. Empty / error / loading states
For every screen: describe each state explicitly.

## 9. Accessibility checklist
- [ ] Keyboard reachable
- [ ] Focus visible
- [ ] Color contrast ≥ 4.5:1 for text, 3:1 for UI elements
- [ ] Screen reader labels for all controls
- [ ] No information conveyed by color alone
- [ ] Form errors announced to screen readers

## 10. Responsive notes
- Desktop is primary (≥1024px).
- Tablet (768–1023px): describe adaptations.
- Mobile (375–767px): describe adaptations.

## 11. Open questions
For the human at GATE 2.
