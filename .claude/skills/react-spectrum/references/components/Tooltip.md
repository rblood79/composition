<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Tooltip.html -->
<!-- Last fetched: 2026-04-05 -->

# Tooltip

Display container for Tooltip content. Has a directional arrow dependent on its placement.

```tsx
import { Tooltip, TooltipTrigger } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic

```jsx
<TooltipTrigger>
  <ActionButton aria-label="Edit Name">
    <Edit />
  </ActionButton>
  <Tooltip>Change Name</Tooltip>
</TooltipTrigger>
```

### Immediate Appearance

```jsx
<TooltipTrigger delay={0}>
  <ActionButton aria-label="Save">
    <Save />
  </ActionButton>
  <Tooltip>Saving applies your new settings right away.</Tooltip>
</TooltipTrigger>
```

### Placement

```jsx
<TooltipTrigger placement="end">
  <ActionButton aria-label="Foo">Placement</ActionButton>
  <Tooltip>In LTR this is on the right. In RTL this is on the left.</Tooltip>
</TooltipTrigger>
```

### Offset and Cross Offset

```jsx
// Main axis offset
<TooltipTrigger offset={50}>
  <ActionButton aria-label="Offset">Offset</ActionButton>
  <Tooltip>This will shift up.</Tooltip>
</TooltipTrigger>

// Cross axis offset
<TooltipTrigger crossOffset={100} placement="bottom">
  <ActionButton aria-label="Cross Offset">Cross Offset</ActionButton>
  <Tooltip>This will shift over to the right.</Tooltip>
</TooltipTrigger>
```

### Controlled State

```jsx
function Example() {
  let [isOpen, setOpen] = React.useState(false);
  return (
    <Flex alignItems="center" gap="size-100">
      <TooltipTrigger isOpen={isOpen} onOpenChange={setOpen}>
        <ActionButton aria-label="Resize">
          <Resize />
        </ActionButton>
        <Tooltip>Resize text.</Tooltip>
      </TooltipTrigger>
      <Text>Tooltip is {isOpen ? "showing" : "not showing"}</Text>
    </Flex>
  );
}
```

### Semantic Variants

```jsx
// Positive
<TooltipTrigger>
  <ActionButton aria-label="Approve"><ThumbUp /></ActionButton>
  <Tooltip variant="positive" showIcon>Approve workflow.</Tooltip>
</TooltipTrigger>

// Info
<TooltipTrigger>
  <ActionButton aria-label="Information"><Question /></ActionButton>
  <Tooltip variant="info" showIcon>More information menu.</Tooltip>
</TooltipTrigger>

// Negative
<TooltipTrigger>
  <ActionButton aria-label="Danger"><Delete /></ActionButton>
  <Tooltip variant="negative" showIcon>Dangerous action.</Tooltip>
</TooltipTrigger>
```

### Disabled Tooltip

```jsx
<TooltipTrigger isDisabled>
  <ActionButton aria-label="Danger" onPress={() => alert("pressed")}>
    <Delete />
  </ActionButton>
  <Tooltip variant="negative" showIcon>
    Dangerous action.
  </Tooltip>
</TooltipTrigger>
```

## Props API

### TooltipTrigger Props

| Name                 | Type                           | Default   | Description                                    |
| -------------------- | ------------------------------ | --------- | ---------------------------------------------- |
| `children`           | `[ReactElement, ReactElement]` | --        | Two child elements: trigger and tooltip        |
| `offset`             | `number`                       | `7`       | Additional spacing along main axis             |
| `placement`          | `Placement`                    | `'top'`   | Position relative to trigger element           |
| `isDisabled`         | `boolean`                      | --        | Disables tooltip independently from trigger    |
| `delay`              | `number`                       | `1500`    | Milliseconds before tooltip appears on hover   |
| `trigger`            | `'hover' \| 'focus'`           | `'hover'` | Interaction mode                               |
| `shouldCloseOnPress` | `boolean`                      | `true`    | Whether tooltip closes when trigger is pressed |
| `isOpen`             | `boolean`                      | --        | Controlled open state                          |
| `defaultOpen`        | `boolean`                      | --        | Uncontrolled initial open state                |
| `containerPadding`   | `number`                       | `12`      | Padding between tooltip and viewport edges     |
| `crossOffset`        | `number`                       | `0`       | Additional spacing along cross axis            |
| `shouldFlip`         | `boolean`                      | `true`    | Flips orientation when insufficient space      |
| `onOpenChange`       | `(isOpen: boolean) => void`    | --        | Fires when tooltip visibility changes          |

### Tooltip Props

| Name        | Type                                                         | Default | Description                        |
| ----------- | ------------------------------------------------------------ | ------- | ---------------------------------- |
| `children`  | `ReactNode`                                                  | --      | Tooltip content                    |
| `variant`   | `'neutral' \| 'positive' \| 'negative' \| 'info'`            | --      | Visual style variant               |
| `placement` | `'start' \| 'end' \| 'right' \| 'left' \| 'top' \| 'bottom'` | `'top'` | Arrow direction                    |
| `showIcon`  | `boolean`                                                    | --      | Displays semantic icon for variant |
| `isOpen`    | `boolean`                                                    | --      | Controlled visibility state        |

### Accessibility Props

| Name               | Type     | Description                          |
| ------------------ | -------- | ------------------------------------ |
| `id`               | `string` | Unique element identifier            |
| `aria-label`       | `string` | Element label for screen readers     |
| `aria-labelledby`  | `string` | IDs of labeling elements             |
| `aria-describedby` | `string` | IDs of describing elements           |
| `aria-details`     | `string` | IDs of detailed description elements |

### Layout/Spacing/Sizing/Positioning Props (abbreviated)

Standard Responsive layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, etc. Standard spacing: `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`. Standard sizing: `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`. Standard positioning: `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`.

### Advanced Props

| Name               | Type            | Description                  |
| ------------------ | --------------- | ---------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort)  |

### Placement Options

`'top'`, `'top left'`, `'top right'`, `'top start'`, `'top end'`, `'bottom'`, `'bottom left'`, `'bottom right'`, `'bottom start'`, `'bottom end'`, `'left'`, `'left top'`, `'left bottom'`, `'start'`, `'start top'`, `'start bottom'`, `'right'`, `'right top'`, `'right bottom'`, `'end'`, `'end top'`, `'end bottom'`

## Accessibility

- Tooltip triggers must be focusable and hoverable
- TooltipTrigger automatically links tooltips to triggers using ARIA attributes
- Tooltips appear instantly on keyboard focus (no delay)
- Only one tooltip displays at a time; warmup/cooldown period for subsequent tooltips
- For disabled buttons or plain text, use ContextualHelp instead
- RTL layout automatic

## Timing Behavior

- Default hover delay: 1500ms
- Keyboard focus: instant (0ms)
- Warmup/cooldown: subsequent tooltip activation is immediate for a short window after closing
- Set `delay={0}` for immediate appearance on hover
