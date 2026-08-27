<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ColorSwatchPicker.html -->
<!-- Last fetched: 2026-04-05 -->

# ColorSwatchPicker

A ColorSwatchPicker displays a list of color swatches and allows a user to select one of them.

Added in version 3.35.0.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { ColorSwatchPicker } from "@adobe/react-spectrum";
```

## Basic Example

```jsx
<ColorSwatchPicker>
  <ColorSwatch color="#A00" />
  <ColorSwatch color="#f80" />
  <ColorSwatch color="#080" />
  <ColorSwatch color="#08f" />
  <ColorSwatch color="#088" />
  <ColorSwatch color="#008" />
</ColorSwatchPicker>
```

## Value Management

### Uncontrolled (Default Value)

```jsx
<ColorSwatchPicker defaultValue="#A00">
  <ColorSwatch color="#A00" />
  <ColorSwatch color="#f80" />
  <ColorSwatch color="#080" />
</ColorSwatchPicker>
```

### Controlled Value

```jsx
import { parseColor } from "@adobe/react-spectrum";

function Example() {
  let [color, setColor] = React.useState(parseColor("hsl(0, 100%, 33.33%)"));
  return (
    <ColorSwatchPicker value={color} onChange={setColor}>
      <ColorSwatch color="#A00" />
      <ColorSwatch color="#f80" />
      <ColorSwatch color="#080" />
    </ColorSwatchPicker>
  );
}
```

**Note:** Color swatches within a picker must have unique colors, even across different color spaces (e.g., `#f00`, `hsl(0, 100%, 50%)`, and `hsb(0, 100%, 100%)` are considered duplicates).

## Labeling

Default accessibility label is "Color swatches". Override with `aria-label` or `aria-labelledby`:

```jsx
<ColorSwatchPicker aria-label="Fill color">
  <ColorSwatch color="#A00" />
  <ColorSwatch color="#f80" />
  <ColorSwatch color="#080" />
</ColorSwatchPicker>
```

## Events

```jsx
function Example() {
  let [value, setValue] = React.useState(parseColor("#A00"));
  return (
    <div>
      <ColorSwatchPicker value={value} onChange={setValue}>
        <ColorSwatch color="#A00" />
        <ColorSwatch color="#f80" />
        <ColorSwatch color="#080" />
        <ColorSwatch color="#08f" />
        <ColorSwatch color="#088" />
        <ColorSwatch color="#008" />
      </ColorSwatchPicker>
      <p>Selected color: {value.toString("rgb")}</p>
    </div>
  );
}
```

## Visual Options

### Size

```jsx
<ColorSwatchPicker size="XS">
  <ColorSwatch color="#A00" />
  <ColorSwatch color="#f80" />
  <ColorSwatch color="#080" />
  <ColorSwatch color="#08f" />
</ColorSwatchPicker>
```

### Density

```jsx
<ColorSwatchPicker density="compact">
  <ColorSwatch color="#A00" />
  <ColorSwatch color="#f80" />
  <ColorSwatch color="#080" />
  <ColorSwatch color="#08f" />
</ColorSwatchPicker>
```

### Rounding

```jsx
<ColorSwatchPicker rounding="full">
  <ColorSwatch color="#A00" />
  <ColorSwatch color="#f80" />
  <ColorSwatch color="#080" />
  <ColorSwatch color="#08f" />
</ColorSwatchPicker>
```

**Note:** Only use rounded corners if the ColorSwatchPicker is displayed on a single row.

## Props API

### Core Props

| Name           | Type                                   | Default     | Description                              |
| -------------- | -------------------------------------- | ----------- | ---------------------------------------- |
| `children`     | `ReactNode`                            | --          | ColorSwatch components within the picker |
| `value`        | `string \| Color`                      | --          | Current color (controlled)               |
| `defaultValue` | `string \| Color`                      | --          | Initial color (uncontrolled)             |
| `density`      | `'compact' \| 'regular' \| 'spacious'` | `"regular"` | Padding between swatches                 |
| `size`         | `'XS' \| 'S' \| 'M' \| 'L'`            | `"M"`       | Size of color swatches                   |
| `rounding`     | `'none' \| 'default' \| 'full'`        | `"none"`    | Corner rounding of swatches              |

### Events

| Name       | Type                     | Description                                 |
| ---------- | ------------------------ | ------------------------------------------- |
| `onChange` | `(value: Color) => void` | Handler called when color selection changes |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description                       |
| ------------------ | --------------- | --------------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (last resort only) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort only)  |

## Accessibility

- Default ARIA label is "Color swatches"
- Override with `aria-label` for context-specific labeling
- Use `aria-labelledby` to reference external labels
- All labels should be localized
