---
name: ios-design
description: >
  Build production-quality iOS interfaces with SwiftUI following Apple HIG and modern design patterns.
  Use this skill whenever the user is building, designing, or styling iOS views, screens, components,
  or layouts with SwiftUI. Trigger on: creating new views, styling components, adding animations,
  implementing navigation, building forms, designing cards/lists/sheets, working with dark mode,
  accessibility, dynamic type, SF Symbols, custom shapes, or any iOS UI work. Also trigger when the
  user mentions "make it look good", "polish the UI", "design system", "theme", or asks about iOS
  visual patterns — even if they don't say "HIG" or "SwiftUI" explicitly. If the user is working on
  a .swift file that contains View conformances, this skill applies.
---

# iOS Design Skill

Build interfaces that feel inevitable — where every element earns its place and the design disappears behind the experience. This skill encodes the visual language, component patterns, and interaction principles behind premium iOS apps.

## Design Philosophy

Great iOS design isn't about decoration. It's about **clarity** (content is the interface), **deference** (UI serves the content, not itself), and **depth** (visual layers and motion create hierarchy). Every view should pass the "squint test" — blur your eyes and the visual hierarchy should still be obvious.

### Core Principles

1. **Content-first**: UI chrome should be minimal. Let typography, spacing, and color do the work.
2. **Adaptive**: Every view must work in light mode, dark mode, Dynamic Type sizes, and with accessibility features enabled. Not as an afterthought — as the starting point.
3. **Responsive state**: The interface should breathe with the app's activity. Loading, success, error, empty — each state gets intentional design treatment.
4. **Motion with purpose**: Animation communicates relationships and state changes. Never animate just because you can.
5. **Touch-native**: Minimum 44pt touch targets. Generous spacing. Thumb-reachable primary actions.

---

## Color System

### Palette Architecture

Build color palettes with semantic roles, not raw values. This makes dark mode automatic and keeps the design coherent as it evolves.

```swift
// Define semantic colors, not literal ones
extension Color {
    // Brand
    static let brand = Color("Brand")           // Primary action, key accent
    static let brandSecondary = Color("BrandSecondary") // Supporting accent

    // Surfaces (adapt automatically via asset catalog)
    static let surface = Color("Surface")               // Cards, containers
    static let surfaceElevated = Color("SurfaceElevated") // Modals, popovers
    static let appBackground = Color("AppBackground")   // Full-screen bg

    // Content
    static let textPrimary = Color("TextPrimary")
    static let textSecondary = Color("TextSecondary")
    static let textTertiary = Color("TextTertiary")

    // Functional (consistent across modes)
    static let success = Color("Success")   // Green family
    static let warning = Color("Warning")   // Amber family
    static let error = Color("Error")       // Red family

    // Structure
    static let divider = Color("Divider")
    static let inputBackground = Color("InputBackground")
}
```

### Color Guidance

- **Dark mode isn't inverted light mode.** Dark surfaces should be warm-neutral (e.g., `#1A1A1A`, not pure `#000000`). Light text should be off-white (`#F0F0F0`), not pure white.
- **Elevation = brightness in dark mode.** Higher surfaces are lighter. In light mode, use shadows instead.
- **Functional colors stay consistent** across modes. Green means success everywhere. But adjust luminance slightly so they look good on both backgrounds.
- **Brand color at 4-8% opacity** makes excellent subtle backgrounds for highlighted sections.
- **Use opacity for hierarchy**, not separate gray values. `textPrimary.opacity(0.6)` is more maintainable than defining `textSecondary` as a fixed gray.
- **Test your palette** with the Accessibility Inspector's color contrast checker. WCAG AA minimum: 4.5:1 for body text, 3:1 for large text.

### Color Don'ts

- Don't use more than 3 distinct hues in a single view. Brand + functional colors are usually enough.
- Don't use pure black (`#000000`) for backgrounds or pure white (`#FFFFFF`) for text in dark mode — it causes eye strain.
- Don't hard-code colors inline. Always go through your semantic color system.

---

## Typography

### The Type Scale

iOS apps that look professional use a deliberate type scale — a set of predefined sizes/weights that create rhythm. Apple's built-in styles are a great foundation:

```swift
// Apple's Dynamic Type styles (preferred — they scale automatically)
.font(.largeTitle)     // 34pt - Hero content, empty states
.font(.title)          // 28pt - Screen titles
.font(.title2)         // 22pt - Section headers
.font(.title3)         // 20pt - Subsection headers
.font(.headline)       // 17pt semibold - Emphasized body
.font(.body)           // 17pt - Primary content
.font(.callout)        // 16pt - Secondary content
.font(.subheadline)    // 15pt - Supporting text
.font(.footnote)       // 13pt - Captions, metadata
.font(.caption)        // 12pt - Timestamps, badges
.font(.caption2)       // 11pt - Smallest readable text
```

### Custom Fonts

When using custom fonts, wrap them in a system that respects Dynamic Type:

```swift
extension Font {
    // Custom fonts that scale with Dynamic Type
    static func display(_ size: CGFloat, weight: Font.Weight = .medium) -> Font {
        .custom("SpaceGrotesk-Medium", size: size, relativeTo: .largeTitle)
    }

    static func reading(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("Inter-Regular", size: size, relativeTo: .body)
    }

    static func code(_ size: CGFloat = 14) -> Font {
        .system(size: size, design: .monospaced)
    }
}
```

### Typography Rules

- **One display font, one body font** maximum. More than two custom typefaces fights with itself.
- **Weight does more than size.** Before making text bigger, try making it bolder. Semibold at 16pt often reads better than regular at 18pt.
- **Line spacing matters.** For multi-line body text, add `.lineSpacing(4)` to improve readability. For single-line labels, default spacing is fine.
- **Use `relativeTo:`** when defining custom font sizes so they scale with Dynamic Type.
- **Monospaced for data.** Timestamps, code, technical values — use `.monospaced()` or `.monospacedDigit()`.
- **Letter spacing (tracking)** on section headers (`.tracking(1.5)` + `.textCase(.uppercase)`) creates clean visual separators.

---

## Spacing & Layout

### The 4pt Grid

All spacing should be multiples of 4. This creates visual rhythm:

```swift
enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    static let xxxl: CGFloat = 48
}
```

### Layout Patterns

```swift
// Standard screen layout
VStack(spacing: 0) {
    // Content area
    ScrollView {
        LazyVStack(spacing: Spacing.lg) {
            // Content items
        }
        .padding(.horizontal, Spacing.lg)
    }

    // Fixed bottom bar
    bottomBar
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, Spacing.md)
        .background(.ultraThinMaterial)
}
```

### Spacing Rules

- **Horizontal padding**: 16pt minimum on all screen edges. 20pt feels more premium.
- **Between related items**: 8-12pt (e.g., icon and label, title and subtitle).
- **Between groups**: 24-32pt (e.g., between card sections).
- **Touch targets**: 44pt minimum height/width for interactive elements. Use `.frame(minHeight: 44)` or `.contentShape(Rectangle())` to expand tap areas beyond visible bounds.
- **Bottom safe area**: Always respect it. Use `.safeAreaInset(edge: .bottom)` for fixed bottom elements, not manual padding.
- **Keyboard avoidance**: Use `.scrollDismissesKeyboard(.interactively)` on scroll views. iOS handles keyboard avoidance automatically in most cases — don't fight it.

---

## Component Patterns

### Cards

Cards are the building block of modern iOS interfaces. A well-designed card has: surface background, rounded corners, subtle definition (border or shadow, rarely both), and consistent internal padding.

```swift
// Standard card
content
    .padding(Spacing.lg)
    .background(Color.surface)
    .clipShape(RoundedRectangle(cornerRadius: 12))
    .overlay(
        RoundedRectangle(cornerRadius: 12)
            .strokeBorder(Color.divider, lineWidth: 1)
    )

// Elevated card (modals, popovers)
content
    .padding(Spacing.lg)
    .background(Color.surfaceElevated)
    .clipShape(RoundedRectangle(cornerRadius: 16))
    .shadow(color: .black.opacity(0.08), radius: 8, y: 2)

// Interactive card (tappable)
Button(action: onTap) {
    cardContent
}
.buttonStyle(CardButtonStyle())

struct CardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
    }
}
```

### Corner Radius Guide

- **Small elements** (badges, tags, inline chips): 4-6pt
- **Buttons, input fields**: 8-12pt
- **Cards, sheets**: 12-16pt
- **Modal presentations, bottom sheets**: 20-24pt (top corners)
- **Full pill shape**: `Capsule()` (for search bars, chips, floating pills)
- **Consistency rule**: Nested rounded rectangles need their inner radius = outer radius - padding. If a card has 16pt radius and 12pt padding, inner elements should have 4pt radius.

### Buttons

```swift
// Primary action button
Text("Continue")
    .font(.headline)
    .foregroundStyle(.white)
    .frame(maxWidth: .infinity, minHeight: 50)
    .background(Color.brand)
    .clipShape(RoundedRectangle(cornerRadius: 14))

// Secondary/outline button
Text("Cancel")
    .font(.headline)
    .foregroundStyle(Color.brand)
    .frame(maxWidth: .infinity, minHeight: 50)
    .background(Color.brand.opacity(0.08))
    .clipShape(RoundedRectangle(cornerRadius: 14))

// Icon button (toolbar, nav)
Button(action: {}) {
    Image(systemName: "gear")
        .font(.system(size: 17, weight: .medium))
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
}
```

### Lists & Rows

```swift
// Settings-style row
HStack(spacing: Spacing.md) {
    Image(systemName: icon)
        .font(.system(size: 17))
        .foregroundStyle(Color.brand)
        .frame(width: 28, height: 28)
        .background(Color.brand.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 6))

    Text(title)
        .font(.body)
        .foregroundStyle(Color.textPrimary)

    Spacer()

    Text(value)
        .font(.body)
        .foregroundStyle(Color.textSecondary)

    Image(systemName: "chevron.right")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(Color.textTertiary)
}
.frame(minHeight: 44)
.padding(.horizontal, Spacing.lg)
```

### Input Fields

```swift
// Standard text input
TextField("Message", text: $text)
    .font(.body)
    .padding(.horizontal, Spacing.lg)
    .padding(.vertical, Spacing.md)
    .background(Color.inputBackground)
    .clipShape(RoundedRectangle(cornerRadius: 12))
    .overlay(
        RoundedRectangle(cornerRadius: 12)
            .strokeBorder(Color.divider, lineWidth: 1)
    )

// Pill-shaped search/chat input
HStack(spacing: Spacing.sm) {
    TextField("Ask anything...", text: $text)
        .font(.body)
    Button(action: send) {
        Image(systemName: "arrow.up.circle.fill")
            .font(.system(size: 28))
            .foregroundStyle(text.isEmpty ? Color.textTertiary : Color.brand)
    }
    .disabled(text.isEmpty)
}
.padding(.horizontal, Spacing.lg)
.padding(.vertical, Spacing.sm)
.background(Color.inputBackground)
.clipShape(Capsule())
.overlay(Capsule().strokeBorder(Color.divider, lineWidth: 1))
```

### Empty States

Empty states are a design opportunity, not an afterthought. They should explain what goes here and how to fill it:

```swift
VStack(spacing: Spacing.xl) {
    Image(systemName: "bubble.left.and.bubble.right")
        .font(.system(size: 48))
        .foregroundStyle(Color.textTertiary)

    VStack(spacing: Spacing.sm) {
        Text("No conversations yet")
            .font(.title3.weight(.semibold))
            .foregroundStyle(Color.textPrimary)
        Text("Start a conversation to see it here")
            .font(.body)
            .foregroundStyle(Color.textSecondary)
            .multilineTextAlignment(.center)
    }

    Button("New Conversation") { /* action */ }
        .buttonStyle(.borderedProminent)
}
.frame(maxWidth: .infinity, maxHeight: .infinity)
.padding(Spacing.xxl)
```

---

## Navigation Patterns

### Tab Bar

```swift
TabView(selection: $selectedTab) {
    ChatView()
        .tabItem {
            Label("Chat", systemImage: "bubble.left.fill")
        }
        .tag(Tab.chat)

    WorkflowsView()
        .tabItem {
            Label("Workflows", systemImage: "square.stack.3d.up.fill")
        }
        .tag(Tab.workflows)
}
.tint(Color.brand)
```

- **3-5 tabs maximum.** More than 5 means your information architecture needs rethinking.
- **Use filled SF Symbols** for selected state, outlined for unselected.
- **Badge important counts**: `.badge(unreadCount)`

### Navigation Stack

```swift
NavigationStack(path: $path) {
    List { /* content */ }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large) // .inline for secondary screens
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done", action: dismiss)
                    .fontWeight(.semibold)
            }
        }
}
```

### Sheets & Modals

```swift
.sheet(isPresented: $showDetail) {
    NavigationStack {
        DetailView()
            .navigationTitle("Detail")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: { showDetail = false })
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save)
                        .fontWeight(.semibold)
                }
            }
    }
    .presentationDetents([.medium, .large])
    .presentationDragIndicator(.visible)
}
```

- Use **`.medium` detent** for quick selections and short forms.
- Use **`.large` detent** for full editing experiences.
- Always provide a **visible drag indicator** so users know they can dismiss.
- For confirmation flows, prefer sheets over alerts — they're more flexible and feel less intrusive.

---

## Animation & Motion

### Spring Animations (Preferred)

Springs feel more natural than linear/easeInOut because they have overshoot and settle, like physical objects:

```swift
// Standard interactive spring
.animation(.spring(duration: 0.3, bounce: 0.2), value: trigger)

// Snappy response (buttons, toggles)
.animation(.spring(duration: 0.2, bounce: 0.1), value: trigger)

// Gentle entrance (cards appearing)
.animation(.spring(duration: 0.4, bounce: 0.15), value: trigger)

// Bouncy (playful elements, success states)
.animation(.spring(duration: 0.5, bounce: 0.3), value: trigger)
```

### Entrance Animations

```swift
// Fade + slide up (most common)
.opacity(isVisible ? 1 : 0)
.offset(y: isVisible ? 0 : 20)
.animation(.spring(duration: 0.3), value: isVisible)

// Scale from center (modals, cards)
.scaleEffect(isVisible ? 1 : 0.95)
.opacity(isVisible ? 1 : 0)
.animation(.spring(duration: 0.3, bounce: 0.15), value: isVisible)

// Staggered list entrance
ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
    ItemView(item: item)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 20)
        .animation(
            .spring(duration: 0.4).delay(Double(index) * 0.05),
            value: appeared
        )
}
```

### Continuous Animations

```swift
// Breathing/pulsing (loading indicators)
Circle()
    .scaleEffect(isPulsing ? 1.0 : 0.85)
    .opacity(isPulsing ? 1.0 : 0.6)
    .animation(
        .easeInOut(duration: 1.5).repeatForever(autoreverses: true),
        value: isPulsing
    )
    .onAppear { isPulsing = true }

// Rotation (spinners, processing)
Image(systemName: "gear")
    .rotationEffect(.degrees(isSpinning ? 360 : 0))
    .animation(
        .linear(duration: 2).repeatForever(autoreverses: false),
        value: isSpinning
    )
```

### Accessibility: Reduce Motion

Always provide a reduced-motion alternative. When `accessibilityReduceMotion` is on, replace springs and slides with simple opacity fades:

```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

// Instead of slide + fade, just fade
.opacity(isVisible ? 1 : 0)
.offset(y: reduceMotion ? 0 : (isVisible ? 0 : 20))
.animation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.3), value: isVisible)
```

---

## SF Symbols

SF Symbols are the icon system for iOS. They scale with Dynamic Type, support multiple weights, and have built-in animations.

### Usage Patterns

```swift
// Standard icon
Image(systemName: "star.fill")
    .font(.system(size: 17, weight: .medium))
    .foregroundStyle(Color.brand)

// Hierarchical rendering (multi-color with automatic tinting)
Image(systemName: "person.crop.circle.badge.checkmark")
    .symbolRenderingMode(.hierarchical)
    .foregroundStyle(Color.brand)

// Multi-color (uses SF Symbol's built-in colors)
Image(systemName: "externaldrive.badge.icloud")
    .symbolRenderingMode(.multicolor)

// Symbol effect animations (iOS 17+)
Image(systemName: "wifi")
    .symbolEffect(.variableColor.iterative, isActive: isSearching)

Image(systemName: "checkmark.circle.fill")
    .symbolEffect(.bounce, value: didComplete)
```

### Symbol Selection Guide

Choose symbols that communicate meaning instantly:

| Purpose | Good Choice | Why |
|---------|-------------|-----|
| Send message | `arrow.up.circle.fill` | Direction implies action |
| Settings | `gearshape.fill` | Universal convention |
| Search | `magnifyingglass` | Universal convention |
| Add/Create | `plus.circle.fill` | Filled = primary action |
| Delete | `trash` | Outlined = destructive caution |
| Success | `checkmark.circle.fill` | Filled + green = confirmed |
| Error | `exclamationmark.triangle.fill` | Warning shape = attention |
| Loading | `progress.indicator` or custom | Communicate activity |
| Navigate forward | `chevron.right` | Consistent with iOS convention |
| Close/Dismiss | `xmark` | Simple, universal |

- **Filled variants** for selected/active/primary states
- **Outlined variants** for unselected/secondary/destructive actions
- **Use `.symbolVariant(.fill)`** to switch between filled/outlined based on state

---

## Dark Mode

Dark mode isn't a feature — it's a core design requirement. Build for both modes from the start.

### Asset Catalog Approach (Recommended)

Define colors in your asset catalog with "Any Appearance" and "Dark" variants. SwiftUI picks the right one automatically:

```
Assets.xcassets/
├── Colors/
│   ├── Surface.colorset/        # Light: #FFFFFF, Dark: #1A1A1A
│   ├── SurfaceElevated.colorset/ # Light: #F5F5F5, Dark: #252525
│   ├── AppBackground.colorset/  # Light: #F9F9F9, Dark: #111111
│   ├── TextPrimary.colorset/    # Light: #111111, Dark: #F0F0F0
│   ├── Divider.colorset/        # Light: #E8E8E8, Dark: #333333
│   └── Brand.colorset/          # Same in both (or slight adjustment)
```

### Programmatic Approach

```swift
extension Color {
    static let surface = Color(
        light: Color(hex: "FFFFFF"),
        dark: Color(hex: "1A1A1A")
    )
}

extension Color {
    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(dark)
                : UIColor(light)
        })
    }
}
```

### Dark Mode Rules

- **Shadows are invisible in dark mode.** Use borders/strokes for card definition instead, or increase shadow opacity.
- **Elevation = lightness in dark mode.** A modal on a card on a background should be: `#111111` → `#1A1A1A` → `#252525`.
- **Don't just invert.** Reds, greens, and blues may need luminance adjustments to maintain contrast and feel right on dark backgrounds.
- **Test in both modes early and often.** Use Xcode previews with `.preferredColorScheme(.dark)`.

---

## Accessibility

Accessibility makes your app better for everyone, not just users with disabilities. Many accessibility features (Dynamic Type, reduced motion, high contrast) are used by mainstream users.

### Essential Checklist

```swift
// 1. Dynamic Type: Use built-in text styles or relativeTo:
.font(.body)  // Scales automatically
.font(.custom("Inter", size: 16, relativeTo: .body))  // Custom font that scales

// 2. Minimum touch targets
.frame(minWidth: 44, minHeight: 44)
.contentShape(Rectangle())  // Expand tap area beyond visible bounds

// 3. Color contrast: 4.5:1 for body text, 3:1 for large text
// Test with Accessibility Inspector

// 4. Semantic labels for icons and images
Image(systemName: "gear")
    .accessibilityLabel("Settings")

// 5. Group related content
VStack {
    Text(title)
    Text(subtitle)
}
.accessibilityElement(children: .combine)

// 6. Announce state changes
.accessibilityValue(isConnected ? "Connected" : "Disconnected")

// 7. Reduce motion support
@Environment(\.accessibilityReduceMotion) var reduceMotion
```

### Layout for Dynamic Type

Large text sizes can break layouts. Design for it:

```swift
// Use ViewThatFits for adaptive layout
ViewThatFits {
    // Preferred: horizontal
    HStack { icon; text; Spacer(); value }
    // Fallback: vertical (when text is too large)
    VStack(alignment: .leading) { HStack { icon; text }; value }
}

// Or use @Environment(\.dynamicTypeSize) to adapt
@Environment(\.dynamicTypeSize) var typeSize

var body: some View {
    if typeSize >= .accessibility1 {
        verticalLayout
    } else {
        horizontalLayout
    }
}
```

---

## Status & Feedback Indicators

### Connection/Status Dots

```swift
Circle()
    .fill(statusColor)
    .frame(width: 8, height: 8)
    .overlay(
        Circle()
            .strokeBorder(Color.surface, lineWidth: 1.5)
    )

var statusColor: Color {
    switch status {
    case .connected: return .success
    case .connecting: return .warning
    case .disconnected: return .error
    }
}
```

### Loading States

```swift
// Inline loading (replaces content)
if isLoading {
    ProgressView()
        .tint(Color.brand)
} else {
    content
}

// Overlay loading (dims content)
content
    .opacity(isLoading ? 0.5 : 1)
    .overlay {
        if isLoading {
            ProgressView("Loading...")
                .padding()
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
    .allowsHitTesting(!isLoading)
```

### Skeleton Loading (Premium Pattern)

```swift
// Placeholder that shimmers while loading
RoundedRectangle(cornerRadius: 8)
    .fill(Color.textTertiary.opacity(0.15))
    .frame(height: 16)
    .shimmering()  // Custom modifier below

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [.clear, .white.opacity(0.2), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase)
                .animation(
                    .linear(duration: 1.5).repeatForever(autoreverses: false),
                    value: phase
                )
            )
            .clipped()
            .onAppear { phase = 300 }
    }
}
```

---

## Haptic Feedback

Haptics make interactions feel tactile and real. Use them judiciously — too much haptic feedback is worse than none.

```swift
// Impact (taps, selections)
UIImpactFeedbackGenerator(style: .light).impactOccurred()   // Subtle tap
UIImpactFeedbackGenerator(style: .medium).impactOccurred()  // Button press
UIImpactFeedbackGenerator(style: .heavy).impactOccurred()   // Significant action

// Notification (outcomes)
UINotificationFeedbackGenerator().notificationOccurred(.success)  // Task complete
UINotificationFeedbackGenerator().notificationOccurred(.warning)  // Attention needed
UINotificationFeedbackGenerator().notificationOccurred(.error)    // Something failed

// Selection (scrolling through options)
UISelectionFeedbackGenerator().selectionChanged()
```

### When to Use Haptics

- **Toggle/switch changes**: Light impact
- **Button press**: Light or medium impact
- **Delete/destructive action**: Medium impact
- **Success/completion**: Success notification
- **Error/failure**: Error notification
- **Scroll snapping**: Selection changed
- **Long press recognized**: Medium impact
- **Pull to refresh trigger**: Light impact

---

## Gesture Patterns

```swift
// Swipe to reveal actions (built-in)
.swipeActions(edge: .trailing) {
    Button(role: .destructive) { delete() } label: {
        Label("Delete", systemImage: "trash")
    }
    Button { archive() } label: {
        Label("Archive", systemImage: "archivebox")
    }
    .tint(.blue)
}

// Long press with context menu
.contextMenu {
    Button { copy() } label: {
        Label("Copy", systemImage: "doc.on.doc")
    }
    Button(role: .destructive) { delete() } label: {
        Label("Delete", systemImage: "trash")
    }
}

// Drag gesture with haptic feedback
.gesture(
    DragGesture(minimumDistance: 20)
        .onChanged { value in
            offset = value.translation.width
        }
        .onEnded { value in
            if value.translation.width > threshold {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                performAction()
            }
            withAnimation(.spring(duration: 0.3)) {
                offset = 0
            }
        }
)
```

---

## Performance-Aware Design

Beautiful UI that stutters is bad UI. Keep these performance considerations in mind:

- **`LazyVStack`/`LazyHStack`** for any list longer than ~20 items. Non-lazy stacks measure all children upfront.
- **`.drawingGroup()`** on complex view hierarchies with overlapping effects (shadows, blurs, gradients) to flatten into a single render pass.
- **Avoid `.blur()` on large surfaces** — it's expensive. Use `.ultraThinMaterial` or pre-rendered blurred images instead.
- **`.task` instead of `.onAppear`** for async work — it cancels automatically when the view disappears.
- **`@State` for local view state only.** Shared state goes in `@Observable` models to prevent unnecessary redraws.
- **Use `.id()` carefully.** Changing a view's identity forces a full re-render. Good for resetting state; bad for performance if done on every update.

---

## View Architecture

### Screen Template

A well-structured screen view follows this pattern:

```swift
struct FeatureView: View {
    @State private var viewModel = FeatureViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingView
            case .empty:
                emptyView
            case .loaded(let items):
                contentView(items)
            case .error(let message):
                errorView(message)
            }
        }
        .navigationTitle("Feature")
        .task { await viewModel.load() }
    }

    private var loadingView: some View { /* skeleton/spinner */ }
    private var emptyView: some View { /* empty state with CTA */ }
    private func contentView(_ items: [Item]) -> some View { /* main content */ }
    private func errorView(_ message: String) -> some View { /* error + retry */ }
}
```

### Extract Reusable Components

When a visual pattern appears 3+ times, extract it. But not before — premature abstraction creates components nobody uses:

```swift
// Only extract after seeing the pattern repeated
struct StatusBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}
```

---

## Reference: Premium Visual Patterns

For detailed examples of chat interfaces, AI assistant patterns, conversation blocks, spirit/avatar designs, and ambient backgrounds, see `references/premium-patterns.md`.

For the complete Solace design system tokens (exact hex values, font sizes, spacing values), see `references/design-tokens.md`.
