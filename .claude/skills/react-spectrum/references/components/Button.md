<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Button.html -->
<!-- Last fetched: 2026-04-05 -->

# Button

## Description

Buttons allow users to perform an action or to navigate to another page. They have multiple styles for various needs, and are ideal for calling attention to where a user needs to do something in order to move forward in a flow.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { Button } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic

```jsx
<Button variant="accent">Save</Button>
```

### With Icon and Label

```jsx
import { Text } from "@adobe/react-spectrum";

<Button variant="primary">
  <Bell />
  <Text>Icon + Label</Text>
</Button>;
```

### Event Handling

```jsx
function Example() {
  let [count, setCount] = React.useState(0);

  return (
    <Button variant="primary" onPress={() => setCount((c) => c + 1)}>
      {count} Dogs
    </Button>
  );
}
```

### Pending State

```jsx
function Example() {
  let [isLoading, setIsLoading] = React.useState(false);

  let handlePress = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  };

  return (
    <Button variant="primary" isPending={isLoading} onPress={handlePress}>
      Click me!
    </Button>
  );
}
```

## Props API

| Name                  | Type                                                                                  | Default    | Description                                                    |
| --------------------- | ------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `variant`             | `'accent' \| 'primary' \| 'secondary' \| 'negative'`                                  | --         | Visual style of the button                                     |
| `style`               | `'fill' \| 'outline'`                                                                 | --         | Background style                                               |
| `staticColor`         | `'white' \| 'black'`                                                                  | --         | Static color for buttons over colored backgrounds              |
| `isPending`           | `boolean`                                                                             | --         | Displays loading spinner after 1 second delay; disables events |
| `isDisabled`          | `boolean`                                                                             | --         | Disables the button                                            |
| `type`                | `'button' \| 'submit' \| 'reset'`                                                     | `'button'` | HTML button behavior                                           |
| `form`                | `string`                                                                              | --         | Associates button with a `<form>` by id                        |
| `formAction`          | `string`                                                                              | --         | URL that processes form submission                             |
| `formEncType`         | `string`                                                                              | --         | Form data encoding method                                      |
| `formMethod`          | `string`                                                                              | --         | HTTP method for form submission                                |
| `formNoValidate`      | `boolean`                                                                             | --         | Skips form validation on submit                                |
| `formTarget`          | `string`                                                                              | --         | Target window for form submission                              |
| `name`                | `string`                                                                              | --         | Form submission name attribute                                 |
| `value`               | `string`                                                                              | --         | Form submission value                                          |
| `elementType`         | `ElementType \| JSXElementConstructor`                                                | `'button'` | HTML element or React component to render                      |
| `href`                | `string`                                                                              | --         | URL for link buttons (`elementType="a"`)                       |
| `target`              | `string`                                                                              | --         | Link target window                                             |
| `rel`                 | `string`                                                                              | --         | Link relationship attribute                                    |
| `children`            | `ReactNode`                                                                           | --         | Button content/label                                           |
| `autoFocus`           | `boolean`                                                                             | --         | Receives focus on render                                       |
| `id`                  | `string`                                                                              | --         | Unique element identifier                                      |
| `excludeFromTabOrder` | `boolean`                                                                             | --         | Removes from keyboard tab sequence                             |
| `preventFocusOnPress` | `boolean`                                                                             | --         | Prevents focus when pressed (use carefully)                    |
| `aria-label`          | `string`                                                                              | --         | Accessible label (required for icon-only buttons)              |
| `aria-labelledby`     | `string`                                                                              | --         | Element(s) that label this element                             |
| `aria-describedby`    | `string`                                                                              | --         | Element(s) that describe this element                          |
| `aria-details`        | `string`                                                                              | --         | Element(s) providing extended description                      |
| `aria-disabled`       | `boolean \| 'true' \| 'false'`                                                        | --         | Indicates disabled state to assistive tech                     |
| `aria-expanded`       | `boolean \| 'true' \| 'false'`                                                        | --         | Indicates expanded/collapsed state                             |
| `aria-haspopup`       | `boolean \| 'menu' \| 'listbox' \| 'tree' \| 'grid' \| 'dialog' \| 'true' \| 'false'` | --         | Indicates popup availability                                   |
| `aria-controls`       | `string`                                                                              | --         | Element(s) controlled by this element                          |
| `aria-pressed`        | `boolean \| 'true' \| 'false' \| 'mixed'`                                             | --         | Current "pressed" state for toggle buttons                     |
| `aria-current`        | `boolean \| 'true' \| 'false' \| 'page' \| 'step' \| 'location' \| 'date' \| 'time'`  | --         | Current item indicator                                         |
| `UNSAFE_className`    | `string`                                                                              | --         | CSS class (use as last resort)                                 |
| `UNSAFE_style`        | `CSSProperties`                                                                       | --         | Inline styles (use as last resort)                             |

(layout props omitted)

## Events

| Event           | Type                           | Description                              |
| --------------- | ------------------------------ | ---------------------------------------- |
| `onPress`       | `(e: PressEvent) => void`      | Fired when press is released over target |
| `onPressStart`  | `(e: PressEvent) => void`      | Fired when press interaction begins      |
| `onPressEnd`    | `(e: PressEvent) => void`      | Fired when press interaction ends        |
| `onPressChange` | `(isPressed: boolean) => void` | Fired when press state changes           |
| `onPressUp`     | `(e: PressEvent) => void`      | Fired when press releases over target    |
| `onFocus`       | `(e: FocusEvent) => void`      | Fired when element receives focus        |
| `onBlur`        | `(e: FocusEvent) => void`      | Fired when element loses focus           |
| `onFocusChange` | `(isFocused: boolean) => void` | Fired when focus state changes           |
| `onKeyDown`     | `(e: KeyboardEvent) => void`   | Fired when key is pressed                |
| `onKeyUp`       | `(e: KeyboardEvent) => void`   | Fired when key is released               |

## Visual Variants

The component supports four main variants: **accent**, **primary**, **secondary**, and **negative**, each available in **fill** and **outline** styles. A **disabled** state is also available. For buttons over colored backgrounds, use `staticColor="white"` or `staticColor="black"`.

## Accessibility

- **Visible Label Required:** All buttons must have a visible label for accessibility
- **Icon-Only Buttons:** Must include an `aria-label` to identify the control
- **Internationalization:** Pass localized strings to `children` or `aria-label`
- **Keyboard Support:** Full keyboard interaction via mouse, keyboard, and touch through `onPress`
