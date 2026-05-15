---
name: accessibility
description: WCAG 2.1 AA compliance patterns, screen reader support, keyboard navigation, and inclusive design
---

# Accessibility (a11y) Skill for Claude Code

> **Comprehensive accessibility patterns ensuring WCAG 2.1 AA compliance and inclusive design for all users.**

---

## Core Principles

### The Four Pillars of Accessibility (POUR)

1. **Perceivable** - Users can perceive the content
2. **Operable** - Users can operate the interface
3. **Understandable** - Users can understand the content
4. **Robust** - Content works with assistive technologies

---

## Semantic HTML

### Always Use Semantic Elements

```html
<!-- ❌ Bad -->
<div class="header">
  <div class="nav">
    <div class="nav-item">Home</div>
  </div>
</div>
<div class="main">
  <div class="article">
    <div class="title">Article Title</div>
  </div>
</div>

<!-- ✅ Good -->
<header>
  <nav aria-label="Main navigation">
    <a href="/">Home</a>
  </nav>
</header>
<main>
  <article>
    <h1>Article Title</h1>
  </article>
</main>
```

### Landmark Regions

```html
<header role="banner">           <!-- Site header -->
<nav role="navigation">          <!-- Navigation -->
<main role="main">               <!-- Main content (only one per page) -->
<aside role="complementary">     <!-- Sidebar content -->
<footer role="contentinfo">      <!-- Site footer -->
<section role="region">          <!-- Distinct section (needs aria-label) -->
<form role="form">               <!-- Form (needs aria-label) -->
<search role="search">           <!-- Search functionality -->
```

### Heading Hierarchy

```html
<!-- ✅ Correct hierarchy -->
<h1>Page Title</h1>
  <h2>Section 1</h2>
    <h3>Subsection 1.1</h3>
    <h3>Subsection 1.2</h3>
  <h2>Section 2</h2>
    <h3>Subsection 2.1</h3>

<!-- ❌ Skip levels -->
<h1>Title</h1>
<h3>Subsection</h3>  <!-- Missing h2! -->
```

---

## ARIA Patterns

### When to Use ARIA

1. **First rule**: Don't use ARIA if native HTML works
2. **Second rule**: Don't change native semantics
3. **Third rule**: All interactive ARIA controls must be keyboard accessible
4. **Fourth rule**: Don't use `role="presentation"` or `aria-hidden="true"` on focusable elements
5. **Fifth rule**: All interactive elements must have accessible names

### Essential ARIA Attributes

```tsx
// Accessible name
<button aria-label="Close dialog">×</button>
<input aria-label="Search products" />

// Described by
<input 
  aria-describedby="password-hint" 
  type="password"
/>
<p id="password-hint">Must be at least 8 characters</p>

// State
<button aria-pressed="true">Bold</button>
<button aria-expanded="false" aria-controls="menu">Menu</button>
<div aria-hidden="true">Decorative content</div>

// Live regions
<div aria-live="polite">Status updates here</div>
<div aria-live="assertive">Error messages here</div>
<div role="status">Form saved successfully</div>
<div role="alert">Error: Invalid email</div>

// Current state
<a aria-current="page">Home</a>
<li aria-current="step">Step 2 of 4</li>
```

### Common ARIA Patterns

```tsx
// Modal Dialog
<div 
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Action</h2>
  <p id="dialog-description">Are you sure you want to proceed?</p>
</div>

// Tabs
<div role="tablist" aria-label="Product information">
  <button role="tab" aria-selected="true" aria-controls="panel-1">Details</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2">Reviews</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
  Panel content
</div>

// Menu
<button aria-haspopup="true" aria-expanded="false">
  Options
</button>
<ul role="menu" aria-label="Options menu">
  <li role="menuitem">Edit</li>
  <li role="menuitem">Delete</li>
</ul>

// Progress
<div 
  role="progressbar" 
  aria-valuenow="50" 
  aria-valuemin="0" 
  aria-valuemax="100"
  aria-label="Upload progress"
>
  50%
</div>

// Alert
<div role="alert" aria-live="assertive">
  Error: Please fix the highlighted fields
</div>
```

---

## Keyboard Navigation

### Focus Management

```tsx
// Skip link (first element in body)
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

// CSS for skip link
.skip-link {
  position: absolute;
  left: -9999px;
  z-index: 999;
}

.skip-link:focus {
  left: 50%;
  transform: translateX(-50%);
  top: 10px;
  padding: 8px 16px;
  background: var(--color-accent);
  color: white;
  border-radius: 4px;
}

// Focus trap for modals
function useFocusTrap(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    element.addEventListener('keydown', handleKeyDown)
    firstElement?.focus()

    return () => element.removeEventListener('keydown', handleKeyDown)
  }, [ref])
}
```

### Keyboard Shortcuts

```tsx
// Common keyboard patterns
const keyboardHandlers = {
  // List navigation
  ArrowDown: () => focusNext(),
  ArrowUp: () => focusPrevious(),
  Home: () => focusFirst(),
  End: () => focusLast(),
  
  // Selection
  Enter: () => selectCurrent(),
  Space: () => toggleCurrent(),
  
  // Dismissal
  Escape: () => close(),
  
  // Type-ahead search
  default: (key: string) => {
    if (key.length === 1) searchByLetter(key)
  }
}

// Roving tabindex for lists
function RovingTabIndex({ children }) {
  const [activeIndex, setActiveIndex] = useState(0)
  
  return Children.map(children, (child, index) =>
    cloneElement(child, {
      tabIndex: index === activeIndex ? 0 : -1,
      onFocus: () => setActiveIndex(index)
    })
  )
}
```

### Focus Visible Styling

```css
/* Remove default, add custom focus */
:focus {
  outline: none;
}

:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* High contrast focus for dark backgrounds */
.dark :focus-visible {
  outline-color: white;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.3);
}

/* Focus within for components */
.input-group:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px hsl(262 83% 58% / 0.2);
}
```

---

## Color & Contrast

### Minimum Contrast Ratios

| Content Type | Ratio | Example |
|-------------|-------|---------|
| Normal text (<18px) | 4.5:1 | Body copy, labels |
| Large text (≥18px or 14px bold) | 3:1 | Headings, large UI |
| UI components | 3:1 | Buttons, inputs, icons |
| Graphical objects | 3:1 | Charts, infographics |

### Don't Rely on Color Alone

```tsx
// ❌ Bad - color only indicator
<span className="text-red-500">Error</span>

// ✅ Good - icon + color + text
<span className="text-red-500 flex items-center gap-1">
  <AlertCircle className="w-4 h-4" aria-hidden="true" />
  <span>Error: Invalid email format</span>
</span>

// ❌ Bad - color-only link
<p>Click <a href="/terms" className="text-blue-500">here</a> for terms</p>

// ✅ Good - underlined link
<p>Read our <a href="/terms" className="text-blue-500 underline">Terms of Service</a></p>

// Form validation
<input 
  className={error ? "border-red-500" : "border-gray-300"}
  aria-invalid={error ? "true" : "false"}
  aria-describedby={error ? "error-message" : undefined}
/>
{error && (
  <p id="error-message" className="text-red-500 flex items-center gap-1">
    <AlertCircle className="w-4 h-4" />
    {error}
  </p>
)}
```

### Color Contrast Tools

```tsx
// Check contrast programmatically
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return (brightest + 0.05) / (darkest + 0.05)
}

function meetsWCAG(ratio: number, level: 'AA' | 'AAA', isLarge: boolean): boolean {
  if (level === 'AAA') {
    return isLarge ? ratio >= 4.5 : ratio >= 7
  }
  return isLarge ? ratio >= 3 : ratio >= 4.5
}
```

---

## Forms

### Accessible Form Pattern

```tsx
<form aria-labelledby="form-title" onSubmit={handleSubmit}>
  <h2 id="form-title">Contact Us</h2>
  
  {/* Required field with label */}
  <div className="form-group">
    <label htmlFor="name">
      Name <span aria-hidden="true">*</span>
      <span className="sr-only">(required)</span>
    </label>
    <input
      id="name"
      type="text"
      required
      aria-required="true"
      aria-invalid={errors.name ? "true" : "false"}
      aria-describedby={errors.name ? "name-error" : undefined}
    />
    {errors.name && (
      <p id="name-error" role="alert" className="error">
        {errors.name}
      </p>
    )}
  </div>
  
  {/* Input with hint */}
  <div className="form-group">
    <label htmlFor="password">Password</label>
    <input
      id="password"
      type="password"
      aria-describedby="password-hint password-error"
    />
    <p id="password-hint" className="hint">
      Must be at least 8 characters with one number
    </p>
    {errors.password && (
      <p id="password-error" role="alert" className="error">
        {errors.password}
      </p>
    )}
  </div>
  
  {/* Fieldset for related inputs */}
  <fieldset>
    <legend>Preferred contact method</legend>
    <label>
      <input type="radio" name="contact" value="email" />
      Email
    </label>
    <label>
      <input type="radio" name="contact" value="phone" />
      Phone
    </label>
  </fieldset>
  
  {/* Submit with loading state */}
  <button 
    type="submit" 
    disabled={isSubmitting}
    aria-busy={isSubmitting}
  >
    {isSubmitting ? 'Submitting...' : 'Submit'}
  </button>
  
  {/* Form-level error summary */}
  {Object.keys(errors).length > 0 && (
    <div role="alert" aria-live="polite">
      <h3>Please fix the following errors:</h3>
      <ul>
        {Object.entries(errors).map(([field, error]) => (
          <li key={field}>
            <a href={`#${field}`}>{error}</a>
          </li>
        ))}
      </ul>
    </div>
  )}
</form>
```

### Custom Form Controls

```tsx
// Accessible custom checkbox
function Checkbox({ label, checked, onChange, id }) {
  return (
    <label htmlFor={id} className="checkbox-label">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span 
        className="checkbox-custom"
        aria-hidden="true"
      >
        {checked && <CheckIcon />}
      </span>
      {label}
    </label>
  )
}

// Accessible custom select
function Select({ label, options, value, onChange, id }) {
  return (
    <div className="select-wrapper">
      <label htmlFor={id}>{label}</label>
      <div className="select-container">
        <select id={id} value={value} onChange={onChange}>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="select-icon" aria-hidden="true" />
      </div>
    </div>
  )
}
```

---

## Images & Media

### Image Accessibility

```tsx
// Informative image - needs alt text
<img 
  src="/product.jpg" 
  alt="Red Nike Air Max sneakers, side view"
/>

// Decorative image - empty alt
<img src="/decorative-pattern.svg" alt="" role="presentation" />

// Complex image - longer description
<figure>
  <img 
    src="/chart.png" 
    alt="Sales chart showing 40% growth"
    aria-describedby="chart-description"
  />
  <figcaption id="chart-description">
    Quarterly sales increased from $1M in Q1 to $1.4M in Q4, 
    representing 40% year-over-year growth.
  </figcaption>
</figure>

// Icon with meaning
<button>
  <TrashIcon aria-hidden="true" />
  <span className="sr-only">Delete item</span>
</button>

// Icon that IS the label
<button aria-label="Delete item">
  <TrashIcon aria-hidden="true" />
</button>

// Linked image
<a href="/products/shoes">
  <img src="/shoes.jpg" alt="View Nike Air Max collection" />
</a>
```

### Video & Audio

```tsx
// Video with captions
<video controls>
  <source src="/video.mp4" type="video/mp4" />
  <track 
    kind="captions" 
    src="/captions-en.vtt" 
    srcLang="en" 
    label="English"
    default
  />
  <track 
    kind="descriptions" 
    src="/descriptions-en.vtt" 
    srcLang="en" 
    label="English descriptions"
  />
  Your browser does not support video.
</video>

// Audio with transcript link
<div>
  <audio controls>
    <source src="/podcast.mp3" type="audio/mpeg" />
  </audio>
  <a href="/podcast-transcript">Read transcript</a>
</div>
```

---

## Motion & Animations

### Respect Reduced Motion

```css
/* Base animation */
.animated {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

/* Disable for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animated {
    transition: none;
  }
  
  /* Or provide alternative */
  .fade-in {
    animation: none;
    opacity: 1;
  }
}
```

```tsx
// React hook
function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  return prefersReduced
}

// Usage
function AnimatedComponent() {
  const reducedMotion = useReducedMotion()
  
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
    >
      Content
    </motion.div>
  )
}
```

---

## Screen Reader Utilities

### CSS Classes

```css
/* Visually hidden but accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Visible on focus (skip links) */
.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}

/* Hide from screen readers */
[aria-hidden="true"] {
  /* Content hidden from assistive technology */
}
```

### Live Regions

```tsx
// Announce dynamic content
function LiveAnnouncer() {
  const [announcement, setAnnouncement] = useState('')
  
  // Expose announce function globally or via context
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement('')
    // Small delay ensures announcement is read
    setTimeout(() => setAnnouncement(message), 100)
  }, [])
  
  return (
    <div 
      role="status" 
      aria-live="polite" 
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  )
}

// Usage examples
announce('Item added to cart')
announce('Form submitted successfully')
announce('Error: Please check your input', 'assertive')
```

---

## Testing Checklist

### Automated Tests
- [ ] Run axe-core or similar tool
- [ ] Check color contrast ratios
- [ ] Validate HTML structure
- [ ] Check for missing alt text
- [ ] Verify heading hierarchy

### Keyboard Testing
- [ ] Tab through entire page
- [ ] Focus order is logical
- [ ] All interactive elements reachable
- [ ] Focus visible at all times
- [ ] Can dismiss modals with Escape
- [ ] Skip link works

### Screen Reader Testing
- [ ] Test with VoiceOver (Mac)
- [ ] Test with NVDA (Windows)
- [ ] All content announced
- [ ] Form labels read correctly
- [ ] Error messages announced
- [ ] Live regions work

### Visual Testing
- [ ] Zoom to 200% - still usable
- [ ] High contrast mode works
- [ ] No information lost without color
- [ ] Text resizing doesn't break layout

---

## Quick Reference

| Element | Requirements |
|---------|--------------|
| Images | Alt text or empty alt for decorative |
| Links | Descriptive text, not "click here" |
| Buttons | Accessible name via text or aria-label |
| Forms | Labels, error messages, fieldsets |
| Headings | Logical hierarchy, no skipped levels |
| Color | 4.5:1 text, 3:1 UI, don't rely on color alone |
| Focus | Visible indicators, logical order |
| Motion | Respect prefers-reduced-motion |
| Modals | Focus trap, Escape to close, aria-modal |

---

*This skill ensures all interfaces are usable by everyone, regardless of ability.*
