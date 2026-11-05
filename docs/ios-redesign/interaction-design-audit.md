# TrackerThings V2 — Native iOS Interaction & Motion Design Audit

**Repository:** `riuusix/TrackerThings-V2`  
**Target Platform:** Native iOS (SwiftUI, iOS 18+, Swift 6)  
**Design System Foundation:** *Editorial Distinctive — Intentional, Calm, Functional* (`DESIGN.md`)  
**Interaction Evolution:** *Soft, Tactile, Fluid, Editorial, and Distinctive*

---

## 1. Existing Interaction Patterns

An audit of the current `Sources/TrackerThings` codebase reveals how users currently interact with academic entities across the four main tabs (`RootTabView.swift`):

1. **Creation Flows (Modal Sheets & Standard `Form`):**
   - **Dashboard (`DashboardView.swift:456`):** Uses a top-right `.toolbar` `Menu` (`+` icon) with two options ("Tambah Tugas", "Kelas Pengganti") that toggle boolean `@State` flags (`isPresentingAddTask`, `isPresentingAddReplacement`) to present standard `.sheet` modals (`TaskFormSheet`, `KelasPenggantiFormSheet`).
   - **Courses (`CourseListView.swift:180`):** Uses a toolbar menu to open `CourseFormSheet` or `ImportScheduleView` via `.sheet`.
   - **Exams (`ExamListView.swift:95`):** Uses a toolbar button to open `ExamFormSheet` via `.sheet`.
   - *Limitation:* Every creation action is buried in top-right navigation bar menus (far from thumb reach on modern iPhones) and opens a generic, unanchored iOS `Form` sheet that has no spatial connection to the button that triggered it.

2. **Task & Schedule Progression:**
   - **Task Completion (`TaskCardView.swift:46`):** Left circular checkbox button triggers `onMarkCompleted`, plays a success haptic, and calls `viewModel.updateTaskProgress(task:progress: 100)`. Completed tasks disappear from `urgentTasks` on reload without an inline undo affordance or spatial transition into a completed state.
   - **Task Progress Slider (`TaskCardView.swift:169`):** Every task card in the dashboard embeds a live `Slider(value: $localProgress, in: 0...100, step: 5)`. While functional, having active horizontal sliders on every row in a vertical scroll view creates gesture contention and visual repetition.
   - **Schedule Day Selection (`DashboardView.swift:102`):** Horizontal pill bar with `matchedGeometryEffect(id: "DAY_SELECTOR_PILL")` switching `viewModel.selectedDay`.

3. **Notification & Activity Arrival:**
   - **System Notifications (`NotificationService.swift`):** Local `UNUserNotificationCenter` schedules H-1 / H-2h / lead-time reminders and routes taps via `NotificationPayload` (v2 schema) and `AppNavigationCoordinator`.
   - **Unused In-App Notification Model (`NotificationItem.swift`, `DashboardViewModel.swift:14, 426`):** `DashboardViewModel` computes `public var notifications: [NotificationItem]` inside `generateNotifications()`, but **no view in the iOS app renders or exposes these items**. There is no in-app activity center or inbox, nor any visual bridge when a reminder arrives or an academic state changes in-app.

---

## 2. Repetitive or Generic SwiftUI Patterns

 Evaluating the existing views against `DESIGN.md` and `antislop` rules exposes several generic patterns:

| Location | Current Pattern | Why It Feels Generic / Static |
| --- | --- | --- |
| `DashboardView.swift:184–450` | Vertical stack of 6 uniform card sections (`AcademicBriefingCardView`, `Perlu Perhatian`, `Jadwal Kuliah`, `Tugas Aktif`, `Kelas Pengganti`) all using `.cardSurface()` | Every section uses identical rounded rectangles (`cornerRadius: 14`), `14pt` padding, and `1pt` subtle borders—creating a "wall of cards" rather than an editorial workspace. |
| `TaskFormSheet.swift`, `CourseListView.swift:301`, `ExamListView.swift:315`, `KelasPenggantiFormSheet.swift` | Default `NavigationStack { Form { Section { ... } } }` inside `.sheet` | Indistinguishable from default Xcode template forms; lacks contextual header hierarchy, inline quick-pick chips, and origin-aware spatial continuity. |
| `TaskCardView.swift:157–178` | Always-visible `Slider` on every dashboard task row | Crowds the card, forces uniform tall card heights, and risks accidental slider drags while scrolling vertically. |
| `CourseListView.swift:27`, `ExamListView.swift:20` | Standard `List` with `.listStyle(.plain)` wrapping uniform cards | Does not group or differentiate courses by identity, category, or time rhythm; no inline peek/expansion before full push navigation. |
| `DashboardView.swift:44–84` | Standard top header + toolbar `+` menu | Requires reaching to the top corner of the screen for primary daily creation actions (`Tambah Tugas`, `Kelas Pengganti`, `Mata Kuliah`, `Ujian`). |

---

## 3. Existing Motion and Animation Architecture

From the previous refinement pass, `AppTheme.swift` defines foundational tokens:

| Before | After (Target Evolution) | Why |
| --- | --- | --- |
| Basic `AppTheme.Motion` with 4 static presets (`interactiveSpring`, `spatialSpring`, `snappy`, `entranceEaseOut`) | Full purpose-built motion vocabulary in `AppTheme.Motion` covering dock expansion, button-to-panel morphing, staggered item cascade, fly-to-inbox arc, and numeric/completion transitions, gated by `accessibilityReduceMotion` | Aligns with Emil Kowalski's rule: extend existing codebase tokens rather than forking them, with exact spring parameters per interaction role. |
| Sheet-only creation (`isPresentingAddTask = true`) | Origin-aware **Gooey Action Dock** $\rightarrow$ **Morphing Quick Composer** using shared namespace / spring-driven spatial expansion from the floating trigger | Popovers, menus, and quick composers should scale and morph from their trigger (`scale(0.92)` + opacity + spring), never teleport from an unrelated screen edge. |
| Instant disappearance of completed task on reload | Staged completion choreography (`checkmark draw` $\rightarrow$ `row collapse & settle into completed drawer` + 4s undo opportunity) | Prevents jarring layout jumps (`popLayout` / simultaneous gap closure) and gives immediate tactile confirmation with recovery. |
| Invisible `viewModel.notifications` array | **Fly-to-Inbox** arrival card that enters at top, arcs into the header Inbox pill badge, and persists in an in-app `ActivityInboxStore` | Makes incoming reminders and academic events tangible and inspectable without fabricating fake events. |

---

## 4. Opportunities for New Interactions (Emil Kowalski Gate)

Applying the four-question gate from `find-animation-opportunities` (*Frequency*, *Purpose*, *Speed*, *Function*):

### Part 1 — Approved Opportunities Table

| # | Location | Today | Purpose | Frequency | Suggested Motion (SwiftUI) |
| --- | --- | --- | --- | --- | --- |
| 1 | `RootTabView.swift` / `GooeyActionDock.swift` | Top-bar `Menu` in `DashboardView` only | **Spatial consistency & State indication** — unifies quick creation within thumb reach | Occasional (5–15×/day) | Floating `+` trigger rotates $45^\circ$ (`response: 0.32, dampingFraction: 0.76`) while connected action pills emerge from trigger origin with non-uniform stagger (`0ms`, `35ms`, `65ms`, `90ms`), starting at `scale(0.92)` + `opacity: 0` (never `scale(0)`), plus subtle canvas metaball/gooey bridge between trigger and primary pill. |
| 2 | `MorphingQuickComposer.swift` | Unrelated `.sheet` with default `Form` | **Spatial consistency** — editor grows directly out of the chosen action pill | Occasional (3–10×/day) | Selected action pill morphs via `matchedGeometryEffect` + `.spring(response: 0.38, dampingFraction: 0.82)` into a floating editorial composer card anchored above the keyboard; cancel reverses symmetrically back to resting dock in `220ms`. |
| 3 | `FlyToInboxBanner.swift` & `ActivityInboxSheet.swift` | `viewModel.notifications` unused; no visual arrival | **Spatial consistency & Feedback** — shows where an incoming reminder or created item lives | Occasional (1–5×/day) | Compact arrival pill enters from top safe area (`translateY(-24pt)`, `scale(0.95)`, `opacity: 0` $\rightarrow$ `.spring(response: 0.36, dampingFraction: 0.80)`), holds `1.8s` (interruptible by tap), then arcs into the header Inbox icon (`scale(0.35)`, `opacity: 0`) as the badge counter pulses (`scale(1.18)` $\rightarrow$ `1.0`). |
| 4 | `TaskCardView.swift` & `DashboardView.swift` | Task vanishes on reload; slider always exposed | **Feedback & Preventing jarring change** — tactile completion with undo + progressive disclosure | Tens/day | Tapping completion ring fills circle + scales checkmark (`response: 0.28, dampingFraction: 0.72`), strikes title, and smoothly collapses row into a compact "Baru Saja Selesai (Urungkan)" bar before settling into Completed section. Tapping row body expands/collapses inline progress scrubber & quick actions (`response: 0.30, dampingFraction: 0.84`). |
| 5 | `ScheduleCardView.swift` & `CourseCardView.swift` | Static cards that only push on tap | **State indication & Spatial consistency** — quick peek of room, lecturer, notes, and related tasks | Tens/day | Tapping quick-peek chevron expands contextual drawer inline (`opacity` + clipped height with `.spring(response: 0.30, dampingFraction: 0.85)`); tapping "Buka Detail" or card title pushes full detail view. |
| 6 | `ExamListView.swift` & `AcademicBriefingCardView.swift` | Static countdown numbers and status pills | **State indication** — legible numeric updates when real data changes | Occasional | `.contentTransition(.numericText())` on countdown days, SKS totals, and active task counts animated only when underlying values change (`response: 0.30, dampingFraction: 0.85`). |

### Part 2 — Rejected Candidates (Restraint Filter)

- **Tab Bar Selection Bounce / Staggered Tab Content Reload (`RootTabView.swift:16`):** **Rejected (Frequency: 50–100+ times/day).** Switching tabs is a high-frequency core navigation action. Staggering dashboard sections every time the user switches tabs makes the app feel sluggish. Tab switches remain immediate/snappy.
- **Continuous Floating/Breathing Animation on Cards or Empty States:** **Rejected (Purpose Gate Failure).** Violates `animate` and `DESIGN.md` — decorative perpetual motion on functional academic data distracts reading and drains battery.
- **Swipe-to-Complete / Custom Horizontal Drag Gestures on Task Cards (`TaskCardView.swift`):** **Rejected (Function & HIG Gate).** Conflicts with iOS interactive pop gesture, horizontal day-selector scrolling, and VoiceOver rotor actions. Explicit tactile buttons and inline expansion are safer and clearer.
- **Animating Keyboard Focus or Text Field Typing in Quick Composer:** **Rejected (Frequency: 100+/day).** Keyboard-initiated input must have zero latency.

---

## 5. Choreography Timelines (`choreograph` Skill Specification)

### A. Gooey Action Dock Expansion (Total budget: $\le 260\text{ms}$)

| Element | Role | Starts | Duration / Spring | Motion | Relationship |
| --- | --- | --- | --- | --- | --- |
| Primary `+` Button & Gooey Neck | **Lead** | `0ms` | `spring(0.32, 0.76)` | Icon rotates $0^\circ \rightarrow 45^\circ$, metaball neck stretches upward | Leads the gesture |
| Action 1: Tambah Tugas | **Support** | `0ms` | `spring(0.34, 0.78)` | `offsetY: 0` from trigger, `scale(0.92 -> 1.0)`, `opacity(0 -> 1)` | Together with Lead |
| Action 2: Kelas Pengganti | **Support** | `35ms` | `spring(0.34, 0.78)` | `scale(0.92 -> 1.0)`, `opacity(0 -> 1)` | Overlaps Action 1 (non-uniform stagger) |
| Action 3: Jadwal Kuliah | **Support** | `65ms` | `spring(0.34, 0.78)` | `scale(0.92 -> 1.0)`, `opacity(0 -> 1)` | Overlaps Action 2 |
| Action 4: Jadwal Ujian | **Support** | `90ms` | `spring(0.34, 0.78)` | `scale(0.92 -> 1.0)`, `opacity(0 -> 1)` | Overlaps Action 3 |
| Backdrop Scrim | **Decoration** | `0ms` | `easeOut(0.18)` | `opacity(0 -> 1)` only | Together with Lead |
| Underlying Dashboard Content | **Static** | — | — | Remains still (no background scaling) | Static |

*Exit rule:* Simultaneous collapse (`spring(0.24, 0.88)`), no reverse stagger—when the user dismisses, all pills collapse at once.

### B. Action Pill $\rightarrow$ Morphing Quick Composer

| Element | Role | Starts | Duration / Spring | Motion | Relationship |
| --- | --- | --- | --- | --- | --- |
| Selected Action Pill $\rightarrow$ Composer Card Shell | **Lead** | `0ms` | `spring(0.38, 0.82)` | Shared `matchedGeometryEffect` container morphs from pill frame to composer card frame | Lead container carries content |
| Unselected Action Pills | **Support** | `0ms` | `easeOut(0.15)` | `opacity(1 -> 0)`, `scale(1 -> 0.94)` | Exit immediately together |
| Composer Header & Input Fields | **Support** | `40ms` | `easeOut(0.20)` | Fade in `opacity(0 -> 1)` inside the expanding container (no per-field stagger) | One entrance per container |

### C. Fly-to-Inbox Arrival Sequence

| Element | Role | Starts | Duration / Spring | Motion | Relationship |
| --- | --- | --- | --- | --- | --- |
| Floating Arrival Card | **Lead** | `0ms` | `spring(0.36, 0.80)` | Enters at top (`offsetY: -20 -> 0`, `scale: 0.95 -> 1.0`, `opacity: 0 -> 1`) | Lead |
| Flight into Inbox Icon | **Lead** | `+1800ms` (or on swipe/collapse) | `spring(0.42, 0.82)` | Translates toward Inbox button anchor (`GeometryReader` / preference key coordinates), `scale(1.0 -> 0.32)`, `opacity(1 -> 0)` | Sequence after readable hold |
| Inbox Icon & Unread Badge | **Support** | Lands at end of flight (`+2100ms`) | `spring(0.28, 0.68)` | Badge increments with `.numericText()`, pill pulses `scale(1.0 -> 1.16 -> 1.0)` | Synced to impact of Lead |

---

## 6. Navigation and Accessibility Constraints

1. **Preserving P0 Deep-Link Architecture:**
   - `AppNavigationCoordinator`, `AppRoute`, and `NotificationPayload` (v2) remain the authoritative routing layer.
   - Tapping any item in the new **In-App Activity Inbox** or **Fly-to-Inbox** preview calls `AppNavigationCoordinator.shared.navigate(to: route)` or `handleNotificationPayload(payload)`.
2. **Thumb-Zone Ergonomics & Safe Areas:**
   - The **Gooey Action Dock** floats at the bottom-trailing safe area above the tab bar (`padding(.bottom, 12)`), never obscuring tab bar items or list bottom rows (lists receive extra bottom `safeAreaInset` padding).
   - Automatically hides when keyboard is active or when a detail/settings view is pushed onto a tab's `NavigationPath`.
3. **Accessibility & Reduced Motion (`@Environment(\.accessibilityReduceMotion)`):**
   - Every custom control has explicit `.accessibilityLabel`, `.accessibilityHint`, and `.accessibilityAddTraits`.
   - Minimum hit target $\ge 44 \times 44\text{ pt}$ on all dock buttons, inbox triggers, and completion rings.
   - When `accessibilityReduceMotion` is enabled:
     - Gooey metaball deformation, spatial flight paths, and scale morphs collapse into clean, fast `0.18s` opacity cross-fades.
     - No stagger delays are applied.
   - Escape / VoiceOver two-finger Z scrub (`accessibilityAction(.escape)`) dismisses both the Gooey Action Dock and the Morphing Quick Composer.

---

## 7. Components to Rebuild vs. Preserve

### Preserve (Core Architecture, Services & Domain Logic)
- **Networking & Persistence:** `NetworkService`, `TrackerDataService`, `AuthService`, `LocalCacheService`, `KeychainHelper`, `NetworkMonitor`.
- **Notification & Deep-Link Engine:** `NotificationService`, `NotificationPayload`, `AppNavigationCoordinator`, `AppRoute`, `EntityNotFoundView`.
- **OCR & Schedule Import Pipeline:** `AppleVisionOcrService`, `LocalScheduleExtractor`, `ImportScheduleViewModel`, `ImportScheduleView`.
- **ViewModels & Business Rules:** `DashboardViewModel`, `CourseViewModel`, `ExamViewModel`, `AuthViewModel`, `SettingsViewModel` (extended cleanly with undo/inbox hooks without breaking existing methods).

### Rebuild / Introduce (Interactive UI/UX Layer)
1. **New — `ActivityInboxStore.swift` & `FlyToInboxOverlay.swift` & `ActivityInboxSheet.swift`:**
   - Coherent in-app activity center persisted via `LocalCacheService` / `UserDefaults`, fed by real `UNUserNotificationCenter` foreground deliveries, urgent academic deadlines (`DashboardViewModel.notifications`), and real CRUD milestones.
   - Coordinates the **Fly-to-Inbox** spatial animation into the header Inbox button.
2. **New — `GooeyActionDock.swift`:**
   - Custom SwiftUI floating action dock with Canvas-rendered liquid/gooey metaball connection bridge, spring-driven action fan-out, backdrop scrim, and full VoiceOver/Reduce-Motion support.
3. **New — `MorphingQuickComposer.swift`:**
   - Origin-aware morphing editor supporting **Quick Task Composer**, **Quick Schedule / Replacement Class Composer**, **Quick Course Composer**, and **Quick Exam Composer** using actual view model save methods and validation.
4. **Rebuilt — `DashboardView.swift`:**
   - Editorial workspace header with live **Inbox Pill Button** (anchor for Fly-to-Inbox), interactive **Academic Briefing Ribbon**, **Focus Today Timeline** (with inline expandable schedule items), and **Living Task List** (with inline expandable progress drawer and completion undo banner).
5. **Refined — `TaskCardView.swift`, `ScheduleCardView.swift`, `CourseCardView.swift`, `CourseListView.swift`, `ExamListView.swift`:**
   - Upgraded into living academic components with inline expansion, category-coded editorial accents, numeric countdown transitions, and clutter-free default states.

