# MowLog Agent Guardrails

## Purpose
Define non-negotiable rules for agent execution in this app.

## Allowed Without Extra Approval
- UI and state wiring changes inside `src/`.
- New tests, docs, and non-runtime scripts.
- Refactors that preserve behavior.

## Require Explicit Human Approval
- Dependency installs or upgrades.
- Production deploy operations.
- `.env*` edits or secret handling changes.
- Destructive database or data migration work.

## Quality Gates (Mandatory)
1. Run `npm run lint`.
2. Run `npm run build`.
3. Verify affected user flow manually.
4. Update `session_log.md` with:
   - Last successful state
   - Current blocker (if any)
   - Next atomic action

## Failure Handling Loop
If build/test fails, run this bounded loop before escalation:
1. Read full error output.
2. Classify root cause.
3. Apply one focused fix.
4. Re-run failed check.
5. Repeat at most 2 retries.

Escalate only after bounded retries fail.
