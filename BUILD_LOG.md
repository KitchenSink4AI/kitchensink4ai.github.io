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
