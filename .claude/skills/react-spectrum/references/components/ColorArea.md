<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ColorArea.html -->
<!-- Last fetched: 2026-04-05 -->

# ColorArea

A ColorArea allows users to adjust two channels of an RGB, HSL, or HSB color value against a two-dimensional gradient background.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { ColorArea } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<ColorArea defaultValue="#7f0000" />
```

## Controlled Component with HSL Channels

```jsx
import { parseColor } from "react-stately";

function Example() {
  let [value, setValue] = React.useState(parseColor("hsl(0, 100%, 50%)"));
  return (
    <ColorArea
      aria-labelledby="hsl-controlled-id"
      value={value}
      onChange={setValue}
      xChannel="saturation"
      yChannel="lightness"
    />
  );
}
```

## HTML Form Integration

```jsx
<ColorArea xName="red" yName="green" />
```

## Events

- **`onChange`**: Triggered continuously as the user drags the handle
- **`onChangeEnd`**: Triggered when the user stops dragging

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
      <ColorArea
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

## Labeling & Accessibility

```jsx
<ColorArea
  aria-label="Background color"
  defaultValue="hsl(0, 100%, 50%)"
  xChannel="saturation"
  yChannel="lightness"
/>
```

- **Role Description**: "2D Slider" is automatically announced to screen reader users
- **Value Formatting**: Channel names and values are formatted by locale
- **RTL Support**: Layout automatically flips for right-to-left languages
- **Default Label**: Uses localized "Color Picker" label if no custom aria-label provided

## RGBA Color Picker Example

```jsx
import { parseColor } from "react-stately";

function Example() {
  let [color, setColor] = React.useState(parseColor("#ff00ff"));
  let [redChannel, greenChannel, blueChannel] = color.getColorChannels();
  return (
    <Flex direction="column">
      <ColorArea
        xChannel={redChannel}
        yChannel={greenChannel}
        value={color}
        onChange={setColor}
      />
      <ColorSlider channel={blueChannel} value={color} onChange={setColor} />
      <ColorSlider channel="alpha" value={color} onChange={setColor} />
    </Flex>
  );
}
```

## HSLA Color Picker with ColorWheel

```jsx
function Example() {
  let [color, setColor] = React.useState(parseColor("hsla(0, 100%, 50%, 0.5)"));
  let [, saturationChannel, lightnessChannel] = color.getColorChannels();
  return (
    <Flex direction="column">
      <View position="relative" width="size-2400">
        <Grid
          position="absolute"
          justifyContent="center"
          alignContent="center"
          width="100%"
          height="100%"
        >
          <ColorArea
            xChannel={saturationChannel}
            yChannel={lightnessChannel}
            value={color}
            onChange={setColor}
            size="size-1200"
          />
        </Grid>
        <ColorWheel value={color} onChange={setColor} size="size-2400" />
      </View>
      <ColorSlider channel="alpha" value={color} onChange={setColor} />
    </Flex>
  );
}
```

## Props API

### Core Props

| Name           | Type                      | Default | Description                                  |
| -------------- | ------------------------- | ------- | -------------------------------------------- |
| `size`         | `DimensionValue`          | --      | Size of the Color Area                       |
| `xChannel`     | `ColorChannel`            | --      | Color channel for the horizontal axis        |
| `yChannel`     | `ColorChannel`            | --      | Color channel for the vertical axis          |
| `value`        | `Color`                   | --      | Current value (controlled)                   |
| `defaultValue` | `Color \| string`         | --      | Default value (uncontrolled)                 |
| `colorSpace`   | `'rgb' \| 'hsl' \| 'hsb'` | --      | Color space; defaults to value's color space |
| `isDisabled`   | `boolean`                 | `false` | Disables the ColorArea                       |
| `xName`        | `string`                  | --      | Name for X channel input (HTML forms)        |
| `yName`        | `string`                  | --      | Name for Y channel input (HTML forms)        |
| `form`         | `string`                  | --      | Associated form element ID                   |

### Event Handlers

| Name          | Type                     | Description                           |
| ------------- | ------------------------ | ------------------------------------- |
| `onChange`    | `(value: Color) => void` | Called when value changes during drag |
| `onChangeEnd` | `(value: Color) => void` | Called when user stops dragging       |

### Accessibility Props

| Name               | Type     | Description                                |
| ------------------ | -------- | ------------------------------------------ |
| `id`               | `string` | Element's unique identifier                |
| `aria-label`       | `string` | Defines label for element                  |
| `aria-labelledby`  | `string` | Identifies labeling element(s)             |
| `aria-describedby` | `string` | Identifies describing element(s)           |
| `aria-details`     | `string` | Identifies detailed description element(s) |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`minWidth`, `maxWidth`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description                 |
| ------------------ | --------------- | --------------------------- |
| `UNSAFE_className` | `string`        | CSS className (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort) |

## Color API Methods

| Method                             | Returns                                      | Description                           |
| ---------------------------------- | -------------------------------------------- | ------------------------------------- |
| `toFormat(format)`                 | `Color`                                      | Converts to given color format        |
| `toString(format?)`                | `string`                                     | Converts to string (default: 'css')   |
| `clone()`                          | `Color`                                      | Returns duplicate color               |
| `toHexInt()`                       | `number`                                     | Converts to hex integer               |
| `getChannelValue(channel)`         | `number`                                     | Gets numeric value for channel        |
| `withChannelValue(channel, value)` | `Color`                                      | Sets channel value, returns new Color |
| `getChannelRange(channel)`         | `ColorChannelRange`                          | Returns min/max/step for channel      |
| `getChannelName(channel, locale)`  | `string`                                     | Gets localized channel name           |
| `getColorSpace()`                  | `'rgb' \| 'hsl' \| 'hsb'`                    | Returns color space                   |
| `getColorChannels()`               | `[ColorChannel, ColorChannel, ColorChannel]` | Returns all channel names             |

**Supported Color Channels:** `'hue'`, `'saturation'`, `'brightness'`, `'lightness'`, `'red'`, `'green'`, `'blue'`, `'alpha'`

**Supported Color Formats:** `'hex'`, `'hexa'`, `'rgb'`, `'rgba'`, `'hsl'`, `'hsla'`, `'hsb'`, `'hsba'`
