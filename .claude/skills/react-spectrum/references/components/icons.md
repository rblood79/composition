<!-- Source: https://react-spectrum.adobe.com/s2/ (S2) + GitHub @react-spectrum/s2/src/Icon.tsx -->
<!-- Last fetched: 2026-04-05 -->

# Icons

React Spectrum S2 provides a set of Workflow icons that can be imported individually from `@react-spectrum/s2/icons`.

```tsx
import { IconName } from "@react-spectrum/s2/icons";
```

## Usage

Icons are used within components like Button, ToggleButton, MenuItem, etc.

```jsx
import { Edit, Delete, Add } from "@react-spectrum/s2/icons";

<Button>
  <Edit />
  <Text>Edit</Text>
</Button>;
```

### Standalone Icon

```jsx
<Edit aria-label="Edit item" />
```

### Icon with Accessible Label

When used standalone (outside a labeled component), provide `aria-label`:

```jsx
<Delete aria-label="Delete selected items" />
```

### Hidden Decorative Icons

When the icon is purely decorative alongside text, it can be hidden from assistive technology:

```jsx
<Button>
  <Add aria-hidden />
  <Text>Add Item</Text>
</Button>
```

## Props

### IconProps

| Name               | Type                           | Default | Description                                                      |
| ------------------ | ------------------------------ | ------- | ---------------------------------------------------------------- |
| `aria-label`       | `string`                       | --      | Accessible label for standalone icons                            |
| `aria-hidden`      | `boolean \| 'true' \| 'false'` | --      | Hide from assistive technology                                   |
| `styles`           | `StyleString`                  | --      | Style overrides (margin, position, grid, zIndex, rotation, size) |
| `slot`             | `string`                       | --      | Slot name for placement within parent component                  |
| `UNSAFE_style`     | `CSSProperties`                | --      | Custom styles                                                    |
| `UNSAFE_className` | `string`                       | --      | Custom class name                                                |
| `id`               | `string`                       | --      | DOM id                                                           |

### Allowed Style Overrides

Margin, positioning, grid layout, z-index, rotation, and size-related properties are permitted. Width and height are **not** directly customizable.

## Context

### IconContext

Provides styling and render customization to icon components:

```tsx
interface IconContextValue {
  styles?: StyleString;
  render?: (icon: ReactNode) => ReactNode;
}
```

## Creating Custom Icons

Use `createIcon()` factory function to create new icon components from SVG:

```tsx
import { createIcon } from "@react-spectrum/s2";

const MyIcon = createIcon(MySvgComponent);
```

## Accessibility

- Standalone icons require `aria-label`
- Decorative icons within labeled elements should use `aria-hidden`
- Icons within buttons/links inherit the parent's accessible name
