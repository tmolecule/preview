# Jobs

Self-contained job specs that run via launchd → `run.sh` → `claude -p`.

## Pattern

Each job is a single markdown file (`<job-name>.md`) that fully describes:
- Why it exists
- What queries / API calls / actions to run
- Where to write the report
- Optional: how to email or otherwise distribute the result

When launchd fires, `run.sh <job-name>` invokes `claude -p` with the spec path. Claude reads the spec end-to-end and executes it — no separate prompt template needed.

## Marker file (one-shot guard, brand-namespaced)

After a successful run, `run.sh` writes `~/scripts/logs/.<brand>-<job-name>.completed` (e.g. `.tmolecule-llm-mentions-recheck.completed`). On subsequent invocations the runner sees the marker and exits cleanly. The brand prefix prevents collisions between WhollyKaw and TMolecule jobs that share a job name.

To re-arm a job, delete its marker file:
```bash
rm ~/scripts/logs/.tmolecule-<job-name>.completed
```

## Email delivery (Resend)

`send-report-email.py` is a generic helper that:
- Takes a markdown file path + subject + optional preamble
- Highlights any `## Action Items` / `## Recommended next moves` / `## Next moves` section in a yellow callout
- Converts headings, lists, bold, italic, links, code, and pipe tables to HTML
- Sends via Resend transactional API to `support@tmolecule.com` (override via `REPORT_TO_EMAIL`)

### Required setup

Create `~/.env.resend` with the Resend API key:
```
RESEND_API_KEY=re_...
```
The runner sources this file before invoking Claude, so the env var propagates through.

### Test without sending
```bash
DRY_RUN=1 RESEND_API_KEY=test python3 jobs/send-report-email.py path/to/report.md "Subject" "Preamble"
```

## launchd plist

Plists live outside this repo at `~/Library/LaunchAgents/com.tmolecule.<job-name>.plist`. Pattern:

```xml
<key>ProgramArguments</key>
<array>
    <string>/Users/voicecalls/tmolecule/worker-seo/jobs/run.sh</string>
    <string>job-name</string>
</array>
<key>StartCalendarInterval</key>
<dict>
    <key>Month</key><integer>5</integer>
    <key>Day</key><integer>16</integer>
    <key>Hour</key><integer>5</integer>
    <key>Minute</key><integer>0</integer>
</dict>
```

## Existing jobs

- `llm-mentions-recheck.md` — fires 2026-05-16 05:00 EDT. Re-checks AI mentions vs the 2026-05-02 baseline after the AI-SEO infrastructure deploy. Emails report to support@tmolecule.com.
