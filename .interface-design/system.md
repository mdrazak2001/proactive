# Proactive interface system

## Direction and feel

Proactive is a broadcast-grade incident instrument for an incident commander working under time pressure. It should feel calm, exact, observable, and expensive—not cyberpunk, playful AI, or a generic SaaS dashboard.

Domain vocabulary: war room, incident bridge, signal source, hypothesis, investigation order, deploy marker, trace, evidence chain, command authority, guardrail, receipt, and audit trail.

Color world: graphite equipment panels, warm paper-white incident notes, phosphor signal green, restrained amber review states, fault red, and steel-grey metadata.

Signature interaction: **The Evidence Wake**. The spoken question stays canonical; its R42 underline draws one tether into a continuous evidence line. A single 44px refractive lens advances only when shared evidence rows arrive, then the evidence contracts into one concluding sentence. In Share View, that relationship must remain legible at 720p.

Reject these defaults:

- AI chat bubbles and assistant avatars; use investigation orders, commands, evidence, and receipts.
- Gradient orbs, rainbow accents, glass cards, and decorative grids; color communicates state only.
- Bento walls of identical cards; use one dominant execution surface with supporting rails or open sections.
- Fake browser theater when real sources exist; show provider, scope, query, timestamp, and source link.

Reference influence: the supplied Supabase integration page informs calm dark hierarchy, compact navigation, and row-based connection controls. The supplied PostHog page demonstrates memorability and product-world commitment, but Proactive must not imitate its desktop/game treatment because incident response requires trust and broadcast clarity.

## Depth and surfaces

- Depth strategy: dark surface-color shifts plus quiet borders. Avoid dramatic shadows.
- Base canvas `#080a09`; control room `#0d100f`; console `#111513`; raised console `#171c19`; inset `#090c0b`.
- Standard border `rgba(241,239,231,.10)`; soft separation `.06`; focus ring uses signal green at `.48`.
- Radius scale: controls 6px, cards 10px, major frames 14px. Nested radii must remain concentric.
- Sidebars share the canvas hue and separate with one quiet border.

## Palette

- Primary text / warm paper: `#f1efe7`.
- Secondary text: `#969d97`; tertiary: `#656c67`.
- Signal / approved / connected: `#b9ff66`; dim signal `#7da84b`.
- Review / pending: `#efb85f`.
- Fault / destructive evidence: `#ff7468`.
- Accent usage stays below roughly 10% of a screen.

## Typography and hierarchy

- IBM Plex Sans Variable for interface and editorial copy; IBM Plex Mono for queries, timestamps, scopes, status labels, and evidence metadata.
- Product UI uses a roughly 1.2 type ratio: caption 11, body 14, section 17, heading 20–22, page title 28.
- Marketing display may reach 56–64px on desktop, with tight tracking and balanced wrapping.
- Share View minimum body size is 16px and key conclusion/evidence is 20–32px for video compression.
- Use weight and text color before adding size. Dynamic numbers use tabular numerals.

## Spacing and density

- Base unit: 4px.
- Dense operator controls: 12–16px internal padding; section gaps 24–32px.
- Marketing and onboarding sections: 64–96px major spacing on desktop, 40–64px mobile.
- Minimum interactive hit area: 44×44px.

## Focal patterns

- Landing: the hypothesis → approved plan → evidence transformation is the hero, not a generic product screenshot.
- Integrations: the selected signal source and exact access boundary lead; provider catalogs are quiet supporting rows.
- War Room: the transcript is the application. One canonical spoken question opens a single inline investigation fold; there is no separate agent dashboard or sidebar.
- Share View: conversation → question → evidence → answer stays readable in one centered document at 1280×720. The active quote and its inline evidence dominate; navigation, setup chrome, and agent-step theatre disappear.

## Reusable components

- Evidence Wake: one flat inline fold attached directly to the active transcript quote; a compact approval rail, one one-shot Bézier tether, one continuous SVG evidence trace, and one 44px refractive GlassSurface lens. The lens is the only glass material. Row arrival—not local timers—moves it, while prior evidence recedes and assembles into the final sentence.

- Primary action: 44px minimum height, 6px radius, 14px/600, signal-green fill on dark; hover changes lightness, active scales to .97, visible focus ring.
- Secondary action: 40–44px height, transparent/raised surface, quiet border, primary text.
- Status chip: 24–28px height, mono 10–11px/500, restrained semantic dot plus text.
- Product sidebar: 224–240px, same hue as canvas, 44px navigation rows, one selected tonal surface.
- Provider row: minimum 72px, provider mark + name + one-sentence capability + scope/status + single trailing action. Prefer rows to identical integration cards.
- Connection drawer: one focal provider, progressive steps (authorize, discover, scope, verify), explicit read-only receipt before completion.
- Evidence receipt: provider, observation, source time, fetch time, query fingerprint, deep link, and clear separation between observed fact and model inference.

## Required states

Every connector and execution control must implement loading, empty, hover, focus, disabled, error, connected, needs-attention, and revoked states. Never imply a provider is connected when only demo data is active.
