# TrackerThings V2 — Mandatory Skill & Design System Audit (`skill-audit.md`)

**Repository:** `riuusix/TrackerThings-V2`  
**Baseline Commit:** `78c9c6939ad9bc382aac8a31a2b3e7de3c3e214c`  
**Audit Date:** 2026-11-12  

---

## 1. Complete Skill Inventory Across Repository & Environment

All skill directories in `.agents/skills/`, `.gemini/antigravity/builtin/skills/`, and root `DESIGN.md` were discovered and read in full (including `SKILL.md` and reference documentation) prior to implementation.

### 1.1 Workspace Skills (`.agents/skills/` — 31 Skills)

| # | Skill Name | Path | Core Domain & Rules Extracted |
|---|---|---|---|
| 1 | `apple-design` | `.agents/skills/apple-design/SKILL.md` + `references/hig/*.md` | Apple HIG for iOS: Liquid Glass & materials (`ultraThinMaterial`) belong strictly on the **functional navigation/control layer** (`FrostedGlideTabBar`, `GooeyActionDock`), never on content cards. Enforce `44×44pt` hit targets, `accessibilityReduceTransparency` opaque fallback, `accessibilityReduceMotion` crossfade fallback, Dynamic Type, and non-conflicting scroll axes (`scroll-views.md`, `page-controls.md`, `tab-bars.md`). |
| 2 | `animate` | `.agents/skills/animate/SKILL.md` + `RECIPES.md` | Spring-based interactive motion; never animate from `scale(0)` (use `0.92–0.96`); origin-aware popovers/menus (`transform-origin` / `UnitPoint.bottomTrailing`); interruptible transitions; asymmetric enter/exit timing. |
| 3 | `animation-performance` | `.agents/skills/animation-performance/SKILL.md` | 60/120fps budget (`16.6ms` / `8.3ms`). Animate only composite/GPU properties (`transform`, `opacity`). Avoid animating layout geometry (`height`, `margin`, `padding`) or dynamic blur radii per frame. |
| 4 | `animation-vocabulary` | `.agents/skills/animation-vocabulary/SKILL.md` | Canonical motion primitives: **Morph** (`matchedGeometryEffect` / shared surface), **Glide** (sliding active pill), **Stagger** (`30–50ms` cascade), **Press Compression** (`scale(0.95–0.97)`), **Deck Paging** (horizontal translation + opacity). |
| 5 | `choreograph` | `.agents/skills/choreograph/SKILL.md` | Multi-stage sequence orchestration: group into max 2–3 distinct stages; total entrance duration `< 300ms`; exits must be faster than entrances (`~120–200ms`) with content fading out before container collapse. |
| 6 | `emil-design-eng` | `.agents/skills/emil-design-eng/SKILL.md` | Emil Kowalski design engineering principles: tactile responsiveness, frequency-aware restraint (high-frequency task paging and tab switching must be fast, non-blocking, and interruptible), custom cubic-bezier curves (`cubic-bezier(0.22, 1, 0.36, 1)`). |
| 7 | `find-animation-opportunities` | `.agents/skills/find-animation-opportunities/SKILL.md` | Identify high-leverage spatial continuity points: bottom tab active indicator (`FrostedGlideTabBar`), action dock expansion (`GooeyActionDock`), and horizontal task deck paging (`InvisibleTaskDeck` / `InvisibleTaskPager`). |
| 8 | `improve-animations` | `.agents/skills/improve-animations/SKILL.md` + `AUDIT.md` | Audit existing animations for abrupt mount/unmount cuts, leftover transparent containers, non-origin scaling, and uncoordinated text/container timing. |
| 9 | `review-animations` | `.agents/skills/review-animations/SKILL.md` + `STANDARDS.md` | Verification standards: zero layout shift on close, zero hit-testing blockage during exit, reduced-motion compliance, and interruptibility mid-flight. |
| 10 | `mobile-native` | `.agents/skills/mobile-native/SKILL.md` | Native iOS ergonomics: thumb-zone reachability, safe-area inset coordination, edge-swipe protection (`< 24pt` left edge), and haptic pairing (`UISelectionFeedbackGenerator`, `UIImpactFeedbackGenerator`). |
| 11 | `write-swift` | `.agents/skills/write-swift/SKILL.md` | Swift 6 strict concurrency (`@MainActor`, `Sendable`, `actor` isolation, `nonisolated` pure functions), value-type state models, deterministic `Task` cancellation. |
| 12 | `antislop` | `.agents/skills/antislop/SKILL.md` | Eliminates AI-slop patterns: bans nested card-in-card borders, decorative rainbow badges, redundant action buttons, and unrequested visual noise. |
| 13 | `design-taste-frontend` | `.agents/skills/design-taste-frontend/SKILL.md` | Editorial hierarchy, restrained surface layering, tabular numerals (`tabular-nums`) for academic timestamps/deadlines/progress, and calm visual rhythm. |
| 14 | `design-taste-frontend-v1` | `.agents/skills/design-taste-frontend-v1/SKILL.md` | Foundational anti-template layout rules and component density discipline. |
| 15 | `frontend-design` | `.agents/skills/frontend-design/SKILL.md` | Intentional typography, clear focal points, and semantic token usage across Light and Dark modes. |
| 16 | `high-end-visual-design` | `.agents/skills/high-end-visual-design/SKILL.md` | Surface depth calibration (`canvas` → `surface` → `surface-elevated`), hairline `1px` borders, and restrained shadows. |
| 17 | `minimalist-ui` | `.agents/skills/minimalist-ui/SKILL.md` | Scannable editorial density, generous breathing room, and elimination of competing chrome. |
| 18 | `redesign-existing-projects` | `.agents/skills/redesign-existing-projects/SKILL.md` | Audit-first workflow: preserve all business rules, routes, and data contracts while upgrading interaction and visual architecture. |
| 19 | `stitch-design-taste` | `.agents/skills/stitch-design-taste/SKILL.md` | Semantic token contract alignment and hardware-accelerated micro-motion. |
| 20 | `web-design-guidelines` | `.agents/skills/web-design-guidelines/SKILL.md` | Accessibility (`aria-label`, `aria-live`, keyboard arrow navigation, `:focus-visible`), URL state synchronization, and touch-action discipline (`touch-action: pan-y`). |
| 21 | `supabase-postgres-best-practices` | `.agents/skills/supabase-postgres-best-practices/SKILL.md` + `references/query-missing-indexes.md` | Foreign key columns (`user_id`, `id_jadwal`) are **not** indexed automatically in PostgreSQL; composite B-tree indexes must match equality predicates (`user_id`, `status`, `is_pinned`) followed by sort columns (`deadline`, `tanggal`, `waktu_mulai`). |
| 22 | `supabase` | `.agents/skills/supabase/SKILL.md` | Safe idempotent SQL migrations (`CREATE INDEX IF NOT EXISTS`), connection pooling discipline, and user-scoped query isolation. |
| 23 | `full-output-enforcement` | `.agents/skills/full-output-enforcement/SKILL.md` | Complete, unabridged production code generation with zero placeholders or TODOs. |
| 24 | `design-md` | `.agents/skills/design-md/SKILL.md` | Living design-language contract synchronization between `DESIGN.md`, `app/globals.css`, and `AppTheme.swift`. |
| 25 | `brandkit` | `.agents/skills/brandkit/SKILL.md` | Cohesive brand identity and symbolic clarity across platforms. |
| 26 | `gpt-taste` | `.agents/skills/gpt-taste/SKILL.md` | Layout rhythm and visual hierarchy calibration. |
| 27 | `industrial-brutalist-ui` | `.agents/skills/industrial-brutalist-ui/SKILL.md` | Tabular data ledger clarity (applied selectively to archive/history tables while keeping Soft Blue Editorial tone). |
| 28 | `image-to-code` | `.agents/skills/image-to-code/SKILL.md` | Visual fidelity and layout proportion discipline. |
| 29 | `imagegen-frontend-mobile` | `.agents/skills/imagegen-frontend-mobile/SKILL.md` | Mobile screen hierarchy and uncluttered viewport composition. |
| 30 | `imagegen-frontend-web` | `.agents/skills/imagegen-frontend-web/SKILL.md` | Web section proportion and focal clarity. |
| 31 | `playwright-cli` | `.agents/skills/playwright-cli/SKILL.md` | Deterministic verification and E2E testing patterns. |

---

## 2. How Each Skill Domain Shapes This Redesign

### 2.1 Invisible Pagination (`apple-design/page-controls.md`, `scroll-views.md`, `web-design-guidelines`, `animate`)
- **Rule**: Never nest same-axis scroll views or hijack vertical scrolling when swiping a horizontal card deck.
- **Application**:
  - **Display Cap**: Strictly maximum **3 tasks per visible group/page** (`pageSize = 3`) in Dashboard task sections (`Disematkan`, `Prioritas Mendesak` / `Tugas Aktif`) and Task History (`Riwayat Tugas`).
  - **Web (`InvisibleTaskDeck.tsx`)**: Uses `touch-action: pan-y` with horizontal pointer/touch delta locking (`|dx| > 36px` and `|dx| > |dy| * 1.35`), keyboard `ArrowLeft`/`ArrowRight` navigation, accessible prev/next pill buttons, subtle `1 / N` + dot indicator, GPU-only slide/fade transitions (`cubic-bezier(0.22, 1, 0.36, 1)`), and automatic next-page prefetching.
  - **iOS (`InvisibleTaskPager.swift`)**: Chunks tasks into 3-item decks with compact inline header/footer deck controls (`< 1 / N >` + capsule dots), VoiceOver `accessibilityAdjustableAction`, and optional horizontal deck swipe when not dragging an individual row action, preserving current page state across `TaskDetailView` navigation.

### 2.2 Gooey Action Dock Reconstruction (`choreograph`, `animate`, `improve-animations`, `review-animations`)
- **Rule**: Popovers/menus must emerge from their trigger origin (`Alignment.bottomTrailing`), never scale from `0`, stagger item entrances (`30–50ms`), and collapse asymmetrically (items fade out first, then panel morphs back into the trigger bubble with zero residual transparent container).
- **Application**:
  - Explicit `GooeyDockPhase` state machine: `.closed` → `.pressing` → `.expandingBubble` → `.panelOpen` → `.collapsingItems` → `.collapsingBubble` → `.closed`.
  - When `.closed`, only the compact `56×56pt` `+` bubble button is mounted—no invisible panel or hit-testing overlay remains in the tree.

### 2.3 Frosted Glide Native iOS Bottom Navigation (`apple-design/tab-bars.md`, `liquid-glass.md`, `materials.md`)
- **Rule**: Floating tab bar uses translucent material (`ultraThinMaterial`) with a `1px` specular inner stroke, soft elevation shadow, and an opaque fallback when `accessibilityReduceTransparency` is enabled.
- **Application**:
  - `FrostedGlideTabBar.swift` houses all 5 canonical tabs (`Beranda`, `Jadwal`, `Tugas`, `Ujian`, `Profil`) inside one floating frosted capsule.
  - Active tab indicator uses `matchedGeometryEffect(id: "frostedGlideActivePill", in: namespace)` with `AppTheme.Motion.tabGlide` spring physics, light selection haptics, and coordinated bottom safe-area insets so neither screen content nor `GooeyActionDock` overlaps.

### 2.4 API, Database & Cache Performance (`supabase-postgres-best-practices`, `write-swift`)
- **Rule**: Index all foreign keys and composite filter+sort columns; deduplicate concurrent identical GET requests; scope all client caches by `userId` with explicit TTL and targeted mutation invalidation.
- **Application**:
  - Add composite PostgreSQL indexes on `tugas`, `jadwal`, `ujian`, `kelas_pengganti`, and `announcements`.
  - Add server-side cursor/offset pagination and filtering to `GET /api/tugas` while keeping full backward compatibility.
  - Implement `lib/requestCache.ts` (Web) and `RequestCacheCoordinator` in `NetworkService` / `TrackerDataService` / `LocalCacheService` (iOS) with in-flight request coalescing, user-scoped TTL + SWR caching, targeted single-task mutation patching, and complete purge on logout.

