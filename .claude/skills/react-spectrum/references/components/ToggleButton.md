<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ToggleButton.html -->
<!-- Last fetched: 2026-04-05 -->

# ToggleButton

ToggleButtons allow users to toggle a selection on or off, for example switching between two states or modes.

**Added in:** 3.2.0

```tsx
import { ToggleButton } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic

```jsx
<ToggleButton>Pin</ToggleButton>
```

### Icon with Label

```jsx
import { Text } from "@adobe/react-spectrum";
import Pin from "@spectrum-icons/workflow/PinOff";

<ToggleButton>
  <Pin />
  <Text>Icon + Label</Text>
</ToggleButton>;
```

### Icon Only (with accessibility)

```jsx
<ToggleButton aria-label="Icon only">
  <Pin />
</ToggleButton>
```

### Controlled

```jsx
function Example() {
  let [isSelected, setSelected] = React.useState(false);
  return (
    <ToggleButton
      isEmphasized
      isSelected={isSelected}
      onChange={setSelected}
      aria-label="Pin"
    >
      <Pin />
    </ToggleButton>
  );
}
```

### Visual Variants

```jsx
// Emphasized
<ToggleButton isEmphasized defaultSelected>Pin</ToggleButton>

// Quiet
<ToggleButton isQuiet>Pin</ToggleButton>

// Disabled
<ToggleButton isDisabled>Pin</ToggleButton>

// Static color (over colored backgrounds)
<View backgroundColor="static-blue-700" padding="size-500">
  <ToggleButton staticColor="white">
    <Pin /><Text>Pin</Text>
  </ToggleButton>
</View>
```

## Props API

| Name                  | Type                 | Default | Description                           |
| --------------------- | -------------------- | ------- | ------------------------------------- |
| `children`            | `ReactNode`          | --      | Button content (label, icon, or both) |
| `isEmphasized`        | `boolean`            | --      | Displays button with emphasized style |
| `isSelected`          | `boolean`            | --      | Controlled selection state            |
| `defaultSelected`     | `boolean`            | --      | Uncontrolled default selection state  |
| `isDisabled`          | `boolean`            | --      | Disables the button                   |
| `isQuiet`             | `boolean`            | --      | Applies quiet styling                 |
| `staticColor`         | `'white' \| 'black'` | --      | Static color for colored backgrounds  |
| `autoFocus`           | `boolean`            | --      | Receives focus on render              |
| `excludeFromTabOrder` | `boolean`            | --      | Exclude from tab order                |
| `preventFocusOnPress` | `boolean`            | --      | Prevent focus on press                |

### Accessibility Props

| Name               | Type                                      | Description                                          |
| ------------------ | ----------------------------------------- | ---------------------------------------------------- |
| `id`               | `string`                                  | Unique identifier                                    |
| `aria-label`       | `string`                                  | Accessibility label (required for icon-only buttons) |
| `aria-labelledby`  | `string`                                  | ID of labeling element                               |
| `aria-describedby` | `string`                                  | ID of describing element                             |
| `aria-disabled`    | `boolean \| 'true' \| 'false'`            | Assistive tech disabled state                        |
| `aria-pressed`     | `boolean \| 'true' \| 'false' \| 'mixed'` | Current pressed state                                |

### Layout/Spacing/Sizing/Positioning Props (abbreviated)

Standard Responsive layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, etc. Standard spacing: `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`. Standard sizing: `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`. Standard positioning: `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`.

### Advanced Props

| Name               | Type            | Description                        |
| ------------------ | --------------- | ---------------------------------- |
| `UNSAFE_className` | `string`        | Direct CSS className (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort)        |

## Events

| Name            | Type                            | Description                            |
| --------------- | ------------------------------- | -------------------------------------- |
| `onChange`      | `(isSelected: boolean) => void` | Fires when selection state changes     |
| `onPress`       | `(e: PressEvent) => void`       | Fires when press completes over target |
| `onPressStart`  | `(e: PressEvent) => void`       | Fires when press begins                |
| `onPressEnd`    | `(e: PressEvent) => void`       | Fires when press ends                  |
| `onPressChange` | `(isPressed: boolean) => void`  | Fires when press state changes         |
| `onPressUp`     | `(e: PressEvent) => void`       | Fires when press releases              |
| `onFocus`       | `(e: FocusEvent) => void`       | Fires when element receives focus      |
| `onBlur`        | `(e: FocusEvent) => void`       | Fires when element loses focus         |
| `onFocusChange` | `(isFocused: boolean) => void`  | Fires when focus status changes        |
| `onKeyDown`     | `(e: KeyboardEvent) => void`    | Fires when key is pressed              |
| `onKeyUp`       | `(e: KeyboardEvent) => void`    | Fires when key is released             |

### PressEvent Properties

- `type`: `'pressstart' | 'pressend' | 'pressup' | 'press'`
- `pointerType`: `'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual'`
- `target`: Target element
- `shiftKey`, `ctrlKey`, `metaKey`, `altKey`: Keyboard modifiers
- `x`, `y`: Position relative to target

## Accessibility

- Icon-only buttons require `aria-label`
- ToggleButton should NOT be used when content changes between states (e.g., mute/unmute). Use ActionButton instead.
- Accessible via mouse, keyboard, and touch
- Localize `children` or `aria-label` for i18n
