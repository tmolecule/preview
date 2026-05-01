# Calculator Traffic Plan - Drive 500+ submissions/month

Goal: get the Collagen Calculator from launch (0/mo) to **500-1000 submissions/month** by month 6, then evaluate whether to scale or kill.

## Funnel math (the assumptions everything hangs on)

```
Landing page visit
    -> 50% start the calculator         (UX target)
        -> 80% complete it              (5 inputs, low friction)
            -> 35% submit email         (gated PDF is a real reward)
                -> 60% confirm DOI      (Brevo deliverability target)
                    -> 3% buy Spice Rush within 14 days (sequence-attributed)
```

Net: **100 LP visits -> ~14 confirmed emails -> ~0.4 orders.**

For 500 emails/month, you need ~3,500 LP visits/month. That is the headline traffic number.

---

## Channel breakdown

### 1. Paid - Meta (Instagram + Facebook) - PRIMARY VALIDATION

**Why this first:** fastest signal on whether the funnel works. 2-week test tells you if the entire system has legs.

| Item | Plan |
|---|---|
| Audience | Women 35-65, US, interested in: collagen, ayurveda, supplements, skincare, wellness |
| Lookalikes | Skip until you have 100+ buyers in the seed set |
| Format | 4-second video showing calculator in use + carousel fallback |
| Hook angles to test | "Score your collagen routine in 60 seconds" / "The mistake 80% of collagen takers make" / "Why your collagen isn't working" |
| Landing | `/collagen-calculator/` directly (no warm-up page) |
| Realistic CPC | $1.20 - $2.50 (wellness audience) |
| Realistic CPL (email) | $6 - $12 |
| Test budget | $30/day x 14 days = **$420** |
| Expected emails | 35 - 70 from the test |

**Decision rule:** if CPL < $10 and email-to-purchase > 2%, scale to $50-100/day. If not, kill Meta and reallocate to channel 2.

### 2. Paid - Google Ads (Search) - HIGH-INTENT BACKBONE

**Why:** lower volume than Meta but the intent is *qualified*. People searching "collagen with tea" already believe in the category.

| Item | Plan |
|---|---|
| Match types | Phrase match, broad with negatives |
| Seed keywords | `collagen and tea`, `best time to take collagen`, `coffee block collagen absorption`, `collagen with coffee`, `optimal collagen routine`, `tea for skin elasticity` |
| Negatives | `vegan` (you are bovine/marine likely), `recipe`, `face cream`, brand names of competitors |
| Landing | `/collagen-calculator/` |
| Realistic CPC | $0.80 - $2.20 |
| Realistic CPL | $5 - $10 |
| Test budget | $20/day x 14 days = **$280** |
| Expected emails | 30 - 55 from the test |

**Decision rule:** any keyword under $8 CPL keeps spending; pause everything above $15.

### 3. Pinterest - SLOW BURN, COMPOUNDS

**Why:** your audience lives here. Pins have a long half-life (months, not hours like Instagram). Cheap to test.

| Item | Plan |
|---|---|
| Pin format | Vertical 1000x1500 |
| Volume | 5 pins/week, 4 weeks = 20 pins |
| Pin angles | "Score your collagen routine" / "Tea + collagen: the 7-day protocol" / "Why coffee + collagen is a mistake" / Recipe-style "Spiced collagen tea" |
| Boards to pin to | Your own first, then group boards: collagen, anti-aging, wellness, ayurveda, tea recipes |
| Cost | $0 organic (or $50-150 for Idea Pins boost) |
| Expected traffic by month 3 | 100 - 400/month from organic Pinterest |

**Decision rule:** if zero traffic by month 2, the pins are not getting clicks - test new hook angles, not new boards.

### 4. Reddit - VALUE FIRST, NEVER DROP THE LINK

**Why:** smaller volume but the highest-intent users in the funnel. Banned-fast if you spam.

| Item | Plan |
|---|---|
| Subreddits | r/30PlusSkinCare (1.2M), r/Supplements (760K), r/tea (500K), r/SkincareAddiction (2.6M), r/Ayurveda |
| Strategy | Comment helpfully on collagen threads. After 30+ comments and karma > 100, a single thoughtful original post per sub mentioning the tool |
| Cadence | 3-5 helpful comments/week, 1 original post/month per sub max |
| Cost | $0 |
| Expected traffic | 50 - 200/month from month 2 onwards |

**Decision rule:** if a post is removed by mods, do not repost. Adjust the format. Promotional language gets banned faster than links do.

### 5. Email - your existing list (if any) - CHEAPEST TEST

If you have any current email list (TMolecule launch list, WhollyKaw cross-list with permission, family/friends/founder network):

| Item | Plan |
|---|---|
| Send | One-off email: "I built a tool you might find useful" |
| Cost | $0 |
| Expected | 30 - 50% open, 5 - 15% click, 30 - 50% complete the calculator |
| Side benefit | Validates the funnel against a warm audience before you pay for cold |

**Decision rule:** if warm audience converts under 5% to email, the funnel itself has a problem - fix before paying for traffic.

### 6. SEO - learn.tmolecule.com - PLAYS THE LONG GAME

You already have a Workers SEO site. Two moves:

| Move | Effort | Payoff |
|---|---|---|
| Add internal link from every existing collagen/skin/anti-aging article -> calculator | 1 hour | Compounds |
| Write 5 new articles targeting calculator-adjacent keywords ("how to take collagen with tea", "best tea for skin", "collagen and coffee") | 5-10 hours per article + content writer cost | 3-6 months to rank |

Realistic SEO traffic by month 6: **100 - 300/month** if you ship 5+ articles in months 1-2.

### 7. Influencer micro-collabs - SKIP UNTIL MONTH 3

Wait until the funnel is proven. Then:
- Target: 5-10 micro-influencers in collagen/ayurveda/tea space (5K-50K followers)
- Offer: free Spice Rush + flat fee $50-200 + affiliate code
- Cost: $500-2000 budget for a 5-10 collab batch
- Realistic outcome: hit-driven, average is meh, one viral post can bring 1000+ in a week

---

## Phased rollout - 6 month plan

### Phase 1 - Validate (Month 1-2) - **Budget: $700 + time**
- [ ] Week 1: Send to existing list (if any), measure baseline funnel rates
- [ ] Week 2: Launch Meta test ($30/day) + Google test ($20/day)
- [ ] Week 2: Pin 5 Pinterest pins, start Reddit comment seeding
- [ ] Week 3-4: Read the data. Kill what is not working
- [ ] **Month 2 target: 200-400 calculator submissions**

### Phase 2 - Scale what works (Month 3-4) - **Budget: $1500-2500/mo**
- [ ] Double daily spend on the winning paid channel ($60-100/day)
- [ ] Ship 5 supporting SEO articles on `learn.tmolecule.com`
- [ ] Ramp Pinterest to 10 pins/week
- [ ] First influencer batch (5 micros, $500-1000 total)
- [ ] **Month 4 target: 400-700 calculator submissions**

### Phase 3 - Compound (Month 5-6) - **Budget: $2000-3500/mo**
- [ ] SEO articles start ranking - measure organic traffic
- [ ] Retarget calculator visitors who did not submit (Meta retargeting, ~$0.50 CPM)
- [ ] Repeat best Pinterest pins as Idea Pins
- [ ] Second influencer batch
- [ ] **Month 6 target: 500-1000 calculator submissions/month**

### Phase 4 - Decision point (End of Month 6)
Three honest outcomes:
1. **Working:** funnel is at 500+/mo, CAC is under LTV. Scale to $5K/mo paid + write 20 more SEO pages.
2. **Borderline:** 200-500/mo at break-even. Keep the calculator alive but pivot focus to Phase 2 lead magnets (goal stacks).
3. **Not working:** under 200/mo or CAC blown. Kill the paid spend, leave the page up for organic, redirect effort to a different lead magnet (the Find Your Ritual quiz has higher viral coefficient).

---

## Total cost summary

| Phase | Months | Paid budget | Other costs |
|---|---|---|---|
| 1 - Validate | 1-2 | $700 | Founder time |
| 2 - Scale | 3-4 | $4,000 | $500-1500 content writers, $500-1000 influencers |
| 3 - Compound | 5-6 | $6,000 | Continued content + retargeting tooling |
| **Total** | **6 mo** | **~$10,700** | **~$2,000-3,500** |

**Total 6-month investment to validate at scale: $13K-15K + founder time.**

## What this nets you (best case)

By month 6, if the funnel works:
- ~3,000 confirmed emails in the Collagen Calculator segment
- ~90 Spice Rush orders directly attributed (3% sequence conversion)
- ~$900 - $2,700 direct revenue (Spice Rush is $9.99 - higher with bundles)
- **Plus** the email list itself: at $1-3 per email of LTV in wellness, that is $3K-9K in pipeline value
- **Plus** SEO traffic that compounds for years
- **Plus** the calculator is a piece of brand IP that signals credibility forever

Worst case: you spend $13K, learn the calculator does not convert, and pivot to a different magnet. That is also a useful answer.

---

## What I would actually do tomorrow

If I were running this:
1. **Week 1:** ship the calculator live (deploy Pages, wire Brevo, set up the sequence)
2. **Week 1:** send to your existing list (even 50 people) - cheapest validation
3. **Week 2:** launch the $700 paid test, **but only after** the warm-list send confirms the funnel itself works
4. **Pause everything else** until you see 2 weeks of data

Spending paid before validating with warm traffic is how brands light $1000+ on fire learning something they could have learned for free.
