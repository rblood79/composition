<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ColorField.html -->
<!-- Last fetched: 2026-04-05 -->

# ColorField

A ColorField allows users to edit a hex color or individual color channel value.

Added in version 3.35.0.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { ColorField } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<ColorField label="Primary Color" />
```

## Value Management

### Uncontrolled

```jsx
<ColorField label="Primary Color" defaultValue="#e21" />
```

### Controlled

```jsx
import { parseColor } from "react-stately";

function Example() {
  let [value, setValue] = React.useState(parseColor("#e73623"));
  return (
    <ColorField
      label="Primary Color (Controlled)"
      value={value}
      onChange={setValue}
    />
  );
}
```

### HTML Forms Integration

```jsx
<ColorField label="Color" name="color" />
```

The value submits as a hex string, or as a number when a `channel` prop is provided.

## Color Channel Editing

```jsx
function Example() {
  let [color, setColor] = React.useState(parseColor("#7f007f"));
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <ColorField
        label="Hue"
        value={color}
        onChange={setColor}
        colorSpace="hsl"
        channel="hue"
      />
      <ColorField
        label="Saturation"
        value={color}
        onChange={setColor}
        colorSpace="hsl"
        channel="saturation"
      />
      <ColorField
        label="Lightness"
        value={color}
        onChange={setColor}
        colorSpace="hsl"
        channel="lightness"
      />
    </div>
  );
}
```

## Labeling

```jsx
<Flex gap="size-150" wrap>
  <ColorField label="Primary Color" />
  <ColorField label="Primary Color" isRequired />
  <ColorField label="Primary Color" isRequired necessityIndicator="label" />
</Flex>
```

If no visible label is provided, use `aria-label` or `aria-labelledby`.

## Validation

```jsx
import { Form, ButtonGroup, Button } from "@adobe/react-spectrum";

<Form validationBehavior="native" maxWidth="size-3000">
  <ColorField label="Color" name="color" isRequired />
  <ButtonGroup>
    <Button type="submit" variant="primary">
      Submit
    </Button>
    <Button type="reset" variant="secondary">
      Reset
    </Button>
  </ButtonGroup>
</Form>;
```

## Visual Options

### Quiet Style

```jsx
<ColorField label="Primary Color" isQuiet />
```

### Disabled / Read-Only

```jsx
<ColorField label="Primary Color" isDisabled defaultValue="#e73623" />
<ColorField label="Primary Color" isReadOnly defaultValue="#e73623" />
```

### Label Positioning

```jsx
<ColorField label="Primary Color" labelPosition="side" labelAlign="end" />
```

### Help Text

```jsx
<Flex gap="size-100" wrap>
  <ColorField
    label="Color"
    defaultValue="#abc"
    validationState="valid"
    description="Enter your favorite color."
  />
  <ColorField
    label="Color"
    validationState="invalid"
    errorMessage="Empty input is not allowed."
  />
</Flex>
```

### Contextual Help

```jsx
import { Content, ContextualHelp, Heading } from "@adobe/react-spectrum";

<ColorField
  label="Accent Color"
  defaultValue="#e73623"
  contextualHelp={
    <ContextualHelp>
      <Heading>What is an accent color?</Heading>
      <Content>
        An accent color is the primary foreground color for your theme.
      </Content>
    </ContextualHelp>
  }
/>;
```

## Props API

### Core Props

| Name                 | Type                                                        | Default   | Description                                                                                                                        |
| -------------------- | ----------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `channel`            | `ColorChannel`                                              | --        | Color channel to edit ('hue', 'saturation', 'brightness', 'lightness', 'red', 'green', 'blue', 'alpha'). If omitted, edits as hex. |
| `colorSpace`         | `ColorSpace`                                                | --        | Color space ('rgb', 'hsl', 'hsb') when `channel` is provided                                                                       |
| `value`              | `Color`                                                     | --        | Controlled color value                                                                                                             |
| `defaultValue`       | `Color`                                                     | --        | Initial uncontrolled value                                                                                                         |
| `isQuiet`            | `boolean`                                                   | --        | Apply quiet styling                                                                                                                |
| `isWheelDisabled`    | `boolean`                                                   | --        | Disable scroll-based value changes                                                                                                 |
| `isDisabled`         | `boolean`                                                   | --        | Disable the field                                                                                                                  |
| `isReadOnly`         | `boolean`                                                   | --        | Allow selection but prevent editing                                                                                                |
| `isRequired`         | `boolean`                                                   | --        | Require a value for form submission                                                                                                |
| `validationBehavior` | `'aria' \| 'native'`                                        | `'aria'`  | Use native HTML or ARIA validation                                                                                                 |
| `validate`           | `(value: Color \| null) => ValidationError \| true \| null` | --        | Custom validation function                                                                                                         |
| `autoFocus`          | `boolean`                                                   | --        | Focus on render                                                                                                                    |
| `label`              | `ReactNode`                                                 | --        | Visual label text                                                                                                                  |
| `description`        | `ReactNode`                                                 | --        | Hint text below label                                                                                                              |
| `errorMessage`       | `ReactNode \| (v: ValidationResult) => ReactNode`           | --        | Error message display                                                                                                              |
| `name`               | `string`                                                    | --        | Form input name attribute                                                                                                          |
| `form`               | `string`                                                    | --        | Associated form's ID                                                                                                               |
| `validationState`    | `'valid' \| 'invalid'`                                      | --        | Manual validation state override                                                                                                   |
| `labelPosition`      | `'top' \| 'side'`                                           | `'top'`   | Label placement relative to field                                                                                                  |
| `labelAlign`         | `'start' \| 'end'`                                          | `'start'` | Label horizontal alignment                                                                                                         |
| `necessityIndicator` | `'icon' \| 'label'`                                         | `'icon'`  | Show required state as icon or text                                                                                                |
| `contextualHelp`     | `ReactNode`                                                 | --        | ContextualHelp component for additional info                                                                                       |

### Events

| Name                  | Type                                        | Description                        |
| --------------------- | ------------------------------------------- | ---------------------------------- |
| `onChange`            | `(color: Color \| null) => void`            | Fires when color value changes     |
| `onFocus`             | `(e: FocusEvent) => void`                   | Fires when field receives focus    |
| `onBlur`              | `(e: FocusEvent) => void`                   | Fires when field loses focus       |
| `onFocusChange`       | `(isFocused: boolean) => void`              | Fires when focus status changes    |
| `onKeyDown`           | `(e: KeyboardEvent) => void`                | Fires on key press                 |
| `onKeyUp`             | `(e: KeyboardEvent) => void`                | Fires on key release               |
| `onCopy`              | `ClipboardEventHandler<HTMLInputElement>`   | Fires on copy action               |
| `onCut`               | `ClipboardEventHandler<HTMLInputElement>`   | Fires on cut action                |
| `onPaste`             | `ClipboardEventHandler<HTMLInputElement>`   | Fires on paste action              |
| `onCompositionStart`  | `CompositionEventHandler<HTMLInputElement>` | Fires when text composition begins |
| `onCompositionEnd`    | `CompositionEventHandler<HTMLInputElement>` | Fires when text composition ends   |
| `onCompositionUpdate` | `CompositionEventHandler<HTMLInputElement>` | Fires during text composition      |
| `onSelect`            | `ReactEventHandler<HTMLInputElement>`       | Fires when text is selected        |
| `onBeforeInput`       | `FormEventHandler<HTMLInputElement>`        | Fires before input modification    |
| `onInput`             | `FormEventHandler<HTMLInputElement>`        | Fires on input modification        |

### Accessibility Props

| Name                  | Type      | Description                        |
| --------------------- | --------- | ---------------------------------- |
| `id`                  | `string`  | Unique element identifier          |
| `excludeFromTabOrder` | `boolean` | Remove from keyboard tab sequence  |
| `aria-label`          | `string`  | Accessible label string            |
| `aria-labelledby`     | `string`  | ID of labeling element             |
| `aria-describedby`    | `string`  | ID of describing element           |
| `aria-details`        | `string`  | ID of detailed description element |
| `aria-errormessage`   | `string`  | ID of error message element        |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description                                 |
| ------------------ | --------------- | ------------------------------------------- |
| `UNSAFE_className` | `string`        | Direct CSS class assignment (use sparingly) |
| `UNSAFE_style`     | `CSSProperties` | Direct inline styles (use sparingly)        |
