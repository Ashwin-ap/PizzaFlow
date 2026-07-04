# Frontend Design Inspiration

> A complete, self-contained design brief distilled from a polished, Stripe-inspired
> marketing site ("Outrank"). Hand this file to a coding assistant on a **different**
> project. The **features, backend, and content are unrelated** — only the *visual
> language* should be reused: the color theme, button styles, typography, spacing,
> motion, and the overall "premium, calm, modern SaaS" feel.
>
> **How to use this:** Treat everything below as the design system. Adapt the tokens
> to your own components and pages. Do NOT copy the SEO/agency content — that belongs
> to the original site.

---

## 1. Design Philosophy (the vibe)

- **Premium, quiet, and modern** — like Stripe, Linear, or Vercel. Nothing shouts.
- **Lots of whitespace.** Content breathes. Generous padding, roomy sections.
- **One confident accent color** (a vivid indigo/violet) against mostly white/near-white surfaces. The accent is used sparingly — for primary actions and highlights, never everywhere.
- **Soft, blue-tinted shadows** instead of hard black ones. Elevation feels airy.
- **Rounded, friendly geometry** — fully-rounded ("pill") buttons and chips, generously rounded cards.
- **Subtle, tasteful motion** — gentle hover lifts, scroll-reveal fade-ups, count-up numbers. Never distracting. Always respects `prefers-reduced-motion`.
- **No emoji icons. No generic multicolor gradients.** Use a clean line-icon set (e.g. `lucide-react`) and restrained brand-tinted gradients only.
- **Full light + dark mode** driven by CSS variables, so components invert automatically.

---

## 2. Color Palette

Colors are defined as **CSS custom properties** (design tokens). Components should reference the *semantic* tokens (`canvas`, `ink`, `primary`, `hairline`) rather than raw hex — that's what makes dark mode "just work."

### Brand / Accent
| Token | Hex | Use |
|---|---|---|
| `primary` | `#533afd` | The main accent. Primary buttons, links, active states, focus rings. |
| `primary-deep` | `#4434d4` | Eyebrow text, slightly darker accent. |
| `primary-press` | `#2e2b8c` | Pressed/active button state. |
| `primary-soft` | `#665efd` | Accent on dark backgrounds (better contrast). |
| `primary-subdued` | `#b9b9f9` | Soft tag/badge backgrounds. |
| `brand-dark` | `#1c1e54` | Deep navy for dark CTA bands, promo bars, footer accents. |

### Supporting accents (use rarely, for illustration/detail only)
| Token | Hex |
|---|---|
| `ruby` | `#ea2261` |
| `magenta` | `#f96bee` |
| `star` (rating gold) | `#f5a623` |
| `green` (success) | `#0d8f6f` |
| `green-soft` | `#5fd0a8` |

### Surfaces & text — LIGHT mode
| Token | Hex | Meaning |
|---|---|---|
| `canvas` | `#ffffff` | Page/card background |
| `canvas-soft` | `#f6f9fc` | Alternating section / recessed panel |
| `hairline` | `#e3e8ee` | Borders, dividers |
| `hairline-input` | `#a8c3de` | Input borders (slightly stronger) |
| `ink` | `#0d253d` | Primary text (near-black navy) |
| `ink-secondary` | `#273951` | Secondary text |
| `ink-mute` | `#64748d` | Muted/placeholder text |

### Surfaces & text — DARK mode (same tokens, re-mapped)
| Token | Hex |
|---|---|
| `canvas` | `#0d1117` |
| `canvas-soft` | `#161c26` |
| `hairline` | `#262d3a` |
| `hairline-input` | `#38414f` |
| `ink` | `#e8edf4` |
| `ink-secondary` | `#c2ccd9` |
| `ink-mute` | `#8a95a4` |

**Note:** `primary` and the accent colors stay the *same* in dark mode; only surfaces and text flip. On dark backgrounds, prefer `primary-soft` for text-on-dark legibility (e.g. eyebrows).

### Elevation (shadows) — the signature "blue shadow"
```css
--shadow-1: 0 1px 3px rgba(0, 55, 112, 0.08);
--shadow-2: 0 8px 24px rgba(0, 55, 112, 0.08), 0 2px 6px rgba(0, 55, 112, 0.04);
```
Shadows are **blue-tinted** (`rgba(0,55,112,...)`), not gray/black. `shadow-1` = resting cards, `shadow-2` = hover/floating elements.

---

## 3. Typography

- **Primary font:** `Inter` (Google font), weights **300, 400, 500, 600**. Load via `next/font` or a `<link>`. Fallback stack: `"SF Pro Display", system-ui, -apple-system, sans-serif`.
- **Mono accent font:** `JetBrains Mono` (weights 400, 500) — used *only* for small uppercase "eyebrow" labels above headings.
- Enable the stylistic set: `font-feature-settings: "ss01" 1;` on the body for slightly more characterful letterforms.
- Use `font-feature-settings: "tnum" 1;` (tabular numbers) on stat/number/price cells so digits align.

### Type scale & usage
| Element | Style |
|---|---|
| Hero H1 | ~48–64px, `font-semibold` (600), tight tracking `-1px`, often **two-tone** (main text in `ink`, a phrase in `ink-mute`). |
| Section H2 | ~32–40px, weight 600, tracking slightly negative. |
| Body | 15–17px, weight **300–400** (light body text is part of the look), color `ink-secondary`. |
| Eyebrow | 11px, JetBrains Mono, `uppercase`, `letter-spacing: 0.12em`, color `primary-deep`, with a short 18px dash line before it. |
| Wordmark/logo | 24px, weight 600, tracking `-1.2px`, with a tiny 7px `primary` dot at the end. |

---

## 4. Layout & Spacing

- **Content container:** centered, `max-width: 1180px`, horizontal padding `24px` (`px-6`). Call it `.container-x`.
- **Section rhythm:** large vertical padding between sections (roughly `80–120px` top/bottom on desktop). Alternate `canvas` and `canvas-soft` backgrounds to separate sections.
- **Breakpoints to design for:** desktop, then reflow cleanly at **~960px** (tablet) and **~680px** (mobile). Grids collapse to single column on mobile.
- **Corner radius:** buttons/chips = fully rounded (pill). Cards = `rounded-xl`/`rounded-2xl` (~16–24px). Inputs = small `6px`.

---

## 5. Buttons (the most important reusable piece)

**Base (`.btn`):** pill-shaped (`rounded-full`), `inline-flex` centered with a `6px` gap for an optional icon, padding `8px 16px`, font-size `16px`, weight normal (400), no border. Icons inside are `15×15px`.

**Signature hover:** every button **scales up to 1.1** and gains `shadow-2` on hover, with a `300ms` transition on `background-color, color, transform, box-shadow`. This gentle "grow + lift" is the defining interaction — apply it consistently.

**Small variant (`.btn-sm`):** padding `6px 12px`, font-size `14px`, icons `14px`.

### Variants
| Variant | Rest | Hover | Active |
|---|---|---|---|
| **Primary** | `bg: primary`, white text | **inverts** → white bg, `primary` text | `bg: primary-press`, nudges down 1px |
| **Secondary** | white bg, `primary` text, 1px inset `primary` ring | fills `primary`, white text | — |
| **Ghost** | white bg, `ink` text, 1px inset `hairline` ring | fills `ink` (dark), white text | — |
| **On-dark** | `brand-dark` bg, white text | inverts → white bg, `brand-dark` text | — |
| **Outline-light** (on dark sections) | transparent, white text, 1px white-34%-opacity ring | white bg, `brand-dark` text | — |
| **Block** | add `width: 100%` | — | — |

The primary button's **invert-on-hover** (solid → outline) plus the scale is the key move. Copy that behavior exactly.

### Inline link CTA (`.link-cta`)
Text link in `primary`, 15px, with a small trailing arrow icon (`14px`, `3px` gap), underline on hover only. Used for "Learn more →" style links.

---

## 6. Form Inputs

- **`.input`:** full-width, `6px` radius, 1px `hairline-input` border, white (`canvas`) bg, padding `8px 12px`, font-size `15px`, weight **light (300)**, `ink` text.
- Placeholder color: `ink-mute`.
- **Focus:** border turns `primary` + a soft **3px focus ring** `rgba(83,58,253,0.12)`. (On the contact form specifically, a stronger `4px` outline at `0.35` opacity with `2px` offset.) `150ms` transition.
- Selects and textareas share the same styling.

---

## 7. Cards

There's no single card class — cards are composed with utilities, but always follow this recipe:
```
rounded-xl / rounded-2xl
border: 1px solid hairline
background: canvas
box-shadow: shadow-1 (resting)
hover: -translate-y (lift ~2–4px) + shadow-2
transition: 300ms
```
Consistent, calm, and they lift slightly on hover like the buttons.

---

## 8. Chips / Filters & Tags

**Filter chip (`.chip`):** pill, 1px `hairline` border, white bg, `14px` text, `ink-secondary` color.
- Hover: **scales to 1.1**, fills dark (`ink` bg, white text).
- Active: fills `primary`, white text.

**Soft tag/badge (`.tag-soft`):** tiny pill, `primary-subdued` bg, `10px` uppercase `primary-deep` text — for category labels.

---

## 9. Motion & Micro-interactions

All motion is **CSS-based** (no heavy animation library needed). Keep it subtle. Every animation below must be disabled under `@media (prefers-reduced-motion: reduce)`.

| Effect | What it does |
|---|---|
| **Button/chip/card hover** | scale to 1.1 (buttons/chips) or translateY lift (cards) + `shadow-2`, 300ms. |
| **Scroll reveal** | Elements start `opacity:0, translateY(24px)` and fade/slide up to normal when they enter the viewport (IntersectionObserver adds an `is-visible` class). 700ms `cubic-bezier(0.2,0.6,0.2,1)`. |
| **Page transition** | On each route change, wrap the page and run a quick fade + 8px rise, 450ms. |
| **Count-up numbers** | Stats animate from 0 to their value (easeOutCubic, ~1.6s) when scrolled into view. |
| **Nav underline** | A 4px `primary` line slides in left→right under a hovered nav link (scaleX 0→1, 300ms). |
| **Marquee** | Optional infinite horizontal logo strip, 30s linear loop, pauses on hover. |
| **Floating cards** | Hero decoration cards gently bob ±10px on a 6s loop (`floatY`). |
| **Shimmer** | A soft light sweep across a highlighted tag/badge. |

Preferred easing for reveals/transitions: `cubic-bezier(0.2, 0.6, 0.2, 1)`. For springy toggle knobs: `cubic-bezier(0.34, 1.56, 0.64, 1)`.

---

## 10. Dark Mode Strategy

1. Toggle a **`.dark` class on `<html>`** (not per-element `dark:` variants).
2. Redefine the surface/text CSS variables under `.dark` (see palette table). Components using `bg-canvas` / `text-ink` / `border-hairline` invert automatically.
3. Persist the user's choice in `localStorage("theme")`.
4. Add a tiny **blocking inline script** in the document `<head>`/top of `<body>` that reads the stored theme (or `prefers-color-scheme`) and applies `.dark` *before first paint* — this prevents a white flash on load:
```js
(function(){try{var t=localStorage.getItem('theme');
var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
if(d)document.documentElement.classList.add('dark');}catch(e){}})();
```
5. Provide an **iOS-style toggle switch** (sun/moon icons crossfading) to flip it.
6. Some surfaces stay dark in *both* modes (promo bars, CTA bands, footer) using `brand-dark` — that's intentional.

---

## 11. Recommended Stack (to reproduce this look easily)

- **Tailwind CSS v4** with config-in-CSS: put the tokens in an `@theme { --color-primary: …; }` block so they become utilities (`bg-primary`, `text-ink`, `border-hairline`). Reusable pieces (`.btn`, `.chip`, `.input`) go in `@layer components` using `@apply`.
- **`lucide-react`** (or any clean line-icon set) for icons. No emoji.
- Fonts via `next/font` (Inter + JetBrains Mono) or `<link>`.
- Scroll-reveal + count-up via a small IntersectionObserver utility — no animation library required.

> If your project doesn't use Tailwind, replicate the same tokens as plain CSS custom
> properties and hand-write the `.btn` / `.input` / `.chip` classes. The *values* above
> are the design system; the framework is just a delivery mechanism.

---

## 12. Quick Do / Don't Checklist

**Do**
- Use one vivid `#533afd` accent against white/near-white.
- Make buttons and chips pill-shaped and give them the scale-1.1 + blue-shadow hover.
- Use blue-tinted shadows, generous whitespace, and light-weight body text.
- Invert the primary button on hover (fill ↔ outline).
- Ship full light/dark mode via CSS-variable tokens + a no-flash inline script.
- Keep motion subtle and honor `prefers-reduced-motion`.

**Don't**
- Don't use emoji as icons.
- Don't use rainbow/generic multi-stop gradients.
- Don't use hard black shadows.
- Don't scatter the accent color everywhere — it's for actions and highlights only.
- Don't copy the SEO-agency content, page structure, or 3D hero — only the visual language.
