# Runbook: GitHub setup

**Last updated:** 2026-04-26
**Owner:** Project owner (human)

## When to use this

Setting up the GitHub repo for Massage Tulum, or hardening an existing repo to match these conventions.

## Pre-conditions

- A GitHub account with permission to create repos (personal or org).
- Local git installed and authenticated to GitHub (`gh auth status` works).

## 1. Create the repo

```bash
gh repo create massage-tulum --private --description "Booking platform for massage studios in Tulum"
cd ~/projects   # or wherever
git clone git@github.com:<you>/massage-tulum.git
cd massage-tulum
```

Copy in the contents you've generated (CLAUDE.md, .claude/, docs/, .github/) and commit:

```bash
git add .
git commit -m "chore: initial project scaffolding (CLAUDE.md, agents, docs)"
git push -u origin main
```

## 2. Branch protection on `main`

This is the most important step. Without it, agents could push to main and bypass the human approval gate.

Settings → Branches → Add rule (or "branch ruleset" in newer GitHub UIs):

- Branch name pattern: `main`
- ✅ Require a pull request before merging
  - ✅ Require approvals (1)
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners (optional, but recommended once you add a CODEOWNERS file)
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Required checks: `ci` (the workflow you'll add in step 5). Add this AFTER your first CI run completes — GitHub only lets you require checks it has seen run at least once.
- ✅ Require linear history
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings (admins included — yes, even you)
- ❌ Allow force pushes — disabled
- ❌ Allow deletions — disabled

**On a free GitHub account with a private repo:** branch protection is available. Required reviewers may be limited; check current GitHub free-tier docs.

## 3. Default merge method

Settings → General → Pull Requests:
- ✅ Allow squash merging — DEFAULT
- ❌ Allow merge commits
- ❌ Allow rebase merging

(Squash-only keeps `main` history clean and matches the "linear history" rule.)

Also enable: ✅ Automatically delete head branches.

## 4. PR template

Create `.github/pull_request_template.md`:

```markdown
## Ticket
Closes CU-XXXX

## What changed
- 

## Why


## How to test
1. 

## Checklist
- [ ] Linked to ClickUp ticket
- [ ] Tests added/updated
- [ ] Docs updated (ADR / runbook / README) if applicable
- [ ] No secrets committed
- [ ] i18n keys in both `es` and `en` (if FE)
- [ ] RLS policies updated (if BE schema change)

## Migrations
- [ ] No migrations
- [ ] Includes migrations (rollback verified locally)

## Screenshots / recordings (if FE)
```

## 5. CI workflow skeleton

Save as `.github/workflows/ci.yml`. Architect / DevOps will refine this — this is just the starter shape.

```yaml
name: ci
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-test-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test
        env:
          NODE_ENV: test

      - name: Build
        run: pnpm build

      - name: Audit
        run: pnpm audit --prod --audit-level=high
        continue-on-error: false

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

After you push this workflow once and let it run, go back to branch protection and require the `lint-test-build` and `secret-scan` jobs.

## 6. CODEOWNERS (optional but recommended)

`.github/CODEOWNERS`:

```
# Default — you, the human, must approve everything
* @<your-github-username>

# Agents are not GitHub users; the human owns approvals.
```

## 7. Repo secrets

You'll add secrets later as needed (Vercel token, Supabase keys, etc.). For now, just be aware of where they go:

Settings → Secrets and variables → Actions

**Never put secrets in workflow files. Always reference `${{ secrets.NAME }}`.**

## 8. .gitignore

Make sure your `.gitignore` includes at minimum:

```
node_modules/
.next/
dist/
build/
.turbo/
.vercel/
coverage/

.env
.env.*
!.env.example

.DS_Store
*.log
*.pem
*.key

.claude/settings.local.json
```

## 9. Verification

- [ ] Repo created and code pushed.
- [ ] Branch protection active on `main` (try pushing to main directly — it should fail).
- [ ] Default merge method is squash.
- [ ] PR template appears when opening a new PR.
- [ ] CI workflow runs on PRs and is required for merge.
- [ ] `.gitignore` excludes `.env*`.

## Common failures

- **CI required check missing:** Required status checks must have run at least once before they appear in the protection settings list. Push a dummy PR, let CI run, then come back and tick the box.
- **Force push allowed despite settings:** check repo-level vs org-level rulesets. Org rulesets win.
- **Squash-merge button missing:** check both repo settings AND any org-level repository policies.

## Rollback

Branch protection can be removed in Settings → Branches. Don't remove it casually — the whole orchestration model assumes the human is the only one merging to main.
