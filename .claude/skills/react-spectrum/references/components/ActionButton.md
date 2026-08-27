<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ActionButton.html -->
<!-- Last fetched: 2026-04-05 -->

# ActionButton

ActionButtons allow users to perform an action. They're used for similar, task-based options within a workflow, and are ideal for interfaces where buttons aren't meant to draw a lot of attention.

```tsx
import { ActionButton } from "@adobe/react-spectrum";
```

## Basic Usage

```tsx
<ActionButton>Edit</ActionButton>
```

### Icon with Label

```tsx
import { Text } from "@adobe/react-spectrum";
import Edit from "@spectrum-icons/workflow/Edit";

<ActionButton>
  <Edit />
  <Text>Icon + Label</Text>
</ActionButton>;
```

### Icon Only

```tsx
<ActionButton aria-label="Icon only">
  <Edit />
</ActionButton>
```

### With Events

```tsx
function Example() {
  let [count, setCount] = React.useState(0);

  return (
    <ActionButton onPress={() => setCount((c) => c + 1)}>
      {count} Edits
    </ActionButton>
  );
}
```

## Visual Options

### Quiet Style

```tsx
<ActionButton isQuiet>Action!</ActionButton>
```

### Disabled State

```tsx
<ActionButton isDisabled>Action!</ActionButton>
```

### Static Color

For use over colored backgrounds:

```tsx
<Flex wrap gap="size-250">
  <View backgroundColor="static-blue-700" padding="size-500">
    <ActionButton staticColor="white">
      <Edit />
      <Text>Edit</Text>
    </ActionButton>
  </View>
  <View backgroundColor="static-yellow-400" padding="size-500">
    <ActionButton staticColor="black" isQuiet>
      <Edit />
      <Text>Edit</Text>
    </ActionButton>
  </View>
</Flex>
```

## Props

| Name                  | Type                              | Default    | Description                          |
| --------------------- | --------------------------------- | ---------- | ------------------------------------ |
| `children`            | `ReactNode`                       | --         | Button content                       |
| `isQuiet`             | `boolean`                         | --         | Quiet style variant                  |
| `staticColor`         | `'white' \| 'black'`              | --         | Static color for colored backgrounds |
| `isDisabled`          | `boolean`                         | --         | Disables the button                  |
| `autoFocus`           | `boolean`                         | --         | Auto-focus on render                 |
| `type`                | `'button' \| 'submit' \| 'reset'` | `'button'` | HTML button type                     |
| `form`                | `string`                          | --         | Associated form element ID           |
| `formAction`          | `string`                          | --         | URL for form submission              |
| `formEncType`         | `string`                          | --         | Form data encoding                   |
| `formMethod`          | `string`                          | --         | HTTP method for form                 |
| `formNoValidate`      | `boolean`                         | --         | Skip form validation                 |
| `formTarget`          | `string`                          | --         | Form submission target               |
| `name`                | `string`                          | --         | Form field name                      |
| `value`               | `string`                          | --         | Form field value                     |
| `excludeFromTabOrder` | `boolean`                         | --         | Excludes from tab order              |
| `preventFocusOnPress` | `boolean`                         | --         | Prevents focus on press              |
| `id`                  | `string`                          | --         | Element identifier                   |

Layout/spacing/positioning props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`, `UNSAFE_className`, `UNSAFE_style`

### Accessibility Props

| Name               | Type                                                                                 | Description                   |
| ------------------ | ------------------------------------------------------------------------------------ | ----------------------------- |
| `aria-label`       | `string`                                                                             | Labels the element            |
| `aria-labelledby`  | `string`                                                                             | Links to labeling element     |
| `aria-describedby` | `string`                                                                             | Links to description          |
| `aria-details`     | `string`                                                                             | Links to detailed description |
| `aria-disabled`    | `boolean \| 'true' \| 'false'`                                                       | Disabled state                |
| `aria-expanded`    | `boolean \| 'true' \| 'false'`                                                       | Expansion state               |
| `aria-pressed`     | `boolean \| 'true' \| 'false' \| 'mixed'`                                            | Toggle state                  |
| `aria-current`     | `boolean \| 'true' \| 'false' \| 'page' \| 'step' \| 'location' \| 'date' \| 'time'` | Current item indicator        |
| `aria-haspopup`    | `boolean \| 'menu' \| 'listbox' \| 'tree' \| 'grid' \| 'dialog'`                     | Popup availability            |
| `aria-controls`    | `string`                                                                             | Controlled elements           |

## Events

| Name            | Type                           | Description                       |
| --------------- | ------------------------------ | --------------------------------- |
| `onPress`       | `(e: PressEvent) => void`      | Released over target              |
| `onPressStart`  | `(e: PressEvent) => void`      | Press begins                      |
| `onPressEnd`    | `(e: PressEvent) => void`      | Press ends                        |
| `onPressChange` | `(isPressed: boolean) => void` | Press state changes               |
| `onPressUp`     | `(e: PressEvent) => void`      | Released over target or elsewhere |
| `onFocus`       | `(e: FocusEvent) => void`      | Element receives focus            |
| `onBlur`        | `(e: FocusEvent) => void`      | Element loses focus               |
| `onFocusChange` | `(isFocused: boolean) => void` | Focus status changes              |
| `onKeyDown`     | `(e: KeyboardEvent) => void`   | Key pressed                       |
| `onKeyUp`       | `(e: KeyboardEvent) => void`   | Key released                      |

### PressEvent

| Property      | Type                                                     | Description                   |
| ------------- | -------------------------------------------------------- | ----------------------------- |
| `type`        | `'pressstart' \| 'pressend' \| 'pressup' \| 'press'`     | Event type                    |
| `pointerType` | `'mouse' \| 'pen' \| 'touch' \| 'keyboard' \| 'virtual'` | Input device                  |
| `target`      | `Element`                                                | Event target                  |
| `shiftKey`    | `boolean`                                                | Shift modifier                |
| `ctrlKey`     | `boolean`                                                | Ctrl modifier                 |
| `metaKey`     | `boolean`                                                | Meta modifier                 |
| `altKey`      | `boolean`                                                | Alt modifier                  |
| `x`           | `number`                                                 | X position relative to target |
| `y`           | `number`                                                 | Y position relative to target |

## Accessibility

Icon-only buttons require `aria-label` to provide an accessible text alternative. Localized strings should be passed to `children` or `aria-label` props.
