# UK Tax & NI Calculator

Next.js (App Router) app that calculates UK tax across multiple income
types — employment, pension, self-employment, rental, savings
interest, dividends, and capital gains — for a chosen tax year and
region (rest of UK / Scotland), with Google sign-in and saved
calculation history.

## How the multi-income calculation works

HMRC taxes income in a fixed order, and this app follows it:

1. **Non-savings, non-dividend income** (employment + pension income +
   rental profit + self-employment profit, each after their own
   allowance/expenses — see below) is taxed first, using the personal
   allowance and the region-specific bands (rUK 20/40/45%, or
   Scotland's 6 bands).
2. **Savings interest** is taxed next. Any leftover personal allowance
   applies first, then the 0% starting-rate-for-savings band (up to
   £5,000, shrinking as non-savings income rises), then the personal
   savings allowance (£1,000 basic-rate / £500 higher-rate / £0
   additional-rate — based on *total* income across every source,
   including dividends, not just where non-savings income lands),
   then the standard savings rates.
3. **Dividends** are taxed last of the income tax components, after
   the £500 dividend allowance. Any foreign tax withheld on them (e.g.
   15% US withholding under the UK-US treaty) is then credited back
   via Foreign Tax Credit Relief — see below.
4. **Capital Gains Tax** is calculated separately from income tax
   (after the £3,000 annual exempt amount), using whatever basic-rate
   band space is left once steps 1–3 have used their share — 18% in
   the remaining basic-rate band, 24% above it.
5. **National Insurance** is two separate calculations: Class 1 on
   employment income only (8%/2%), and Class 4 on self-employment
   profit (6%/2%, same £12,570/£50,270 breakpoints). Pension income is
   deliberately excluded from both — NI is never charged on pensions,
   which is why it has its own input field rather than sharing
   Employment income. Class 2 isn't a real deduction any more (see
   Simplifications) so it's shown as an informational note, not a tax
   figure.

**Important quirk this app models correctly:** savings interest,
dividends, and Capital Gains Tax are *not* devolved — Scottish
taxpayers pay them at the same rates and thresholds as the rest of the
UK, even though their salary/rental/self-employment income uses
Scotland's separate income tax bands. Only step 1 above changes by
region.

### Simplifications (this isn't a substitute for professional advice)

- Rental income can use either the flat £1,000 property allowance or a
  user-entered itemized list of allowable expenses (letting agent fees,
  insurance, repairs, ground rent, etc.) — the calculator automatically
  applies whichever deducts more. **Mortgage interest is deliberately
  excluded** from that itemized list: since the 2020/21 "Section 24"
  changes, mortgage interest is no longer deductible from rental
  profit at all. Instead, it's entered as its own field and modelled
  correctly — as a flat-rate tax credit (`mortgageInterestReliefRate`
  in `tax_years`, 20% for 2025/26 and 2026/27) applied against the
  final income tax bill, capped at the lowest of the interest paid,
  the rental profit, and total taxable income above the personal
  allowance. This is the mechanism that actually costs higher-rate
  landlords more than basic-rate ones, since the credit rate doesn't
  scale with their marginal tax band.
- Self-employment income follows the identical allowance-vs-itemized
  pattern, using the £1,000 trading allowance instead of the property
  allowance. The **Class 1 + Class 4 "annual maximum" interaction is
  not modelled**: HMRC caps combined NI for anyone with both
  employment and self-employment income in the same year so they're
  not effectively taxed twice on overlapping income, via an
  apportionment calculation submitted through Self Assessment. This
  app calculates Class 1 and Class 4 independently, so someone with
  significant income from both sources may see a slightly higher
  combined NI figure here than their real Self Assessment bill.
- **Class 2 NI has no calculation at all**, deliberately: since the
  2024/25 abolition it's £0 whenever self-employment profit clears the
  Small Profits Threshold (simply "treated as paid" for State Pension
  purposes), and an optional flat weekly amount below it. The app
  shows this as an informational note in the results, never as a
  deduction from the total.
- **Rental losses, self-employment losses, and unused mortgage interest
  relief now all carry forward — manually, between separate
  calculations, not automatically across tax years.** Per PIM4210 (rental)
  and ITA 2007 s83 / BIM85060 (self-employment), a loss is relieved
  against the *first available* profit of the same activity in a later
  year, indefinitely, with any excess carrying forward again. Per
  PIM4460, unused finance-cost relief (when the 20% mortgage interest
  credit is capped below the full interest paid) works the same way.
  Three input fields — "Rental losses brought forward," "Self-employment
  losses brought forward," and "Unused finance costs brought forward" —
  let a user enter last year's carried-forward figures by hand; the app
  doesn't look these up automatically from a previous calculation, even
  a saved one, because it has no reliable way to confirm a saved
  calculation is actually for the *immediately preceding* tax year
  rather than some other year entirely — guessing wrong would silently
  double-count a loss, which is worse than not automating it at all.
  (Automatic carry-forward, done properly, is noted as a next step below.)
- **Foreign Tax Credit Relief only covers dividends, not capital gains,
  and no country-specific treaty rate cap is enforced.** Per HMRC's
  HS263, the credit is the *smaller* of the foreign tax withheld and
  the UK tax actually due on that same income — this app implements
  that cap, but not the separate treaty-rate cap (e.g. only 15% of a
  US dividend is really creditable under the UK-US treaty; if someone
  enters a higher figure, perhaps because they never filed a W-8BEN
  and 30% was withheld, the app doesn't automatically strip the excess
  down to 15% — it needs to be entered pre-capped). Capital gains on
  foreign shares have no equivalent field at all: the US doesn't tax
  non-residents on capital gains, so this hasn't come up yet, but a
  country that does would need its own foreign tax credit modelled
  separately, since HS263 requires each foreign gain to be calculated
  individually.
- **Capital losses are now modelled correctly, including the AEA-preservation quirk most calculators miss.** Per HMRC's Capital Gains Manual (CG21520 — validated against the department's own "Mr D" worked example): current-year losses must be deducted from current-year gains in full, no choice; brought-forward losses are then used only if a taxable amount still remains after the Annual Exempt Amount, and only down to the level of the AEA, never below it — this deliberately preserves as much of an old loss as possible for future years, since losses (unlike the AEA) never expire. Two fields — "Capital losses this year" and "Capital losses brought forward" — drive this; results show exactly how much of each was used and what's left to carry forward.
- **Private Residence Relief now covers the clean, full-relief case** —
  a gain from selling a property that was your only or main home for
  the *entire* period of ownership is fully exempt from CGT (TCGA
  1992 s222-226): it doesn't reduce the taxable gain, it simply isn't
  a chargeable gain at all, so it doesn't even use up any of the £3,000
  Annual Exempt Amount. This is genuinely most real-world home sales.
  **Partial relief is deliberately not modelled**: if any part of the
  ownership period doesn't qualify (a period let out, business use of
  part of the home, a period of non-qualifying absence), HMRC's actual
  calculation apportions the gain across qualifying and non-qualifying
  periods — a materially harder computation this app doesn't attempt.
  In that case the UI leaves the exemption checkbox unticked and taxes
  the whole gain as an ordinary chargeable gain, which will generally
  *overstate* the real bill (a conservative estimate, flagged clearly
  in both the input and the results, rather than a silent underestimate).
- Capital Gains Tax uses the post-October-2024 unified 18%/24% rates
  (same for property and other assets) — Business Asset Disposal
  Relief, Investors' Relief, and carried interest still aren't
  modelled.
- **Relief-at-source pension contributions and Gift Aid are now
  modelled**, via the mechanism HMRC actually uses: the net amount
  paid is grossed up (÷0.8, since basic-rate relief is added
  automatically) and the combined gross figure extends the basic and
  higher-rate bands — for income tax, savings, dividends, *and*
  capital gains, all of which measure position against the same
  basic/higher-rate boundary. The same grossed-up total also reduces
  "adjusted net income" for the £100k personal allowance taper test.
  **Critically, this only applies to "relief at source" pension
  contributions** (most personal pensions/SIPPs, some workplace
  schemes) — "net pay arrangement" contributions (most auto-enrolment
  workplace pensions) are deducted from pay *before* tax is
  calculated, so they're already reflected in whatever salary figure
  the user enters as Employment income, and must never also be entered
  in the new pension field — doing so would double-claim relief
  already received. The UI field copy warns about this explicitly, but
  the app itself has no way to detect or prevent the mistake if a user
  ignores the warning.
- **High Income Child Benefit Charge, student loan repayments, and
  Marriage Allowance are all now modelled.** HICBC tapers linearly
  between £60,000 and £80,000 of adjusted net income (confirmed
  against a real worked example: £76,000 income, £2,212.60 Child
  Benefit → £1,770.08 charge, matching exactly), using the same
  adjusted-net-income measure as the Personal Allowance taper. Student
  loans cover Plans 1/2/4/5 plus Postgraduate (9%/6% of income above
  each plan's threshold, thresholds confirmed current for both
  2025/26 and 2026/27 — Plans 1/2/4 moved between the two years).
  Marriage Allowance is a toggle that adds £1,260 to the recipient's
  own Personal Allowance; since this app only ever models one
  taxpayer, it can't verify the *transferring* spouse's own
  eligibility, but it does check whether the *recipient's* own income
  looks too high to qualify and shows a warning if so, rather than
  silently applying a transfer HMRC wouldn't actually allow.
- **A "What this calculator doesn't cover" dropdown** (`components/ExclusionsDropdown.tsx`,
  shown on the main page) explicitly lists every deliberate gap —
  Business Asset Disposal Relief, partial Private Residence Relief,
  the Class 1+4 NI cap, foreign tax credit on gains, non-UK residence
  status, Rent-a-Room Relief, capital allowances for vehicles, Pension
  Annual Allowance tapering, the Marriage Allowance transferor gap
  above, VAT/IHT/SDLT, and the manual-only carry-forward design — each
  with a plain-English reason and concrete advice on where to get
  proper help (a Chartered Accountant, a Chartered Tax Adviser, or a
  specific piece of HMRC guidance, depending on the topic).
- The personal allowance taper (£1 lost per £2 over £100k) is applied
  using total income across all streams except capital gains, which is
  a reasonable approximation of "adjusted net income" but not exact in
  every edge case.


## Stack

- **Next.js 16** (App Router, async route params)
- **MongoDB** — stores tax year rate tables, users/sessions (via the
  NextAuth adapter), saved calculations, and the general access
  allowlist
- **NextAuth** (Google provider, database sessions)
- **Stripe** (optional) — one-time pay-for-access, via hosted Checkout
  and a webhook; see "Setting up Stripe"
- **Tailwind CSS** for styling

## Important: there is no live HMRC "rates" API

HMRC's Developer Hub APIs are for Making Tax Digital / Self Assessment
submissions against an authenticated taxpayer's account — they don't
expose a simple "give me this year's tax bands" endpoint. Instead,
this app stores the published rate figures itself in the `tax_years`
Mongo collection and serves them from its own `/api/tax-years/[year]`
route. The published figures live in `scripts/rates-data.ts` (written to
Mongo by `scripts/seed.ts`), and **you'll need to update them each time
HMRC publishes new rates** (typically after the Spring/Autumn Budget) —
either by editing that file and re-running `npm run seed`, or through the
admin page below. There's no official feed to automate this
against.

## Saved calculations: full CRUD

Signed-in users get more than "save once and forget" — every saved
calculation can be edited or deleted, not just created and read:

- **Create** — "Save this calculation" after any result, same as before.
- **Read** — a "Your saved calculations" list appears once a user has
  at least one saved entry, showing tax year, region, net income, and
  save date for each.
- **Update** — clicking **Edit** on a saved entry loads its figures
  back into the form and switches the Save button to "Update saved
  calculation," which `PATCH`es that specific document (`/api/history/[id]`)
  instead of creating a new one. An amber banner makes it clear editing
  is in progress, with a "Start new instead" link to break out of it.
- **Delete** — removes a saved calculation permanently (`DELETE
  /api/history/[id]`), after a confirm dialog.

Every mutating operation on `/api/history/[id]` filters on `{ _id,
userId }` together, not `_id` alone — a user can only ever update or
delete their *own* saved calculations, and a mismatched id (wrong
owner or doesn't exist) returns an identical 404 either way, so no
information leaks about whether a given id belongs to someone else.

**One deliberate limitation, carried over from the brought-forward
loss/finance-cost fields:** editing a saved entry correctly restores
its own brought-forward figures (since you're correcting that exact
record), but the *generic* mount-time prefill — used when starting a
fresh calculation, not editing an existing one — still never
auto-fills those three fields. Same reasoning as before: the app has
no reliable way to know if the most recent saved entry is actually
last year's calculation or some other year's, and guessing wrong would
silently double-count a loss.

## Managing tax years without editing code

Once `ADMIN_EMAILS` is set and you're signed in with one of those Google
accounts, visit `/admin/tax-years`. It lets you:

- Pick an existing tax year to **copy figures from** — every field
  (personal allowance, all the income tax/savings/dividend/CGT/NI bands,
  for both rUK and Scotland) prefills with that year's actual values, so
  you're editing last year's real numbers rather than starting blank.
- Since HMRC freezes most thresholds most years, usually only a handful
  of fields need to change — the dividend rate rise for 2026/27 or a
  Budget-announced CGT change, for example — so most of a year's update
  is "copy from last year, tweak the two or three things that moved."
- Save writes straight to the `tax_years` collection (both the "uk" and
  "scotland" documents), the same place `scripts/seed.ts` writes to —
  so this page is really a UI on top of what the seed script does by
  hand.

This doesn't replace `scripts/seed.ts` — that's still useful for first-time
setup or bulk changes — but for the yearly Budget update, the admin page
is the faster path and doesn't require redeploying code. After any change
to the rates, run `npm run verify -- --db` (see below) to confirm the live
data still produces the right answers.

## Verifying the calculations

`npm run verify` runs the calculation engine through about 60 checks —
mostly published worked examples (HMRC, GOV.UK, gov.scot, LITRG), plus a
handful of constructed cases where no official example exists; the
validation guide lists the source for each and marks which is which. It
exits non-zero if any figure is off, takes a second, and needs no
database.

```bash
npm run verify              # checks scripts/rates-data.ts
npm run verify -- --db      # same checks against the LIVE tax_years collection
```

**`--db` mode also checks every document has every field the engine
needs.** This catches the classic mistake of deploying new code without
re-running `npm run seed`: instead of a runtime crash on a user's screen,
you get a message like `2026-27 (uk) — missing hicbc, studentLoan,
marriageAllowanceTransferable — run npm run seed`. It also runs a smoke
test on *every* year in the database (including any you've added on
`/admin/tax-years`), confirming all features together produce finite
numbers for that year.

**When to run it:**
- After changing anything in `lib/calculateTax.ts`.
- After a Budget update, whether you edited `rates-data.ts` and re-seeded
  or used the admin page.
- Before deploying, and after `npm run seed`.

**What a pass does and doesn't mean.** The published examples are for
2026/27, so a pass proves the engine still reproduces those figures —
it does not prove the rates you've just entered for, say, 2027/28 are
right. Those still need checking against that year's gov.uk figures.
Conversely, a failure right after changing a 2026/27 rate is often
*correct behaviour*: the published example was calculated with the old
rate. Read which check failed before assuming the engine is broken.

To add a check for a new scenario, add an `expectNumber(...)` line to
the relevant section of `scripts/verify.ts`, using a figure from an
official source rather than one produced by the app itself.

## Access control

The whole app — not just saving, and not just `/admin/tax-years` —
requires sign-in with an approved Google account. There are two
allowlists, with two different homes:

- **`ADMIN_EMAILS`** — an environment variable. Can reach
  `/admin/tax-years` (edit rates) and `/admin/access` (manage who's
  allowed). Changing this list means editing the variable and
  redeploying — deliberately, since admin status shouldn't be a click
  away from inside the app itself.
- **The `allowed_emails` collection** — managed from `/admin/access`
  (an admin adds someone by hand), or automatically by a successful
  Stripe payment if you've set that up (see "Setting up Stripe"
  below) — either way, no redeploy needed. Admins are always
  implicitly allowed (`isAdminEmail()` is checked first, before any
  database call), so an admin's address never needs adding here too.

**A fresh deployment starts locked down to admins only** — the
`allowed_emails` collection begins empty, and there's no "empty means
open to everyone" fallback. An admin signs in (always allowed) and
adds people from `/admin/access`, or waits for someone to pay; nobody
else can get in until one of those happens.

**Sign-in itself is deliberately NOT gated — only actual use of the app
is.** Anyone with a Google account can sign in and get a session; this
changed when pay-for-access was added, since someone who isn't allowed
yet needs to be able to sign in first (so the app has their
Google-verified email) before they can be shown a "buy access" screen
and pay to unlock it. What's still fully gated is everything that
matters: `app/page.tsx` and every API route (`/api/calculate`,
`/api/tax-years`, `/api/tax-years/[year]`, `/api/history`,
`/api/history/[id]`) call `isAllowedEmail()` fresh on every single
request — never assuming that "has a session" means "is allowed to use
this." `/api/checkout` is the one deliberate exception: it only checks
that you're signed in, not that you're already allowed, since letting
in not-yet-allowed people to pay is the entire point of that route.

**Why check on every request, rather than once at sign-in:** sessions
are database-backed with a multi-day lifetime. If access were only
checked once, at the moment of signing in, removing someone from
`allowed_emails` would do nothing until their session happened to
expire on its own — potentially weeks later. Checking fresh on every
request means removal takes effect on that person's very next request,
not whenever their old session finally lapses.

**What this doesn't do:** revoke an already-active session immediately.
Removing someone from `/admin/access` stops them the next time any
page or API route re-checks — in practice, on their very next request
— but doesn't forcibly end a session already in progress on their
machine. If you need someone cut off *instantly*, delete their row
from the `sessions` collection in MongoDB directly, or shorten
`session.maxAge` in `lib/auth.ts` (default: NextAuth's 30 days).

**Upgrading from an earlier version that used an `ALLOWED_EMAILS`
environment variable?** That variable is no longer read by the app at
all — `lib/admin.ts`'s `isAllowedEmail()` now queries the
`allowed_emails` collection instead. Run this once against your
existing database:

```bash
npm run migrate-allowed-emails
```

It reads whatever's currently in `ALLOWED_EMAILS` and adds each
address to the collection — safe to run more than once, and a no-op if
the variable was never set (in which case, just add people directly at
`/admin/access` instead). Afterwards you can remove `ALLOWED_EMAILS`
from `.env.local` and Vercel, or leave it there unused — nothing reads
it either way.

**`/admin/tax-years`** and its API route keep their own, unchanged
`isAdminEmail()` check — this feature doesn't touch either, since an
admin is always allowed by the new check too.

## Setting up Stripe (pay-for-access)

Entirely optional. Leave `STRIPE_SECRET_KEY` unset and the app behaves
exactly as the "Access control" section above describes — free,
admin-managed access only, no "Buy access" button anywhere. Set it (and
the other two Stripe variables) to let people pay their way onto the
allowlist without an admin having to do anything.

**How it works, in one sentence:** someone signs in, sees a "Buy
access" button if they're not already allowed, pays through a page
hosted entirely by Stripe (their card details never touch this app),
and a webhook — a request Stripe's servers send directly to yours —
adds their email to `allowed_emails` the moment the payment succeeds.

**The one thing worth understanding before anything else:** the
`/?payment=success` page someone sees after paying is just a friendly
message. It does **not** grant access by itself — if it did, anyone
could type that URL in manually and get in for free. The webhook
(`/api/webhooks/stripe`) is the only thing that actually grants access,
and it only accepts requests carrying a valid signature that only
Stripe knows how to produce (`STRIPE_WEBHOOK_SECRET`). This is why
setup has an extra step most tutorials with a simple "add a button"
framing skip over.

### 1. Create a Stripe account and get your test secret key

Sign up at [stripe.com](https://stripe.com) if you don't have an
account. **Stay in Test mode** (toggle top-right of the dashboard) for
everything below — test mode uses fake card numbers, moves no real
money, and is completely free to use as much as you like.

Go to **Developers → API keys** and copy the **Secret key** (starts
`sk_test_...`). Put it in `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_GBP=9.99
```

(`STRIPE_PRODUCT_NAME` is optional — see `.env.example` for what it
defaults to if you leave it out.)

### 2. Set up webhook forwarding for local testing

Your machine doesn't have a public URL, so Stripe can't send it
webhooks directly the way it can to a deployed site. Stripe's own CLI
tool solves this by forwarding real webhook events to your local
server:

1. Install it — see [Stripe's CLI install guide](https://docs.stripe.com/stripe-cli) for your OS (a single download, no account setup beyond what you did in step 1).
2. Run `stripe login` once, and follow the prompt to connect it to your account.
3. With your dev server running (`npm run dev`), in a **separate**
   terminal run:
   ```bash
   stripe listen --events checkout.session.completed --forward-to localhost:3000/api/webhooks/stripe
   ```
   **The `--events` flag is required on current CLI versions** (it
   wasn't on older ones) — without it you'll get `must specify events
   to forward using --events, --all-snapshot, or --all-thin` and the
   listener won't start at all. `checkout.session.completed` is the
   only event this app's webhook handler acts on, so naming it
   specifically (rather than `--all-snapshot`, which forwards every
   event type Stripe has) keeps the terminal output relevant.
4. It prints a webhook signing secret starting `whsec_...` — put that
   in `.env.local` as `STRIPE_WEBHOOK_SECRET`. **This is a different
   secret from the one you'll use in production** — the CLI generates
   its own for local forwarding, separate from the one the Stripe
   dashboard gives you for a real deployed endpoint (step 5 below).
5. Restart `npm run dev` so it picks up the new environment variable.
   Leave `stripe listen` running in its own terminal for the rest of
   your testing.

### 3. Test a payment end to end

1. Sign in with a Google account that ISN'T already on your allowlist
   (or temporarily remove yourself from `/admin/access` to test as a
   non-admin — remember to add yourself back afterwards).
2. You should see a "Buy access" button with your configured price.
3. Click it, and use Stripe's standard test card:
   **`4242 4242 4242 4242`**, any future expiry date, any 3-digit CVC,
   any postcode. This is a real, working test card number Stripe
   publishes specifically for this — it will never charge anything or
   work outside test mode.
4. After paying, you're redirected back with a "payment received"
   message. In the terminal running `stripe listen`, you should see
   the `checkout.session.completed` event logged.
5. Refresh the page — you should now see the calculator, not the buy
   screen.
6. Check `/admin/access` — the email should appear with a green "Paid
   £9.99" badge (or whatever price you set).

If step 5 doesn't unlock access, check the `stripe listen` terminal for
an error, and see "Troubleshooting" below.

### 4. Going live: production webhook and live-mode keys

Test mode and live mode are entirely separate in Stripe — separate API
keys, separate webhook configuration, separate everything. Test mode
proves the *code* works; this step is what actually takes real
payments.

1. In the Stripe dashboard, go to the **Webhooks** tab under
   **Workbench**, then click **"+ Add destination"**. (Stripe renamed
   "webhook endpoints" to "event destinations" as part of this newer
   Workbench interface — same feature, newer name. You may also see
   an entry here for your local `stripe listen` CLI session, listed
   alongside real destinations since Workbench treats "local listener"
   as one of several destination types — that's not something you
   created and can be ignored; it's just your earlier local testing.)
2. Work through the short wizard: event source **"Your account"**,
   destination type **"Webhook endpoint"**, event
   `checkout.session.completed` specifically (no need to send every
   event type), and the URL
   `https://your-production-domain/api/webhooks/stripe`.
3. Once created, that destination's own page shows its signing secret
   (`whsec_...`) — different again from your local CLI one. Add it to
   Vercel's environment variables as `STRIPE_WEBHOOK_SECRET`.
4. Toggle the Stripe dashboard **out of Test mode**. Go to Developers →
   API keys again — you'll see a *different* secret key here, starting
   `sk_live_...`. Add that to Vercel as `STRIPE_SECRET_KEY`, replacing
   the test one.
5. Add `STRIPE_PRICE_GBP` (and `STRIPE_PRODUCT_NAME` if you set one) to
   Vercel too.
6. Redeploy, then make one real, small payment yourself to confirm the
   whole path works with real money before telling anyone else it's
   live.

### Where to check if something goes wrong

In the Stripe dashboard, Workbench → Webhooks → click your destination
shows every delivery attempt, its response code, and — critically —
the full response body your server sent back, which is usually enough
to diagnose a problem without needing to reproduce it. This works in
both
test and live mode independently.

## Getting started


1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env file and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   - `MONGODB_URI` — an Atlas connection string (or self-hosted)
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — `http://localhost:3000` for local dev
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
     Add an OAuth 2.0 Client ID (Web application) with authorized
     redirect URI: `http://localhost:3000/api/auth/callback/google`
     (and your production URL once deployed).
   - `ADMIN_EMAILS` — your Google account email (comma-separate more
     than one), so you can access `/admin/tax-years` and `/admin/access`.
     There's no separate variable for general access anymore — once
     you're signed in as an admin, add other people at `/admin/access`.
     See "Access control" below.
   - The `STRIPE_*` variables are optional — leave them unset for now.
     See "Setting up Stripe" below when you're ready for pay-for-access.

3. Seed the tax rate data:

   ```bash
   npm run seed
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`.

## Project structure

```
app/
  page.tsx                        # main UI shell (sign-in gate, buy-access screen + calculator)
  layout.tsx                      # root layout + SessionProvider
  admin/tax-years/page.tsx        # admin: manage rate tables (ADMIN_EMAILS gated)
  admin/access/page.tsx           # admin: manage who can use the app (ADMIN_EMAILS gated)
  api/
    auth/[...nextauth]/route.ts   # NextAuth handler
    tax-years/route.ts            # GET: list available tax years (allowed users only)
    tax-years/[year]/route.ts     # GET: rates for one year (allowed users only, async params)
    calculate/route.ts            # POST: run a calculation (allowed users only)
    history/route.ts              # GET/POST: list + create saved calculations (allowed users only)
    history/[id]/route.ts         # PATCH/DELETE: update or remove one saved calculation (allowed users only)
    admin/tax-years/route.ts      # GET/POST: manage rate docs (admin only)
    admin/allowed-emails/route.ts # GET/POST: list + add allowed users (admin only)
    admin/allowed-emails/[id]/route.ts  # DELETE: remove an allowed user (admin only)
    checkout/route.ts             # POST: start a Stripe Checkout session (signed-in users only, not gated on isAllowedEmail)
    webhooks/stripe/route.ts      # POST: Stripe's server calls this — the only thing that actually grants paid access
components/
  TaxCalculatorForm.tsx           # form + results UI + saved-calculations list (client component)
  AuthButton.tsx                  # Google sign-in/out button
  AdminTaxYearForm.tsx            # admin rate-editing form, copy-from-year prefill
  AdminAccessForm.tsx             # admin form for adding/removing allowed users, shows paid badges
  BuyAccessButton.tsx             # starts the Stripe Checkout flow
  BandListEditor.tsx              # reusable threshold/rate list editor
  ExclusionsDropdown.tsx          # "what this doesn't cover" reference panel
lib/
  mongodb.ts                      # Mongo client singleton
  db.ts                           # configurable database name (MONGODB_DB_NAME)
  auth.ts                         # NextAuth config — sign-in itself is open to any Google account; access is gated elsewhere
  admin.ts                        # ADMIN_EMAILS check + database-backed general allowlist (incl. paid entries)
  stripe.ts                       # Stripe client singleton + price/product config helpers
  calculateTax.ts                 # pure multi-income tax, NI & CGT calculation logic
scripts/
  rates-data.ts                   # the published rate figures (typed as TaxYearRates[])
  seed.ts                         # writes rates-data.ts to the tax_years collection
  verify.ts                       # checks the engine against published examples
  migrate-allowed-emails.ts       # one-time: old ALLOWED_EMAILS env var → allowed_emails collection
```

## Troubleshooting

**I can't reach the calculator, or I've locked myself out.** Sign-in
itself always succeeds for any Google account — if you're stuck, it's
the *allowlist* check, not sign-in, that's blocking you. If you're an
admin (your email is in `ADMIN_EMAILS`), you're always allowed —
double-check the environment variable is actually set on whichever
deployment you're testing (local vs Vercel can easily differ), and
that you signed in with the matching Google account. If you're not an
admin, ask an admin to add your email at `/admin/access`, or use the
"Buy access" button if you've set up Stripe — there's no self-service
admin override.

**"You're signed in as [email], but that account doesn't have access
yet."** Working as intended — that email isn't in `ADMIN_EMAILS` or
the `allowed_emails` collection. An admin can add it at
`/admin/access` (takes effect immediately, no redeploy needed), or, if
you've configured Stripe, the person can pay for it themselves.

**Stripe: the "Buy access" button doesn't appear at all.**
`STRIPE_PRICE_GBP` (or `STRIPE_SECRET_KEY`) isn't set — this is
deliberate graceful degradation, not a bug: see "Setting up Stripe"
above. Check `.env.local` (or Vercel's environment variables for a
deployed instance) has both set.

**Stripe: payment goes through, but access doesn't unlock.** This
almost always means the webhook never reached your server, or its
signature check failed. Check:
- Locally: is `stripe listen --events checkout.session.completed --forward-to localhost:3000/api/webhooks/stripe`
  actually running in its own terminal, and does `STRIPE_WEBHOOK_SECRET`
  match what *that* command printed (not a dashboard one)?
- In production: in the Stripe dashboard, Workbench → Webhooks →
  your destination shows every delivery attempt and the exact response
  your server sent back — this is the fastest way to see what actually
  went wrong, rather than guessing.
- A common mistake: using the test-mode webhook secret in a live-mode
  deployment, or vice versa — they're different values even for the
  same endpoint URL.

**`stripe listen` fails with "must specify events to forward using
--events, --all-snapshot, or --all-thin".** A behaviour change on
current Stripe CLI versions — older versions defaulted to forwarding
every event type if you didn't specify any; current ones refuse to
start at all until you do. Add `--events checkout.session.completed`
(the only event this app's webhook handler uses) to the command, as
shown in "Setting up Stripe" above.

**Windows: `stripe` (or any other freshly-installed command) isn't
recognized, even right after `winget install` succeeds.** `winget`
doesn't always add the install folder to your PATH, and even when it
does, an already-open terminal won't see the change — only a genuinely
new one will. If a brand-new terminal still doesn't recognize it,
`winget install` again with an unchanged package (or `winget list
<package>`) still confirms the program IS actually installed — the
problem is specifically that PowerShell doesn't know where to look for
it, not that the install failed. Find the real install folder (often
under `%LOCALAPPDATA%\Microsoft\WinGet\Packages\...`) and add it to
your PATH via Windows' own "Edit environment variables for your
account" dialog, rather than trying to fix it from inside PowerShell —
a typo in a PowerShell-based PATH edit can corrupt the whole variable.

**The "Manage tax years" link is missing right after signing in, but
appears after signing out and back in.** Both `app/page.tsx` and
`app/admin/tax-years/page.tsx` now set `export const dynamic =
"force-dynamic"` specifically to prevent this — without it, Next.js
can occasionally serve a cached copy of the page rendered before you
signed in, since the session check happens several calls deep inside
`getServerSession()` rather than in a way Next.js is guaranteed to
detect as dynamic on every version. If you still see this after
pulling the latest code, the next thing to check is `lib/auth.ts`'s
`session: { strategy: "database" }` — with database sessions, the very
first request right after the OAuth callback needs NextAuth's session
document write to Mongo to be visible before it's read back, and on
rare occasions that read can lose the race. Switching to `strategy:
"jwt"` would remove that possibility entirely (the session is decoded
straight from the cookie, no database round-trip), at the cost of
losing the ability to instantly revoke a session server-side.

**Want to change the app icon?** It's generated, not hand-drawn — a
brand-blue rounded square with a white "£". Regenerate at any size
with `python3 make_icons.py` (needs Pillow: `pip install pillow`) if
you ever want a different design; the source script isn't included in
this zip since it's a one-off build tool, not part of the running app.
The four files it produces: `app/icon.png` and `app/apple-icon.png`
(Next.js's file-based favicon/Apple-touch-icon convention — no extra
config needed, just having the files there is enough), plus
`public/icons/icon-192.png` and `icon-512.png` (referenced by
`public/manifest.json` for PWA/Android home-screen use).

**I need the database name to be something other than `tax_calculator`**
(e.g. it collides with an existing database in the same MongoDB
cluster). Set `MONGODB_DB_NAME` in `.env.local` to whatever you want —
every part of the app (API routes, NextAuth, and `scripts/seed.ts`)
reads from that single constant (`lib/db.ts`) rather than hardcoding
the name, so this is the only place you need to change it. Note that
the database name at the end of your `MONGODB_URI` is cosmetic and
ignored — the app always explicitly selects the database via
`MONGODB_DB_NAME`, regardless of what's in the connection string.

**Google sign-in throws `Cannot read properties of null (reading 'useState')`
in `SessionProvider`.** This project pins `next-auth` v4, which has a known,
currently-unresolved compatibility bug with React 19 — the fix isn't to
upgrade next-auth (v5 has its own Next.js 16 rough edges as of this
writing) but to make sure React itself is pinned to `18.3.1`, not `19.x`.
Run `npm ls react react-dom` — if either shows `19.x`, delete
`node_modules` and your lockfile, confirm `package.json` has exact
(non-caret) `"react": "18.3.1"` and `"react-dom": "18.3.1"`, and reinstall.
Next.js 16 still supports React 18 (deprecated, but supported), so this
is a safe, deliberate choice here rather than a temporary workaround.

**`npm install` fails with an `ERESOLVE` peer dependency error mentioning
`mongodb-adapter`.** This project uses `@auth/mongodb-adapter` (the
current, maintained package). If you're seeing this, check you haven't
got the old `@next-auth/mongodb-adapter` in your `package.json` — that
package was abandoned at v1.1.3, which only supports the MongoDB driver
v4/v5, and conflicts with the v6 driver this project uses. The fix is
switching to `@auth/mongodb-adapter`, not forcing the install with
`--legacy-peer-deps` — that flag would install successfully but leave
you on the outdated, incompatible adapter underneath.

## Deploying (Vercel)

1. Push this repo to GitHub/GitLab/Bitbucket and import it in Vercel.
2. Add the same environment variables from `.env.local` in the Vercel
   project settings (set `NEXTAUTH_URL` to your production domain).
   **Double-check `ADMIN_EMAILS` is set** — without it, nobody can
   *use* the calculator, including you (sign-in itself always works;
   it's the allowlist check afterwards that would block everyone),
   since general access now starts locked down to admins only until
   one of them adds people at `/admin/access` (a step you'll need to
   do once, after deploying).
3. In MongoDB Atlas, allow network access from Vercel (either
   `0.0.0.0/0` for simplicity, or Atlas's Vercel integration for
   scoped access).
4. Add your production callback URL in Google Cloud Console:
   `https://your-domain.vercel.app/api/auth/callback/google`.
5. Run `npm run seed` against your production `MONGODB_URI` (locally,
   pointed at the prod database) to populate rate data — and again
   whenever a release adds new rate fields.
6. Run `npm run verify -- --db` against that same database to confirm
   every document is complete and the figures check out.
7. **Upgrading an existing deployment that used `ALLOWED_EMAILS`?** Run
   `npm run migrate-allowed-emails` (see "Access control" above) once,
   against the same production database.
8. **Using Stripe?** Set up the production webhook and live-mode keys
   — see "Setting up Stripe" above, step 4. Easiest done after your
   first deploy, once you have a real domain to point the webhook at.
9. Deploy.
10. Sign in as an admin and add anyone who isn't an admin at
    `/admin/access` — a fresh deployment allows nobody but admins until
    you do.

## Notes / next steps

- Extend `calculateTax.ts` if you want to model further adjustments:
  student loan repayments, pension contributions (which extend the
  basic/higher-rate bands), salary sacrifice, or marriage allowance.
- **Automatic carry-forward** (rather than the current manual
  brought-forward input fields) is a natural next step for signed-in
  users: look up the saved calculation for the specific immediately-
  preceding tax year (matching `taxYear` strings sequentially, e.g.
  `"2025-26"` → `"2026-27"`) and prefill all three brought-forward
  fields from its carried-forward output. Deliberately not built yet —
  see the Simplifications note on why guessing the wrong "last"
  calculation would be worse than not automating it.
- The `calculations` collection has no automatic cleanup — add a TTL
  index if you don't want history to grow unbounded.
- If you need Business Asset Disposal Relief or separate CGT asset
  types again, add a `capitalGains.badrRate` field to the schema and
  a UI toggle — the current model assumes the standard 18%/24% rates.
