# Design System — CruFolio

## Product Context
- **What this is:** A CRM and business intelligence platform for wine suppliers, importers, and distributors
- **Who it's for:** Wine suppliers and importers managing distributor relationships across US states; sales directors and territory reps tracking depletions, reorders, and pipeline; operations leads consolidating data from VIP, Fintech, and distributor portals
- **Space/industry:** Wine & spirits trade, B2B SaaS
- **Project type:** Web application (dashboard + CRM)

## Brand Identity
- **Name:** CruFolio
- **Tagline:** The Authoritative Platform for Wine Suppliers
- **Essence:** Authoritative. Refined. Built for Wine.
- **Pillars:** Authority, Clarity, Craft, Partnership
- **Voice:** Knowledgeable wine trade insider. Confident but not arrogant. Specific but not jargon-heavy. Uses wine trade terminology naturally (depletions, 9L cases, three-tier compliance).

## Aesthetic Direction
- **Direction:** Luxury/Refined
- **Decoration level:** Intentional — subtle texture and background treatment, not expressive
- **Mood:** A premium wine portfolio deserves a premium tool. The interface should feel like walking into a well-appointed tasting room — warm, confident, and purposeful. Every screen tells a story with data.
- **Anti-patterns:** No startup slang ("crush it", "game-changer"). No blue as a primary color. No mixing serif + sans-serif in one headline. No Champagne Gold as background. No pure white (#FFFFFF) as page background — use Parchment.

## Typography
- **Display/Hero:** Libre Baskerville Regular (Google Fonts) — serif authority for headlines, page titles, marketing copy. Fallback: Georgia, 'Times New Roman', serif.
- **UI Headings:** Inter Tight Semibold — clean sans-serif for card titles, subsections, labels. Fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif.
- **Body:** Inter Regular — readable sans-serif for all body text, tables, inputs. Fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif.
- **Data/Tables:** Inter with `font-feature-settings: 'tnum'` for tabular numbers
- **Code:** JetBrains Mono
- **Loading:** Google Fonts CDN — `Libre+Baskerville:ital,wght@0,400;0,700;1,400` and `Inter:wght@300;400;500;600;700` and `Inter+Tight:wght@400;500;600;700`
- **Scale:**
  - H1 Display: 32px / Libre Baskerville Regular / line-height 1.3
  - H2 Section: 24px / Libre Baskerville Regular / line-height 1.35
  - H3 Card Title: 20px / Inter Tight Semibold / line-height 1.4
  - H4 Subsection: 16px / Inter Tight Semibold / line-height 1.5
  - Body Large: 16px / Inter Regular / line-height 1.6
  - Body Default: 15px / Inter Regular / line-height 1.6
  - Body Small: 13px / Inter Regular / line-height 1.5
  - Caption/Label: 12px / Inter Regular / uppercase / letter-spacing 0.5px

## Color
- **Approach:** Balanced — primary + secondary with semantic colors for hierarchy
- **Primary:**
  - Deep Burgundy `#6B1E1E` — headlines, CTAs, logo, dominant brand color
  - Wine-Dark Navy `#1A1F3E` — sidebar, navigation bars, dark UI surfaces
- **Secondary:**
  - Aged Oak `#8B6A4C` — hover states, active lines, highlights
  - Warm Copper `#B87333` — accent highlights, secondary emphasis
- **Accent:**
  - Champagne Gold `#D2C78A` — subtle accents only: borders, dividers, premium callouts. Never as background.
- **Neutrals:**
  - Parchment `#FDF8F0` — default page background (never use pure white #FFFFFF)
  - Card White `#FFFFFF` — card/surface fill only
  - Card Border `#E5E0DA` — card and component borders
  - Input Border `#D1CBC4` — form input borders
  - Warm Slate `#6B6B6B` — secondary/dimmed text
  - Deep Charcoal `#2E2E2E` — primary body text
- **Semantic:**
  - Success: `#1F865A`
  - Warning: `#C07B01`
  - Error: `#C53030`
- **Hover states:**
  - Primary button hover: `#8A2035` (Burgundy Light)
  - Focus ring: 3px box-shadow in Champagne Gold at 30% opacity (`rgba(210, 199, 138, 0.3)`)
- **Dark mode:** Reduce saturation 10-20%, use navy-based surfaces. Swap Deep Burgundy headlines to Parchment. Use Champagne Gold for section titles.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined
- **Structure:** Fixed left sidebar (dark, Wine-Dark Navy) + scrollable main content area (Parchment background)
- **Sidebar width:** 252px expanded, 60px collapsed
- **Max content width:** 1200px
- **Border radius:**
  - Buttons: 7px
  - Cards: 8px
  - Inputs: 6px
  - Status badges: 12px (pill)
  - Full round: 9999px

## Components
- **Buttons:**
  - Primary CTA: Deep Burgundy bg, Parchment text, 7px radius, Inter Tight Semibold 14px, 12px 24px padding
  - Secondary: Transparent bg, Deep Burgundy text + border
  - Ghost/Tertiary: Transparent bg, text color + card-border border
- **Cards:** 8px radius, 1px `#E5E0DA` border, white fill, 24px padding
- **Inputs:** 6px radius, 1px `#D1CBC4` border, white fill, Inter Regular 14px, 10px 14px padding
- **Alerts:** 7px radius, 8% opacity background of status color, 1px border at 20% opacity
- **Status badges:** 12px radius (pill), 10% opacity background of status color
- **Sidebar nav items:** Active state uses Champagne Gold text + 3px left border + 10% Gold background

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms)
- **Transition speed:** 200ms default for interactive elements

## Logo Assets
- **Logomark:** CF monogram inside vine leaf — Deep Burgundy on light backgrounds, Champagne Gold on dark
- **Wordmark:** "CruFolio" in Libre Baskerville Regular, letter-spacing +2px
- **Clear space:** Height of the 'C' in CruFolio on all sides
- **Minimum size:** Horizontal lockup 120px, standalone logomark 24px
- **Favicon:** Logomark at 32x32, 24x24, 16x16

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-17 | Initial design system created from Brand Identity Guide v1.0 | Codified existing brand guide into actionable DESIGN.md for development |
| 2026-03-17 | Libre Baskerville + Inter Tight + Inter type stack | Serif authority for display, clean sans-serif for UI — matches wine trade premium positioning |
| 2026-03-17 | Parchment (#FDF8F0) as default background | Warm cream tone avoids clinical white, reinforces wine/paper aesthetic |
| 2026-03-17 | Champagne Gold accents only, never as background | Gold loses its premium feel when overused — reserve for borders, dividers, focus states |
