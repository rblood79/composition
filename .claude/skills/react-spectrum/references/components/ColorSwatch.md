<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ColorSwatch.html -->
<!-- Last fetched: 2026-04-05 -->

# ColorSwatch

A ColorSwatch displays a preview of a selected color.

Added in version 3.35.0.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { ColorSwatch } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<ColorSwatch color="#f00" />
```

## Color Value Display

```jsx
import { ColorSlider, parseColor } from "@adobe/react-spectrum";

function Example() {
  let [color, setColor] = React.useState(parseColor("hsl(0, 100%, 50%)"));
  return (
    <Flex direction="column" gap="size-100">
      <ColorSlider value={color} onChange={setColor} channel="hue" />
      <ColorSwatch color={color} />
    </Flex>
  );
}
```

## Transparency Handling

Fully transparent colors display with a red diagonal slash. Partially transparent colors show a checkerboard pattern background.

```jsx
function Example() {
  let [color, setColor] = React.useState(parseColor("hsla(0, 100%, 50%, 0)"));
  return (
    <Flex direction="column" gap="size-100">
      <ColorSlider value={color} onChange={setColor} channel="alpha" />
      <ColorSwatch color={color} />
    </Flex>
  );
}
```

## Accessible Labeling

```jsx
<ColorSwatch
  color="#f00"
  aria-label="Background color"
  colorName="Fire truck red"
/>
```

ColorSwatch provides automatic localized color descriptions for screen readers (e.g., "dark vibrant blue"). Override with the `colorName` prop for custom names like Pantone colors.

## Size Variations

```jsx
<Flex gap="size-100">
  <ColorSwatch color="#ff0" size="XS" />
  <ColorSwatch color="#ff0" size="S" />
  <ColorSwatch color="#ff0" size="M" />
  <ColorSwatch color="#ff0" size="L" />
</Flex>
```

## Rounding Options

```jsx
<Flex gap="size-100">
  <ColorSwatch color="#0ff" rounding="none" />
  <ColorSwatch color="#0ff" rounding="default" />
  <ColorSwatch color="#0ff" rounding="full" />
</Flex>
```

## Props API

### Core Props

| Name        | Type                            | Default     | Description                                                          |
| ----------- | ------------------------------- | ----------- | -------------------------------------------------------------------- |
| `color`     | `string \| Color`               | --          | Color value to display (string or Color object)                      |
| `colorName` | `string`                        | --          | Accessible name for the color (overrides auto-generated description) |
| `size`      | `'XS' \| 'S' \| 'M' \| 'L'`     | `"M"`       | Swatch size                                                          |
| `rounding`  | `'default' \| 'none' \| 'full'` | `"default"` | Corner rounding style                                                |

### Accessibility Props

| Name               | Type     | Description                              |
| ------------------ | -------- | ---------------------------------------- |
| `id`               | `string` | Unique element identifier                |
| `aria-label`       | `string` | Accessible label for the element         |
| `aria-labelledby`  | `string` | ID reference(s) for labeling element     |
| `aria-describedby` | `string` | ID reference(s) for description          |
| `aria-details`     | `string` | ID reference(s) for detailed description |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description                         |
| ------------------ | --------------- | ----------------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (use as last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (use as last resort)  |
