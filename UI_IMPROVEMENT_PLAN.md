# UI Improvement Plan - Leave-NPW

## 📋 Overview
แผนการพัฒนา UI/UX สำหรับระบบยื่น/อนุมัติใบลาโรงเรียนบ้านเนินพลับหวาน

**Tech Stack**: Next.js 16 + Tailwind CSS + Framer Motion + PWA

---

## 🎨 1. Color Palette & Theme Enhancement

### Current State
- Primary: Sky Blue (`sky-500` to `sky-600`)
- Neutral: Slate Gray
- Accent: Teal, Amber/Orange
- มี Dark Mode support

### Improvements Needed

#### 1.1 Semantic Color System
```
✅ Success/Approved    → Emerald (#10b981)
⚠️  Pending/Warning    → Amber (#f59e0b)
❌ Rejected/Error      → Red (#ef4444)
📘 Info/Primary        → Sky (#0ea5e9)
🎯 Special/Events      → Indigo/Purple (#6366f1)
⚪ Neutral             → Slate (ปรับ contrast)
```

#### 1.2 Dark Mode Refinement
- ปรับ `--background` และ `--foreground` ให้มี contrast ดีขึ้น
- ใช้ warmer grays แทน pure slate (เช่น `zinc` หรือ `neutral`)
- เพิ่ม subtle glow effects สำหรับ primary actions
- ทดสอบ WCAG AAA contrast ratio

#### 1.3 Gradient Enhancements
- เพิ่ม gradient presets สำหรับ cards และ banners
- ใช้ gradient ที่ subtle มากขึ้นใน dark mode

---

## 📝 2. Typography & Readability

### Current State
- Font: Kanit (ดีสำหรับภาษาไทย) ✅
- Font weights: 400, 500, 600
- Custom font sizes: display, heading-xl/lg/md/sm, body, label, caption

### Improvements Needed

#### 2.1 Font Weight Scale
```css
font-weight: 300  /* Light - สำหรับ large display */
font-weight: 400  /* Regular - body text */
font-weight: 500  /* Medium - labels, subtle emphasis */
font-weight: 600  /* Semibold - headings */
font-weight: 700  /* Bold - strong emphasis */
```

#### 2.2 Line Height Adjustments
- Body text: `1.6` → `1.7` (สบายตามากขึ้น)
- Headings: เพิ่ม breathing room
- Labels/Captions: คงที่

#### 2.3 Letter Spacing
- Headings ใหญ่: `-0.02em` ถึง `-0.01em`
- Body: `0` (default)
- All caps labels: `0.05em` (ถ้ามี)

---

## 🧩 3. Component Design System

### 3.1 Button System

**Variants Needed:**
```
• Primary   - สำหรับ main actions (ยื่นใบลา, บันทึก)
• Secondary - สำหรับ alternative actions (ยกเลิก, กลับ)
• Ghost     - สำหรับ subtle actions (เมนู, settings)
• Outline   - สำหรับ less emphasis actions
• Danger    - สำหรับ destructive actions (ลบ, reject)
```

**States:**
- Default
- Hover (scale, shadow, color shift)
- Active (scale down)
- Disabled (opacity, cursor)
- Loading (spinner + disabled state)

### 3.2 Card System

**Elevation Levels:**
```
• Flat      - border only, no shadow
• Low       - shadow-sm (subtle)
• Medium    - shadow-md (default cards)
• High      - shadow-lg (modals, important cards)
• Floating  - shadow-xl (tooltips, popovers)
```

**Variants:**
```
• Default   - white bg + border
• Elevated  - white bg + shadow
• Outlined  - transparent bg + border
• Filled    - colored bg (info, warning, success)
```

### 3.3 Badge/Tag System

**Current**: มีอยู่แล้วแต่ไม่ consistent

**Improvements:**
- ปรับ border-radius ให้เหมือนกัน (`rounded-md` หรือ `rounded-full`)
- ปรับ padding ให้เหมือนกัน (`px-2 py-0.5`)
- สร้าง color mapping สำหรับแต่ละสถานะ:
  ```
  sick       → blue
  personal   → purple
  maternity  → pink
  religious  → teal
  approved   → green
  pending    → amber
  rejected   → red
  cancelled  → gray
  ```

### 3.4 Input System

**Components:**
- Text input
- Textarea
- Select/Dropdown
- Date picker
- File upload
- Signature pad (มีอยู่แล้ว)

**States:**
- Default
- Focus (ring + border color)
- Error (red ring + error message)
- Disabled
- Success (green ring)

---

## 📐 4. Visual Hierarchy & Spacing

### 4.1 Spacing Scale
```
xs:  4px   (0.25rem)  - tight spacing
sm:  8px   (0.5rem)   - compact spacing
md:  12px  (0.75rem)  - default gap
base: 16px (1rem)     - comfortable spacing
lg:  24px  (1.5rem)   - section spacing
xl:  32px  (2rem)     - large section gap
2xl: 48px  (3rem)     - major section divider
```

### 4.2 Container Widths
```
Current: max-w-4xl (56rem / 896px) ✅

Alternatives:
• max-w-3xl (48rem) - tighter layout
• max-w-5xl (64rem) - wider for desktop
• max-w-7xl (80rem) - dashboard layouts
```

### 4.3 White Space Strategy
- เพิ่ม breathing room ระหว่าง sections
- ใช้ `space-y-section` (1.5rem) consistently
- เพิ่ม padding ใน cards (3 → 4 or 5)

---

## ✨ 5. Micro-interactions & Animations

### Current State
- ✅ Framer Motion ติดตั้งแล้ว
- ✅ มี animations: slide-up, fade-in, shimmer, pulse
- ✅ มี pull-to-refresh
- ✅ มี loading skeletons

### Improvements Needed

#### 5.1 Skeleton Loaders
- ปรับ shimmer animation ให้นุ่มนวลขึ้น
- สร้าง skeleton components สำหรับแต่ละ section
- เพิ่ม skeleton สำหรับ lists และ grids

#### 5.2 Page Transitions
```jsx
// Next.js App Router transitions
<AnimatePresence mode="wait">
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

#### 5.3 List Animations
- Staggered animations สำหรับ list items (มีอยู่แล้วบางส่วน) ✅
- Exit animations เมื่อ remove items
- Reorder animations

#### 5.4 Haptic Feedback (Mobile)
```js
// เพิ่มใน critical actions
if ('vibrate' in navigator) {
  navigator.vibrate(10); // subtle tap
  navigator.vibrate([10, 20, 10]); // pattern
}
```

#### 5.5 Toast Notifications
- ปัจจุบันใช้ Sonner ✅
- ปรับ styling ให้ match design system
- เพิ่ม icons สำหรับแต่ละ type

---

## 📱 6. Mobile-First Improvements

### Current State
- ✅ Responsive design
- ✅ Pull-to-refresh
- ✅ Bottom navigation
- ✅ Safe area support
- ✅ PWA support

### Improvements Needed

#### 6.1 Touch Targets
- Minimum size: 44x44px (iOS guideline) หรือ 48x48px (Material)
- เพิ่ม padding สำหรับ clickable areas
- ตรวจสอบ buttons, links, และ interactive elements

#### 6.2 Gesture Support
```
✅ Pull to refresh (มีแล้ว)
⭕ Swipe to delete (สำหรับ lists)
⭕ Swipe to navigate (back/forward)
⭕ Long press for context menu
⭕ Pinch to zoom (สำหรับ images/signatures)
```

#### 6.3 Mobile Navigation
- Bottom nav ควรมี active state ชัดเจน
- เพิ่ม haptic feedback เมื่อ switch tabs
- พิจารณา tab bar animation

#### 6.4 Form Experience
- Keyboard type ที่เหมาะสม (`numeric`, `email`, `tel`)
- Auto-focus และ auto-scroll to error
- Virtual keyboard ไม่บัง input field

---

## 🌓 7. Dark Mode Refinement

### Current Implementation
```css
/* globals.css */
:root {
  --background: 248 250 252; /* slate-50 */
  --foreground: 15 23 42;    /* slate-900 */
}

.dark {
  --background: 2 6 23;      /* slate-950 */
  --foreground: 248 250 252; /* slate-50 */
}
```

### Improvements Needed

#### 7.1 Color Contrast
- ตรวจสอบ contrast ratio ทุก text/background pair
- Target: WCAG AAA (7:1 สำหรับ normal text, 4.5:1 สำหรับ large text)
- Tools: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

#### 7.2 Warmer Grays
```css
/* ใช้ zinc หรือ neutral แทน slate */
.dark {
  --background: 9 9 11;      /* zinc-950 - warmer */
  --foreground: 250 250 250; /* zinc-50 */
}
```

#### 7.3 Glow Effects
```css
/* Primary buttons in dark mode */
.dark .btn-primary {
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.3);
}

/* Cards */
.dark .card-elevated {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
```

#### 7.4 Border Adjustments
- Dark mode borders ควรมี opacity ต่ำกว่า light mode
- พิจารณาใช้ `border-white/10` แทน `border-slate-800`

---

## 🎯 8. Specific Component Enhancements

### 8.1 Dashboard (Teacher & HR)

**Stats Cards:**
- เพิ่ม icons ที่ใหญ่ขึ้นและมีสีสัน
- เพิ่ม trend indicators (↑ ↓ →)
- เพิ่ม comparison text ("เพิ่มขึ้น 2 คนจากเมื่อวาน")
- Hover effect ที่ชัดเจน

**Charts/Graphs:**
- เพิ่ม Chart.js หรือ Recharts
- Line chart: แสดงการลาตาม timeline
- Bar chart: เปรียบเทียบประเภทการลา
- Pie/Donut chart: สัดส่วนการลา
- Sparklines: แสดง trend ใน stat cards

### 8.2 Heatmap Calendar

**Current**: มีอยู่แล้ว ✅

**Improvements:**
- ปรับ gradient colors:
  ```
  0 leaves:   slate-50 / slate-900
  1-2 leaves: blue-100 / blue-900
  3-4 leaves: blue-300 / blue-700
  5+ leaves:  blue-600 / blue-400
  ```
- เพิ่ม legend แสดงความหมายของสี
- Tooltip แสดงรายละเอียดเมื่อ hover
- Highlight วันหยุดด้วยสีต่างออกไป
- เพิ่ม loading state

### 8.3 Leave Cards/List

**Improvements:**
- เพิ่ม left border bar สีตามประเภทการลา
- เพิ่ม status icon ด้านซ้าย
- แสดง progress bar สำหรับ leave in progress
- เพิ่ม quick actions (view, edit, cancel) on hover
- Avatar/Initials สำหรับ teacher (ในมุมมอง HR)

**Example Structure:**
```
┌─────────────────────────────────────┐
│ 🔵 [Sick Leave]     [Approved ✓]   │
│                                      │
│ John Doe • รหัส: T001               │
│ 15-20 ม.ค. 2567 • 3 วัน            │
│ ██████████░░░░░░ 60% complete       │
└─────────────────────────────────────┘
```

### 8.4 Form Improvements

**Step Indicator:**
- แสดงขั้นตอนปัจจุบัน
- Progress bar หรือ stepper
- Breadcrumb navigation

**Input Fields:**
- Floating labels
- Inline validation messages
- Success checkmarks
- Helper text ที่ชัดเจน

**Date Picker:**
- Calendar UI ที่สวยงาม
- Highlight weekends และวันหยุด
- Disable past dates (ตามกรณี)
- Quick presets (วันนี้, พรุ่งนี้, สัปดาห์หน้า)

**Signature Pad:**
- มีอยู่แล้ว ✅
- เพิ่ม clear button ที่ชัดเจน
- แสดง preview ก่อน submit
- Undo/Redo buttons

### 8.5 Empty States

**Current**: มีบางส่วนแล้ว ✅

**Improvements:**
- เพิ่ม illustrations หรือ emoji ที่น่ารัก
- CTA button ที่ชัดเจน
- Helpful text ที่บอกว่าจะทำอะไรต่อ

**Examples:**
```
📋 ไม่มีประวัติการลา
   เริ่มต้นยื่นใบลาแรกของคุณ
   [ยื่นใบลา]

🔍 ไม่พบผลการค้นหา
   ลองค้นหาด้วยคำอื่น

✅ ไม่มีใบลารออนุมัติ
   ดีมาก! ไม่มีงานค้างอยู่
```

### 8.6 Modal/Dialog

**Improvements:**
- Backdrop blur effect
- Smooth enter/exit animations
- Close on backdrop click
- ESC key to close
- Trap focus inside modal
- Scrollable content if needed

### 8.7 Navigation

**Bottom Navigation (Mobile):**
- Active state indicator ที่ชัดเจน
- Badge สำหรับ notifications
- Haptic feedback
- Smooth transitions

**Sidebar (Desktop):**
- Collapsible sidebar
- Icons + text labels
- Active page highlight
- Hover states

### 8.8 Loading States

**Types:**
```
• Skeleton loaders    - สำหรับ content
• Spinner            - สำหรับ actions
• Progress bar       - สำหรับ uploads
• Shimmer effect     - สำหรับ placeholders
• Pull indicator     - สำหรับ pull-to-refresh ✅
```

---

## 🎨 9. Design Tokens

สร้าง centralized design tokens:

```typescript
// design-tokens.ts
export const tokens = {
  colors: {
    // Semantic colors
    success: { light: 'emerald-500', dark: 'emerald-400' },
    warning: { light: 'amber-500', dark: 'amber-400' },
    error: { light: 'red-500', dark: 'red-400' },
    info: { light: 'sky-500', dark: 'sky-400' },
    
    // Leave types
    leaveTypes: {
      sick: { light: 'blue-600', dark: 'blue-400' },
      personal: { light: 'purple-600', dark: 'purple-400' },
      maternity: { light: 'pink-600', dark: 'pink-400' },
      religious: { light: 'teal-600', dark: 'teal-400' },
    },
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    base: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
  
  animations: {
    fast: '150ms',
    base: '300ms',
    slow: '500ms',
    verySlow: '700ms',
  },
};
```

---

## 🚀 10. Implementation Priority

### Phase 1: Foundation (Week 1)
- [ ] ปรับ color palette ใน tailwind.config.ts
- [ ] สร้าง design tokens file
- [ ] ปรับ typography scale
- [ ] แก้ไข dark mode contrast issues
- [ ] สร้าง button component variants

### Phase 2: Components (Week 2)
- [ ] สร้าง card component system
- [ ] ปรับปรุง badge/tag system
- [ ] สร้าง input component variants
- [ ] ปรับปรุง loading states
- [ ] สร้าง modal/dialog component

### Phase 3: Interactions (Week 3)
- [ ] เพิ่ม micro-animations
- [ ] ปรับปรุง page transitions
- [ ] เพิ่ม haptic feedback
- [ ] ปรับปรุง toast notifications
- [ ] เพิ่ม gesture support

### Phase 4: Polish (Week 4)
- [ ] ปรับปรุง empty states
- [ ] เพิ่ม data visualizations
- [ ] ปรับปรุง heatmap calendar
- [ ] แก้ไข spacing และ hierarchy
- [ ] Testing และ refinement

---

## 📊 11. Success Metrics

### User Experience
- ⚡ Faster perceived load time (skeleton loaders)
- 👆 Better touch experience (larger touch targets)
- 🎨 Visual consistency (design system)
- 🌓 Better dark mode experience
- ♿ Improved accessibility (WCAG AAA)

### Performance
- 🚀 Smooth animations (60fps)
- 📦 No layout shift (CLS < 0.1)
- ⏱️ Fast interaction (FID < 100ms)

### Developer Experience
- 🔧 Reusable components
- 📝 Clear design tokens
- 🎯 Type-safe styling
- 🧪 Easy to test

---

## 🛠️ 12. Tools & Resources

### Design Tools
- **Figma** - สำหรับ mockups และ prototypes
- **Coolors** - color palette generator
- **WebAIM** - contrast checker
- **Heroicons** - icon library (or keep Lucide React)

### Development Tools
- **Tailwind CSS IntelliSense** - VS Code extension
- **Headless UI** - accessible components (optional)
- **Radix UI** - primitive components (optional)
- **Framer Motion** - animations (installed ✅)

### Testing Tools
- **Lighthouse** - performance และ accessibility
- **axe DevTools** - accessibility testing
- **React DevTools** - component inspection

---

## 📚 13. References

### Color Systems
- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)
- [Material Design Color System](https://m3.material.io/styles/color/system/overview)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

### Typography
- [Practical Typography](https://practicaltypography.com/)
- [Google Fonts - Kanit](https://fonts.google.com/specimen/Kanit)

### Accessibility
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [A11y Project](https://www.a11yproject.com/)

### Animation
- [Framer Motion Docs](https://www.framer.com/motion/)
- [UI Animation Principles](https://uxdesign.cc/the-ultimate-guide-to-proper-use-of-animation-in-ux-10bd98614fa9)

---

## ✅ Next Steps

**ขั้นตอนถัดไป:**
1. ทบทวนแผนนี้และปรับแก้ตามความต้องการ
2. เลือก Phase ที่จะเริ่มก่อน
3. สร้าง mockups/wireframes (ถ้าต้องการ)
4. เริ่ม implementation ตาม priority
5. Test และ iterate

**คำถามสำหรับการตัดสินใจ:**
- ต้องการเริ่มจาก Phase ไหนก่อน?
- มี design guidelines หรือ brand colors เฉพาะหรือไม่?
- ต้องการ UI library เพิ่มเติมหรือไม่? (Headless UI, Radix UI)
- มีข้อจำกัดด้าน performance หรือ browser support?

---

**Created:** 2026-09-22  
**Last Updated:** 2026-09-22  
**Version:** 1.0
