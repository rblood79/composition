<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ButtonGroup.html -->
<!-- Last fetched: 2026-04-05 -->

# ButtonGroup

## Description

ButtonGroup manages the layout and overflow behavior of related buttons. It automatically switches between horizontal and vertical orientations based on available horizontal space, making it ideal for groupings of two or more related button actions.

**Version:** Added in 3.0.0

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { Button, ButtonGroup } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic

```jsx
<ButtonGroup>
  <Button variant="primary">Rate Now</Button>
  <Button variant="secondary">No, thanks</Button>
  <Button variant="secondary">Remind me later</Button>
</ButtonGroup>
```

### Vertical Orientation

```jsx
<ButtonGroup orientation="vertical">
  <Button variant="secondary">No, thanks</Button>
  <Button variant="secondary">Remind me later</Button>
  <Button variant="primary">Rate Now</Button>
</ButtonGroup>
```

### Alignment

```jsx
<ButtonGroup orientation="vertical" align="end">
  <Button variant="secondary">No, thanks</Button>
  <Button variant="primary">Rate Now</Button>
</ButtonGroup>

<ButtonGroup orientation="vertical" align="center">
  <Button variant="secondary">Remind me later</Button>
  <Button variant="primary">Rate Now</Button>
</ButtonGroup>
```

### Disabled State

```jsx
<ButtonGroup isDisabled>
  <Button variant="secondary">No, thanks</Button>
  <Button variant="primary">Rate Now</Button>
</ButtonGroup>
```

## Props API

| Name               | Type                           | Default        | Description                                                       |
| ------------------ | ------------------------------ | -------------- | ----------------------------------------------------------------- |
| `children`         | `ReactNode`                    | --             | The Button elements contained within the ButtonGroup              |
| `isDisabled`       | `boolean`                      | --             | Disables all buttons in the group                                 |
| `orientation`      | `'horizontal' \| 'vertical'`   | `'horizontal'` | Axis alignment; 'vertical' prevents dynamic orientation switching |
| `align`            | `'start' \| 'end' \| 'center'` | `'start'`      | Button alignment within the group                                 |
| `id`               | `string`                       | --             | Unique element identifier                                         |
| `UNSAFE_className` | `string`                       | --             | Direct CSS class assignment (last resort)                         |
| `UNSAFE_style`     | `CSSProperties`                | --             | Inline styles (last resort)                                       |

(layout props omitted)

## Key Behaviors

- **Responsive Layout:** Automatically switches from horizontal to vertical orientation when horizontal space becomes limited
- **Contextual Alignment:** Start-aligned by default for content flow; end-aligned within containers like dialogs or cards; center-aligned in empty states
- **RTL Support:** Automatic alignment flipping for right-to-left languages
