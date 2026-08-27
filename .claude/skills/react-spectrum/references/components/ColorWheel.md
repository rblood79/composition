<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ColorWheel.html -->
<!-- Last fetched: 2026-04-05 -->

# ColorWheel

A ColorWheel allows users to adjust the hue of an HSL or HSB color value on a circular track.

Added in version 3.35.0.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { ColorWheel } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<ColorWheel defaultValue="hsl(30, 100%, 50%)" />
```

## Value Management

### Uncontrolled

```jsx
<ColorWheel defaultValue="hsl(30, 100%, 50%)" />
```

### Controlled

```jsx
import { parseColor } from "react-stately";

function Example() {
  let [value, setValue] = React.useState(parseColor("hsl(30, 100%, 50%)"));
  return <ColorWheel value={value} onChange={setValue} />;
}
```

### HTML Form Integration

```jsx
<ColorWheel name="hue" />
```

The value submits as a number between 0-360 degrees.

## Events

- **`onChange`**: Fires during handle dragging
- **`onChangeEnd`**: Fires when user stops dragging

```jsx
function Example() {
  let [currentValue, setCurrentValue] = React.useState(
    parseColor("hsl(50, 100%, 50%)"),
  );
  let [finalValue, setFinalValue] = React.useState(
    parseColor("hsl(50, 100%, 50%)"),
  );

  return (
    <div>
      <ColorWheel
        value={currentValue}
        onChange={setCurrentValue}
        onChangeEnd={setFinalValue}
      />
      <pre>Current value: {currentValue.toString("hsl")}</pre>
      <pre>Final value: {finalValue.toString("hsl")}</pre>
    </div>
  );
}
```

## Visual Options

### Disabled

```jsx
<ColorWheel isDisabled />
```

### Custom Size

```jsx
<ColorWheel size="size-1600" />
```

## Props API

### Core Props

| Name           | Type              | Default               | Description                      |
| -------------- | ----------------- | --------------------- | -------------------------------- |
| `size`         | `DimensionValue`  | --                    | Outer diameter of the ColorWheel |
| `isDisabled`   | `boolean`         | --                    | Disables the component           |
| `defaultValue` | `string \| Color` | `'hsl(0, 100%, 50%)'` | Uncontrolled initial value       |
| `value`        | `Color`           | --                    | Controlled current value         |
| `name`         | `string`          | --                    | HTML form input name attribute   |
| `form`         | `string`          | --                    | Associated form element ID       |

### Events

| Name          | Type                     | Description                             |
| ------------- | ------------------------ | --------------------------------------- |
| `onChange`    | `(value: Color) => void` | Handles value changes during dragging   |
| `onChangeEnd` | `(value: Color) => void` | Handles final value when dragging stops |

### Accessibility Props

| Name               | Type     | Description                                |
| ------------------ | -------- | ------------------------------------------ |
| `id`               | `string` | Element's unique identifier                |
| `aria-label`       | `string` | Defines a label for the element            |
| `aria-labelledby`  | `string` | References labeling element ID             |
| `aria-describedby` | `string` | References describing element ID           |
| `aria-details`     | `string` | References detailed description element ID |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`minWidth`, `maxWidth`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description                             |
| ------------------ | --------------- | --------------------------------------- |
| `UNSAFE_className` | `string`        | Sets CSS className (use as last resort) |
| `UNSAFE_style`     | `CSSProperties` | Sets inline styles (use as last resort) |

## Accessibility

By default, ColorWheel uses a localized "hue" channel name as its `aria-label`. When providing custom labels via `aria-label` or `aria-labelledby`, ensure they are properly localized.
