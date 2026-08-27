<!-- Source: https://react-spectrum.adobe.com/react-spectrum/CheckboxGroup.html -->
<!-- Last fetched: 2026-04-05 -->

# CheckboxGroup

A CheckboxGroup allows users to select one or more items from a list of choices.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { CheckboxGroup, Checkbox } from "@adobe/react-spectrum";
```

## Basic Example

```jsx
<CheckboxGroup label="Favorite sports">
  <Checkbox value="soccer">Soccer</Checkbox>
  <Checkbox value="baseball">Baseball</Checkbox>
  <Checkbox value="basketball">Basketball</Checkbox>
</CheckboxGroup>
```

## Controlled vs Uncontrolled Values

```jsx
function Example() {
  let [selected, setSelected] = React.useState(["soccer", "baseball"]);

  return (
    <Flex gap="size-300">
      <CheckboxGroup
        label="Favorite sports (uncontrolled)"
        defaultValue={["soccer", "baseball"]}
      >
        <Checkbox value="soccer">Soccer</Checkbox>
        <Checkbox value="baseball">Baseball</Checkbox>
        <Checkbox value="basketball">Basketball</Checkbox>
      </CheckboxGroup>

      <CheckboxGroup
        label="Favorite sports (controlled)"
        value={selected}
        onChange={setSelected}
      >
        <Checkbox value="soccer">Soccer</Checkbox>
        <Checkbox value="baseball">Baseball</Checkbox>
        <Checkbox value="basketball">Basketball</Checkbox>
      </CheckboxGroup>
    </Flex>
  );
}
```

## HTML Forms Integration

```jsx
<CheckboxGroup label="Condiments" name="condiments">
  <Checkbox value="mayo">Mayo</Checkbox>
  <Checkbox value="mustard">Mustard</Checkbox>
  <Checkbox value="ketchup">Ketchup</Checkbox>
</CheckboxGroup>
```

## Labeling

```jsx
<Flex gap="size-300" wrap>
  <CheckboxGroup label="Favorite sports">
    <Checkbox value="soccer">Soccer</Checkbox>
    <Checkbox value="baseball">Baseball</Checkbox>
    <Checkbox value="basketball">Basketball</Checkbox>
  </CheckboxGroup>

  <CheckboxGroup label="Favorite sports" isRequired necessityIndicator="icon">
    <Checkbox value="soccer">Soccer</Checkbox>
    <Checkbox value="baseball">Baseball</Checkbox>
    <Checkbox value="basketball">Basketball</Checkbox>
  </CheckboxGroup>

  <CheckboxGroup label="Favorite sports" isRequired necessityIndicator="label">
    <Checkbox value="soccer">Soccer</Checkbox>
    <Checkbox value="baseball">Baseball</Checkbox>
    <Checkbox value="basketball">Basketball</Checkbox>
  </CheckboxGroup>
</Flex>
```

## Events

```jsx
function Example() {
  let [selected, setSelected] = React.useState([]);

  return (
    <>
      <CheckboxGroup
        label="Favorite sports"
        value={selected}
        onChange={setSelected}
      >
        <Checkbox value="soccer">Soccer</Checkbox>
        <Checkbox value="baseball">Baseball</Checkbox>
        <Checkbox value="basketball">Basketball</Checkbox>
      </CheckboxGroup>
      <div>You have selected: {selected.join(", ")}</div>
    </>
  );
}
```

## Validation

```jsx
import { Form, ButtonGroup, Button } from "@adobe/react-spectrum";

<Form validationBehavior="native">
  <CheckboxGroup label="Sandwich condiments" name="condiments" isRequired>
    <Checkbox value="lettuce">Lettuce</Checkbox>
    <Checkbox value="tomato">Tomato</Checkbox>
    <Checkbox value="onion">Onion</Checkbox>
    <Checkbox value="sprouts">Sprouts</Checkbox>
  </CheckboxGroup>
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

### Individual Checkbox Validation

```jsx
<Form validationBehavior="native">
  <CheckboxGroup label="Agree to the following" isRequired>
    <Checkbox value="terms" isRequired>
      Terms and conditions
    </Checkbox>
    <Checkbox value="privacy" isRequired>
      Privacy policy
    </Checkbox>
    <Checkbox value="cookies" isRequired>
      Cookie policy
    </Checkbox>
  </CheckboxGroup>
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

## Visual Options

### Orientation

```jsx
<CheckboxGroup label="Favorite sports" orientation="horizontal">
  <Checkbox value="soccer">Soccer</Checkbox>
  <Checkbox value="baseball">Baseball</Checkbox>
  <Checkbox value="basketball">Basketball</Checkbox>
</CheckboxGroup>
```

### Label Position and Alignment

```jsx
<CheckboxGroup label="Favorite sports" labelPosition="side" labelAlign="end">
  <Checkbox value="soccer">Soccer</Checkbox>
  <Checkbox value="baseball">Baseball</Checkbox>
  <Checkbox value="basketball">Basketball</Checkbox>
</CheckboxGroup>
```

### Help Text with Description and Error Messages

```jsx
function Example() {
  let [checked, setChecked] = React.useState(["dogs", "dragons"]);
  let isValid =
    checked.length === 2 &&
    checked.includes("dogs") &&
    checked.includes("dragons");

  return (
    <CheckboxGroup
      label="Pets"
      onChange={setChecked}
      value={checked}
      isInvalid={!isValid}
      description="Select your pets."
      errorMessage={
        checked.includes("cats")
          ? "No cats allowed."
          : "Select only dogs and dragons."
      }
    >
      <Checkbox value="dogs">Dogs</Checkbox>
      <Checkbox value="cats">Cats</Checkbox>
      <Checkbox value="dragons">Dragons</Checkbox>
    </CheckboxGroup>
  );
}
```

### Contextual Help

```jsx
import { Content, ContextualHelp, Heading } from "@adobe/react-spectrum";

<CheckboxGroup
  label="Favorite genres"
  contextualHelp={
    <ContextualHelp>
      <Heading>What does this do?</Heading>
      <Content>
        Your musical taste is used to train our machine learning recommendation
        algorithm.
      </Content>
    </ContextualHelp>
  }
>
  <Checkbox value="rock">Rock</Checkbox>
  <Checkbox value="pop">Pop</Checkbox>
  <Checkbox value="classical">Classical</Checkbox>
</CheckboxGroup>;
```

### Disabled

```jsx
<CheckboxGroup label="Favorite sports" isDisabled>
  <Checkbox value="soccer">Soccer</Checkbox>
  <Checkbox value="baseball">Baseball</Checkbox>
  <Checkbox value="basketball">Basketball</Checkbox>
</CheckboxGroup>
```

### Read Only

```jsx
<CheckboxGroup label="Favorite sports" defaultValue={["baseball"]} isReadOnly>
  <Checkbox value="soccer">Soccer</Checkbox>
  <Checkbox value="baseball">Baseball</Checkbox>
  <Checkbox value="basketball">Basketball</Checkbox>
</CheckboxGroup>
```

### Emphasized

```jsx
<CheckboxGroup
  label="Favorite sports"
  defaultValue={["soccer", "baseball"]}
  isEmphasized
>
  <Checkbox value="soccer">Soccer</Checkbox>
  <Checkbox value="baseball">Baseball</Checkbox>
  <Checkbox value="basketball">Basketball</Checkbox>
</CheckboxGroup>
```

## Props API

### CheckboxGroup Props

| Name                 | Type                                                                | Default      | Description                                                                                                |
| -------------------- | ------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| `children`           | `ReactElement<CheckboxProps> \| ReactElement<CheckboxProps>[]`      | --           | The Checkboxes contained within the CheckboxGroup                                                          |
| `orientation`        | `'vertical' \| 'horizontal'`                                        | `'vertical'` | The axis the checkboxes should align with                                                                  |
| `isEmphasized`       | `boolean`                                                           | --           | By default, checkboxes are not emphasized (gray). The emphasized (blue) version provides visual prominence |
| `value`              | `string[]`                                                          | --           | The current value (controlled)                                                                             |
| `defaultValue`       | `string[]`                                                          | --           | The default value (uncontrolled)                                                                           |
| `name`               | `string`                                                            | --           | The name of the input element, used when submitting an HTML form                                           |
| `isDisabled`         | `boolean`                                                           | --           | Whether the input is disabled                                                                              |
| `isReadOnly`         | `boolean`                                                           | --           | Whether the input can be selected but not changed by the user                                              |
| `label`              | `ReactNode`                                                         | --           | The content to display as the label                                                                        |
| `description`        | `ReactNode`                                                         | --           | A description for the field; provides a hint such as specific requirements                                 |
| `errorMessage`       | `ReactNode \| (v: ValidationResult) => ReactNode`                   | --           | An error message for the field                                                                             |
| `isRequired`         | `boolean`                                                           | --           | Whether user input is required on the input before form submission                                         |
| `isInvalid`          | `boolean`                                                           | --           | Whether the input value is invalid                                                                         |
| `validationBehavior` | `'aria' \| 'native'`                                                | `'aria'`     | Whether to use native HTML form validation or ARIA                                                         |
| `validate`           | `(value: string[]) => ValidationError \| true \| null \| undefined` | --           | A function that returns an error message if a given value is invalid                                       |
| `form`               | `string`                                                            | --           | The `<form>` element to associate the input with                                                           |
| `labelPosition`      | `'top' \| 'side'`                                                   | `'top'`      | The label's overall position relative to the element it is labeling                                        |
| `labelAlign`         | `'start' \| 'end'`                                                  | `'start'`    | The label's horizontal alignment relative to the element it is labeling                                    |
| `necessityIndicator` | `'icon' \| 'label'`                                                 | `'icon'`     | Whether the required state should be shown as an icon or text                                              |
| `contextualHelp`     | `ReactNode`                                                         | --           | A ContextualHelp element to place next to the label                                                        |
| `showErrorIcon`      | `boolean`                                                           | --           | Whether an error icon is rendered                                                                          |

### Events

| Name            | Type                              | Description                                                    |
| --------------- | --------------------------------- | -------------------------------------------------------------- |
| `onChange`      | `(value: T) => void`              | Handler that is called when the value changes                  |
| `onFocus`       | `(e: FocusEvent<Target>) => void` | Handler that is called when the element receives focus         |
| `onBlur`        | `(e: FocusEvent<Target>) => void` | Handler that is called when the element loses focus            |
| `onFocusChange` | `(isFocused: boolean) => void`    | Handler that is called when the element's focus status changes |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Accessibility Props

| Name                | Type     | Description                                                             |
| ------------------- | -------- | ----------------------------------------------------------------------- |
| `id`                | `string` | The element's unique identifier                                         |
| `aria-label`        | `string` | Defines a string value that labels the current element                  |
| `aria-labelledby`   | `string` | Identifies the element(s) that labels the current element               |
| `aria-describedby`  | `string` | Identifies the element(s) that describes the object                     |
| `aria-details`      | `string` | Identifies the element(s) that provide a detailed, extended description |
| `aria-errormessage` | `string` | Identifies the element that provides an error message                   |

### Advanced Props

| Name               | Type            | Description                                                     |
| ------------------ | --------------- | --------------------------------------------------------------- |
| `UNSAFE_className` | `string`        | Sets the CSS className for the element; use only as last resort |
| `UNSAFE_style`     | `CSSProperties` | Sets inline style for the element; use only as last resort      |

## Checkbox Props (Child Component)

| Name                 | Type                                                               | Default  | Description                                                       |
| -------------------- | ------------------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| `children`           | `ReactNode`                                                        | --       | The label for the element                                         |
| `value`              | `string`                                                           | --       | The value of the input element, used when submitting an HTML form |
| `defaultSelected`    | `boolean`                                                          | --       | Whether the element should be selected (uncontrolled)             |
| `isSelected`         | `boolean`                                                          | --       | Whether the element should be selected (controlled)               |
| `isDisabled`         | `boolean`                                                          | --       | Whether the input is disabled                                     |
| `isReadOnly`         | `boolean`                                                          | --       | Whether the input can be selected but not changed by the user     |
| `isRequired`         | `boolean`                                                          | --       | Whether user input is required before form submission             |
| `isInvalid`          | `boolean`                                                          | --       | Whether the input value is invalid                                |
| `validationBehavior` | `'aria' \| 'native'`                                               | `'aria'` | Whether to use native HTML form validation or ARIA                |
| `validate`           | `(value: boolean) => ValidationError \| true \| null \| undefined` | --       | A function that returns an error message if invalid               |
| `autoFocus`          | `boolean`                                                          | --       | Whether the element should receive focus on render                |
| `isIndeterminate`    | `boolean`                                                          | --       | Indeterminism is presentational only                              |

### Checkbox Events

| Name            | Type                              | Description                                                       |
| --------------- | --------------------------------- | ----------------------------------------------------------------- |
| `onChange`      | `(isSelected: boolean) => void`   | Handler that is called when the element's selection state changes |
| `onFocus`       | `(e: FocusEvent<Target>) => void` | Handler that is called when the element receives focus            |
| `onBlur`        | `(e: FocusEvent<Target>) => void` | Handler that is called when the element loses focus               |
| `onFocusChange` | `(isFocused: boolean) => void`    | Handler that is called when the element's focus status changes    |
| `onKeyDown`     | `(e: KeyboardEvent) => void`      | Handler that is called when a key is pressed                      |
| `onKeyUp`       | `(e: KeyboardEvent) => void`      | Handler that is called when a key is released                     |

## Accessibility

- If a visible label is not specified, provide an `aria-label` attribute
- For external labels, use `aria-labelledby` with the labeling element's id
- Checkbox elements within a group should always have a visible label
- For RTL languages (Hebrew, Arabic), the checkbox automatically repositions to the right
- When `necessityIndicator` is set to `"label"`, localized "(required)" or "(optional)" text is provided automatically
