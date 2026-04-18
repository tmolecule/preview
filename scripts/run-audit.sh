#!/usr/bin/env bash
# Run the TMolecule accessibility audit and email start + finish notifications.
# Usage: ./run-audit.sh  (called manually after publishes, or by monthly cron)
#
# Configure EMAIL_TO below — defaults to the TMolecule support inbox.

set -euo pipefail

EMAIL_TO="${AUDIT_EMAIL:-customer.care@whollykaw.com}"
DATE="$(date +%Y-%m-%d)"
TIME="$(date '+%Y-%m-%d %H:%M %Z')"
AUDIT_DIR="$HOME/tmolecule/audits"
REPORT_JSON="$AUDIT_DIR/axe-$DATE.json"
LOG_FILE="$AUDIT_DIR/axe-$DATE.log"

mkdir -p "$AUDIT_DIR"

send_email() {
  local subject="$1"
  local body="$2"
  # Use macOS Mail.app via AppleScript — reliable if Mail is configured.
  osascript <<EOF 2>/dev/null || true
  tell application "Mail"
    set newMessage to make new outgoing message with properties {subject:"$subject", content:"$body", visible:false}
    tell newMessage
      make new to recipient with properties {address:"$EMAIL_TO"}
    end tell
    send newMessage
  end tell
EOF
}

REPORT_NAME="Monthly Accessibility Audit — tmolecule.com"
REPORT_DESCRIPTION="Automated WCAG 2.1 Level AA accessibility scan of all public pages on tmolecule.com (Home, Shop, Product, Cart, About, Contact, Accessibility), run via axe-core v4.10. Flags violations by severity (critical / serious / moderate / minor) for color contrast, form labeling, ARIA usage, heading order, keyboard focus, landmarks, language attributes, and image alt text. Result saved as a dated JSON report for audit trail and regression tracking."

# --- START notification ---
START_BODY="Report: $REPORT_NAME

$REPORT_DESCRIPTION

— Run details —

Status:   STARTING
Time:     $TIME
Target:   https://tmolecule.com
Scope:    7 pages · WCAG 2.1 AA ruleset
Saved to: $REPORT_JSON
Log:      $LOG_FILE

A second email with the full per-page stats table will follow when the run finishes."

send_email "[Monthly a11y audit · STARTED] tmolecule.com · $DATE" "$START_BODY"

# --- Run audit ---
PATH="$HOME/Library/Python/3.14/bin:$HOME/.pyenv/shims:/opt/homebrew/bin:/usr/local/bin:$PATH"
python3 "$HOME/tmolecule/scripts/axe-audit.py" > "$LOG_FILE" 2>&1
EXIT_CODE=$?

# --- FINISH notification ---
END_TIME="$(date '+%H:%M %Z')"
FULL_LOG="$(cat "$LOG_FILE" 2>/dev/null || echo '(no log)')"

if [ $EXIT_CODE -eq 0 ]; then
  STATUS="PASS"
  STATUS_LINE="✓ PASS — 0 critical / 0 serious WCAG 2.1 AA violations across all pages"
else
  STATUS="FAIL"
  STATUS_LINE="✗ FAIL — critical or serious violations detected (see table below)"
fi

FINISH_BODY="Report: $REPORT_NAME

$REPORT_DESCRIPTION

— Run details —

Status:   FINISHED — $STATUS
Result:   $STATUS_LINE
Time:     $TIME → $END_TIME

— Per-page stats —

$FULL_LOG

— Artifacts —

JSON report: $REPORT_JSON
Log file:    $LOG_FILE

Next scheduled run: 1st of next month at 9:07 am local (via crontab)."

send_email "[Monthly a11y audit · FINISHED · $STATUS] tmolecule.com · $DATE" "$FINISH_BODY"

exit $EXIT_CODE
