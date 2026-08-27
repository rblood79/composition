<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ProgressCircle.html -->
<!-- Last fetched: 2026-04-05 -->

# ProgressCircle

ProgressCircles display the progression of system operations like downloading, uploading, or processing in a visual format. They support both determinate and indeterminate states.

```jsx
import { ProgressCircle } from "@adobe/react-spectrum";

<ProgressCircle aria-label="Loading..." value={50} />;
```

## Value

By default, the `value` prop is a percentage between 0 and 100. Use `minValue` and `maxValue` to set a custom scale.

```jsx
<ProgressCircle
  aria-label="Loading..."
  minValue={50}
  maxValue={150}
  value={100}
/>
```

## Indeterminate

```jsx
<ProgressCircle aria-label="Loading..." isIndeterminate />
```

## Static Color

```jsx
<View backgroundColor="static-blue-700" padding="size-300">
  <ProgressCircle aria-label="Loading..." staticColor="white" isIndeterminate />
</View>
<View backgroundColor="static-yellow-400" padding="size-300">
  <ProgressCircle aria-label="Loading..." staticColor="black" isIndeterminate />
</View>
```

## Size

```jsx
<ProgressCircle aria-label="Loading..." size="S" value={15} />
<ProgressCircle aria-label="Loading..." value={30} />
<ProgressCircle aria-label="Loading..." size="L" value={60} />
```

## Props

| Name               | Type                 | Default | Description                                     |
| ------------------ | -------------------- | ------- | ----------------------------------------------- |
| `size`             | `'S' \| 'M' \| 'L'`  | `'M'`   | Diameter size of the circle.                    |
| `staticColor`      | `'white' \| 'black'` | --      | Static color for backgrounds; ensures contrast. |
| `isIndeterminate`  | `boolean`            | --      | Shows indeterminate progress when true.         |
| `value`            | `number`             | `0`     | Current progress value (controlled).            |
| `minValue`         | `number`             | `0`     | Minimum allowed value.                          |
| `maxValue`         | `number`             | `100`   | Maximum allowed value.                          |
| `id`               | `string`             | --      | Unique element identifier.                      |
| `aria-label`       | `string`             | --      | Labels the current element (required).          |
| `aria-labelledby`  | `string`             | --      | ID of labeling element.                         |
| `aria-describedby` | `string`             | --      | ID of describing element.                       |
| `aria-details`     | `string`             | --      | ID of detailed description element.             |
| `UNSAFE_className` | `string`             | --      | CSS className (use as last resort).             |
| `UNSAFE_style`     | `CSSProperties`      | --      | Inline style (use as last resort).              |

### Layout Props (all Responsive)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`

### Spacing Props (all Responsive\<DimensionValue\>)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`

### Sizing Props (all Responsive\<DimensionValue\>)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`

### Positioning Props (all Responsive)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

## Accessibility

An `aria-label` must be provided for accessibility. Alternatively, use `aria-labelledby` referencing an associated label element's ID. When using `staticColor`, ensure background contrast meets WCAG guidelines.

## Internationalization

Pass localized strings to `aria-label` prop. RTL languages (Hebrew, Arabic): progress fill continues clockwise for both determinate and indeterminate states.
