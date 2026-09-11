## 2026-09-11 21:33 KST (Turnstile cleanup)

Removed the unused initial `kitchensink4-contact` Turnstile widget after confirming the live site uses `kitchensink4-contact-live` (`0x4AAAAAAEwNtPCbz5fnrEza`). The live widget and Worker secret were left unchanged. Cloudflare API deletion returned success; no source or production route changes were made.
## 2026-09-11 (Turnstile contact protection enabled)

Cloudflare Turnstile was enabled on the production contact form. The managed widget is restricted to kitchensink4.ai and www.kitchensink4.ai. The public site key is embedded in contact/index.html; the private secret is stored only as the Worker secret TURNSTILE_SECRET and is not committed. The Worker config now sets TURNSTILE_ENABLED=true. Worker deployment version: a3bf379a-1eb8-4d2b-bbcb-12cb96241df6.

Verification: live /contact/ returned HTTP 200 and contained both the Turnstile script and widget site key; a tokenless POST to /api/contact returned HTTP 403 and did not send mail; Wrangler secret metadata showed RESEND_TOKEN and TURNSTILE_SECRET. Existing honeypot and KV rate limiting remain active. The unused initial widget was later removed; only the live widget remains.
# Storefront BUILD_LOG

## 2026-09-09 overnight ship-prep run (started as record; earlier history in git)

- Identity branches merged to main: fixture-swap, shop-dog, garden-card
  (design-pass was already an ancestor). Fixtures now faucet/brush/plug/sprig,
  sign-swing animation reduced-motion-guarded, shop-dog easter egg + page live
  in the tree.
- Three storefront gaps closed from the ratified draft 4: meta description,
  KitchenSink4PDF Backordered shelf, ONE TRIP WHOLE STORE family install
  section (#cart) with CHECKOUT masthead nav in 7 locales.
- Handle scrub applied (26 of 27 old-handle refs; residual = visitor badge
  page_id, author-gated). Aisle-card figures restamped to the stamped
  releases (word 2.1.0/1,842, ppt 1.2.0/141 tools/1,241, xl 1.1.0/1,294,
  web 1.0.0/2,065/52 tools) across 7 locales.
- Gates: i18n parity 7x67(+CHECKOUT) keys clean both pages, manual ship-gate
  greps clean (no placeholders, no em dashes, no local paths), headless
  renders clean, screenshots in Agent Results/20260909_storefront_build/.
- Final local main: 6e697f4. NOT pushed; goes live in the execution hour
  AFTER repo transfers (its links point at the KitchenSink4AI org).

##  (GO-LIVE)
- The storefront is LIVE at kitchensink4ai.github.io (org root site repo, full history, Pages from root). Old address serves a noindex signpost with a 2-second redirect plus per-aisle meta-refresh stubs.
- The one-line pip install went out true: co-install verified against the live index before the commit that restored it.

## 2026-09-09 20:13 (session close)
- Corporate homepage built at /preview/ (v16+, 15 design rounds): dark register, Oxanium, VC-audience, KitchenSink4AI brand. ROOT SWAP PENDING author Didymoi review.
- Fonts: oxanium-var.woff2 (12KB), geologica-var.woff2 (42KB, unused after all-Oxanium ruling), plexmono-400.woff2 (12KB, shell line only).
- Old address flipped to 2s auto-redirect.
- pip co-install line restored after ppt fastmcp3 migration.

## 2026-09-10 (contact live end to end, two new pages, the legal pass)

The contact form completed its pipeline: Resend domain verified (recreated
once after a poisoned verification backoff; same DKIM key, zero DNS changes),
the Worker's six-category battery delivered to all four mailboxes, and the
author confirmed all seven test mails. Masthead Contact link and the business
tile's "Reach the humans" link went live, plus the statusline and Didymoi
tiles gained whole-card links.

Two pages shipped: /didymoi/ (the patent teaser, author-blessed same day)
and /privacy/ ("Nothing much, on purpose." - every sentence verified against
the actual stack), with footer Privacy links on the landing family. The
legal pass replaced the overstated license line on every footer and the
service counter, rescoped the no-trackers claim to the products while the
visitor counters stayed by author order, de-absolutized the web tile's
safety copy, and moved the catalog fonts to /products/fonts (23 woff2,
zero Google-CDN requests). Locale sync retranslated the changed strings
across six languages in three passes, 100+ entries.

Figures restamped through the day as the releases landed: version badges to
2.1.2/1.2.2/1.2.2/1.0.1, PPT to 142 tools / 1,251 tests across all locale
number formats, Word to 1,846, Web to 20/53 tools and 2,066 tests. The
phone-width masthead defect (nav wider than a 390px viewport since the
Contact link) fixed on landing and contact pages with the Didymoi page's
tiers. Worker source homed in the repo under workers/contact/. Logged at 2026-09-10 18:13.
