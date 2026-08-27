<!-- Source: https://react-spectrum.adobe.com/s2/ (S2) + GitHub @react-spectrum/s2/src/ToggleButtonGroup.tsx -->
<!-- Last fetched: 2026-04-05 -->

# ToggleButtonGroup

A ToggleButtonGroup is a grouping of related ToggleButtons, with single or multiple selection.

```tsx
import { ToggleButtonGroup, ToggleButton } from "@react-spectrum/s2";
```

## Examples

### With Icons and Labels

```jsx
<ToggleButtonGroup>
  <ToggleButton id={1}>
    <Bold />
    <Text slot="label">Bold</Text>
  </ToggleButton>
  <ToggleButton id={2}>
    <Italic />
    <Text slot="label">Italic</Text>
  </ToggleButton>
  <ToggleButton id={3}>
    <Underline />
    <Text slot="label">Underline</Text>
  </ToggleButton>
</ToggleButtonGroup>
```

### Icon Only

```jsx
<ToggleButtonGroup>
  <ToggleButton id={1} aria-label="Bold">
    <Bold />
  </ToggleButton>
  <ToggleButton id={2} aria-label="Italic">
    <Italic />
  </ToggleButton>
  <ToggleButton id={3} aria-label="Underline">
    <Underline />
  </ToggleButton>
</ToggleButtonGroup>
```

## Props

### ToggleButtonGroupProps

Extends `ActionButtonGroupProps` and `RACToggleButtonGroupProps`.

| Name                     | Type                                | Default        | Description                           |
| ------------------------ | ----------------------------------- | -------------- | ------------------------------------- |
| `children`               | `ReactNode`                         | --             | ToggleButton elements                 |
| `isEmphasized`           | `boolean`                           | --             | Displays with emphasized visual style |
| `density`                | `'regular'`                         | `'regular'`    | Controls spacing density              |
| `size`                   | `'XS' \| 'S' \| 'M' \| 'L' \| 'XL'` | `'M'`          | Button group size                     |
| `orientation`            | `'horizontal' \| 'vertical'`        | `'horizontal'` | Layout direction                      |
| `isJustified`            | `boolean`                           | --             | Justifies button distribution         |
| `isDisabled`             | `boolean`                           | --             | Whether the group is disabled         |
| `selectionMode`          | `'single' \| 'multiple'`            | --             | Selection mode                        |
| `selectedKeys`           | `Iterable<Key>`                     | --             | Selected items (controlled)           |
| `defaultSelectedKeys`    | `Iterable<Key>`                     | --             | Initial selected items (uncontrolled) |
| `disallowEmptySelection` | `boolean`                           | --             | Require at least one selection        |
| `onSelectionChange`      | `(keys: Set<Key>) => void`          | --             | Handler for selection changes         |
| `styles`                 | `StyleString`                       | --             | Spectrum style overrides              |
| `UNSAFE_className`       | `string`                            | --             | Custom class name                     |
| `UNSAFE_style`           | `CSSProperties`                     | --             | Custom styles                         |

## Context

### ToggleButtonGroupContext

Provides props to child ToggleButton components for coordinated styling and behavior.

## Accessibility

For icon-only buttons, each ToggleButton needs an `aria-label`.
