---
name: cinachain-design-system
description: Apply the cinachain design system when building or restyling any UI in this repo (Next.js app under app/, the portal/ Vite site, components/, marketing/docs pages). Use whenever the user creates or edits components, pages, layouts, buttons, cards, forms, badges, gradients, or asks for color/typography/spacing/radius/shadow choices, look-and-feel, visual consistency, copy casing, or "make it match the rest of the app" — even without saying "design system". Covers Vercel/Geist-inspired neutrals, sentence-case vs uppercase rules, font-weight caps, pill vs sm radius, mesh/brand gradient usage, elevation levels, and Do's/Don'ts. Token VALUES live in design/tokens.json; this skill is the judgment layer on top.
---

# Cinachain Design System

The brand's visual language is Vercel/Geist-inspired: near-white canvas, ink-near-black primary, a multi-color mesh gradient as the only decoration, a geometric sans (Inter as the Geist substitute) for everything narrative, and a monospaced face (Roboto Mono) for technical labels.

**Token values are NOT memorized here.** The single source of truth for colors / spacing / radius / type scale / shadows is `design/tokens.json`. This skill is the **judgment layer** — when to use which token, and the rules that are easy to get wrong (casing, weight caps, gradient usage).

## When to use
- Creating or editing any UI in this repo: `app/` (Next.js DApp), `portal/` (Vite marketing site), `components/`, marketing/docs pages.
- Choosing colors, fonts, sizes, radii, shadows, spacing.
- Writing or reviewing UI copy (button labels, headings, card titles, list items, badges).
- "Make it match the rest of the app" / visual-consistency questions.

## Do NOT use for
- Pure backend, smart contracts, data models, scripts with no visual output.
- Anything outside this repo — the tokens are cinachain-specific.

## Source of truth
- **Token values**: `design/tokens.json` (`color` / `semantic` / `spacing` / `radius` / `typography` / `shadow` / `breakpoint` / `layout`). Read it for exact hex/px/weight — never hardcode a value from memory.
- **Generated CSS** (do NOT hand-edit): `portal/design-tokens.css`, `styles/generated/design-tokens.css` — regenerated from tokens.json via `scripts/generate-design-tokens.mjs`.
- **Full rules & rationale**: `references/design.md` (the complete design-analysis document). Read it when the condensed rules below are ambiguous or you need the "why".
- **Motion constants**: `config/design.ts` (`FADE_IN` / `FADE_UP` / `FADE_DOWN`).

## Before writing UI code, confirm
1. Every color/size/radius/shadow value resolves to a token in `design/tokens.json` (or a Tailwind utility backed by one). No invented hex.
2. Copy casing follows the **Case** rule below — the #1 source of drift.
3. Any gradient is the allowed brand mesh — never a generic purple/blue AI-default gradient.
4. Font weight ≤ 600.

## Rules

### Case (most important — this is where drift happens)
**Sentence-case is the default for all narrative copy.**
- **Headings (h1–h4), button labels, card titles, CTA links, list items, form labels, status/role tags**: sentence-case — capitalize only the first letter of the phrase, the rest lowercase. End sentence-style headlines with a period ("A growing ecosystem.", "Built incrementally.", "Built by cinagroup.").
- **`text-transform: uppercase` is allowed ONLY on mono technical labels** — section eyebrows, footer column titles, stat labels — and these MUST use the mono face (`font-mono-tech` / Roboto Mono). Never put `uppercase` on body copy, headings, or buttons.
- **Allowed exceptions (do NOT "correct" these)**:
  - CamelCase brand words: `CinaChain`, `CinaBadge`, `CinaMega`, `CinaCredit`.
  - All-lowercase brand word: `cinagroup` (always lowercase — matches `github.com/cinagroup`).
  - All-caps acronyms: `ERC-721`, `ERC-1155`, `ERC-20`, `IPFS`, `USDC`, `NFT`, `API`, `CDP`, `RPC`, `URI`, `SIWE`.
  - Hyphenate token standards: `ERC-721` (not `ERC721`).
  - Brand term: `DApp` (cinachain's NFT application — retained as-is in nav links, headings, and the site title).
- **Anti-patterns — these Title-Case strings are WRONG**:
  - ❌ "Gasless Minting" → ✅ "Gasless minting"
  - ❌ "Smart Wallet" → ✅ "Smart wallet"
  - ❌ "View Collection" / "View Badges" → ✅ "View collection" / "View badges"
  - ❌ "Connect Wallet" / "Sign In" / "Sign Out" → ✅ "Connect wallet" / "Sign in" / "Sign out"
  - ❌ "Mint Your First NFT" → ✅ "Mint your first NFT"
  - ❌ "In Progress" → ✅ "In progress"
  - ❌ "Core Team" / "Brand & Community" → ✅ "Core team" / "Brand & community"
  - ❌ "Contract Address" / "Token Standard" → ✅ "Contract address" / "Token standard"

### Typography
- Two faces only: **Inter** (geometric sans, weights 400/500/600) for display/body/button/link; **Roboto Mono** (weight 400) for code + technical labels.
- **Weight 600 is the display ceiling.** Never 700/800/bold. Display = 600, buttons = 500, body = 400.
- **Negative tracking is part of the voice.** Display sizes use aggressive negative letter-spacing — use `.font-display` (sets `-0.05em`) or `tracking-tight`. Default/positive tracking on a heading breaks the brand.
- Body paragraphs are NEVER set in mono. Mono is for code blocks, terminal mockups, and the eyebrow/stat/footer-label technical layer.
- Type scale (exact values in `tokens.json` → `typography`): `displayXl` 48 → `displayLg` 32 → `displayMd` 24 → `displaySm` 20 → `bodyLg` 18 → `bodyMd` 16 → `bodySm` 14 → `caption`/`code` 12–13.

### Colors
- **Primary / ink** (`#171717`): the single black-ink CTA color and default text on light surfaces.
- **Surfaces cycle**: `canvas` (#fff, cards) → `canvas-soft` (#fafafa, page body) → `canvas-soft-2` (#f5f5f5, insets) → `primary` (#171717, polarity-flipped dark band). The dark band IS the depth cue between sections.
- **Link** `#0070f3` (and `linkDeep` pressed, `linkBgSoft` soft fill). Success reuses link blue.
- **Status colors**: error/warning each have base/soft/deep triples — pick the right step (`soft` = background fill, `deep` = pressed/strong).
- **Do NOT introduce a new accent color.** The palette is ink + grays + the brand gradient pairs. `violet` / `cyan` / `highlight-pink` belong to the brand gradient and marketing moments, not generic UI accents.

### Brand mesh gradient
- The three stop-pairs (`develop` blue→teal, `preview` violet→pink, `ship` coral→amber) form ONE multi-color mesh gradient.
- Use at **hero scale only** as an atmospheric backdrop. Never miniaturize to an icon, never reduce to a single stop, never reorder. It IS the decoration system.
- Apply via the `.mesh-gradient` utility (already defined in `portal/src/styles.css`).

### Shapes (radius)
- `pill` (100px): marketing-scale CTAs. `pill-sm` (64px): tab pills.
- `sm` (6px): in-app/nav buttons, form inputs. `md` (8px): feature/template cards. `lg` (12px): pricing/large cards. `xl` (16px): largest card chrome. `full` (9999px): icon containers, ghost nav pills.
- **Do not mix `pill` (100px) and `sm` (6px) button scales on the same screen** — pick one scale per surface.

### Spacing & layout
- Base unit 4px; every value is a multiple of 4. Use the `xxs`…`section` scale (`tokens.json` → `spacing`), never arbitrary px.
- Page width 1400px (`layout.pageWidth`); gutters 24px desktop / 16px mobile.
- Marketing bands: `4xl`–`5xl` vertical padding; hero stretches to `section`. Cards: `lg`–`xl` interior.

### Elevation
- Stacked shadows only (multiple small offsets + inset hairline ring) — levels 1–5 in `tokens.json` → `shadow`.
- Never a single heavy drop-shadow. Level 1 = inset hairline (default card edge); Level 5 = modal/dropdown.
- Tailwind map: `shadow-vercel-sm`/`-card` (level 2), `-md` (3), `-lg` (4), `-modal` (5), plus `elevation-1`…`elevation-5`.

### Components
- **Buttons**: `button-primary` (ink pill, white text) + `button-secondary` (white pill) paired in marketing bands. Nav-scale: `button-primary-sm` / `-secondary-sm`.
- **Cards**: `card-marketing` (md radius, lg pad), `card-marketing-large` (lg radius, xl pad), `card-soft` (canvas-soft). Featured pricing tier polarity-flips to `primary` background.
- **Eyebrows / footer titles / stat labels**: mono face + `uppercase` + `tracking-wider` + `text-xs`. This is the ONLY place `uppercase` appears.

### Motion
- Use the `config/design.ts` constants (`FADE_IN` / `FADE_UP` / `FADE_DOWN`). Always respect `prefers-reduced-motion`.

## Do's and Don'ts

**Do**
- Reserve `primary` (#171717) for primary CTAs — black ink IS the conversion target.
- Sentence-case all narrative copy; period-terminate sentence-style headlines.
- Negative-track every display heading.
- Use the mesh gradient at hero scale only.
- Stack shadows + inset hairline for elevation.
- Cycle surfaces canvas-soft → canvas → primary for section depth.

**Don't**
- Don't Title-Case buttons/cards/headings ("View Collection" ❌ → "View collection" ✅).
- Don't render headings in all-caps outside mono labels.
- Don't promote the sans beyond weight 600.
- Don't introduce a sixth accent color or a generic purple/blue AI gradient.
- Don't set body paragraphs in mono.
- Don't miniaturize the mesh gradient or reduce it to one color.
- Don't mix `pill` (100px) and `sm` (6px) button radii on the same screen.

## Self-check before finishing
- [ ] Every color/size/radius/shadow comes from `design/tokens.json` (or a token-backed utility) — no invented values.
- [ ] All headings/buttons/card-titles/list-items are sentence-case (exceptions: CamelCase brands, all-lowercase `cinagroup`, all-caps acronyms).
- [ ] No `uppercase` outside mono technical labels; those labels use `font-mono-tech`.
- [ ] No font-weight > 600; display headings have negative tracking.
- [ ] No body paragraph in mono.
- [ ] No generic purple/blue gradient; brand mesh only, hero scale only.
- [ ] Button radius scale consistent within a surface.

**Grep self-checks** (run from repo root):
```bash
# Title-Case CTA / card-title suspects (review hits, fix the real ones):
grep -rnE '"(View|Try|Connect|Mint|Submit|Sign|Add|Install|Your) [A-Z]' app/ portal/src/ components/
# uppercase on non-mono elements (should be empty):
grep -rn 'uppercase' app/ portal/src/ components/ | grep -v 'font-mono-tech'
# weight > 600 (should be empty):
grep -rnE 'font-(bold|extrabold|black)|font-weight:\s*(7|8|9)' app/ portal/src/ components/
# token-standard hyphenation (should all be hyphenated):
grep -rnE 'ERC[0-9]|ERC [0-9]' app/ portal/src/ components/ data/
```
