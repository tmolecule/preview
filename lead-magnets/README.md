# TMolecule Lead Magnets

Cloudflare Pages project for templated lead magnets, starting with the Collagen Bioavailability Calculator.

See [docs/SPEC.md](docs/SPEC.md) for the full plan (Phases 1-4).

## Layout

```
lead-magnets/
  wrangler.toml                   Pages project config + R2 binding
  public/
    index.html                    Tools index
    collagen-calculator/
      index.html                  Phase 1 calculator
  functions/
    api/
      calculate.js                POST /api/calculate (deterministic scorer)
      subscribe.js                POST /api/subscribe (Brevo DOI trigger)
  data/
    goals.json                    Phase 2 source data (5 of 14 seeded)
    ingredients.json              Phase 3 source data (5 of 22 seeded)
  docs/
    SPEC.md                       Full spec
```

## Local dev

```
npm install -g wrangler
wrangler pages dev public --compatibility-date=2026-04-01
```

## Deploy (first time)

```
# 1. Create R2 bucket
wrangler r2 bucket create tmolecule-lead-magnets

# 2. Set secrets
wrangler pages secret put BREVO_API_KEY --project-name=tmolecule-lead-magnets

# 3. Push the PDF asset
wrangler r2 object put tmolecule-lead-magnets/collagen-protocol-v1.pdf --file=./assets/collagen-protocol-v1.pdf

# 4. First deploy
wrangler pages deploy public --project-name=tmolecule-lead-magnets

# 5. Wire custom domain (Cloudflare dashboard -> Pages -> custom domain)
#    Custom domain: wellness.tmolecule.com
```

## Pre-launch checklist

- [ ] Brevo: create list "Collagen Calculator" -> capture list_id -> put in wrangler.toml `BREVO_LIST_ID_COLLAGEN_CALC`
- [ ] Brevo: create DOI HTML template using `{{ doubleoptin }}` merge tag -> put template_id in wrangler.toml `BREVO_DOI_TEMPLATE_ID`
- [ ] Brevo: confirm `BREVO_REDIRECT_URL` matches the post-confirm route on this site
- [ ] R2: upload `collagen-protocol-v1.pdf`
- [ ] DNS: point `wellness.tmolecule.com` at Pages project
- [ ] Smoke test: submit calculator -> receive DOI email -> click -> land on protocol page
```
