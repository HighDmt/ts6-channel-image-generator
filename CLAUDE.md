# CLAUDE.md — TS6 Channel Image Generator (fork of ts5-channel-image-generator)

> Project notes: TS6 measurements, design decisions and how the tool works.
> Status: **TS6 port built and live at <https://highdmt.github.io/ts6-channel-image-generator/>.** Later additions (zoom, collapse, TS6 hover, auto-fill, fixes) are in section 9. Sections 5 and 7 are the original build plan, kept for context. Build with Node 16 (`.nvmrc`).

---

## 1. Mission

Fork <https://github.com/pitkes22/ts5-channel-image-generator> and produce **the exact same tool, retargeted at the TeamSpeak 6 client**.

- Same workflow, same UI, same features, same export format (ZIP of PNG slices + `files.txt`).
- What changes: slice geometry and the **preview**, which must look like the TS6 channel tree. Plus branding/strings.
- Definition of done: slices exported by the tool, set as TS6 channel images, line up seamlessly across a real TS6 tree (spacers + channels + sub-channels), and the in-app preview matches what TS6 shows.

Do **not** add features from the original's "Planned Features" list. Do not redesign the app shell. Minimal, faithful port.

---

## 2. What the original does

Fully client-side Next.js app (no server). User uploads an image (file or URL), it is resized, sliced into N horizontal strips (one per channel) on a canvas, and all strips are exported as a ZIP. User hosts the PNGs and sets each channel's image URL in TeamSpeak.

### Stack (original, pinned)
Next 10.0.6, React 17.0.1, Blueprint.js 3 (`@blueprintjs/core` 3.38, `popover2`), styled-components 5, lodash, jszip, file-saver, react-color. `next build && next export` → static `out/`, deployed to GitHub Pages by `.github/workflows/deploy.yml` (Node 12, `peaceiris/actions-gh-pages`, needs `ACTIONS_DEPLOY_KEY` secret). `next.config.js` sets `basePath: '/ts5-channel-image-generator'` in production.

### File map
| File | Role |
|---|---|
| `pages/index.js` | Page composition (Upload, Options, Export, Preview, Description) inside `ImageManipulation` context. `<title>`. |
| `pages/_document.js` | SEO/OG meta (mentions TS5, og:url). |
| `components/imageManipulation.js` | **Core.** Geometry constants, resize + slice logic, context provider. |
| `components/room.js` | **Preview of one channel/spacer.** Styled-components replica of the TS5 row. |
| `components/preview.js` | Preview list; per-channel hover controls (spacer toggle, depth ←/→, reset). |
| `components/options.js` | Channel count, ignore spacing, vertical/horizontal offset, cover/contain switch, background color. |
| `components/export.js` | ZIP export; `ts5_channel_banner_<name>.zip`; per-slice `prefix_%d.png`. |
| `components/upload.js`, `description.js`, `layout.js`, `step.js` | Upload; footer text (TS5 copy, repo links, PayPal button, author copyright); layout; step wrapper. |
| `public/roomIcon.svg`, `coverContainExplanation.png`, `favicon.png` | Preview icon (TS5 hex-cube), cover/contain help image, favicon. |

### Core algorithm (`imageManipulation.js`)
```js
SPACER_HEIGHT = 16          // visible spacer row
SPACER_BANNER_HEIGHT = 26   // slice height for a spacer (visible + gap)
CHANNEL_HEIGHT = 22         // visible channel row
CHANNEL_BANNER_HEIGHT = 30  // slice height for a channel (visible + gap)
CHANNEL_BANNER_WIDTH = 500
CHANNEL_DEPTH_OFFSET = 11   // x indent per nesting level
```
- `getChannelHeight(isSpacer, ignoreSpacing)`: visible height if "ignore spacing" else banner height (visible + gap) so the image stays continuous across row gaps.
- `resizeImageFromDataURL`: scales source to width 500 (+ `maxDepth * 11` in Cover mode).
- `getClippedRegion`: canvas 500 × channelHeight, fills background color, `drawImage` from `(x, y)`.
- `generateImages`: `x = room.depth * CHANNEL_DEPTH_OFFSET - options.xOffset` (TS5 anchors the image to each row, so nested rows must sample further right for continuity); `y += channelHeight`.
- `getSlicesCount` / `getRoomsHeight`: how many rows fit (`sizeRatio = width / 500`).
- Rooms state: 256 × `{depth, spacer}`; max depth 32; child depth ≤ parent depth + 1.

### Preview (`room.js`)
Hard-coded TS5: wrapper 26/30 px, container 16/22 px, `#1c2538`, 5 px radius, 24 px icon, 15 px title, italic grey spacer text, `ImageMask` (150 px dark gradient behind name; full-width centered gradient for spacers), image CSS mask `black calc(100% - 88px) → transparent`, `margin-left = depth * 11`. **Literals are duplicated instead of imported from the constants.**

---

## 3. TS5 → TS6: sources

TeamSpeak has published **no official pixel specs**. The [6.0.0-beta1 changelog](https://community.teamspeak.com/t/teamspeak-6-0-0-beta1-screen-camera-sharing-communities-design-overhaul/54925) only mentions a design overhaul, updated icons, improved spacing, simplified context menus and avatar previews for collapsed channels. A [feature request](https://community.teamspeak.com/t/customization-options-for-channel-layout-and-ui-styling/60919) complains TS6 rows/spacing are too large (consistent with the 14 px gaps below). **All numbers in section 4 come from the user's own screenshots** (`docs/`), including a calibration test with a purpose-built ruler image (`calibration_500x100.png`: 10 px colored bands labeled `y0…y90`, vertical ticks every 10 px — white every 50 —, magenta 1 px border, white marker top-left, black marker bottom-right) set as the image of 8 channels in one tree.

---

## 4. TS6 geometry

### 4.1 CONFIRMED (calibration test, 100 % UI scale, image pixels map 1:1 to screenshot pixels — tick spacing measured exactly 10.0 px)

**Rows**
| Property | TS5 (code) | **TS6** |
|---|---|---|
| Visible row height | 22 (channel) / 16 (spacer) | **30 for BOTH channels and spacers** |
| Row pitch (row + gap) | 30 / 26 | **44 for everything** (gap = 14). Verified: spacer→channel, channel→sub-channel, spacer→spacer, channel→spacer all 44 |
| Row width (depth 0) | — | **≈ 494 px** (e.g. x 24 → 517) |
| Indent per depth | 11 | **10** (row left edge moves 10 px right per level; right edge fixed) |
| Corner radius | 5 | **channel ≈ 9–10, spacer = fully rounded pill (15)** |
| Hovered row | — | Row **grows 2 px on every side** (30 → 34 px tall, +4 px wide) with a 1 px `#C0C0C0` outline around it; the image does NOT move, so 2 more px of image show on each side; nothing else in the layout moves; the name backdrop follows the grown left edge (`docs/ts6-hover.png`). This is the "outline with a gap" seen earlier, and why the first reference screenshot's spacer looked 36 px tall. Hovered spacers grow the same way and stay a **fully rounded pill** (radius = half the 34 px height) |

**How the banner image is drawn (the important part)**
1. **Native size, no scaling.** Image is drawn at 1:1 (500 px wide image → 500 px on screen). It is *not* cover/contain-scaled.
2. **Vertically centered and cropped to the 30 px row.** A 100 px tall image showed exactly its middle 30 px (y 35–64). → A slice of height 44 displays its middle 30 px (slice y 7–36); the top 7 and bottom 7 are hidden (that's the gap). Therefore **slicing the source image in 44 px steps with 30 px visible gives a perfectly continuous picture.** (Behavior for images *shorter* than 30 px not tested — don't export those.)
3. **Horizontal anchor is fixed in screen space, NOT per row.** The same image x lands on the same screen x at depth 0, 1 and 2 (tick lines at identical screen positions). Image x = 0 sits **10 px left of the depth-0 row's left edge**. So the row at depth *d* shows image x ≥ `10 + 10·d`; the leftmost `10 + 10·d` px are clipped by the row. **There is no per-depth shift** — the picture is automatically continuous under indentation (what TS5 called "Cover").
4. **Right-edge fade is tied to the IMAGE's right edge, not the row's** (client-drawn, not part of the exported PNG): measured on a widened panel, alpha is 1 until image x ≈ 418 and falls ~linearly to 0 at image x ≈ 500 (≈ 82–88 px; same as the TS5 code's `black calc(100% - 88px) → transparent` on the 500 px image). Applies to channels and spacers.
4b. **Panel width does not scale or stretch the image** (verified by widening the channel panel to ≈ 730 px): the image stays 500 px, left-anchored at the same `row_left − 10` origin, and the rest of the row simply shows the plain row background (`#282A2C`). Rows grow with the panel; the spacer name and spacer backdrop stay centered on the *row* (not the image). The user is fine with this behavior — nothing to compensate for in the tool; the usable image area is 500 px minus the hidden left strip.
5. Row corners clip the image; **exports stay rectangular**.

4c. **Image-size rules (tested with 500×20, 500×44, 500×100, 600×100):**
   - **Wider than 500 px → scaled down proportionally to 500 px wide** (NOT cropped; 600×100 rendered at 0.833×, ticks 41.5 px per 50). Aspect ratio is preserved, so height shrinks too, then the vertical center-crop to 30 px applies. Consequence: the tool must always export exactly **500 px wide**; any other width changes scale and breaks continuity.
   - **Shorter than the 30 px row → centered, 1:1, not stretched or tiled**; the row background shows above and below (500×20 showed 5 px of row bg on each side). Consequence: never export slices shorter than 30 px (the planned 44/30 are fine).
   - **500×44 verified:** the displayed band is slice y 7–36 (3 px of the first band, then the next 27 px); the magenta edge markers are hidden top and bottom — continuity logic confirmed.
   - **2x export tested** (`docs/sharpness-test/`, `docs/ts6-sharpness-1x-vs-2x.png`): a 1000×88 image is shrunk to 500×44 and cropped exactly like a 500×44 one (magenta edges hidden, ticks aligned). At 100 % Windows scaling it is **not sharper** (edge energy 1x 70.8 vs 2x 69.0, i.e. the same or a bit softer). Only worth adding if a test at 125 %+ scaling shows a gain — not built.

**Client-drawn overlays (preview must replicate)**
| Element | TS6 measured |
|---|---|
| Channel name backdrop | `#1B1B1F` (27,27,31). **Fades IN from transparent at the row's left edge to solid at ≈ 18 px** (alpha ≈ 0.055/px, measured on `ts6-calibration-a.png`), so ~10 px of image show at the left. Solid until 90 px, transparent by ≈ 150 px. **Width is fixed**: verified on a real server with an 11-character name vs "Channel 1" (both solid to 90 px); long names just run into the fade |
| Channel icon | ≈ 20 px hex-cube, light blue-white (`#C6D5E7`-ish), left edge at `row_left + 11` |
| Channel title | regular weight, ≈ 15 px, light grey (`~#D4D4D5`), starts at `row_left + 42` |
| Spacer name | centered in the row, **bold**, ≈ 15 px, white-ish |
| Spacer backdrop | horizontal gradient centered on the row: peak ≈ 85 % dark (`#1B1B1F`) at the center, falling ~linearly to 0 % at the row's left/right ends |
| Expand/collapse button (only rows with children) | dark rounded rect **22 × 16 px**, radius ≈ 4–5, bg ≈ `rgba(27,24,36,.85)`, right edge ≈ **4 px inside the row's right edge**, vertically centered. Glyph: white **chevron-down** when expanded; blue **chevron-left** when collapsed |
| Row base bg (no image) | `#282A2C` (40,42,44) |
| Panel bg | `#374056` (55,64,86), the default TS6 theme (sampled from a real-server screenshot; an earlier capture showed `#323236`) |

Not needed for the tool: user rows (circular ~30 px avatar, blue name), selected outline.

### 4.2 Consequences for the tool (algorithm changes)
- All visible heights = **30**; all pitches = **44**. `SPACER_*` constants become equal to `CHANNEL_*`; the spacer flag only affects the **preview** (looks + name), not slice size. Keep `getChannelHeight` but it can return the same value for both.
- Export slice size: **500 × 44** (normal) or **500 × 30** when "Ignore channel spacing" is on (same semantics as TS5: image fully visible but visually stretched across gaps).
- **Remove the per-depth x shift:** `x = -options.xOffset` for every depth (no `depth * OFFSET`).
- Resize width is always **500** (drop `+ maxDepth * OFFSET`). The "Fit mode (Cover/Contain)" option therefore has no effect in TS6. **Remove the switch and its help image/popover** (decided, section 7 #3). Keep a short note in the UI that the left `10 + 10·depth` px of the image are hidden.
- Preview must **clip** the left `10 + 10·d` px of the image per depth (see 4.4).
- `getSlicesCount` / `getRoomsHeight` keep working unchanged once constants are updated.

### 4.3 Remaining unknowns (low risk — verify if cheap, don't block)
1. ~~Panel resizing~~ **Resolved** (see 4.1 item 4b: image stays 500 px, left-anchored).
2. ~~Does a long channel name widen the dark name backdrop?~~ **Resolved: no**, fixed 150 px (see 4.1 overlays).
3. ~~Images wider / shorter than the row~~ **Resolved** (see 4.1 item 4c). Still untested: images narrower than 500 px (assumed shown 1:1, left-anchored, not upscaled) and 800 px-wide images (assumed same scale-down rule as 600).
4. Does the client honor **UI scaling** (125–200 %) by scaling the image? (Doesn't change slicing; only affects sharpness.)
5. Per-channel image setting: **resolved by the user — it's a plain URL** (GitHub-hosted URLs work). Exact TS6 menu label not captured; keep README wording generic. Server-query names `channel_banner_gfx_url` / `channel_banner_mode` are **not verified for TS6**.

### 4.4 Preview implementation spec (`room.js`) — numbers to use
```
Row            height 30, margin-bottom 14, width 494 at depth 0, margin-left 10*depth
               radius 10 (channel) / 15 (spacer), overflow hidden, bg #282A2C
Image layer    position absolute, left = -(10 + 10*depth) px relative to the row,
               width 500, vertically centered (top 50% / translateY(-50%)),
               object-fit none (1:1), width 500 FIXED (do not stretch with the row),
               mask-image on the IMAGE element: linear-gradient(to right,
               black calc(100% - 84px), transparent 100%)  — 100% = 500 px image width
               (the area of the row beyond the image just shows the row bg)
Channel backdrop  absolute, left 0, width 150, height 100%,
               linear-gradient(to right, transparent 0, #1B1B1F 18px 60%, transparent 100%)
Spacer backdrop   absolute, full width,
               linear-gradient(to right, transparent, rgba(27,27,31,.85) 50%, transparent)
Icon           20 px, left 11 ; Title left 42, 15px, #D4D4D5 ; Spacer title centered, bold
Chevron btn    22x16, radius 5, right 4, centered, bg rgba(27,24,36,.85), chevron-down white
               (render only when next room has greater depth)
Panel          #374056
```
In the preview the source image is the **resized 500-wide** image; each row's visible portion = slice y-range centered in the row. Easiest: keep rendering the exported slice (500 × 44) via an `<img>` centered vertically in the 30 px row — exactly what TS6 does — and apply the left clip/shift above.

---

## 5. Plan

### Phase 0 — DONE (calibration)
Calibration screenshots are in `docs/` (`ts6-calibration-a.png`, `ts6-calibration-b.png`, `ts6-widened-real-banners.png` — widened panel plus real photo banners on spacers/channels and the calibration rows —, `ts6-size-tests.png` — 500×20 / 500×44 / 600×100 tests, and the earlier `ts6-reference.png` which shows a selected spacer and rows without banners). Optional extra (4.3 item 2): one screenshot with a long channel name. Not blocking.

### Phase 1 — Fork and baseline
1. Create the repo as a **GitHub fork** (`ts6-channel-image-generator`) to preserve history/attribution. The original has **no LICENSE** — keep credit (`© 2020 Peter Adam`), link to the original in README + footer; publish/deploy is OK once the build and Phase 6 checks pass (section 7 #6).
2. Get the untouched app building. Next 10 / webpack 4 break on modern Node (OpenSSL) → Node ≤ 16 or `NODE_OPTIONS=--openssl-legacy-provider`. Decision (section 7, #5): keep the stack, pin Node 16 locally and in CI.
3. `npm ci && npm run dev`, confirm the original works before editing.

### Phase 2 — Geometry (`imageManipulation.js`)
```js
export const SPACER_HEIGHT = 30;
export const SPACER_BANNER_HEIGHT = 44;
export const CHANNEL_HEIGHT = 30;
export const CHANNEL_BANNER_HEIGHT = 44;
export const CHANNEL_BANNER_WIDTH = 500;
export const CHANNEL_DEPTH_OFFSET = 10;     // used by the PREVIEW only
export const IMAGE_LEFT_HIDDEN = 10;        // image x hidden at depth 0 (+ DEPTH_OFFSET per level)
```
- `generateImages`: remove `room.depth * CHANNEL_DEPTH_OFFSET` from `x`.
- `resizeImageFromDataURL` call: always `CHANNEL_BANNER_WIDTH`; remove Cover/Contain dependence from the effect deps.
- Replace literals in `room.js` with imports. Re-check `getSlicesCount` / `getRoomsHeight` with the new constants.

### Phase 3 — Preview rewrite (`room.js`, `preview.js`, `layout.js`)
Implement 4.4. Derive "has children" in `preview.js` (next room depth > this depth) for the chevron. Keep the hover tool controls (spacer toggle, depth ±) — they're tool UI, not TS UI — but restyle so they don't clash. Replace `public/roomIcon.svg` with a redrawn TS6-style hex-cube icon (do **not** copy files from the TS6 install). Update the preview panel background in `layout.js` to `#323236`.

### Phase 4 — Options UI
Remove the Fit-mode switch + `coverContainExplanation.png` + popover (decided, section 7 #3); also delete the now-unused `coverFitMode` option and its effect dependency. Update helper texts that mention rooms/TS5 behavior. Add one helper line: "Leftmost 10 px (+10 px per nested level) of the image are hidden by TeamSpeak 6."

### Phase 5 — Branding and strings (TS5 → TS6)
- `package.json` name → `teamspeak6-room-banner-generator`
- `next.config.js` basePath → `/ts6-channel-image-generator`
- `pages/index.js` `<title>`; `pages/_document.js` description, `og:title`, `og:url`
- `components/description.js`: h1, download link (`#ts5`), repo links, star badge `repo=` param, copyright (keep original credit + add fork credit)
- `components/export.js`: ZIP name `ts5_channel_banner_*.zip` → `ts6_…`
- `components/room.js` doc comment
- `README.md`: title, URLs, step 5 ("You have to have TeamSpeak 5 Beta Client" → TS6 wording per section 7 #4: plain image URL, GitHub hosting recommended)
- `.github/workflows/deploy.yml`: deploy key secret / Node version
- **PayPal donate button** in `description.js` points at the original author's account: REMOVE (decided)
- Re-grep when done: `grep -rniE "ts5|teamspeak ?5" . --exclude-dir=node_modules --exclude-dir=.git`

### Phase 6 — Verification
- Throwaway script: for a known image + room layout, slice count / total height match hand calculation; exported PNGs are `500×44` (or `500×30` with ignore-spacing).
- **Regression test against the real client data:** feed the tool a 500 × (44·8) test image, export 8 slices, user sets them on a TS6 tree with spacers + 3 nesting levels, and compares to the in-app preview and to `docs/` screenshots — seams must be invisible and image x identical at all depths.
- In-app preview vs `docs/ts6-calibration-*.png`: overlay both at 1:1 and check row height 30, pitch 44, indents, backdrop width, fade.
- `npm run build` succeeds, `out/` works under the new basePath.

---

## 6. Rules for the building model
- Smallest diff that achieves TS6 fidelity. Don't refactor; don't upgrade dependencies — section 7 #5 says keep the stack.
- One source of truth for geometry (constants in `imageManipulation.js`, imported elsewhere).
- Don't copy TeamSpeak's proprietary icon/font files; recreate lookalikes.
- Never re-add the donate button; never remove the original author credit.
- Where the preview and a real TS6 screenshot disagree, trust the screenshot and tell the user.

---

## 7. Decisions (all resolved by the user — no open blockers)
1. Calibration — done. 2. UI scale — resolved (1:1).
3. **Cover/Contain switch: REMOVE** (switch, popover, `coverContainExplanation.png`, and the effect dependency).
4. **Per-channel image setting in TS6 is a plain URL; the user hosts images on GitHub (raw/Gist-style URLs work).** README step 5 should say: upload the PNGs somewhere with direct URLs — GitHub works well — and paste each URL into the channel's image/banner URL field. Some image hosts block hotlinking by TeamSpeak (community reports), so recommend GitHub. Do not name exact TS6 menu labels you haven't seen; keep the wording generic ("channel properties → image URL").
5. **Stack: KEEP the original** (Next 10 / React 17 / Blueprint 3 / styled-components 5). Rationale: a faithful minimal port; upgrading Next 10 → 14 and Blueprint 3 → 5 is a rewrite with no benefit. Only changes allowed for building: pin **Node 16** locally (`.nvmrc` = `16`) and in CI; if a newer Node is unavoidable use `NODE_OPTIONS=--openssl-legacy-provider`. Bump `actions/checkout` / `actions/setup-node` to `@v4` in the workflow. For deployment, prefer `peaceiris/actions-gh-pages@v3` with `github_token: ${{ secrets.GITHUB_TOKEN }}` instead of a deploy key (no secret to create; needs Pages set to deploy from `gh-pages` branch).
6. **PayPal donate button: REMOVE** (delete `DonateButton` and the "buy me a beer" sentence in `description.js`). **KEEP the original credit** (`© 2020 Peter Adam`, with link to the original repo) and add a fork line (e.g. "TS6 fork by <user>"). Fork on GitHub, host on the user's GitHub Pages. The original has no LICENSE; the user did not ask to contact the author, so: keep credit + link prominently, and don't remove or imply authorship of the original code.
7. **Name: `ts6-channel-image-generator`** (repo, `package.json` name `teamspeak6-room-banner-generator`, basePath `/ts6-channel-image-generator`).

---

## 8. Reference
- Original repo: <https://github.com/pitkes22/ts5-channel-image-generator> · live: <https://pitkes22.github.io/ts5-channel-image-generator/>
- TS6 design overhaul changelog: <https://community.teamspeak.com/t/teamspeak-6-0-0-beta1-screen-camera-sharing-communities-design-overhaul/54925>
- TS6 layout/spacing feedback: <https://community.teamspeak.com/t/customization-options-for-channel-layout-and-ui-styling/60919>
- Banner setup thread (TS5-era, unverified for TS6): <https://community.teamspeak.com/t/can-not-set-channel-banners/53501>
- Put in the repo under `docs/`: `calibration_500x100.png`, `ts6-calibration-a.png` (8-row tree), `ts6-calibration-b.png` (same + user row), `ts6-reference.png` (no-banner rows + selected spacer), `ts6-widened-real-banners.png` (wide panel, real photo banners), `ts6-size-tests.png` (image-size rules), `calibration_500x20.png`, `calibration_500x44.png`, `calibration_600x100.png`, `calibration_800x100.png`.

---

## 9. Post-launch changes (branch `preview-zoom-collapse`)
- **Zoom slider** (50–300 %, `options.zoom`), live while dragging like the other sliders. No intermediate resized image any more: `image` is a `useMemo` holding the *scaled* size (`500 × zoom` wide) and each slice is drawn straight from the original full-size image with a scale factor (`getClippedRegion`). Offsets and slice heights stay in scaled px; slices stay 500 px wide. `getSlicesCount` / `getRoomsHeight` no longer scale by `width / 500`. `resizeImageFromDataURL` and its `memoize` were removed; `crossOrigin = "Anonymous"` moved to `getImage` so URL-loaded images don't taint the canvas.
- **Collapse in the preview**: clicking the expand button hides the sub-channels (preview state only, not exported); collapsed glyph is a blue (`#1CC9FF`, sampled) chevron-left. Rows below move up, exactly like TS6, so the picture no longer lines up while collapsed.
- **Name backdrop left fade-in** (see 4.1).
- **Fixed pre-existing bug**: "Load from URL" referenced an undefined `resizedImageDataURL` and always failed; now uses the URL.
- Dev-server gotcha: after many hot reloads Next 10 served a truncated chunk ("Unexpected end of input", page not hydrated). Fix: stop the server, delete `.next`, restart.
- **Hover in the preview** (see 4.1 "Hovered row"): `room.js` splits each row into a layout box (`RoomWrapper`, fixed 30 px) and a visible `RowSurface` that grows by the CSS variable `--grow` (0 → 2 px on hover); the image is offset by `+var(--grow)` so it stays put.
- Screenshots from the real server: `docs/ts6-real-server.png` (photo banners, used for the backdrop and left fade measurements), `docs/ts6-hover.png`, `docs/ts6-sharpness-1x-vs-2x.png`.
- **Hover clipping gotcha**: the preview list (`ScrollWrapper`, `overflow: auto`) needs `padding: 3px` (2 px hover grow + 1 px outline). Without it the grown row and its outline were cut off at the list's left/top edge, so hovered spacer pills looked flat-ended like channels. Default preview width is 537 so depth-0 rows stay 494 px.
- **Auto-fill empty space** (`options.autoFill`, switch under Zoom / background color): fills any gap left by the offsets or by zooming out. `buildFill` draws the image at its scaled size and adds a 160 px border on every side (`extendCanvas`, left/right first, then top/bottom so the corners are covered too). Border line *d* is the 3 outermost edge lines averaged and box-blurred *along the edge* with radius `48 · d / 159` (prefix sums, alpha-weighted, edge-clamped). Beyond the border the outermost line is stretched. The fill canvas is built once per image + zoom (`useMemo`); with auto-fill on, slices are copied from it (`drawFilled`), so offset dragging stays live.
- **Auto-fill seams**: when an edge lands between two pixels (zoom ≠ 100 % makes offset steps fractional, e.g. 5.25 px), two shapes that each partly cover one pixel line leave it semi-transparent and the dark row shows through as a 1 px line. `drawFilled` splits each slice into up to 9 cells (before / inside / after the fill canvas on each axis), draws the stretched cells first (corners, then sides) 2 px bigger (`FILL_SEAM_OVERLAP`), then the inside cell on top. Verified: min alpha 255 in all slices at 105 % zoom with fractional offsets, in the corners and with the image fully out.
- **Vertical offset is free** (like the horizontal one): from `-roomsHeight` (image just below the channels) to `image.height` (image just above). The helper text shows the range where the image covers every channel (`0 … image.height − roomsHeight`).
- **Drag and drop / paste** (`upload.js`): dropping a file anywhere on the page, or Ctrl+V of a copied image, loads it. While a file is dragged over the window a full-screen "Drop image to upload" overlay shows (`pointer-events: none`, so the drop is handled on `window`; dragenter/dragleave are counted because they fire for every element crossed).
- **Auto-save in the browser** (`storage.js`): the image (`sourceImage`) and `{options, rooms}` are kept in IndexedDB (not localStorage: images can exceed its ~5 MB limit) and restored on load. Nothing is sent anywhere; each visitor only sees their own. Settings are saved 500 ms after changes stop. Restoring sets `lastSourceImage` first so the "new image resets offsets" effect doesn't wipe the saved offsets. "Start over" (under the image preview) clears the saved project and resets everything. Collapsed state in the preview is not saved.
