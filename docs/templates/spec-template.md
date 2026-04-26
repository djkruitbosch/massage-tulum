# Spec: <Feature Name>

**Ticket:** CU-XXXX
**Status:** Draft | Approved | Superseded
**Author:** product-manager (agent)
**Date:** YYYY-MM-DD

## 1. Problem
What user problem does this solve? Who has this problem? How often?
Cite evidence if you have it.

## 2. User stories
- As a <role>, I want to <do thing>, so that <outcome>.
- (3–7 stories. If more, the feature is too big — split it.)

## 3. Acceptance criteria
Numbered, testable, unambiguous. QA writes tests directly from these.
1. Given <state>, when <action>, then <result>.
2. ...

## 4. Out of scope
List what this feature explicitly does NOT include. Prevent scope creep.

## 5. Edge cases & error states
- What happens when X is empty / missing / malformed?
- What happens on network failure?
- What happens with concurrent edits?
- Localization: are there strings that depend on locale (dates, currency)?

## 6. Analytics & success metrics
- Events to track (name, properties, when fired).
- What metric tells us this feature is working?

## 7. Roles & permissions
Who can see / do this? Studio owner only? Therapist? Customer? Admin?
Reference Supabase RLS implications.

## 8. Localization
Confirm: all user-facing strings provided in both `es` and `en`, OR
note explicitly which strings are locale-independent.

## 9. Open questions for human review
List anything you're guessing about. The human resolves these at GATE 1.

## 10. Research needed
Anything the `researcher` agent should investigate before architect starts.
