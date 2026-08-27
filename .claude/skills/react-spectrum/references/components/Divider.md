<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Divider.html -->
<!-- Last fetched: 2026-04-05 -->

# Divider

Dividers bring clarity to a layout by grouping and dividing content in close proximity. They can also be used to establish rhythm and hierarchy.

**Added:** v3.0.0

```tsx
import { Divider } from "@adobe/react-spectrum";
```

## Usage

### Horizontal (Default)

```tsx
<Flex direction="column" gap="size-125">
  <Text>Content above</Text>
  <Divider />
  <Text>Content below</Text>
</Flex>
```

### Vertical

```tsx
<Flex gap="size-125">
  <Text>Content left</Text>
  <Divider orientation="vertical" />
  <Text>Content right</Text>
</Flex>
```

### Size Variations

```tsx
<Flex direction="column" gap="size-125">
  <Text>Content above large Divider</Text>
  <Divider size="L" />
  <Text>Content above medium Divider</Text>
  <Divider size="M" />
  <Text>Content above small Divider</Text>
  <Divider size="S" />
</Flex>
```

## Props

### Core Props

| Name          | Type                         | Default        | Description                       |
| ------------- | ---------------------------- | -------------- | --------------------------------- |
| `size`        | `'S' \| 'M' \| 'L'`          | `'L'`          | Controls thickness of the divider |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Axis alignment                    |
| `slot`        | `string`                     | `'divider'`    | Named slot for placement          |

### Accessibility Props

| Name               | Type     | Description                     |
| ------------------ | -------- | ------------------------------- |
| `id`               | `string` | Unique element identifier       |
| `aria-label`       | `string` | Accessible label                |
| `aria-labelledby`  | `string` | References labeling element     |
| `aria-describedby` | `string` | References description element  |
| `aria-details`     | `string` | References detailed description |

Layout/spacing/positioning props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`, `UNSAFE_className`, `UNSAFE_style`
