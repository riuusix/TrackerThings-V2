# TrackerThings V2 — Design System

## 1. Design Direction

**Editorial Distinctive — Intentional, Calm, Functional.**

TrackerThings is a personal productivity and schedule management product. Its
interface should feel thoughtfully art-directed, information-rich without
feeling crowded, and recognizable without relying on generic SaaS dashboard
conventions.

The goal is not to make the interface decorative. The goal is to give every
screen a clear visual hierarchy and a distinct point of view.

### Core principles

- **Editorial composition:** use deliberate alignment, whitespace, asymmetry,
  and contrast to establish hierarchy.
- **Functional first:** every visual element must help users understand their
  schedule, tasks, progress, or next action.
- **Distinctive, not decorative:** establish identity through typography,
  layout, color, and component details rather than excessive gradients or
  illustrations.
- **Calm productivity:** the interface should feel focused and approachable, not
  corporate, gamified, or visually noisy.
- **Consistency with flexibility:** use shared design tokens and components,
  while allowing individual pages to have their own composition.
- **Responsive by design:** preserve hierarchy and usability across desktop,
  tablet, and mobile.

## 2. Anti-Patterns to Avoid

Do not produce a generic AI-generated SaaS dashboard.

Avoid:

- Repeating identical rounded cards for every metric or content section.
- Using gradients, glow effects, glassmorphism, or decorative blobs without a
  clear purpose.
- Excessive pill badges, oversized icons, and emoji used as visual filler.
- Giving every section the same background, border, padding, and visual weight.
- Arbitrary large headings that waste space without improving hierarchy.
- Decorative charts or statistics that do not support a real user decision.
- Excessive shadows, nested containers, and unnecessary separators.
- Introducing new colors or component styles on individual pages without a
  design rationale.
- Replacing useful existing patterns just to make the interface look different.

Every section must justify its visual prominence and spatial footprint.

## 3. Visual Identity

### Color

Begin with a restrained neutral foundation:

- Warm off-white or subtle neutral page background.
- White or near-white primary surfaces where separation is necessary.
- Deep charcoal for primary text.
- Muted gray for supporting text and metadata.
- One recognizable brand accent for primary actions and important highlights.
- Semantic colors for success, warning, and destructive states.

Suggested initial tokens:

- `--background: #F7F7F4`
- `--surface: #FFFFFF`
- `--foreground: #20211F`
- `--muted: #777A73`
- `--border: #E6E6DF`
- `--accent: #526B52`
- `--success: #347653`
- `--warning: #A56A20`
- `--danger: #B84646`

Treat these as initial proposals, not permission to overwrite established
product colors blindly. Audit existing branding and contrast before finalizing.

Do not use every semantic color as decoration. The accent should remain
recognizable and intentional.

### Typography

Use typography to establish hierarchy.

- Page titles: distinctive, confident, and appropriately sized.
- Section headings: clear and restrained.
- Body text: highly readable at normal interface sizes.
- Metadata: smaller and muted, but never illegible.
- Numbers and dates: aligned and formatted consistently.

Prefer an existing project font when suitable. Otherwise use a reliable system
stack or a well-supported typeface already available in the project.

Use no more than two typeface families unless there is a compelling
product-specific reason.

Avoid making every heading oversized or bold.

### Spacing

Use a consistent spacing scale based on 4px increments.

Suggested values: 4, 8, 12, 16, 24, 32, 48, and 64px.

Use whitespace to separate information groups and create rhythm. Do not fill
every available space with cards.

### Borders and surfaces

- Prefer subtle borders over heavy shadows.
- Use shadows only when they communicate elevation.
- Reserve rounded containers for elements that benefit from grouping.
- Allow important content to sit directly on the page background.
- Do not apply the same corner radius indiscriminately to every element.

## 4. Dashboard Composition

The dashboard must prioritize what the user needs to know and do next.

Recommended hierarchy:

1. A clear page heading and relevant date or contextual information.
2. The most useful immediate action or upcoming schedule.
3. Today's tasks and schedule, organized by practical priority.
4. Supporting summaries or progress information.
5. Secondary information that should not compete with immediate actions.

This is a hierarchy proposal, not a mandate to invent new features. Inspect the
current product and preserve its real capabilities.

### Layout rules

- Establish a deliberate grid and alignment system.
- Use asymmetry selectively when it improves hierarchy.
- Let the primary content occupy more visual space than secondary summaries.
- Use compact rows, timelines, lists, and editorial groupings where they
  communicate information better than cards.
- Keep the navigation visually distinct from the main content.
- Avoid unnecessary duplication of information.
- Use responsive breakpoints based on content needs rather than arbitrary device
  labels.

The dashboard should look intentional even when all cards, charts, and
decorative elements are removed.

## 5. Components

Create or refine reusable components only where repetition and consistency
justify them.

Potential shared patterns:

- Application navigation.
- Page header and contextual date.
- Task row and task status.
- Schedule or timeline entry.
- Priority indicator.
- Section heading.
- Summary metric.
- Empty, loading, and error states.
- Dialogs, menus, and form controls.

Component rules:

- Reuse existing components where practical.
- Define consistent interaction, focus, disabled, and validation states.
- Prefer semantic HTML and accessible controls.
- Use clear labels and sufficient contrast.
- Do not create abstractions for a single use case without a reason.

## 6. Interaction and Motion

Interaction should be subtle, purposeful, and predictable.

- Use motion to communicate state changes, not to decorate the page.
- Preserve clear hover, focus, active, disabled, and loading states.
- Respect reduced-motion preferences.
- Ensure important functionality works with keyboard navigation.
- Avoid animations that delay common productivity tasks.

## 7. Responsive Behavior

Desktop:

- Use available width intentionally.
- Keep reading and task-management areas comfortable to scan.
- Avoid stretching dense content across excessively wide layouts.

Mobile:

- Prioritize the next action and essential information.
- Collapse secondary content logically.
- Avoid horizontal overflow.
- Keep controls comfortably tappable.
- Preserve the information hierarchy instead of simply shrinking the desktop
  layout.

## 8. SwiftUI Scope

The native iOS implementation is not part of the web dashboard redesign.

Preserve existing working SwiftUI navigation, native interactions, business
logic, state management, and platform conventions.

Only propose selective visual refinements when they provide a clear
user-experience benefit. Do not port the web aesthetic directly into iOS or
replace native components without a justified reason.

Any SwiftUI changes must be scoped separately and validated independently.

## 9. Engineering Constraints

- Inspect the existing repository and identify the actual framework, component
  system, styling conventions, and data contracts before implementation.
- Reuse the current architecture and dependencies whenever possible.
- Do not modify API behavior, database schemas, authentication, business logic,
  or unrelated routes as part of a visual redesign.
- Do not fabricate metrics, schedule data, or product capabilities.
- Keep existing functional behavior intact.
- Avoid unnecessary new dependencies.
- Do not overwrite unrelated user changes.

## 10. Definition of Done

The redesign is complete only when:

- The dashboard has a recognizable visual identity.
- The hierarchy of primary and secondary information is obvious.
- The layout avoids repetitive generic card patterns.
- Existing features and data remain functional.
- Loading, error, and empty states remain usable.
- Desktop and mobile layouts have been reviewed.
- Keyboard navigation and accessible contrast have been considered.
- The production build succeeds.
- Changes remain scoped to the intended web dashboard.
- Existing SwiftUI functionality remains untouched.
- The final implementation is reviewed against this document, not merely
  declared finished because it compiles.

## 11. Light and Dark Theme — Soft Contrast

Both themes must feel comfortable for extended daily use.

The visual identity must remain consistent across light and dark modes. Dark
mode is not a simple inversion of light mode; each theme must have intentionally
designed surfaces, text colors, borders, and semantic states.

### Light mode

- Use warm off-white and muted neutral backgrounds instead of pure white as the
  dominant canvas.
- Use charcoal rather than absolute black for primary text.
- Use restrained surface separation and subtle borders.
- Avoid large, high-luminance white areas that make the interface feel glaring.
- Maintain clear text readability without making the overall interface
  excessively bright.

Initial palette:

- Canvas: `#F1F0EB`
- Surface: `#E7E5DE`
- Primary text: `#343630`
- Secondary text: `#696B63`
- Border: `#D8D7CF`
- Accent: `#687B65`

### Dark mode

- Use deep charcoal with a subtle neutral or green undertone, not pure black as
  the main background.
- Use slightly lighter surfaces to distinguish content groups.
- Use soft off-white for primary text instead of pure white.
- Avoid excessively bright accent colors and stark white borders.
- Maintain enough surface separation to preserve hierarchy without relying on
  heavy shadows.

Initial palette:

- Canvas: `#222420`
- Surface: `#2C2F29`
- Elevated surface: `#353830`
- Primary text: `#E5E5DC`
- Secondary text: `#B5B7AC`
- Border: `#44473F`
- Accent: `#A6B69A`

### Theme behavior

- Implement theme colors as semantic design tokens rather than hardcoded colors
  scattered across components.
- Preserve the user's existing theme-selection behavior and system appearance
  integration.
- Ensure task statuses, priorities, warnings, and destructive actions remain
  distinguishable in both themes.
- Do not communicate status through color alone.
- Check text contrast, focus states, disabled controls, charts, form fields,
  menus, and dialogs in both themes.
- Avoid opacity-based text treatments that become illegible against different
  surfaces.
- Do not force every component to use a card background; hierarchy may also come
  from typography, spacing, and alignment.

### Acceptance criteria

The dashboard must be reviewed in both light and dark modes at realistic screen
brightness. Neither theme should feel glaring, muddy, excessively dark, or
washed out.

The same component must retain consistent hierarchy, interaction behavior, and
readability across both themes.
