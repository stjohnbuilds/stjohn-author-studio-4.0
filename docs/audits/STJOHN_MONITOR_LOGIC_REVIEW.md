# StJohn Monitor Logic Review

Date: 2026-06-02

Purpose: check the project-monitor design against common multi-agent and agent
evaluation guidance, then list the plugs that keep audit bots from drifting.

## Sources Checked

- OpenAI, agent design and guardrails:
  https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
- OpenAI Agents SDK, orchestration patterns:
  https://openai.github.io/openai-agents-python/multi_agent/
- OpenAI, evaluation best practices:
  https://developers.openai.com/api/docs/guides/evaluation-best-practices
- Anthropic, building effective agents:
  https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, evals for agents:
  https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Microsoft Azure Architecture Center, AI agent orchestration patterns:
  https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns

## Logic Check

### 1. One manager, narrow workers

Web guidance favors a manager/supervisor pattern when one agent must combine
specialist outputs and enforce shared guardrails. The StJohn monitor now uses a
Lead Monitor plus narrow audit zones.

Status: covered.

### 2. Do not over-agent

Guidance warns against unnecessary multi-agent complexity. The StJohn setup
does not spawn agents endlessly. It uses agents only for distinct slices:
source map, desktop, phone, cloud/save, exports/package, and tests/scripts.

Status: covered.

### 3. Source-of-truth anchor

AI agents drift when they rely on stale context. StJohn now has a single anchor:

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`

It forces re-anchoring before zones, after time/tool thresholds, before bug-log
edits, and before live/cloud/export tests.

Status: covered.

### 4. Receipts, not vibes

Agent evaluation guidance emphasizes transcripts, outcomes, tests, and
evidence. StJohn requires every run to record commands, exit codes, evidence
paths, what was live-tested, what was code-traced, and what was not tested.

Status: covered.

### 5. Human gates

Guidance recommends human-in-the-loop gates for sensitive or high-risk actions.
StJohn treats Marie's real files, real accounts, packaging, destructive cleanup,
and plan closure as human-gated.

Status: covered.

### 6. Dedupe and state management

Multi-agent systems can create duplicate/conflicting state. StJohn requires a
bug-log search before any new item and forces overlapping bugs to update the
existing entry.

Status: covered.

### 7. Endpoint and cost control

Guidance warns that multi-agent context and cost can grow quickly. The StJohn
automation is bounded:

- every 4 hours
- 12 runs total
- one audit zone per run
- each run ends with the next safest zone

Status: covered.

### 8. Remaining Imperfections

- The monitor is still only as good as the real test assets Marie can provide.
- Live phone/cloud tests need a safe Supabase test account and copied test
  files.
- The monitor can identify risks, but fixes must happen in separate fix tasks.
- The docs still contain known drift; that is logged as
  `SAS-AUD-20260602-001`.

## Plan To Keep Improving The Monitor

1. First 12-run pass: let the automation complete one zone per run.
2. After run 4: review whether evidence is useful or too shallow.
3. After run 8: check whether bugs are being deduped correctly.
4. After run 12: write a campaign summary with:
   - zones covered,
   - confirmed bugs,
   - watchlist risks,
   - blocked tests,
   - Marie-only checks,
   - release risk.
5. Only after Marie reviews the campaign summary, decide whether to run a second
   shorter monitor pass or switch to fixing confirmed bugs.

