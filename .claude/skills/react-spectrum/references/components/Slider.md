<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Slider.html -->
<!-- Last fetched: 2026-04-05 -->

# Slider

Sliders allow users to quickly select a value within a range. They should be used when the upper and lower bounds to the range are invariable.

```jsx
import { Slider } from "@adobe/react-spectrum";

<Slider label="Cookies to buy" defaultValue={12} />;
```

## Value

### Uncontrolled & Controlled

```jsx
function Example() {
  let [value, setValue] = React.useState(25);
  return (
    <>
      <Slider label="Cookies to buy (Uncontrolled)" defaultValue={25} />
      <Slider
        label="Cookies to buy (Controlled)"
        value={value}
        onChange={setValue}
      />
    </>
  );
}
```

### Custom Range

```jsx
<Slider
  label="Cookies to buy"
  minValue={50}
  maxValue={150}
  defaultValue={100}
/>
```

### Formatted Value

```jsx
<Slider
  label="Currency"
  formatOptions={{ style: "currency", currency: "JPY" }}
  defaultValue={60}
/>
```

### HTML Forms

```jsx
<Slider label="Opacity" defaultValue={50} name="opacity" />
```

## Labeling

```jsx
<Flex direction="column" maxWidth="size-5000" gap="size-300">
  <Slider label="Cookies to buy" defaultValue={25} />
  <Slider label="Donuts to buy" labelPosition="side" defaultValue={25} />
  <Slider label="Pastries to buy" showValueLabel={false} defaultValue={25} />
</Flex>
```

### Custom Value Labels

```jsx
<Flex direction="column" maxWidth="size-3000" gap="size-300">
  <Slider label="Cookies to buy" showValueLabel={false} defaultValue={90} />
  <Slider
    label="Percent donuts eaten"
    maxValue={1}
    step={0.001}
    formatOptions={{ style: "percent", minimumFractionDigits: 1 }}
    defaultValue={0.891}
  />
  <Slider
    label="Donuts to buy"
    maxValue={60}
    getValueLabel={(donuts) => `${donuts} of 60 Donuts`}
  />
</Flex>
```

## Fill

```jsx
<Flex direction="column" gap="size-300">
  <Slider
    label="Opacity"
    maxValue={1}
    formatOptions={{ style: "percent" }}
    defaultValue={0.9}
    step={0.01}
    isFilled
  />
  <Slider
    label="Exposure"
    minValue={-5}
    maxValue={5}
    defaultValue={1.83}
    formatOptions={{ signDisplay: "always" }}
    step={0.01}
    fillOffset={0}
    isFilled
  />
</Flex>
```

## Gradient

```jsx
<Slider
  label="Filter density"
  trackGradient={["white", "rgba(177,141,32,1)"]}
  defaultValue={0.3}
  maxValue={1}
  step={0.01}
  formatOptions={{ style: "percent" }}
  isFilled
/>
```

## Contextual Help

```jsx
import { Content, ContextualHelp, Heading } from "@adobe/react-spectrum";

<Slider
  label="Exposure"
  minValue={-100}
  maxValue={100}
  defaultValue={0}
  formatOptions={{ signDisplay: "always" }}
  isFilled
  fillOffset={0}
  contextualHelp={
    <ContextualHelp>
      <Heading>What is exposure?</Heading>
      <Content>Exposure adjusts how bright the image is.</Content>
    </ContextualHelp>
  }
/>;
```

## Disabled

```jsx
<Slider label="Cookies to share" defaultValue={25} isDisabled />
```

## Props

| Name             | Type                         | Default        | Description                                                                   |
| ---------------- | ---------------------------- | -------------- | ----------------------------------------------------------------------------- |
| `isFilled`       | `boolean`                    | --             | Whether a fill color displays between slider start and current value.         |
| `fillOffset`     | `number`                     | --             | The offset from which to start the fill.                                      |
| `trackGradient`  | `string[]`                   | --             | Background of the track as CSS gradient stops.                                |
| `formatOptions`  | `Intl.NumberFormatOptions`   | --             | Display format of the value label.                                            |
| `labelPosition`  | `'top' \| 'side'`            | `'top'`        | The label's position relative to the element.                                 |
| `showValueLabel` | `boolean`                    | --             | Whether the value label displays (true by default with label, false without). |
| `getValueLabel`  | `(value: number) => string`  | --             | Custom function to format the value label.                                    |
| `contextualHelp` | `ReactNode`                  | --             | A ContextualHelp element placed next to the label.                            |
| `orientation`    | `'horizontal' \| 'vertical'` | `'horizontal'` | The slider's orientation.                                                     |
| `isDisabled`     | `boolean`                    | --             | Whether the entire slider is disabled.                                        |
| `minValue`       | `number`                     | `0`            | The slider's minimum value.                                                   |
| `maxValue`       | `number`                     | `100`          | The slider's maximum value.                                                   |
| `step`           | `number`                     | `1`            | The slider's step value.                                                      |
| `value`          | `number`                     | --             | The current value (controlled).                                               |
| `defaultValue`   | `number`                     | --             | The default value (uncontrolled).                                             |
| `label`          | `ReactNode`                  | --             | The content displayed as the label.                                           |
| `name`           | `string`                     | --             | The input element's name for HTML form submission.                            |
| `form`           | `string`                     | --             | The ID of the `<form>` element to associate the input with.                   |

### Events

| Name          | Type                      | Description                                                |
| ------------- | ------------------------- | ---------------------------------------------------------- |
| `onChange`    | `(value: T) => void`      | Triggered when the slider value changes.                   |
| `onChangeEnd` | `(value: number) => void` | Triggered when the slider stops moving (user releases it). |

### Accessibility Props

| Name               | Type     | Description                                           |
| ------------------ | -------- | ----------------------------------------------------- |
| `id`               | `string` | Element's unique identifier.                          |
| `aria-label`       | `string` | Defines a string labeling the current element.        |
| `aria-labelledby`  | `string` | Identifies labeling element(s).                       |
| `aria-describedby` | `string` | Identifies describing element(s).                     |
| `aria-details`     | `string` | Identifies element(s) providing detailed description. |

### Layout/Spacing/Sizing/Positioning Props (all Responsive)

Layout: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`

Spacing: `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`

Sizing: `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`

Positioning: `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

Advanced: `UNSAFE_className`, `UNSAFE_style`

## Accessibility

A `label`, `aria-label`, or `aria-labelledby` prop is required depending on the visualization being used (particularly with the `showValueLabel` prop).

## Internationalization

Localized strings should be passed to the `label` prop or associated `aria-labelledby` element. For RTL languages (Hebrew, Arabic), the slider layout automatically flips. The component uses the current locale to format value labels.
