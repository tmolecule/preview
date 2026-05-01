# TMolecule Collagen Calculator — Nurture Sequence

5-email Brevo automation triggered by DOI confirmation on the Collagen Calculator. Designed to convert calculator users into Spice Rush buyers, then graduate them to the long-term list.

## Audience snapshot at entry
- Already takes collagen (validated nutraceutical buyer)
- Engaged with a tool (higher intent than a blog opt-in)
- Self-segmented to skin/anti-aging/wellness goals
- Has a known score (A/B/C/D) and inputs in Brevo attributes:
  - `CALC_SCORE`, `CALC_GRADE`, `SOURCE`

## Sequence overview

| # | Day | Subject | Goal | CTA |
|---|-----|---------|------|-----|
| 0 | 0 | DOI confirmation | Confirm opt-in | `{{ doubleoptin }}` |
| 1 | 0+ | Your protocol + the one thing most miss | Deliver, first conversion | Try Spice Rush (welcome 15) |
| 2 | +2 | Why your morning tea matters more than coffee | Build authority | Soft - read the Learn library |
| 3 | +4 | From Calcutta, 1935, to your mug | Heritage trust | Try Spice Rush (welcome 15) |
| 4 | +7 | The 3 reasons people skip their collagen | Objection handling | Free shipping offer |
| 5 | +10 | One last thing about your routine | Last call, then graduate | Final offer + newsletter intro |

Recommended welcome discount: `WELCOME15` (15% first order). Free shipping fallback in email 4.

---

## Email 0 - Brevo DOI confirmation

This is the existing DOI template. Already specced. Subject:

> **Subject:** Confirm your free collagen protocol from TMolecule
> **Preview:** One click and your personalized protocol is on the way.

Body uses `{{ doubleoptin }}` per the lowercase HTML-mode merge tag (per `reference_brevo_doi_merge_tag.md`).

---

## Email 1 - Day 0 (immediately after DOI confirm)

> **Subject:** Your collagen protocol - and the one thing most people miss
> **Preview:** Your score: {{ contact.CALC_SCORE }}. Here is what to do with it.

Hi {{ contact.FIRSTNAME | default: "there" }},

Your collagen routine scored **{{ contact.CALC_SCORE }} out of 100** - grade {{ contact.CALC_GRADE }}.

The 7-day printable protocol is here: **[Download your protocol (PDF)](LINK_TO_R2_PDF)**

One thing the calculator could not tell you, but worth knowing: **the order matters more than the dose.**

Most people stack collagen, coffee, and a multivitamin in the same 10-minute window and wonder why the results are quiet. Spread the same ingredients across two cups - one warming, one settling - and the same dose works harder.

That is what the protocol fixes.

The other thing it fixes: the tea you mix it with. Black tea built on cardamom, cinnamon, and ginger makes the ritual something you actually look forward to - not a scoop of something dissolved in lukewarm water.

We built **Spice Rush** for exactly this. Real chai, milled-leaf, 30-second brew. Designed to take a daily collagen scoop without making it taste like one.

[Try Spice Rush - 15% off your first tin with code WELCOME15](LINK_TO_PRODUCT?discount=WELCOME15)

Tomorrow I will send you the morning ritual that took us four generations to settle on.

- The TMolecule Team
*Heritage since 1935*

---

## Email 2 - Day +2

> **Subject:** Why your morning tea matters more than your morning coffee
> **Preview:** Real caffeine, sustained - not jittery. The science of L-theanine.

Hi {{ contact.FIRSTNAME | default: "there" }},

Coffee gives you a spike. Tea gives you a curve.

The difference is **L-theanine** - an amino acid found almost exclusively in tea leaves. It crosses the blood-brain barrier, smooths the caffeine release, and extends the alert window from about two hours to four or five.

Translation: the same caffeine, fewer crashes.

This matters for your collagen routine because the morning window is when peptides absorb best - empty stomach, vitamin C cofactor, calm cortisol. Coffee tannins fight all three. Tea works with them.

If you are switching from coffee to tea (or just curious), the easiest start is a real chai - not the syrup-based kind. Cardamom, cinnamon, ginger, black tea. Brewed properly. Three thousand years of refinement.

We have a guide on how the chai ritual evolved from Ayurveda to your kitchen counter:

[Read: The Ayurvedic origin of chai >](LINK_TO_LEARN_ARTICLE)

No pitch today. Just the science.

- The TMolecule Team

---

## Email 3 - Day +4

> **Subject:** From Kerala, 1935, to your mug
> **Preview:** Four generations. The same nose test. The same standard.

Hi {{ contact.FIRSTNAME | default: "there" }},

In 1935, my great-grandfather walked the spice and tea routes of Kerala — birthplace of Ayurveda — with a small tin and a clear instruction from the family: *do not buy the lot unless it passes the nose test*.

That tin is now in our office. The nose test still holds.

Four generations later, the family business - PGP - still tastes every shipment, still rejects most lots, still sources from the same handful of estates. What changed is what we put in the blend.

Modern science has measured what the old Ayurvedic texts already knew: **cardamom for digestion. Cinnamon for blood sugar. Ginger for circulation. Black pepper to multiply curcumin.** The old recipes were pharmacology, before pharmacology had a name.

We built TMolecule to put it back. Spice Rush is the ancestral chai - milled leaf, full spice, real caffeine - with a daily scoop of collagen designed to fit in.

Ninety-one years in the making. Tin by tin, estate by estate.

[See Spice Rush - 15% off with WELCOME15](LINK_TO_PRODUCT?discount=WELCOME15)

- The TMolecule Team

---

## Email 4 - Day +7

> **Subject:** The 3 reasons people skip their collagen - and what we did about them
> **Preview:** Taste, timing, fit. Solved.

Hi {{ contact.FIRSTNAME | default: "there" }},

When people stop taking collagen, it is almost never about the ingredient. It is about the routine.

The three reasons we hear most:

**1. The taste.** Unflavored collagen in coffee makes the coffee feel slightly off. In water, it is forgettable. In a real spiced chai - it disappears, and the chai gets a little richer.

**2. The timing.** Coffee + collagen + multivitamin in one ten-minute scramble does not work. Splitting collagen into morning and evening doses, with the right beverage on each side, is what your protocol PDF lays out.

**3. The fit.** A scoop of powder you have to remember is friction. A daily ritual you look forward to is not. That is the whole point of building the routine around tea, not around the supplement.

If you have been on the fence about Spice Rush, this is the lowest-friction way to try:

[Free shipping on your first tin (no code needed) >](LINK_TO_PRODUCT?promo=freeship)

Offer holds for 72 hours.

- The TMolecule Team

---

## Email 5 - Day +10

> **Subject:** One last thing about your collagen routine
> **Preview:** Then we will stop pitching and start sending you the good stuff.

Hi {{ contact.FIRSTNAME | default: "there" }},

This is the last email about Spice Rush specifically. After this, you are on the regular TMolecule Learn list - one weekly email about tea rituals, brewing, sourcing, and the occasional new blend. No daily pitches.

If the protocol has been useful and you want to try the chai it is built around:

[Spice Rush + free shipping - last call (48 hours) >](LINK_TO_PRODUCT?promo=freeship)

If not - no offense taken. The protocol works with whatever black tea you already have.

A few things worth knowing as you settle into the routine:

- **Skin endpoints take time.** The studies that measured skin elasticity at 10g/day showed change at 8 to 12 weeks. Be patient.
- **Consistency beats dose.** 10g every day beats 20g three times a week.
- **Pair with sleep, sun, and protein.** Collagen does not work in isolation - it is a building block for what your body is already doing.

Welcome to the ritual.

- The TMolecule Team
*Be Well. Naturally.*

---

## Brevo workflow setup

**Trigger:** Contact added to list `Collagen Calculator` AND `OPT_IN = true`

**Workflow steps:**
1. Wait until DOI confirmed (Brevo handles automatically)
2. Send Email 1 (immediate)
3. Wait 2 days -> Send Email 2
4. Wait 2 days -> Send Email 3
5. Wait 3 days -> Send Email 4
6. Wait 3 days -> Send Email 5
7. Add to list `Learn Newsletter` -> remove from `Collagen Calculator`

**Exit conditions (any one removes from sequence):**
- Order placed (Spice Rush) - move to `Customers - Spice Rush`
- Unsubscribe
- Bounce/complaint

**Optional grade-based branching (advanced):**
- If `CALC_GRADE` is `A` -> skip Email 4 (they already have a good routine), send a "share with a friend" email instead
- If `CALC_GRADE` is `D` -> add an extra Email 1.5 with the simplest possible first-step ("just add lemon")

**Discount codes to create in Shopify:**
- `WELCOME15` - 15% off, first order only, expires 14 days after issue
- Free shipping promo - automatic via URL parameter `?promo=freeship` (Shopify Scripts or app like Bold)

**Personalization tokens used:**
- `{{ contact.FIRSTNAME }}` - capture in calculator email field if you add a name field
- `{{ contact.CALC_SCORE }}` - already passed in `attributes.CALC_SCORE`
- `{{ contact.CALC_GRADE }}` - already passed in `attributes.CALC_GRADE`
- `{{ doubleoptin }}` - DOI link, lowercase per existing reference

**Links to fill in before going live:**
- `LINK_TO_R2_PDF` - signed R2 URL or public R2 URL for `collagen-protocol-v1.pdf`
- `LINK_TO_PRODUCT` - `https://tmolecule.com/products/spice-rush-collagen-black-tea`
- `LINK_TO_LEARN_ARTICLE` - pick a chai-origin article from `learn.tmolecule.com`

## Metrics to watch

| Metric | Healthy benchmark | Action if below |
|---|---|---|
| DOI confirm rate | >55% | Improve subject line on Email 0 |
| Email 1 open | >45% | Test subject line variants |
| Email 1 click | >12% | Move PDF link higher |
| Sequence-attributed orders | >2% of opt-ins | Reduce friction on offer (free shipping > discount) |
| Unsubscribe rate per email | <0.8% | Reduce send frequency or soften pitch in 4 |

Test the funnel end-to-end with your own email before going live. Confirm: PDF downloads, discount code applies, Shopify order tag matches the segment for exit.
