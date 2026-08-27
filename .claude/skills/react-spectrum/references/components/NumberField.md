<!-- Source: https://react-spectrum.adobe.com/react-spectrum/NumberField.html -->
<!-- Last fetched: 2026-04-05 -->

# NumberField

NumberFields allow users to input number values with a keyboard or increment/decrement with step buttons.

**Added in:** 3.10.0

## Import

```javascript
import { NumberField } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<NumberField label="Width" defaultValue={1024} minValue={0} />
```

## Value Management

### Uncontrolled

```jsx
<NumberField label="Cookies" defaultValue={15} minValue={0} />
```

### Controlled

```jsx
function Example() {
  let [value, setValue] = React.useState(15);
  return (
    <NumberField
      label="Cookies"
      value={value}
      onChange={setValue}
      minValue={0}
    />
  );
}
```

### HTML Forms

NumberField submits raw numeric values (e.g., `45`) rather than formatted strings:

```jsx
<NumberField
  label="Transaction amount"
  name="amount"
  defaultValue={45}
  formatOptions={{ style: "currency", currency: "USD" }}
/>
```

## Number Formatting

### Decimals

```jsx
<NumberField
  label="Adjust exposure"
  formatOptions={{
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }}
  defaultValue={0}
/>
```

### Percentages

Values are multiplied by 100 for display and divided by 100 on input:

```jsx
<NumberField
  label="Sales tax"
  formatOptions={{ style: "percent" }}
  minValue={0}
  defaultValue={0.05}
/>
```

### Currency

```jsx
<NumberField
  label="Transaction amount"
  defaultValue={45}
  formatOptions={{
    style: "currency",
    currency: "EUR",
    currencyDisplay: "code",
    currencySign: "accounting",
  }}
/>
```

### Units

```jsx
<NumberField
  label="Package width"
  defaultValue={4}
  minValue={0}
  formatOptions={{ style: "unit", unit: "inch", unitDisplay: "long" }}
/>
```

## Step Values

Steps calculate from `minValue` if defined, otherwise from zero:

```jsx
<NumberField label="Step" step={10} />
<NumberField label="Step + minValue" minValue={2} step={3} />
<NumberField label="Step + minValue + maxValue" minValue={2} maxValue={21} step={3} />
```

## Visual Variants

### Quiet

```jsx
<NumberField label="Cookies" isQuiet minValue={0} />
```

### Hidden Steppers

```jsx
<NumberField label="Cookies" hideStepper minValue={0} />
```

### Disabled / Read-Only

```jsx
<NumberField label="Cookies" isDisabled minValue={0} />
<NumberField label="Cookies" defaultValue={15} isReadOnly minValue={0} />
```

### Label Positioning

```jsx
<NumberField
  label="Cookies"
  labelPosition="side"
  labelAlign="end"
  minValue={0}
/>
```

## Help Text and Error Messages

```jsx
function Example() {
  let [value, setValue] = React.useState(1);
  let isValid = React.useMemo(() => value > 0 || Number.isNaN(value), [value]);

  return (
    <NumberField
      validationState={
        Number.isNaN(value) ? undefined : isValid ? "valid" : "invalid"
      }
      value={value}
      onChange={setValue}
      label="Positive numbers only"
      description="Enter a positive number."
      errorMessage={
        value === 0
          ? "Is zero positive?"
          : "Positive numbers are bigger than 0."
      }
    />
  );
}
```

## Contextual Help

```jsx
import { Content, ContextualHelp, Heading } from "@adobe/react-spectrum";

<NumberField
  label="Exposure"
  formatOptions={{
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }}
  defaultValue={0}
  contextualHelp={
    <ContextualHelp>
      <Heading>What is exposure?</Heading>
      <Content>Exposure adjusts how bright the image is.</Content>
    </ContextualHelp>
  }
/>;
```

## Validation

```jsx
<Form validationBehavior="native" maxWidth="size-3000">
  <NumberField label="Width" name="width" isRequired />
  <ButtonGroup>
    <Button type="submit" variant="primary">
      Submit
    </Button>
    <Button type="reset" variant="secondary">
      Reset
    </Button>
  </ButtonGroup>
</Form>
```

## Props API

### Input Props

| Name                 | Type                                                              | Default  | Description                            |
| -------------------- | ----------------------------------------------------------------- | -------- | -------------------------------------- |
| `isQuiet`            | `boolean`                                                         | --       | Display with quiet styling             |
| `hideStepper`        | `boolean`                                                         | `false`  | Hide increment/decrement buttons       |
| `decrementAriaLabel` | `string`                                                          | --       | Custom aria-label for decrement button |
| `incrementAriaLabel` | `string`                                                          | --       | Custom aria-label for increment button |
| `isWheelDisabled`    | `boolean`                                                         | --       | Disable scroll wheel value changes     |
| `formatOptions`      | `Intl.NumberFormatOptions`                                        | --       | Number formatting configuration        |
| `isDisabled`         | `boolean`                                                         | --       | Disable the input                      |
| `isReadOnly`         | `boolean`                                                         | --       | Make input read-only                   |
| `isRequired`         | `boolean`                                                         | --       | Mark field as required                 |
| `validationBehavior` | `'aria' \| 'native'`                                              | `'aria'` | Validation behavior mode               |
| `validate`           | `(value: number) => ValidationError \| true \| null \| undefined` | --       | Custom validation function             |
| `autoFocus`          | `boolean`                                                         | --       | Focus on render                        |
| `value`              | `number`                                                          | --       | Controlled value                       |
| `defaultValue`       | `number`                                                          | --       | Uncontrolled default value             |
| `minValue`           | `number`                                                          | --       | Minimum allowed value                  |
| `maxValue`           | `number`                                                          | --       | Maximum allowed value                  |
| `step`               | `number`                                                          | --       | Increment/decrement step amount        |

### Labeling Props

| Name                 | Type                                              | Default   | Description                      |
| -------------------- | ------------------------------------------------- | --------- | -------------------------------- |
| `label`              | `ReactNode`                                       | --        | Field label                      |
| `description`        | `ReactNode`                                       | --        | Helper text describing the field |
| `errorMessage`       | `ReactNode \| (v: ValidationResult) => ReactNode` | --        | Error message display            |
| `validationState`    | `'valid' \| 'invalid'`                            | --        | Visual validation state          |
| `labelPosition`      | `'top' \| 'side'`                                 | `'top'`   | Label placement                  |
| `labelAlign`         | `'start' \| 'end'`                                | `'start'` | Label horizontal alignment       |
| `necessityIndicator` | `'icon' \| 'label'`                               | `'icon'`  | Required indicator style         |
| `contextualHelp`     | `ReactNode`                                       | --        | Contextual help element          |

### Form Props

| Name   | Type     | Description                |
| ------ | -------- | -------------------------- |
| `name` | `string` | HTML form field name       |
| `form` | `string` | Associated form element ID |

### Events

| Name                  | Type                           | Description               |
| --------------------- | ------------------------------ | ------------------------- |
| `onChange`            | `(value: number) => void`      | Value changed (committed) |
| `onFocus`             | `(e: FocusEvent) => void`      | Element received focus    |
| `onBlur`              | `(e: FocusEvent) => void`      | Element lost focus        |
| `onFocusChange`       | `(isFocused: boolean) => void` | Focus state changed       |
| `onKeyDown`           | `(e: KeyboardEvent) => void`   | Key pressed               |
| `onKeyUp`             | `(e: KeyboardEvent) => void`   | Key released              |
| `onCopy`              | `ClipboardEventHandler`        | User copied text          |
| `onCut`               | `ClipboardEventHandler`        | User cut text             |
| `onPaste`             | `ClipboardEventHandler`        | User pasted text          |
| `onCompositionStart`  | `CompositionEventHandler`      | Text composition started  |
| `onCompositionEnd`    | `CompositionEventHandler`      | Text composition ended    |
| `onCompositionUpdate` | `CompositionEventHandler`      | Composition text updated  |
| `onSelect`            | `ReactEventHandler`            | Text selected             |
| `onBeforeInput`       | `FormEventHandler`             | Before input modification |
| `onInput`             | `FormEventHandler`             | Input value modified      |

### Accessibility Props

| Name               | Type     | Description                        |
| ------------------ | -------- | ---------------------------------- |
| `id`               | `string` | Unique element identifier          |
| `aria-label`       | `string` | Element label                      |
| `aria-labelledby`  | `string` | Labeling element ID(s)             |
| `aria-describedby` | `string` | Describing element ID(s)           |
| `aria-details`     | `string` | Detailed description element ID(s) |

### Layout/Spacing/Sizing/Positioning Props (Responsive)

All standard Spectrum layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Advanced Props

| Name               | Type            | Description                  |
| ------------------ | --------------- | ---------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort)  |

## Key Behaviors

- **Value Submission**: Submits raw numbers to forms, not formatted strings
- **Step Calculation**: When `minValue` is set, steps calculate from that value; otherwise from zero
- **Auto-Snapping**: Values between steps snap to nearest step on blur
- **Empty Field**: Incrementing from empty starts at `minValue` (or `maxValue` when decrementing); otherwise starts from 0
- **Percentage Mode**: Default step automatically becomes `0.01` (1%) when using percent formatting
- **Numeral Systems**: Supports Latin, Arabic-Indic, and Han positional decimals in input
