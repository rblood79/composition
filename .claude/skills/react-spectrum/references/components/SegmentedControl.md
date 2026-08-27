<!-- Source: https://react-spectrum.adobe.com/s2/ (S2) + GitHub @react-spectrum/s2/src/SegmentedControl.tsx -->
<!-- Last fetched: 2026-04-05 -->

# SegmentedControl

A SegmentedControl is a mutually exclusive group of buttons used for view switching.

```tsx
import { SegmentedControl, SegmentedControlItem } from "@react-spectrum/s2";
```

## Examples

### Basic

```jsx
<SegmentedControl aria-label="Time granularity">
  <SegmentedControlItem id="day">Day</SegmentedControlItem>
  <SegmentedControlItem id="week">Week</SegmentedControlItem>
  <SegmentedControlItem id="month">Month</SegmentedControlItem>
  <SegmentedControlItem id="year">Year</SegmentedControlItem>
</SegmentedControl>
```

### With Icons

```jsx
<SegmentedControl aria-label="List organization">
  <SegmentedControlItem id="unordered">
    <ListBulleted />
    <Text>Unordered</Text>
  </SegmentedControlItem>
  <SegmentedControlItem id="ordered">
    <ListNumbered />
    <Text>Ordered</Text>
  </SegmentedControlItem>
  <SegmentedControlItem id="task list">
    <ListMultiSelect />
    <Text>Task List</Text>
  </SegmentedControlItem>
</SegmentedControl>
```

### Icon Only

```jsx
<SegmentedControl aria-label="Text alignment">
  <SegmentedControlItem aria-label="Align bottom" id="align bottom">
    <AlignBottom />
  </SegmentedControlItem>
  <SegmentedControlItem aria-label="Align center" id="align center">
    <AlignCenter />
  </SegmentedControlItem>
  <SegmentedControlItem aria-label="Align left" id="align left">
    <AlignLeft />
  </SegmentedControlItem>
</SegmentedControl>
```

## Props

### SegmentedControlProps

| Name                 | Type                | Default | Description                                        |
| -------------------- | ------------------- | ------- | -------------------------------------------------- |
| `children`           | `ReactNode`         | --      | The SegmentedControlItem elements                  |
| `isDisabled`         | `boolean`           | --      | Whether the segmented control is disabled          |
| `isJustified`        | `boolean`           | --      | Whether items divide the container width equally   |
| `selectedKey`        | `Key \| null`       | --      | The id of the currently selected item (controlled) |
| `defaultSelectedKey` | `Key`               | --      | The id of the initial selected item (uncontrolled) |
| `onSelectionChange`  | `(id: Key) => void` | --      | Handler called when selection changes              |
| `aria-label`         | `string`            | --      | Accessibility label                                |
| `styles`             | `StyleString`       | --      | Spectrum style overrides                           |
| `UNSAFE_style`       | `CSSProperties`     | --      | Custom styles (last resort)                        |
| `UNSAFE_className`   | `string`            | --      | Custom class name (last resort)                    |

### SegmentedControlItemProps

| Name               | Type            | Default | Description                                        |
| ------------------ | --------------- | ------- | -------------------------------------------------- |
| `children`         | `ReactNode`     | --      | The content to display (text, icon, or both)       |
| `id`               | `Key`           | --      | The item identifier                                |
| `isDisabled`       | `boolean`       | --      | Whether the item is disabled                       |
| `aria-label`       | `string`        | --      | Accessibility label (required for icon-only items) |
| `UNSAFE_style`     | `CSSProperties` | --      | Custom styles                                      |
| `UNSAFE_className` | `string`        | --      | Custom class name                                  |

## Accessibility

An `aria-label` is required on SegmentedControl. For icon-only items, each SegmentedControlItem also needs an `aria-label`.
