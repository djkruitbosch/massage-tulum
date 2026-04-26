# Getting Started — Massage Tulum

You have all the scaffolding files. This is the order of operations to actually start the project.

---

## 0. One-time prerequisites (per your machine)

- [ ] Install Node.js 20+ and pnpm 9+.
- [ ] Install Claude Code: `npm install -g @anthropic-ai/claude-code`. Verify with `claude --version`.
- [ ] Install GitHub CLI: `gh auth login`.
- [ ] Confirm your Claude plan supports Claude Code usage. **Reality check:** regular Pro hits Claude Code limits fast with multi-agent setups. Max 5x is workable. Max 20x is comfortable. If you're on Pro, plan to /clear contexts often and possibly batch work into focused sessions.

---

## 1. Repo setup

Follow `docs/runbooks/github-setup.md` end to end:

- [ ] Create the repo (`gh repo create massage-tulum --private`).
- [ ] Push the contents you've generated (this scaffolding).
- [ ] Set up branch protection on `main` (1 approval, required CI, linear history, no force push).
- [ ] Set merge method to squash-only.
- [ ] Verify CI runs on a test PR.
- [ ] Add the `lint-test-build` and `secret-scan` jobs as required status checks (only possible after the first run).

---

## 2. ClickUp setup

Follow `docs/runbooks/clickup-setup.md` end to end:

- [ ] Create the `Massage Tulum` Space.
- [ ] Add custom fields: `Agent`, `PR Link`, `ADR Link`, `Spec Link`.
- [ ] Set up the 10-status workflow.
- [ ] Create ticket templates (Feature spec, Bug, Research, Dev).
- [ ] Set up ClickUp Docs structure (Specs, Architecture, Design, Research, Runbooks, ADRs).

---

## 3. MCP servers

Connect Claude Code to ClickUp and GitHub via MCP. Refer to current Claude Code docs (https://docs.claude.com/en/docs/claude-code/) for the exact configuration syntax — it has changed across versions.

- [ ] ClickUp MCP — needs your ClickUp API token. Test: ask Claude Code "list my ClickUp spaces".
- [ ] GitHub MCP — usually authenticated via `gh` CLI, sometimes needs a separate PAT. Test: ask Claude Code "list open PRs in my massage-tulum repo".
- [ ] (Later) Supabase MCP for direct DB inspection during development.

Store API tokens in `.claude/settings.local.json` (gitignored) or as environment variables. **Never** commit tokens to `.claude/settings.json`.

---

## 4. First Claude Code session

Open a terminal in the project root and run `claude`. The session should pick up `CLAUDE.md` automatically.

Verify the agents are loaded:
```
> /agents
```
You should see all 9 sub-agents listed.

Verify the slash commands are loaded:
```
> /
```
(or check `/help`). You should see `/new-feature`, `/bugfix`, `/research`, `/status`.

---

## 5. First feature — recommended start

Don't start with the most ambitious feature. Start with something small that exercises the full pipeline once, so you find the rough edges before they hurt.

**Suggested first feature:** "Studio owner can sign up and create their studio profile (name, description, address, phone, hours of operation)."

This touches:
- Auth (Supabase Auth setup)
- DB schema (`studios` table + RLS)
- API (POST /studios, GET /studios/me)
- FE (sign-up flow, profile form)
- i18n (es + en)
- Emails (welcome email via Brevo)
- DevOps (envs, CI, first deploy)

Run:
```
> /new-feature Studio owner signs up and creates their studio profile
```

The main session will:
1. Ask any clarifying questions.
2. Create the spec ticket in ClickUp.
3. Invoke `product-manager`.
4. Wait for your approval at GATE 1.

---

## 6. What to expect on the first feature

It will be slower than feature #2. The first feature will:
- Trigger researcher work (auth strategy, email provider details, BE hosting decision).
- Trigger several ADRs (auth, monorepo init, CI baseline, hosting).
- Trigger initial scaffolding by DevOps (turborepo + pnpm workspaces, Next.js init, NestJS init).
- Take longer at GATE 1 and GATE 2 because everything is new.

After the first feature, subsequent features will skip most of the bootstrapping and run much faster.

---

## 7. Things to watch for

### Token / context limits
- The main session's context fills up over time. After 1–2 features, run `/clear` to reset.
- Sub-agents have their own context windows; they reset automatically per invocation.
- ClickUp + ADRs preserve state across sessions. **The chat history is not where state lives.**

### Free-tier walls
- Supabase pauses after 1 week of inactivity. Wake it via the dashboard or by running a query.
- Brevo: 300 emails/day. Don't blast tests against real addresses.
- Vercel hobby: fine for one developer.
- ClickUp free tier: enough for solo. Will eventually need an upgrade for multi-user features.

### Drift
- Agents can drift from CLAUDE.md over long sessions. If an agent does something off-pattern, point at the specific line in CLAUDE.md or the agent definition rather than re-explaining.
- If you find yourself repeating the same correction, update the agent file or CLAUDE.md and `/clear` to apply.

### Approval discipline
- Don't let convenience erode the gates. The whole point is that the human merges to main. If you ever feel like "just letting the agent merge", that's a flag to revisit branch protection.

---

## 8. Where to look when things go wrong

- **An agent does something I didn't want:** check its `.claude/agents/<name>.md` and the relevant section of `CLAUDE.md`. Update the file. `/clear` and retry.
- **CI fails on first PR:** read `.github/workflows/ci.yml` and the runbook. Likely a missing pnpm script or a workspace config issue.
- **Supabase MCP can't connect:** likely auth (run `supabase login`) or wrong project ref.
- **A ticket is stuck:** run `/status` to see open items.
- **You can't remember where docs live:** specs in ClickUp Docs; ADRs in `docs/adr/`; runbooks in `docs/runbooks/`; everything else in this repo.

---

## 9. Non-negotiables to keep yourself honest

- Never bypass branch protection. If you "just this once" merge without review, the orchestration model is dead.
- Never approve your own agents' PRs by reflex. You're the human gate; act like it.
- If an agent invents a fact (a free-tier number, a security recommendation, a ClickUp custom field that doesn't exist), call it out and require a citation. Hallucinations compound.
- Localization is part of done. Both `es` and `en` ship together. There is no "we'll do Spanish later".

---

## You're ready

Start with step 1. The whole flow above is one to two evenings of setup before any code is written — that's normal and worth it. Then `/new-feature` your first ticket and let the workflow do its work.

When you hit something this scaffolding doesn't cover, file a ticket of type `[CHORE]` and update the relevant `.md` file. Treat the scaffolding as code: it evolves with the project.
