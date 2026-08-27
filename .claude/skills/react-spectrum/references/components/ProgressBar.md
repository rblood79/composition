<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ProgressBar.html -->
<!-- Last fetched: 2026-04-05 -->

# ProgressBar

ProgressBars show the progression of a system operation: downloading, uploading, processing, etc., in a visual way. They support both determinate and indeterminate progress states.

```jsx
import { ProgressBar } from "@adobe/react-spectrum";

<ProgressBar label="Loading..." value={50} />;
```

## Value

By default, the `value` prop is a percentage between 0 and 100. Use `minValue` and `maxValue` to set a custom scale.

```jsx
<ProgressBar label="Loading..." minValue={50} maxValue={150} value={100} />
```

### Custom Value Formatting

```jsx
<ProgressBar
  label="Loading..."
  formatOptions={{ style: "currency", currency: "JPY" }}
  value={60}
/>
```

## Indeterminate

Use `isIndeterminate` when progress cannot be calculated.

```jsx
<ProgressBar label="Loading..." isIndeterminate />
```

## Labeling

```jsx
<Flex direction="column" maxWidth="size-3000" gap="size-300">
  <ProgressBar label="Loading..." value={30} />
  <ProgressBar label="Loading..." labelPosition="side" value={30} />
  <ProgressBar label="Loading..." showValueLabel={false} value={30} />
</Flex>
```

### Custom Value Labels

```jsx
<Flex direction="column" maxWidth="size-3000" gap="size-300">
  <ProgressBar label="Loading..." showValueLabel={false} value={30} />
  <ProgressBar label="Loading..." valueLabel="30 of 60 dogs" value={30} />
  <ProgressBar
    label="Loading..."
    formatOptions={{ style: "percent", minimumFractionDigits: 2 }}
    value={30.123}
  />
</Flex>
```

## Static Color

```jsx
<View backgroundColor="static-blue-700" padding="size-300">
  <ProgressBar label="Loading..." staticColor="white" value={5} />
</View>
<View backgroundColor="static-yellow-400" padding="size-300">
  <ProgressBar label="Loading..." staticColor="black" value={5} />
</View>
```

## Size

```jsx
<Flex direction="column" gap="size-300">
  <ProgressBar label="Small" size="S" value={70} />
  <ProgressBar label="Large" size="L" value={70} />
</Flex>
```

## Props

| Name               | Type                       | Default              | Description                                                              |
| ------------------ | -------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `value`            | `number`                   | `0`                  | Current progress value (controlled).                                     |
| `minValue`         | `number`                   | `0`                  | Minimum allowed value.                                                   |
| `maxValue`         | `number`                   | `100`                | Maximum allowed value.                                                   |
| `isIndeterminate`  | `boolean`                  | --                   | Shows indeterminate state when progress is unknown.                      |
| `label`            | `ReactNode`                | --                   | Label text displayed above/beside bar.                                   |
| `labelPosition`    | `'top' \| 'side'`          | `'top'`              | Position of label relative to bar.                                       |
| `showValueLabel`   | `boolean`                  | --                   | Whether to display value label (true if label exists, else false).       |
| `valueLabel`       | `ReactNode`                | --                   | Custom text for value display (e.g., "1 of 4").                          |
| `formatOptions`    | `Intl.NumberFormatOptions` | `{style: 'percent'}` | Format options for value label using Intl.NumberFormat.                  |
| `size`             | `'S' \| 'L'`               | `'L'`                | Bar thickness.                                                           |
| `staticColor`      | `'white' \| 'black'`       | --                   | Color for display over colored backgrounds.                              |
| `id`               | `string`                   | --                   | Element's unique identifier.                                             |
| `aria-label`       | `string`                   | --                   | Defines a string value that labels the current element.                  |
| `aria-labelledby`  | `string`                   | --                   | Identifies the element(s) that labels the current element.               |
| `aria-describedby` | `string`                   | --                   | Identifies the element(s) that describes the object.                     |
| `aria-details`     | `string`                   | --                   | Identifies the element(s) that provide a detailed, extended description. |
| `UNSAFE_className` | `string`                   | --                   | CSS className (last resort only).                                        |
| `UNSAFE_style`     | `CSSProperties`            | --                   | Inline styles (last resort only).                                        |

### Layout Props (all Responsive)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`

### Spacing Props (all Responsive\<DimensionValue\>)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`

### Sizing Props (all Responsive\<DimensionValue\>)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`

### Positioning Props (all Responsive)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

## Accessibility

A `label`, `aria-label`, or `aria-labelledby` prop is required depending on the visualization being used (i.e. depending on the `showValueLabel` prop). When using `staticColor`, ensure sufficient contrast for legibility per WCAG guidelines.

## Internationalization

ProgressBar automatically uses the current locale to format the value label. Pass localized strings to `label`, `aria-label`, or associated `aria-labelledby` element. RTL languages (Hebrew, Arabic) automatically reverse layout.
