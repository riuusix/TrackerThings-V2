# Task: Consolidate and Enhance `DESIGN.md` — TrackerThings V2 Design System

Update the existing `DESIGN.md` into the **single source of truth for the
TrackerThings V2 visual identity and UI design system**.

This task is documentation-only. Do not implement UI changes or modify
application source code.

## 1. Preserve and strengthen the design philosophy

Keep the established direction:

**Editorial Distinctive — Intentional, Calm, Functional.**

TrackerThings should feel thoughtfully art-directed, recognizable, calm, and
information-rich without feeling crowded. It must not resemble a generic SaaS
dashboard or an interface assembled from repetitive AI-generated templates.

Preserve and consolidate the existing guidance for:

- Editorial composition and distinctive page layouts.
- Functional hierarchy and information density.
- Typography, type scale, font weights, and readable line lengths.
- Spacing scale, alignment, rhythm, and visual grouping.
- Surface hierarchy, borders, radii, and component consistency.
- Navigation, forms, tables, schedules, task lists, dialogs, and dashboard
  components.
- Interaction states, transitions, and feedback.
- Responsive behavior across desktop, tablet, and mobile.
- Accessibility, keyboard navigation, focus visibility, and reduced motion.
- Engineering constraints and the existing SwiftUI scope restrictions.

Improve clarity and remove contradictions, but do not rewrite unrelated content
unnecessarily.

## 2. Establish the soft blue brand identity

Replace the previous sage-green brand accent with a restrained **soft blue**
identity that aligns with the TrackerThings logo.

The result should feel calm, distinctive, and comfortable for extended use—not
neon, excessively saturated, overly bright, or like a generic corporate SaaS
product.

Use these canonical starting tokens.

### Light theme

| Token            | Value     |
| ---------------- | --------- |
| Canvas           | `#F1F2F5` |
| Surface          | `#E6E9EF` |
| Elevated surface | `#FFFFFF` |
| Primary text     | `#343944` |
| Secondary text   | `#6B7280` |
| Subtle border    | `#D5DCE8` |
| Strong border    | `#B8C3D5` |
| Accent           | `#5879B8` |
| Accent hover     | `#3F5F9B` |
| Accent muted     | `#E5ECF8` |

### Dark theme

| Token            | Value     |
| ---------------- | --------- |
| Canvas           | `#242831` |
| Surface          | `#2D323D` |
| Elevated surface | `#373E4B` |
| Primary text     | `#E7EAF0` |
| Secondary text   | `#B2BAC8` |
| Subtle border    | `#454D5C` |
| Strong border    | `#626D80` |
| Accent           | `#91ADE5` |
| Accent hover     | `#B0C5F1` |
| Accent muted     | `#303D55` |

These are the canonical starting tokens for the web design system. Do not
preserve sage green or botanical green as an alternative brand palette. Green
may remain only where it serves a legitimate semantic purpose, such as success
status.

## 3. Visual identity and color usage

Consolidate the existing color guidance into a coherent visual identity section.

### Brand accent

Use soft blue intentionally for:

- Primary actions and important interactive controls.
- Active navigation and selected tabs.
- Keyboard focus indicators.
- Selected items and meaningful interactive highlights.
- Progress indicators and relevant data visualization.
- Links and other elements that require clear interactive affordance.

Do not make every component blue. Most of the interface should remain grounded
in neutral canvas, surfaces, typography, and subtle borders.

### Neutral foundation

- Use the canonical canvas and surface tokens to create visual depth without
  excessive contrast.
- Keep light mode soft and neutral rather than stark white.
- Keep dark mode charcoal with a subtle blue undertone rather than pure black.
- Use borders and surface changes to separate content where appropriate.
- Avoid excessive nested cards, unnecessary outlines, and redundant containers.

### Color anti-patterns

Avoid:

- Neon blue, oversaturated accents, and excessively bright interactive elements.
- Gradients, glow effects, glassmorphism, and decorative blue backgrounds
  without a clear functional purpose.
- Using accent color on every heading, card, icon, or background.
- Introducing new brand colors on individual pages without a documented reason.
- Using color as the only way to communicate status, priority, or meaning.
- Hardcoding arbitrary colors inside individual components when an existing
  semantic token should be used.

Preserve the existing anti-pattern guidance for generic dashboard templates,
repetitive cards, decorative charts, excessive pills and badges, oversized
headings without purpose, ornamental icons, and visual decoration that does not
improve usability.

## 4. Semantic design tokens and consistency rules

Document the semantic token architecture so the system remains consistent as the
application grows.

At minimum, define tokens for:

- Canvas and default surfaces.
- Elevated surfaces and overlays.
- Primary and secondary text.
- Subtle and strong borders.
- Brand accent, accent hover, and muted accent backgrounds.
- Success, warning, danger, and disabled states.
- Focus indicators and interactive states.
- Any existing semantic tokens required by the current application.

Use semantic names rather than making components depend directly on raw palette
values.

For example, components should consume concepts such as `background`, `surface`,
`text-primary`, `border-subtle`, `accent`, `accent-hover`, `accent-muted`,
`success`, `warning`, `danger`, and `disabled`, adapted to the project's
existing naming convention.

Rules:

1. Keep the token architecture compatible with the current codebase; document
   recommendations without implementing them.
2. Define light and dark values for applicable tokens.
3. Keep semantic status colors distinct from the brand accent.
4. Do not invent exact semantic status values if the existing document or
   codebase already defines them; preserve legitimate existing definitions and
   document any gaps.
5. Do not scatter raw hex values throughout component-specific guidance.
6. If an exception is genuinely necessary, document its purpose and scope.
7. Ensure disabled, hover, selected, focus, success, warning, and destructive
   states remain distinguishable.
8. Do not rely on color alone to communicate important information.

## 5. Light and dark themes

Replace the previous sage-based palette and green-undertone guidance with the
canonical soft blue tokens in Section 11, or in the equivalent existing theme
section.

### Light mode

The light theme should feel soft, neutral, and comfortable for extended use.

- Use `#F1F2F5` as the canvas.
- Use `#E6E9EF` for standard surfaces.
- Use `#FFFFFF` selectively for elevated surfaces rather than making the entire
  interface stark white.
- Use muted blue accents that remain readable and purposeful.
- Avoid excessive brightness, washed-out text, and unnecessary high-contrast
  boundaries.

### Dark mode

The dark theme should feel calm and layered.

- Use `#242831` as the canvas.
- Use `#2D323D` for standard surfaces.
- Use `#373E4B` for elevated surfaces.
- Use soft blue accents that remain legible without causing eye strain.
- Avoid pure black, overly dark surfaces, glowing accents, and large areas of
  bright blue.

### Cross-theme consistency

- Preserve the same information hierarchy, component meaning, and interaction
  semantics in both themes.
- Adapt contrast appropriately rather than mechanically inverting colors.
- Preserve existing theme-selection and system-appearance behavior.
- Ensure borders, muted surfaces, text, charts, dialogs, menus, form controls,
  and interactive states work in both themes.
- Do not introduce a separate brand identity for either theme.
- Treat light and dark themes as equally supported experiences, not as a primary
  theme and an afterthought.

The specified hex values are the canonical starting points. If a token creates
an accessibility issue in a particular use, document the issue and the intended
semantic adjustment instead of silently introducing an unrelated color.

## 6. Editorial layout and component guidance

Preserve and refine the existing layout system rather than replacing it with a
conventional dashboard template.

The document should explain how to create distinction through:

- Clear content hierarchy and deliberate composition.
- Intentional variation in layout where content requires it.
- Strong alignment, spacing rhythm, and meaningful negative space.
- Appropriate contrast between primary information and supporting details.
- Dense information presented in a calm, scannable manner.
- Components whose visual weight reflects their actual importance.

Do not force every page into the same arrangement of a page title, four
statistic cards, a grid of identical panels, and a chart.

Component rules should explain when to use cards, tables, lists, timelines,
compact metadata, dividers, and other existing patterns. Reuse established
components when they are appropriate, but do not let reuse create repetitive or
visually monotonous pages.

Maintain consistency without forcing uniformity.

## 7. Typography, spacing, and surfaces

Preserve the existing typography and spacing principles. Refine them only where
needed to make the document more actionable and internally consistent.

Ensure the guidance covers:

- A deliberate type hierarchy for page titles, section headings, body text,
  labels, and metadata.
- Readability and appropriate line lengths.
- Consistent spacing tokens and layout rhythm.
- Intentional surface elevation rather than excessive card nesting.
- Consistent borders, corner radii, and component proportions.
- Visual restraint: decoration must support comprehension rather than compete
  with it.

Do not introduce a new typography framework, dependency, or arbitrary design
scale solely for this documentation update.

## 8. Interaction, responsive design, and accessibility

Preserve all existing requirements and consolidate overlapping guidance without
weakening it.

Include:

- Clear hover, pressed, focused, selected, disabled, loading, success, warning,
  and destructive states where applicable.
- Visible keyboard focus and usable keyboard navigation.
- Sufficient text and interface contrast in both themes.
- Semantic labels and accessible control behavior.
- Responsive layouts that adapt to available width instead of merely shrinking
  desktop layouts.
- Appropriate touch targets and mobile spacing.
- Reduced-motion support and restrained transitions.
- Clear empty, loading, error, and success states.
- Information that remains understandable without relying exclusively on color,
  animation, or icons.

Do not sacrifice usability or accessibility to preserve a particular aesthetic.

## 9. Engineering and SwiftUI scope restrictions

Keep the existing engineering constraints and make the scope distinction
explicit.

This document update does not authorize implementation changes.

- Do not modify SwiftUI source files.
- Do not modify application source code, components, stylesheets, configuration,
  dependencies, or build scripts.
- Do not change business logic, API behavior, database schemas, authentication,
  or data handling.
- Do not change theme-selection behavior or system appearance settings.
- Do not install packages or generate application code.
- Do not modify unrelated documentation or files.
- Do not overwrite or discard existing local changes.
- Do not create a commit or push.

`DESIGN.md` describes the web design system and must preserve the existing
guidance that native SwiftUI should remain genuinely native to iOS. Any future
SwiftUI refinement should be selective and intentional, not a wholesale attempt
to force the web design system onto native iOS controls.

## 10. Documentation consistency review

After updating the document, review the entire `DESIGN.md`.

Search for and resolve:

- References to sage green or botanical green as brand colors.
- Old green accent hex values or old palette definitions.
- Conflicting color descriptions or theme rules.
- Duplicate or contradictory token definitions.
- References to pure white or pure black as the default canvas.
- Outdated instructions that conflict with the canonical soft blue palette.

Preserve legitimate semantic green status colors, existing
success/warning/danger meanings, and unrelated content.

Do not remove unrelated design principles merely because they appear in the same
section as old color guidance.

If the existing file uses different section numbering or headings, update the
corresponding sections in place instead of creating duplicate sections or
forcing an unnecessary document restructure.

## 11. Verification and final report

Before editing:

1. Inspect the current `DESIGN.md` and understand its existing structure.
2. Run `git status --short`.
3. Identify pre-existing changes and distinguish them from this task's changes.
4. Preserve all unrelated local modifications.

After editing:

1. Review the complete updated document for clarity and consistency.
2. Verify the canonical light and dark tokens exactly match this specification.
3. Search again for outdated sage-green and botanical-green brand guidance.
4. Confirm semantic status colors and existing non-color requirements were
   preserved.
5. Run `git status --short` again.
6. Confirm that this task modified **only `DESIGN.md`**. If unrelated changes
   already existed, report them separately rather than attributing them to this
   task.
7. Do not create a commit or push.

### Final response

Report:

- The exact sections updated.
- How the soft blue palette and semantic token rules were consolidated.
- Confirmation that editorial composition, anti-patterns, typography, spacing,
  accessibility, responsive behavior, engineering constraints, and SwiftUI scope
  restrictions were preserved.
- Results of the outdated-color and token consistency review.
- The before-and-after Git status, including any pre-existing changes.
- Explicit confirmation of whether only `DESIGN.md` was modified by this task.

If you cannot verify any item, state that clearly rather than claiming success.
