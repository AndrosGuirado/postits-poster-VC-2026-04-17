---
name: ux-design
description: Professional UX design patterns, accessibility standards, and design system compliance for production-ready interfaces
---

# UX Design Skill for Claude Code

> **A comprehensive UX/UI design skill that transforms generic AI output into professional, accessible, and brand-aligned interfaces.**

---

## Core Philosophy

### The Problem This Skill Solves

By default, language models write **plausible** code, not **good** code. This results in:
- Generic, forgettable interfaces ("AI slop" aesthetic)
- Poor accessibility
- Inconsistent design patterns
- Overused color schemes (purple gradients on white)
- Cookie-cutter layouts

This skill encodes **real UX expertise** to produce professional-grade interfaces.

---

## Design Principles

### 1. Typography Excellence

**Requirements:**
- Choose fonts that are **beautiful, unique, and distinctive**
- Establish clear visual hierarchy (headings, body, captions)
- Ensure readability with proper line-height (1.5-1.7 for body text)
- Use appropriate font weights for emphasis

**Avoid:**
- ❌ Generic fonts: Inter, Roboto, Arial, system fonts
- ❌ Too many font families (max 2-3)
- ❌ Poor contrast between text and background
- ❌ Inconsistent sizing scales

**Best Practices:**
```css
/* Example: Distinctive typography setup */
:root {
  --font-display: 'Space Grotesk', 'Outfit', 'Satoshi', sans-serif;
  --font-body: 'IBM Plex Sans', 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Type scale (1.25 ratio) */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.563rem;
  --text-2xl: 1.953rem;
  --text-3xl: 2.441rem;
  --text-4xl: 3.052rem;
}
```

### 2. Color & Theme Strategy

**Requirements:**
- Commit to a **cohesive aesthetic** throughout
- Use CSS custom properties for consistency
- Dominant colors with **sharp accents** outperform timid, evenly-distributed palettes
- Draw inspiration from IDE themes, cultural aesthetics, or brand identity

**Color System Structure:**
```css
:root {
  /* Semantic colors */
  --color-background: hsl(0 0% 3%);
  --color-foreground: hsl(0 0% 98%);
  --color-muted: hsl(0 0% 15%);
  --color-muted-foreground: hsl(0 0% 65%);
  
  /* Brand accent */
  --color-accent: hsl(262 83% 58%);
  --color-accent-foreground: hsl(0 0% 100%);
  
  /* Functional colors */
  --color-success: hsl(142 76% 36%);
  --color-warning: hsl(38 92% 50%);
  --color-error: hsl(0 84% 60%);
  --color-info: hsl(199 89% 48%);
  
  /* Gradients for depth */
  --gradient-primary: linear-gradient(135deg, var(--color-accent), hsl(280 80% 45%));
  --gradient-subtle: linear-gradient(180deg, transparent, hsl(0 0% 5% / 0.8));
}
```

**Avoid:**
- ❌ Clichéd purple gradients on white backgrounds
- ❌ Evenly distributed "safe" palettes
- ❌ Colors without semantic meaning
- ❌ Low contrast combinations

### 3. Motion & Animation

**Requirements:**
- Prioritize **CSS-only solutions** for HTML
- Use Motion library (Framer Motion) for React when needed
- Focus on **high-impact moments**: page load reveals create more delight than scattered micro-interactions
- Use animation-delay for staggered reveals

**Motion Patterns:**
```css
/* Page load stagger effect */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: fadeInUp 0.6s ease-out forwards;
}

/* Stagger children */
.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
.stagger-4 { animation-delay: 0.4s; }

/* Micro-interactions */
.interactive {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 40px -10px hsl(0 0% 0% / 0.3);
}
```

**Avoid:**
- ❌ Animations without purpose
- ❌ Jarring or too-fast transitions
- ❌ Animations that block user interaction
- ❌ Excessive motion (respect prefers-reduced-motion)

### 4. Backgrounds & Atmosphere

**Requirements:**
- Create **atmosphere and depth** rather than defaulting to solid colors
- Layer CSS gradients for dimension
- Use geometric patterns or contextual effects that match the overall aesthetic
- Consider noise textures, grain, or subtle gradients

**Background Patterns:**
```css
/* Gradient mesh background */
.bg-mesh {
  background-color: hsl(0 0% 3%);
  background-image: 
    radial-gradient(at 40% 20%, hsl(262 83% 58% / 0.15) 0px, transparent 50%),
    radial-gradient(at 80% 0%, hsl(280 80% 45% / 0.1) 0px, transparent 50%),
    radial-gradient(at 0% 50%, hsl(199 89% 48% / 0.1) 0px, transparent 50%);
}

/* Subtle grid pattern */
.bg-grid {
  background-image: 
    linear-gradient(hsl(0 0% 100% / 0.02) 1px, transparent 1px),
    linear-gradient(90deg, hsl(0 0% 100% / 0.02) 1px, transparent 1px);
  background-size: 64px 64px;
}
```

### 5. Spacing & Layout

**Requirements:**
- Use consistent spacing scale
- Apply 8px grid system
- Create visual rhythm through intentional whitespace
- Group related elements; separate distinct sections

**Spacing System:**
```css
:root {
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.5rem;   /* 24px */
  --space-6: 2rem;     /* 32px */
  --space-8: 3rem;     /* 48px */
  --space-10: 4rem;    /* 64px */
  --space-12: 6rem;    /* 96px */
  --space-16: 8rem;    /* 128px */
}
```

---

## Accessibility Standards (WCAG 2.1 AA)

### Mandatory Requirements

| Requirement | Standard |
|-------------|----------|
| Color contrast (text) | Minimum 4.5:1 for normal text, 3:1 for large text |
| Color contrast (UI) | Minimum 3:1 for interactive elements |
| Focus indicators | Visible, distinct focus states on all interactive elements |
| Keyboard navigation | All functionality accessible via keyboard |
| Screen reader support | Proper ARIA labels, roles, and live regions |
| Touch targets | Minimum 44x44px for touch interfaces |
| Motion safety | Respect prefers-reduced-motion |

### Implementation Patterns

```tsx
// Focus visible utility
<button className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:outline-none">
  Click me
</button>

// Skip link for keyboard users
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground">
  Skip to main content
</a>
```

```css
/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Screen reader only text */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Component Patterns

### Card Component

```tsx
interface CardProps {
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

export function Card({ title, description, className, children }: CardProps) {
  return (
    <div className={cn(
      "group relative rounded-xl border border-white/10 bg-white/5 p-6",
      "backdrop-blur-sm transition-all duration-300",
      "hover:border-white/20 hover:bg-white/10",
      "hover:shadow-xl hover:shadow-accent/5",
      className
    )}>
      {/* Gradient hover effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      
      <div className="relative z-10">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
        {children}
      </div>
    </div>
  )
}
```

### Button Component

```tsx
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/25",
        secondary: "bg-white/10 text-foreground hover:bg-white/20 border border-white/10",
        ghost: "text-foreground hover:bg-white/10",
        destructive: "bg-error text-white hover:bg-error/90",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)
```

### Input Component

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        className={cn(
          "flex h-11 w-full rounded-lg border bg-white/5 px-4 text-sm",
          "placeholder:text-muted-foreground",
          "transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent",
          error 
            ? "border-error focus:ring-error" 
            : "border-white/10 hover:border-white/20",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
```

---

## Anti-Patterns to Avoid

### The "AI Slop" Aesthetic Checklist

When reviewing generated UI, check for these warning signs:

| Anti-Pattern | Why It's Bad | Fix |
|--------------|--------------|-----|
| Generic font families (Inter, Roboto) | Forgettable, looks like every other AI site | Choose distinctive typography |
| Purple gradient on white | Overused to the point of cliché | Commit to a unique color story |
| Centered everything | Lazy layout, lacks visual interest | Use asymmetry, grid systems |
| Rounded corners on everything | Looks soft/generic | Mix sharp and rounded intentionally |
| Too much whitespace | "Clean" becomes "empty" | Add texture, depth, atmosphere |
| Stock photo style imagery | Inauthentic, disconnected | Use custom illustrations or real photos |
| Generic iconography | Lacks personality | Choose a cohesive icon style |
| No micro-interactions | Feels static, unresponsive | Add purposeful hover/focus states |

### Before Approving Any UI

Ask these questions:
1. Could I tell which company made this? (If no → needs more personality)
2. Does it look like it was designed, or generated? (If generated → needs refinement)
3. Would a human designer be proud of this? (If unsure → iterate)

---

## Workflow Integration

### Phase 1: Discovery

Before designing, gather:
- [ ] Brand guidelines and assets
- [ ] Existing design system (if any)
- [ ] Target user personas
- [ ] Accessibility requirements
- [ ] Performance constraints

### Phase 2: Design System Setup

Check for existing design tokens:
1. Define color palette with semantic naming
2. Establish typography scale
3. Create spacing system
4. Set up component primitives

### Phase 3: Component Implementation

For each component:
1. **Structure** - Semantic HTML, proper ARIA
2. **Style** - Apply design tokens, ensure consistency
3. **Behavior** - Interactions, animations, states
4. **Accessibility** - Keyboard, screen reader, contrast
5. **Responsiveness** - Mobile-first, breakpoints

### Phase 4: Visual Verification

Use browser MCP to verify:
- [ ] Typography hierarchy is clear
- [ ] Colors are consistent
- [ ] Spacing is balanced
- [ ] Animations are smooth
- [ ] Accessibility passes

---

## Auto-Learning Section

When corrected on a UX pattern:

1. **Note the correction** in session context
2. **Identify the principle** that was violated
3. **Apply the learning** to all subsequent components
4. **Suggest updating** this skill if the pattern is generalizable

### Learned Preferences

<!-- Updated when user corrects UX decisions -->

- [Add learned patterns here as they are discovered]

---

## Testing Checklist

Before completing any UX task:

### Visual
- [ ] Typography hierarchy is clear and consistent
- [ ] Colors pass contrast requirements
- [ ] Spacing creates visual rhythm
- [ ] Animations enhance rather than distract
- [ ] Dark/light mode both work (if applicable)

### Accessibility
- [ ] All interactive elements are keyboard accessible
- [ ] Focus states are visible and consistent
- [ ] Screen reader announces content correctly
- [ ] Touch targets are 44px minimum
- [ ] Reduced motion is respected

### Responsive
- [ ] Mobile layout works (320px minimum)
- [ ] Tablet layout works (768px)
- [ ] Desktop layout works (1280px+)
- [ ] No horizontal scroll on any viewport

### Performance
- [ ] Images are optimized
- [ ] Fonts are preloaded
- [ ] Animations use transform/opacity
- [ ] No layout shift on load

---

## Integration with Other Skills

### With Brand Guidelines Skill
When brand-guidelines skill is active:
1. Load brand colors, fonts, and assets
2. Apply brand voice to microcopy
3. Ensure visual consistency with brand identity

### With Frontend Design Skill (Anthropic Official)
This skill extends frontend-design with:
1. More specific UX patterns
2. Accessibility requirements
3. Anti-pattern detection
4. Testing workflows

### With Component Architecture Skill
UX decisions should inform:
1. Component API design
2. State management for interactions
3. Prop naming conventions

---

## Resources

| Resource | Purpose |
|----------|---------|
| Anthropic Frontend Design Skill | Official skill for reference |
| Awesome Claude Skills | Community skill collection |
| Superpowers Skills Repo | Advanced skill patterns |
| WCAG 2.1 Guidelines | Accessibility reference |
| Tailwind CSS Docs | Utility class reference |
| Radix UI | Accessible component primitives |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-17 | Initial release with comprehensive UX patterns |

---

*This skill is designed to be used with Claude Code and integrates with the ACT 2.0 frontend stack (Next.js, Tailwind CSS, shadcn/ui, Radix UI).*
