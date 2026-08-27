<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ColorSlider.html -->
<!-- Last fetched: 2026-04-05 -->

# ColorSlider

A ColorSlider allows users to adjust an individual channel of a color value.

Added in version 3.35.0.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { ColorSlider } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<ColorSlider defaultValue="#7f0000" channel="red" />
```

## Value Management

### Uncontrolled

```jsx
<ColorSlider defaultValue="#7f0000" channel="red" />
```

### Controlled

```jsx
import { parseColor } from "react-stately";

function Example() {
  let [value, setValue] = React.useState(parseColor("hsl(0, 100%, 50%)"));
  return (
    <ColorSlider
      label="Hue (controlled)"
      value={value}
      onChange={setValue}
      channel="hue"
    />
  );
}
```

### HTML Form Integration

```jsx
<ColorSlider defaultValue="#7f0000" channel="red" name="red" />
```

The value submits as a number between minimum and maximum for the displayed channel.

## Labeling

```jsx
<Flex gap="size-300" wrap alignItems="end">
  <ColorSlider
    channel="saturation"
    defaultValue="hsl(0, 100%, 50%)"
    label={null}
  />
  <ColorSlider
    channel="lightness"
    defaultValue="hsl(0, 100%, 50%)"
    showValueLabel={false}
  />
</Flex>
```

If the label is hidden, a localized channel name serves as the default `aria-label`. Channel values automatically convert to `aria-valuetext` regardless of label visibility.

## Events

- **`onChange`**: Triggers when the handle is dragged. Receives a Color object.
- **`onChangeEnd`**: Triggers when the user stops dragging. Receives a Color object.

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
      <ColorSlider
        value={currentValue}
        channel="hue"
        onChange={setCurrentValue}
        onChangeEnd={setFinalValue}
      />
      <pre>Current value: {currentValue.toString("hsl")}</pre>
      <pre>Final value: {finalValue.toString("hsl")}</pre>
    </div>
  );
}
```

## Creating Color Pickers

### RGBA Color Picker

```jsx
function Example() {
  let [color, setColor] = React.useState(parseColor("#ff00ff"));
  return (
    <Flex direction="column">
      <ColorSlider channel="red" value={color} onChange={setColor} />
      <ColorSlider channel="green" value={color} onChange={setColor} />
      <ColorSlider channel="blue" value={color} onChange={setColor} />
      <ColorSlider channel="alpha" value={color} onChange={setColor} />
    </Flex>
  );
}
```

### HSLA Color Picker

```jsx
function Example() {
  let [color, setColor] = React.useState(parseColor("hsla(0, 100%, 50%, 0.5)"));
  return (
    <Flex direction="column">
      <ColorSlider channel="hue" value={color} onChange={setColor} />
      <ColorSlider channel="saturation" value={color} onChange={setColor} />
      <ColorSlider channel="lightness" value={color} onChange={setColor} />
      <ColorSlider channel="alpha" value={color} onChange={setColor} />
    </Flex>
  );
}
```

### HSBA Color Picker

```jsx
function Example() {
  let [color, setColor] = React.useState(parseColor("hsba(0, 100%, 50%, 0.5)"));
  return (
    <>
      <ColorSlider channel="hue" value={color} onChange={setColor} />
      <ColorSlider channel="saturation" value={color} onChange={setColor} />
      <ColorSlider channel="brightness" value={color} onChange={setColor} />
      <ColorSlider channel="alpha" value={color} onChange={setColor} />
    </>
  );
}
```

## Visual Options

### Disabled

```jsx
<ColorSlider defaultValue="#7f0000" channel="red" isDisabled />
```

### Vertical Orientation

```jsx
<ColorSlider defaultValue="#7f0000" channel="red" orientation="vertical" />
```

### Custom Size

```jsx
<Flex direction="column" gap="size-300">
  <ColorSlider
    defaultValue="#7f0000"
    channel="red"
    orientation="vertical"
    height="size-3600"
  />
  <ColorSlider
    defaultValue="#7f0000"
    channel="red"
    width="size-3600"
    maxWidth="100%"
  />
</Flex>
```

### Contextual Help

```jsx
import { Content, ContextualHelp, Heading } from "@adobe/react-spectrum";

<ColorSlider
  label="Accent Color"
  channel="hue"
  defaultValue="hsl(120, 100%, 50%)"
  contextualHelp={
    <ContextualHelp>
      <Heading>What is an accent color?</Heading>
      <Content>
        An accent color is the primary foreground color for your theme.
      </Content>
    </ContextualHelp>
  }
/>;
```

## Props API

### Core Props

| Name             | Type           | Default        | Description                                                                                                          |
| ---------------- | -------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `channel`        | `ColorChannel` | --             | Required. The color channel the slider manipulates (hue, saturation, brightness, lightness, red, green, blue, alpha) |
| `value`          | `Color`        | --             | Current controlled value                                                                                             |
| `defaultValue`   | `Color`        | --             | Default uncontrolled value                                                                                           |
| `label`          | `ReactNode`    | --             | Label content. Use `null` to hide                                                                                    |
| `showValueLabel` | `boolean`      | --             | Whether to display the value label                                                                                   |
| `colorSpace`     | `ColorSpace`   | --             | Color space ('rgb', 'hsl', 'hsb'). Defaults to color value's space                                                   |
| `orientation`    | `Orientation`  | `'horizontal'` | 'horizontal' or 'vertical'                                                                                           |
| `isDisabled`     | `boolean`      | --             | Disables the entire slider                                                                                           |
| `name`           | `string`       | --             | Input element name for form submission                                                                               |
| `form`           | `string`       | --             | Associated form element ID                                                                                           |
| `contextualHelp` | `ReactNode`    | --             | ContextualHelp element next to label                                                                                 |

### Events

| Name          | Type                     | Description          |
| ------------- | ------------------------ | -------------------- |
| `onChange`    | `(value: Color) => void` | Fires while dragging |
| `onChangeEnd` | `(value: Color) => void` | Fires when drag ends |

### Accessibility Props

| Name               | Type     | Description               |
| ------------------ | -------- | ------------------------- |
| `id`               | `string` | Unique element identifier |
| `aria-label`       | `string` | Element label definition  |
| `aria-labelledby`  | `string` | Labels the element        |
| `aria-describedby` | `string` | Describes the element     |
| `aria-details`     | `string` | Extended description      |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description                               |
| ------------------ | --------------- | ----------------------------------------- |
| `UNSAFE_className` | `string`        | Direct CSS className (use as last resort) |
| `UNSAFE_style`     | `CSSProperties` | Direct inline styles (use as last resort) |
