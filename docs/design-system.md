# Matrix Theme Design System

## Overview
A cyberpunk-inspired design system based on the Matrix aesthetic with neon green accents, dark backgrounds, and digital rain effects.

## Color Palette

### Primary Colors
- **Matrix Green**: `#00ff41` - Primary accent, highlights, active states
- **Neon Green**: `#39ff14` - Bright accents, glows
- **Dark Green**: `#003b00` - Subtle backgrounds, hover states

### Background Colors
- **Deep Black**: `#000000` - Primary background
- **Code Black**: `#0d0208` - Secondary background
- **Terminal Black**: `#1a1a1a` - Panel backgrounds
- **Matrix Dark**: `#001a00` - Subtle green-tinted backgrounds

### Text Colors
- **Matrix Text**: `#00ff41` - Primary text
- **Dim Green**: `#00cc33` - Secondary text
- **Ghost Green**: `#004d1a` - Disabled/placeholder text
- **White**: `#ffffff` - High contrast text when needed

### Accent Colors
- **Cyan**: `#00ffff` - Info, links
- **Red**: `#ff0000` - Errors, warnings
- **Yellow**: `#ffff00` - Caution

## Typography

### Font Families
```css
--font-mono: 'Courier New', 'Courier', monospace;
--font-matrix: 'Share Tech Mono', monospace; /* Optional: load from Google Fonts */
```

### Font Sizes
- **xs**: 0.75rem (12px)
- **sm**: 0.875rem (14px)
- **base**: 1rem (16px)
- **lg**: 1.125rem (18px)
- **xl**: 1.25rem (20px)
- **2xl**: 1.5rem (24px)

## Spacing
Use 4px base unit (0.25rem):
- **1**: 0.25rem (4px)
- **2**: 0.5rem (8px)
- **3**: 0.75rem (12px)
- **4**: 1rem (16px)
- **6**: 1.5rem (24px)
- **8**: 2rem (32px)

## Components

### Buttons

#### Primary Button
```html
<button class="btn-primary">
  Action
</button>
```
**Tailwind Classes**: 
```
bg-matrix-green text-black px-4 py-2 rounded font-mono uppercase text-sm 
hover:bg-neon-green hover:shadow-[0_0_10px_rgba(0,255,65,0.5)] 
transition-all duration-200 font-semibold tracking-wider
```

#### Secondary Button
```html
<button class="btn-secondary">
  Action
</button>
```
**Tailwind Classes**:
```
border-2 border-matrix-green text-matrix-green px-4 py-2 rounded font-mono 
uppercase text-sm hover:bg-matrix-green hover:text-black 
hover:shadow-[0_0_10px_rgba(0,255,65,0.3)] transition-all duration-200 
font-semibold tracking-wider
```

#### Ghost Button
```html
<button class="btn-ghost">
  Action
</button>
```
**Tailwind Classes**:
```
text-matrix-green px-4 py-2 rounded font-mono uppercase text-sm 
hover:bg-dark-green transition-all duration-200 tracking-wider
```

### Panels

#### Solid Panel
```html
<div class="panel-solid">
  Content
</div>
```
**Tailwind Classes**:
```
bg-terminal-black border border-matrix-green/30 rounded-lg p-4 
shadow-[0_0_20px_rgba(0,255,65,0.1)]
```

#### Glass Panel (subtle transparency)
```html
<div class="panel-glass">
  Content
</div>
```
**Tailwind Classes**:
```
bg-terminal-black/90 backdrop-blur-sm border border-matrix-green/20 
rounded-lg p-4 shadow-[0_0_20px_rgba(0,255,65,0.05)]
```

### Inputs

#### Text Input
```html
<input type="text" class="input-matrix" placeholder="Enter text...">
```
**Tailwind Classes**:
```
bg-code-black border border-matrix-green/40 text-matrix-green px-3 py-2 
rounded font-mono text-sm focus:outline-none focus:border-matrix-green 
focus:shadow-[0_0_8px_rgba(0,255,65,0.3)] placeholder:text-ghost-green 
transition-all duration-200
```

### Tabs

#### Vertical Tab Button (Active)
```html
<button class="tab-vertical-active">
  <Icon />
</button>
```
**Tailwind Classes**:
```
p-4 flex justify-center bg-matrix-dark border-l-2 border-matrix-green 
text-matrix-green transition-all duration-200
```

#### Vertical Tab Button (Inactive)
```html
<button class="tab-vertical">
  <Icon />
</button>
```
**Tailwind Classes**:
```
p-4 flex justify-center text-ghost-green hover:text-dim-green 
hover:bg-dark-green transition-all duration-200
```

### Text Styles

#### Code Block
```html
<pre class="code-block">
  Code content
</pre>
```
**Tailwind Classes**:
```
bg-code-black border border-matrix-green/20 rounded p-3 font-mono text-sm 
text-dim-green overflow-x-auto
```

#### Log Entry
```html
<div class="log-entry">
  Log message
</div>
```
**Tailwind Classes**:
```
p-3 rounded bg-matrix-dark/30 border border-matrix-green/20 text-sm 
font-mono text-matrix-green
```

## Effects

### Glow Effect
```css
box-shadow: 0 0 10px rgba(0, 255, 65, 0.5);
```

### Subtle Glow
```css
box-shadow: 0 0 20px rgba(0, 255, 65, 0.1);
```

### Text Glow
```css
text-shadow: 0 0 5px rgba(0, 255, 65, 0.5);
```

## Tailwind Config Extension

Add to `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'matrix-green': '#00ff41',
        'neon-green': '#39ff14',
        'dark-green': '#003b00',
        'deep-black': '#000000',
        'code-black': '#0d0208',
        'terminal-black': '#1a1a1a',
        'matrix-dark': '#001a00',
        'dim-green': '#00cc33',
        'ghost-green': '#004d1a',
      },
      fontFamily: {
        'mono': ['Courier New', 'Courier', 'monospace'],
      },
    },
  },
}
```

## Usage Guidelines

1. **Always use monospace fonts** for that terminal/code aesthetic
2. **Prefer dark backgrounds** with green accents
3. **Add subtle glows** to interactive elements
4. **Use uppercase text** for buttons and labels
5. **Keep borders thin** (1-2px) with low opacity green
6. **Animate transitions** for smooth interactions (200ms duration)
