# TMolecule Lead-Magnet Uptime Monitor

A Cloudflare Worker that runs daily at 09:00 UTC and pings the lead-magnet
funnel on `wellness.tmolecule.com`. Sends a Resend email alert ONLY when a
check fails. Silent on healthy days.

## Checks (runs all 7 every day)

| # | Check | What it catches |
|---|---|---|
| 1 | `GET /` returns 200 | Pages outage, DNS, SSL |
| 2 | `GET /collagen-calculator/` returns 200 | Calculator page broken |
| 3 | `POST /api/calculate` returns valid score | Function deployment issue |
| 4 | `POST /api/subscribe` with bad body returns 400 | Function deployed and routing alive (no Brevo email used) |
| 5 | `GET /protocols/collagen-protocol-v1.pdf` >= 1 MB | PDF missing or corrupted |
| 6 | `GET /confirmed/collagen-protocol/` returns 200 | DOI redirect destination broken |
| 7 | `GET /unsubscribe/` returns 200 | Unsubscribe page broken |

The full Brevo round trip (DOI email send) is NOT checked daily — it would
consume a Brevo email credit per day. Test that manually when you suspect Brevo
issues by submitting through the calculator with a real email.

## Deploy

```bash
cd ~/tmolecule/uptime-monitor
npm install
npx wrangler deploy
```

## Set secrets (one-time)

```bash
npx wrangler secret put RESEND_API_KEY     # paste Resend API key
npx wrangler secret put RESEND_TO          # paste alert recipient email
```

## Manual test

Hit the worker URL once deployed:
```bash
curl https://tmolecule-uptime-monitor.<your-account-subdomain>.workers.dev/
```

Returns a JSON summary of all checks. Add `?alert=1` to also fire a test alert
email even when everything passes.

## Schedule

Daily at `0 9 * * *` (09:00 UTC, ~5am ET). Edit `crons` in `wrangler.toml` to change.

## Cost

Free tier covers everything: ~210 cron invocations/month, well under the 100K/day
Workers free limit. Resend free tier is 3K emails/month, so even daily failures
wouldn't approach the limit.
