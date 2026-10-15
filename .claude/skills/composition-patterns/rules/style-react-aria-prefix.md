---
title: Use react-aria-* CSS Prefix
impact: CRITICAL
impactDescription: 일관된 네이밍, 충돌 방지, 유지보수 용이
tags: [style, css, react-aria, naming]
---

CSS 클래스명은 `react-aria-*` prefix를 사용합니다.

## Incorrect

```css
/* ❌ prefix 없는 클래스명 */
.Button {
}
.ComboBox {
}
.TextField {
}

/* ❌ 임의의 prefix */
.my-Button {
}
.custom-ComboBox {
}
```

```tsx
// ❌ prefix 없는 className
<Button className="Button primary" />
```

## Correct

```css
/* ✅ react-aria-* prefix 사용 */
.react-aria-Button {
}
.react-aria-Button.primary {
}
.react-aria-Button.outline {
}

.react-aria-ComboBox {
}
.react-aria-TextField {
}
.react-aria-ToggleButton {
}
```

```tsx
// ✅ prefix 포함된 className
<Button className="react-aria-Button primary" />
<ComboBox className="react-aria-ComboBox" />
```
