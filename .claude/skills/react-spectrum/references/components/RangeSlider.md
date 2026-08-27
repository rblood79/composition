<!-- Source: https://react-spectrum.adobe.com/react-spectrum/RangeSlider.html -->
<!-- Last fetched: 2026-04-05 -->

# RangeSlider

RangeSliders allow users to quickly select a subset range. They should be used when the upper and lower bounds to the range are invariable.

```tsx
import { RangeSlider } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<RangeSlider label="Range" defaultValue={{ start: 12, end: 36 }} />
```

## Value Management

### Controlled vs Uncontrolled

```jsx
function Example() {
  let [value, setValue] = React.useState({ start: 25, end: 75 });
  return (
    <Flex gap="size-150" wrap>
      <RangeSlider
        label="Range (uncontrolled)"
        defaultValue={{ start: 25, end: 75 }}
      />
      <RangeSlider
        label="Range (controlled)"
        value={value}
        onChange={setValue}
      />
    </Flex>
  );
}
```

### Custom Range Scale

```jsx
<RangeSlider
  label="Range"
  minValue={50}
  maxValue={150}
  defaultValue={{ start: 75, end: 100 }}
/>
```

### Value Formatting

```jsx
<RangeSlider
  label="Price range"
  formatOptions={{ style: "currency", currency: "JPY" }}
  defaultValue={{ start: 75, end: 100 }}
/>
```

### HTML Form Integration

```jsx
<RangeSlider
  label="Range"
  defaultValue={{ start: 12, end: 36 }}
  startName="start"
  endName="end"
/>
```

## Label Positioning

```jsx
<Flex direction="column" maxWidth="size-5000" gap="size-300">
  <RangeSlider
    label="Jeans price range"
    formatOptions={{ style: "currency", currency: "USD" }}
    defaultValue={{ start: 75, end: 100 }}
  />
  <RangeSlider
    label="Shoes price range"
    labelPosition="side"
    defaultValue={{ start: 50, end: 100 }}
  />
  <RangeSlider
    label="Hats price range"
    showValueLabel={false}
    defaultValue={{ start: 15, end: 30 }}
  />
</Flex>
```

### Custom Label Formatting

```jsx
<RangeSlider
  label="Search radius"
  maxValue={200}
  getValueLabel={(meters) => `${meters.start}m to ${meters.end}m away`}
  defaultValue={{ start: 15, end: 60 }}
/>
```

## Contextual Help

```jsx
<RangeSlider
  label="Search radius"
  formatOptions={{ style: "unit", unit: "mile" }}
  defaultValue={{ start: 15, end: 60 }}
  contextualHelp={
    <ContextualHelp variant="info">
      <Heading>Ranking</Heading>
      <Content>Search results are sorted by distance.</Content>
    </ContextualHelp>
  }
/>
```

## Disabled State

```jsx
<RangeSlider
  label="Price filter"
  defaultValue={{ start: 25, end: 50 }}
  isDisabled
/>
```

## Props

| Name             | Type                                    | Default        | Description                          |
| ---------------- | --------------------------------------- | -------------- | ------------------------------------ |
| `startName`      | `string`                                | --             | Form input name for the start value  |
| `endName`        | `string`                                | --             | Form input name for the end value    |
| `form`           | `string`                                | --             | Associated `<form>` element ID       |
| `formatOptions`  | `Intl.NumberFormatOptions`              | --             | Display format for value label       |
| `labelPosition`  | `'top' \| 'side'`                       | `'top'`        | Label position relative to slider    |
| `showValueLabel` | `boolean`                               | --             | Display/hide value label             |
| `getValueLabel`  | `(value: RangeValue<number>) => string` | --             | Custom label formatting function     |
| `contextualHelp` | `ReactNode`                             | --             | ContextualHelp element next to label |
| `orientation`    | `'horizontal' \| 'vertical'`            | `'horizontal'` | Slider orientation                   |
| `isDisabled`     | `boolean`                               | --             | Disable entire slider                |
| `minValue`       | `number`                                | `0`            | Minimum selectable value             |
| `maxValue`       | `number`                                | `100`          | Maximum selectable value             |
| `step`           | `number`                                | `1`            | Increment between values             |
| `value`          | `RangeValue<number>`                    | --             | Controlled value                     |
| `defaultValue`   | `RangeValue<number>`                    | --             | Uncontrolled default value           |
| `label`          | `ReactNode`                             | --             | Label content                        |

### Events

| Name          | Type                                  | Description                   |
| ------------- | ------------------------------------- | ----------------------------- |
| `onChange`    | `(value: RangeValue<number>) => void` | Fired when value changes      |
| `onChangeEnd` | `(value: RangeValue<number>) => void` | Fired when slider is released |

### Layout Props

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`

### Spacing Props

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`

### Sizing Props

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`

### Positioning Props

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Accessibility Props

| Name               | Type     | Description                |
| ------------------ | -------- | -------------------------- |
| `id`               | `string` | Unique element identifier  |
| `aria-label`       | `string` | Accessible label string    |
| `aria-labelledby`  | `string` | ID of labeling element     |
| `aria-describedby` | `string` | ID of describing element   |
| `aria-details`     | `string` | ID of detailed description |

### Advanced Props

| Name               | Type            | Description                       |
| ------------------ | --------------- | --------------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (last resort only) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort only)  |

## Accessibility

A `label`, `aria-label`, or `aria-labelledby` prop is required depending on the visualization (i.e. depending on the `showValueLabel` prop).

## Internationalization

Localized strings should be passed to the `label` prop or `aria-label`. The component automatically handles RTL layout and formats value labels according to the current locale.
