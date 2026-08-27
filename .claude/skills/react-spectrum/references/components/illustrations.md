<!-- Source: https://react-spectrum.adobe.com/s2/ (S2) + GitHub @react-spectrum/s2/src/Icon.tsx (IllustrationProps) -->
<!-- Last fetched: 2026-04-05 -->

# Illustrations

React Spectrum S2 offers a collection of illustrations that can be imported from `@react-spectrum/s2/illustrations`.

```tsx
import { IllustrationName } from "@react-spectrum/s2/illustrations";
```

## Usage

Illustrations are typically used within `IllustratedMessage`, `SelectBox`, `DropZone`, and similar components for empty states, error pages, and visual content.

```jsx
import { NotFound } from "@react-spectrum/s2/illustrations";
import { IllustratedMessage, Heading, Content } from "@react-spectrum/s2";

<IllustratedMessage>
  <NotFound />
  <Heading>No results found</Heading>
  <Content>Try adjusting your search criteria.</Content>
</IllustratedMessage>;
```

### In SelectBox

```jsx
import { Server } from "@react-spectrum/s2/illustrations";

<SelectBox id="aws" textValue="AWS">
  <Server />
  <Text slot="label">Amazon Web Services</Text>
</SelectBox>;
```

### Size Variants

Illustrations support three size variants:

```jsx
<NotFound size="S" />  {/* Small */}
<NotFound size="M" />  {/* Medium (default) */}
<NotFound size="L" />  {/* Large */}
```

## Props

### IllustrationProps

| Name               | Type                           | Default | Description                                                      |
| ------------------ | ------------------------------ | ------- | ---------------------------------------------------------------- |
| `size`             | `'S' \| 'M' \| 'L'`            | `'M'`   | Size variant                                                     |
| `aria-label`       | `string`                       | --      | Accessible label for standalone use                              |
| `aria-hidden`      | `boolean \| 'true' \| 'false'` | --      | Hide from assistive technology                                   |
| `styles`           | `StyleString`                  | --      | Style overrides (margin, position, grid, zIndex, rotation, size) |
| `slot`             | `string`                       | --      | Slot name for placement within parent                            |
| `UNSAFE_style`     | `CSSProperties`                | --      | Custom styles                                                    |
| `UNSAFE_className` | `string`                       | --      | Custom class name                                                |
| `id`               | `string`                       | --      | DOM id                                                           |

## Context

### IllustrationContext

Extends IconContextValue with size configuration:

```tsx
interface IllustrationContextValue extends IconContextValue {
  size?: "S" | "M" | "L";
}
```

Parent components like `IllustratedMessage` provide illustration context to control size and color based on the parent's configuration.

## Creating Custom Illustrations

Use `createIllustration()` factory function:

```tsx
import { createIllustration } from "@react-spectrum/s2";

const MyIllustration = createIllustration({
  S: SmallSvg,
  M: MediumSvg,
  L: LargeSvg,
});
```

## Illustration Categories

- **Gradient illustrations**: `@react-spectrum/s2/illustrations/gradient`
- **Linear illustrations**: `@react-spectrum/s2/illustrations/linear`

## Accessibility

- Decorative illustrations within labeled containers use `aria-hidden` automatically
- Standalone illustrations require `aria-label` for screen readers
