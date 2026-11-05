# TrackerThings V2 — Comprehensive iOS Redundancy, Interaction & Architecture Audit

**Repository**: `riuusix/TrackerThings-V2`  
**Branch**: `main`  
**Baseline Commit**: `f6845e46c0b00c998ea42316125556d458e9d918`

---

## Executive Summary

Following the initial interactive redesign (`64caf66` / `f6845e4`), the native iOS app gained `GooeyActionDock`, `MorphingQuickComposer`, `FlyToInboxOverlay`, `ActivityInboxSheet`, and `ActivityInboxStore`. However, a strict architectural and interaction audit reveals five classes of redundancy and quality gaps that must be resolved before the experience feels cohesive, deliberate, and fast:

1. **Interaction Entry-Point Duplication**: `DashboardView` still renders a top-trailing toolbar `+` `Menu` offering the exact same 4 creation actions as the floating `GooeyActionDock`. Meanwhile, `InboxPillButton` is duplicated across `DashboardView` (header), `CourseListView` (toolbar), and `ExamListView` (toolbar), while `GooeyActionDock` lacks Inbox access entirely.
2. **Fly-to-Inbox Unanchored Trajectory**: `FlyToInboxOverlay` animates toward a hardcoded top-right offset (`max(80, width * 0.28)`, `y: -14`) instead of measuring and flying to the real spatial coordinates of the Inbox destination.
3. **Inbox Event Identity Mismatch**: `ActivityInboxStore.syncWithAcademicState` uses canonical IDs (`task-123`, `exam-45`), whereas `NotificationService`'s foreground delegate constructs timestamped IDs (`fg-task-123-1762345678`), and `ViewModel` creation fallbacks use `task-new-<timestamp>`. This can produce duplicate entries for the same task/exam and repeated flight animations.
4. **Duplicated Form Validation & Default Logic**: `MorphingQuickComposer` and the modal edit sheets (`TaskFormSheet`, `KelasPenggantiFormSheet`, `CourseFormSheet`, `ExamFormSheet`) maintain separate time-range validation, string trimming, and default course selection logic.
5. **Double Haptics & Overlapping Animation Transactions**: Several buttons inside `GooeyActionDock`, `MorphingQuickComposer`, and `ActivityInboxSheet` apply `.buttonStyle(PressableScaleButtonStyle())` (which already triggers `HapticsHelper.impact(.light)` on press) AND call `HapticsHelper.selectionChanged()` or `HapticsHelper.impactLight()` inside their action closure, firing two haptic events for one tap.

---

## Dimension A — Visual Redundancy Audit

Classification key:
1. **Intentional design-system consistency** (Keep)
2. **Unnecessary UI duplication** (Remove / Consolidate)
3. **Duplicate information** (Remove / Simplify)
4. **Duplicate functionality** (Remove / Consolidate to canonical control)
5. **Duplicate implementation** (Refactor into shared source of truth)

| # | File & Component | Current Behavior | Redundancy Type | Impact | Recommended Action | Business Logic Unchanged? | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| A1 | `DashboardView.swift` (`toolbar` `+` Menu) vs `RootTabView.swift` (`GooeyActionDock`) | Both render a `+` button on the Home screen offering *Tambah Tugas*, *Kelas Pengganti*, *Mata Kuliah Baru*, and *Jadwal Ujian*. | **4. Duplicate functionality** & **2. Unnecessary UI duplication** | Confuses spatial memory: two `+` buttons on the same screen trigger the same composer. | Remove the duplicate creation `+` `Menu` from `DashboardView` toolbar. Keep `GooeyActionDock` as the single canonical quick-action entry point. | Yes | `InteractionQualityTests` + UI inspection |
| A2 | `DashboardView.swift`, `CourseListView.swift`, `ExamListView.swift` (`InboxPillButton`) | `InboxPillButton` is rendered in the Dashboard header, Course toolbar, and Exam toolbar, separate from the floating action dock. | **2. Unnecessary UI duplication** & **4. Duplicate functionality** | Splits attention between top header/toolbar and bottom action dock; clutters navigation bars. | Move **Kotak Aktivitas (Inbox)** into `GooeyActionDock` (Group 2: Academic Activity) and show a live unread badge indicator on the dock trigger when collapsed. Remove standalone `InboxPillButton` instances from screen headers/toolbars. | Yes | `InteractionQualityTests` |
| A3 | `DashboardView.swift` ("Perlu Perhatian" section vs "Daftar Tugas Aktif" section) | Urgent tasks due within $\le 2$ days appear in "Perlu Perhatian" AND appear a second time immediately below in "Daftar Tugas Aktif". | **3. Duplicate information** | Users see the exact same task twice on the same scroll view; if a task is pinned, it risks appearing a third time. | Keep "Perlu Perhatian" focused on high-level AI/exam/conflict alerts or deduplicate tasks across **Disematkan (Pinned)** and **Daftar Tugas Aktif** so each active task row is rendered once in the task list hierarchy. | Yes | `InteractionQualityTests` (`testPinnedTasksNeverDuplicateInActiveList`) |
| A4 | `TaskCardView.swift` (`priority` badge + `course` badge + `progress` pill + `urgency` chip) | Card header and subtitle both convey urgency when a task is overdue/due today. | **1. Intentional design-system consistency** (with minor tightening) | Priority (`Tinggi/Sedang/Rendah`) vs deadline countdown (`Hari Ini / Besok`) are distinct axes, so both are meaningful. | Preserve both axes; add compact pin indicator (`pin.fill`) and custom reminder indicator (`bell.fill`) when set. | Yes | Unit & visual check |
| A5 | `ScheduleCardView.swift` & `CourseCardView.swift` (`courseAccent` time rail + card surface) | Both use `AppTheme.Colors.courseAccent(for:)` on the left time rail and `.cardSurface`. | **1. Intentional design-system consistency** | Creates a recognizable visual identity for each subject across Home and Courses tabs. | Keep as canonical design-system consistency. | Yes | Existing `InteractiveRedesignTests` |

---

## Dimension B — Interaction Entry-Point Redundancy & Action Matrix

### Typed Dock Action Architecture
Instead of polluting `QuickComposerKind` with non-composer items, we define a dedicated typed action enum in `GooeyActionDock.swift`:

```swift
public enum DockAction: Hashable, Identifiable, Sendable {
    case create(QuickComposerKind)
    case openInbox
}
```

- **Group 1 — Quick Create (`DockAction.create(QuickComposerKind)`)**:
  - `.create(.task)` → Morphs into `MorphingQuickComposer(kind: .task)`
  - `.create(.replacement)` → Morphs into `MorphingQuickComposer(kind: .replacement)`
  - `.create(.course)` → Morphs into `MorphingQuickComposer(kind: .course)`
  - `.create(.exam)` → Morphs into `MorphingQuickComposer(kind: .exam)`
- **Group 2 — Academic Activity (`DockAction.openInbox`)**:
  - Displays real `ActivityInboxStore.shared.unreadCount` and urgent dot (`hasUrgentUnread`).
  - Collapses the dock and presents `ActivityInboxSheet` (`store.isPresentingInboxSheet = true`).
  - Never opens `MorphingQuickComposer`.
- **Collapsed Dock Trigger Unread Indicator**:
  - When `GooeyActionDock` is collapsed and `ActivityInboxStore.shared.unreadCount > 0`, a compact numeric badge sits on the top-trailing rim of the dock trigger (and pulses on `badgePulseTrigger` when a `FlyToInboxOverlay` card lands into the dock!).

### Canonical Route & Action Matrix

| User Intent | Canonical Entry Point | State Owner | Resulting Presentation / Destination |
| :--- | :--- | :--- | :--- |
| **Create Task** | `GooeyActionDock` → `.create(.task)` | `QuickActionDockController` + `DashboardViewModel` | `MorphingQuickComposer(kind: .task)` |
| **Create Replacement Class** | `GooeyActionDock` → `.create(.replacement)` | `QuickActionDockController` + `DashboardViewModel` | `MorphingQuickComposer(kind: .replacement)` |
| **Create Course (Manual)** | `GooeyActionDock` → `.create(.course)` | `QuickActionDockController` + `CourseViewModel` | `MorphingQuickComposer(kind: .course)` |
| **Import Schedule (OCR/PDF)** | `CourseListView` Toolbar (`doc.viewfinder` button) | `CourseListView` / `ImportScheduleViewModel` | `ImportScheduleView` sheet (specialized document workflow) |
| **Create Exam** | `GooeyActionDock` → `.create(.exam)` | `QuickActionDockController` + `ExamViewModel` | `MorphingQuickComposer(kind: .exam)` |
| **Open Activity Inbox** | `GooeyActionDock` → `.openInbox` | `QuickActionDockController` + `ActivityInboxStore` | `ActivityInboxSheet` |
| **Edit Existing Task** | `TaskCardView` (Edit) / `TaskDetailView` Toolbar | `DashboardViewModel.editingTask` | `TaskFormSheet` |
| **Pin / Unpin Task** | `TaskCardView` Swipe Right (`Sematkan` / `Lepas Sematan`) or VoiceOver action | `TaskSwipeCoordinator` + `DashboardViewModel` | Updates `task.isPinned`, moves task to/from **Disematkan** section |
| **Schedule Custom Task Reminder** | `TaskCardView` Swipe Left (`Atur Pengingat`) or `TaskDetailView` / VoiceOver action | `TaskSwipeCoordinator` + `DashboardViewModel` | `TaskReminderSheet` → `NotificationService.scheduleCustomReminderForTask` |
| **Open Entity from Notification / Inbox** | System Notification Tap / `FlyToInboxOverlay` Tap / `ActivityInboxSheet` Row Tap | `AppNavigationCoordinator` | `TaskDetailView` / `CourseDetailView` / `ExamDetailView` / `ReplacementClassDetailView` |

---

## Dimension C — Duplicate Business & Form Logic Audit

| Domain | Previous Duplication | Consolidated Single Source of Truth |
| :--- | :--- | :--- |
| **Task Validation & Defaults** | `MorphingQuickComposer` and `TaskFormSheet` separately validated `namaTugas.trimmingCharacters(in: .whitespacesAndNewlines)` and `idJadwal > 0`. | `DashboardViewModel.validateAndSaveTask(...)` validates title, course ID, deadline, and optional `reminderAt` in one place; both `MorphingQuickComposer` and `TaskFormSheet` call it. |
| **Replacement Class Validation** | `MorphingQuickComposer` checked `startStr < endStr`, while `KelasPenggantiFormSheet` only checked non-empty strings. | `DashboardViewModel.validateTimeRange(start:end:)` and `saveKelasPengganti(...)` enforce consistent `HH:mm` start < end validation for both surfaces. |
| **Course Validation** | `MorphingQuickComposer` and `CourseFormSheet` had separate validation checks. | `CourseViewModel.saveCourse(...)` enforces trimmed name and valid time range for both surfaces. |
| **Exam Validation** | `MorphingQuickComposer` and `ExamFormSheet` had separate validation checks. | `ExamViewModel.saveExam(...)` enforces valid `idJadwal` and time range for both surfaces. |

---

## Dimension D — Inbox & Notification Duplication Audit

### Traced Call Paths & Identity Mismatch
1. **`ActivityInboxStore.syncWithAcademicState(tasks:exams:replacementClasses:)`**:
   - Called from `DashboardViewModel.generateNotifications()` after `loadDashboardData()`.
   - Uses IDs: `task-\(task.id)`, `exam-\(exam.id)`, `replacement-\(kp.id)`.
2. **`NotificationService` (`LocalNotificationPresentationDelegate.userNotificationCenter(_:willPresent:)`)**:
   - Previously generated `id: "fg-\(notification.request.identifier)-\(Int(Date().timeIntervalSince1970))"`.
   - Because the ID included a timestamp, if a foreground reminder fired for `task-123` while `task-123` was already in `ActivityInboxStore` from `syncWithAcademicState`, the user got two rows for the same task, and repeated foreground deliveries created unbounded rows.
3. **`ViewModels` (`saveTask`, `saveKelasPengganti`, `saveCourse`, `saveExam`)**:
   - Enqueued arrival items with `task-\(createdId)` (or `task-new-<timestamp>` fallback).

### Canonical Event Identity Solution
We introduce `NotificationItem.canonicalId(kind:entityType:entityId:fallback:)`:
- **Academic State Heads-Up / Newly Created Entity**: Canonical ID `"\(entityType)-\(entityId)"` (e.g., `task-123`, `exam-45`, `course-12`, `replacementClass-8`).
- **Delivered Reminder Notification (`kind: "reminder"` / `"customReminder"`)**: Canonical ID `"reminder-\(entityType)-\(entityId)"` (or `"custom-reminder-task-\(entityId)"`).
  - Why? This satisfies both requirements in Phase 1.D:
    1. **Idempotency**: Delivering the same foreground reminder multiple times maps to the exact same canonical ID (`reminder-task-123`) and never duplicates rows.
    2. **Semantic Distinction**: A newly delivered reminder (`reminder-task-123`) is distinguishable from a general upcoming heads-up (`task-123`), while tapping either routes to `.taskDetail(id: 123)`.
- **Single-Flight Guarantee (`flightDeliveredIds`)**:
  - `ActivityInboxStore` tracks `flightDeliveredIds: Set<String>` (persisted in `UserDefaults`). Once a canonical event ID has triggered a `FlyToInboxOverlay` flight animation, subsequent deliveries or syncs of the same canonical ID update the item in-place without re-triggering a duplicate flight animation!

---

## Dimension E — Animation, Gesture & State Ownership Map

### Findings Fixed
1. **Double Haptics on Button Tap**: `PressableScaleButtonStyle` already fires `HapticsHelper.impact(.light)` on press. Removing redundant manual `HapticsHelper.impactLight()` / `selectionChanged()` calls from buttons that already use `PressableScaleButtonStyle` eliminates double haptic ticks.
2. **Overlapping Implicit `.animation(..., value:)` + `withAnimation`**: In `GooeyActionDock`, `actionMenuPill` had an implicit `.animation(AppTheme.Motion.menuItemEntrance(...), value: controller.isExpanded)` on top of `controller.toggleDock`'s explicit `withAnimation`. Consolidating stagger into the explicit transition/state owner prevents competing animation transactions.
3. **Full-Screen Unanchored `GeometryReader` in `FlyToInboxOverlay`**: Replaced with `Anchor<CGRect>` preference keys (`InboxTargetAnchorPreferenceKey`) measured in a named coordinate space (`"RootInteractiveSpace"`), animating the flight card along a quadratic Bézier curve from its top banner origin directly into the live `GooeyActionDock` / Inbox target rect.

### Component State Ownership Map

| Interaction / Feature | Single Canonical State Owner | View Consumers |
| :--- | :--- | :--- |
| **Tab & Deep-Link Navigation** | `AppNavigationCoordinator.shared` | `RootTabView`, `ActivityInboxStore`, `NotificationService` |
| **Gooey Action Dock & Morphing Composer** | `QuickActionDockController` (`@State` in `RootTabView`) | `GooeyActionDock`, `MorphingQuickComposer` |
| **In-App Activity Inbox & Fly-to-Inbox Flight** | `ActivityInboxStore.shared` (with `inboxTargetRect: CGRect`) | `FlyToInboxOverlay`, `GooeyActionDock`, `ActivityInboxSheet` |
| **Task Swipe Row Coordination (Single Open Row)** | `TaskSwipeCoordinator` (`@State` in `DashboardView`) | `SwipeableTaskRow` / `TaskCardView` |
| **Task Pin & Custom Reminder Persistence** | `DashboardViewModel` + `TrackerDataService` + `NotificationService` | `DashboardView`, `TaskCardView`, `TaskReminderSheet`, `TaskDetailView` |

