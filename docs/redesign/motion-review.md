# TrackerThings V2 — Motion & Interaction Engineering Review (`motion-review.md`)

**Repository:** `riuusix/TrackerThings-V2`  
**Baseline Commit:** `78c9c6939ad9bc382aac8a31a2b3e7de3c3e214c`  
**Audit Date:** 2026-11-12  

---

## 1. Audit of Current Motion Implementation

### 1.1 `GooeyActionDock.swift` (Before Reconstruction)
- **What Worked**:
  - Single canonical floating action entry point on root tabs (`Home`, `Courses`, `Exams`).
  - Reports real geometry via `InboxTargetRectPreferenceKey` to anchor `FlyToInboxOverlay`.
  - Separates `BUAT CEPAT` (Quick Create) from `AKTIVITAS AKADEMIK` (Inbox).
- **Motion Flaws Identified**:
  1. **Single-Step Boolean Toggle (`isExpanded`)**: Toggling `isExpanded` animated the menu card and `GooeyDockBridgeShape` simultaneously without a staged emergence from the `+` bubble button.
  2. **Detach Between Bubble and Panel**: The menu card used `.scale(scale: 0.88, anchor: .bottomTrailing).combined(with: .offset(y: 16))` while `GooeyDockBridgeShape` sat at a fixed offset below it, so the bubble did not visibly rise and morph into the panel surface.
  3. **Symmetric / Simultaneous Exit**: When closing, the menu text/rows and panel container collapsed at the exact same moment instead of fading the inner items out first (`~90ms`) before shrinking the panel back into the bubble (`~200ms`).
  4. **Bridge Shape Always Mounted**: `GooeyDockBridgeShape(progress: controller.isExpanded ? 1.0 : 0.0)` remained mounted behind the `+` button even when completely closed.

### 1.2 Reconstructed `GooeyActionDock` Choreography
We introduce a deterministic `GooeyDockPhase` state machine in `QuickActionDockController`:
1. **Closed State (`.closed`)**:
   - Only the `56×56pt` `+` bubble button is rendered.
   - Zero residual panel or bridge overlay in the view tree.
2. **Opening Sequence (`openDock`)**:
   - **Stage 1 — Press Compression (`0–45ms`)**: Trigger button compresses subtly (`scale(0.95)`).
   - **Stage 2 — Bubble Emergence & Morph (`45–240ms`, `.expanding` → `.open`)**: A shared morphing surface (`matchedGeometryEffect(id: "gooeyDockMorphContainer", in: dockMorphNamespace)`) connected by `GooeyDockBridgeShape` rises from the `+` button's exact origin and expands into the rounded panel (`288pt` wide, `cornerRadius: 24`).
   - **Stage 3 — Staggered Menu Item Reveal (`70–260ms`)**: Menu items enter with a 35ms stagger per item (`scale(0.96 → 1.0)`, `offset(y: 8 → 0)`, `opacity(0 → 1)`), with icons, titles, and subtitles moving as a cohesive unit.
3. **Closing Sequence (`closeDock`)**:
   - **Stage 1 — Fast Content Exit (`0–95ms`, `.collapsingItems`)**: Menu items and section headers fade/scale out (`opacity: 0`, `scale: 0.96`) while the panel container holds its frame briefly.
   - **Stage 2 — Panel Shrinks into Bubble (`95–260ms`, `.closed`)**: Panel morphs back down into the `+` bubble origin using a damped spring (`response: 0.24, dampingFraction: 0.88`), rotating the `+` icon cleanly from `45°` to `0°` with zero bounce overshoot or leftover transparent layer.
4. **Reduced Motion (`accessibilityReduceMotion`)**:
   - Bypasses multi-stage spatial morphing and executes a single clean `160ms` crossfade.

---

## 2. Frosted Glide Bottom Navigation (`FrostedGlideTabBar.swift`)

### 2.1 Visual & Material Specification
- **Container**: Single floating capsule inset `16pt` horizontally and `10pt` from the bottom safe area.
- **Material**:
  - Standard mode: `.ultraThinMaterial` layered over a subtle `AppTheme.Colors.surfaceElevated.opacity(colorScheme == .dark ? 0.55 : 0.72)` tint for guaranteed legibility over scrolling content.
  - `accessibilityReduceTransparency == true`: Solid opaque `AppTheme.Colors.surfaceElevated` background.
- **Border & Shadow**:
  - `1px` inner specular border (`LinearGradient` from `Color.white.opacity(colorScheme == .dark ? 0.16 : 0.65)` to `AppTheme.Colors.borderSubtle.opacity(0.45)`).
  - Soft ambient shadow (`Color.black.opacity(colorScheme == .dark ? 0.36 : 0.10)`, `radius: 18, y: 8`).

### 2.2 Active Pill Glide Choreography
- **Tabs (5 Canonical Destinations)**:
  1. `Beranda` (`.home`, `house.fill`)
  2. `Jadwal` (`.courses`, `calendar.badge.clock`)
  3. `Tugas` (`.tasks`, `checklist`)
  4. `Ujian` (`.exams`, `graduationcap.fill`)
  5. `Profil` (`.settings`, `person.crop.circle.fill`)
- **Active Pill Motion**:
  - Uses `matchedGeometryEffect(id: "frostedGlideActiveTabPill", in: tabBarNamespace)` with `AppTheme.Motion.tabGlide` (`.spring(response: 0.34, dampingFraction: 0.78, blendDuration: 0)`).
  - Active pill features a soft blue-tinted frosted fill (`AppTheme.Colors.primaryMuted` + subtle `AppTheme.Colors.primary.opacity(0.22)` stroke).
  - Active icon scales subtly (`1.0 → 1.05`) in `AppTheme.Colors.primary` while the label remains crisp with `.fontWeight(.semibold)` (no jittery layout reflow).
  - Re-tapping the already-active tab pops its `NavigationPath` back to root with light haptic feedback.

---

## 3. Invisible Pagination Deck Motion (`InvisibleTaskDeck.tsx` & `InvisibleTaskPager.swift`)

### 3.1 Interaction & Gesture Rules
- **3-Item Card Cap**: Every task group (`Disematkan`, `Daftar Tugas Aktif`, `Riwayat Tugas Selesai`) renders at most **3 tasks at a time**.
- **Directional Gesture Locking**:
  - Horizontal swipe only activates when `|dx| > 24pt` and `|dx| > |dy| * 1.35`, ensuring vertical page scrolling is never hijacked.
  - On iOS, deck paging gestures yield to `SwipeableTaskRow` when swiping directly on an active task row, and header/footer pill controls + swipe on the deck footer/header provide frictionless page switching.
- **Transition Physics**:
  - Direction-aware horizontal slide + opacity transition (`offset(x: direction * 18pt)` + `opacity`, `cubic-bezier(0.22, 1, 0.36, 1)` on Web / `AppTheme.Motion.deckPageSpring` on iOS).
  - Under `prefers-reduced-motion` / `accessibilityReduceMotion`, transitions fall back to a pure opacity crossfade.
