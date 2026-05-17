
# Massage Tulum — Autonomous Runtime

## Autonomous Mode

The repo operates in autonomous mode.

Agents may:
- create branches
- commit code
- push branches
- open PRs
- review PRs
- fix reviewer comments
- run QA
- merge PRs when CI + QA are green

Agents must NOT:
- deploy production
- rotate secrets
- delete data
- modify billing/accounts
- run destructive migrations

If Claude is token-limited or unavailable, the external loop retries automatically later.
