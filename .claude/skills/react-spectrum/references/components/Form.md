<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Form.html -->
<!-- Last fetched: 2026-04-05 -->

# Form

Forms allow users to enter data that can be submitted while providing alignment and styling for form fields.

## Import

```javascript
import { Form } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<Form maxWidth="size-3600">
  <TextField label="Email" />
  <TextField label="Password" />
  <Checkbox>Remember me</Checkbox>
</Form>
```

## Required Fields

```jsx
<Form maxWidth="size-3600" isRequired necessityIndicator="label">
  <TextField label="Name" />
  <TextField label="Email" />
  <TextField label="Address" isRequired={false} />
</Form>
```

## Accessible Form with Labels

```jsx
<h3 id="label-3">Personal Information</h3>
<Form maxWidth="size-3600" aria-labelledby="label-3">
  <TextField label="First Name" />
  <TextField label="Last Name" />
  <RadioGroup label="Favorite pet">
    <Radio value="dogs">Dogs</Radio>
    <Radio value="cats">Cats</Radio>
    <Radio value="dragons">Dragons</Radio>
  </RadioGroup>
</Form>
```

## Server-Side Validation

```jsx
<Form
  validationErrors={{ username: "Sorry, this username is taken." }}
  maxWidth="size-3000"
>
  <TextField label="Username" name="username" />
</Form>
```

## Native HTML Form Validation

```jsx
<Form validationBehavior="native" maxWidth="size-3000">
  <TextField label="Email" name="email" type="email" isRequired />
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

## Custom Focus Management on Validation Error

```jsx
function Example() {
  let [isInvalid, setInvalid] = React.useState(false);

  return (
    <Form
      validationBehavior="native"
      onInvalid={(e) => {
        e.preventDefault();
        setInvalid(true);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        setInvalid(false);
      }}
      onReset={() => setInvalid(false)}
      maxWidth="size-3600"
    >
      {isInvalid && (
        <InlineAlert variant="negative" autoFocus>
          <Heading>Unable to submit</Heading>
          <Content>
            Please fix the validation errors below, and re-submit the form.
          </Content>
        </InlineAlert>
      )}
      <TextField label="First Name" isRequired />
      <TextField label="Last Name" isRequired />
      <ButtonGroup>
        <Button type="submit" variant="primary">
          Submit
        </Button>
        <Button type="reset" variant="secondary">
          Reset
        </Button>
      </ButtonGroup>
    </Form>
  );
}
```

## Visual Options

### Label Position and Alignment

```jsx
<Form labelPosition="top" labelAlign="start" maxWidth="size-3600">
  <TextField label="Name" />
</Form>

<Form labelPosition="side" labelAlign="end" maxWidth="size-3600">
  <TextField label="Name" />
</Form>
```

### Quiet / Emphasized / Disabled / Read-Only

```jsx
<Form isQuiet maxWidth="size-3600"><TextField label="Name" /></Form>
<Form isEmphasized maxWidth="size-3600"><TextField label="Name" /></Form>
<Form isDisabled maxWidth="size-3600"><TextField label="Name" /></Form>
<Form isReadOnly maxWidth="size-3600"><TextField label="Name" value="John Smith" /></Form>
```

## Props API

### Core Props

| Name                 | Type                                                                           | Default   | Description                                 |
| -------------------- | ------------------------------------------------------------------------------ | --------- | ------------------------------------------- |
| `children`           | `ReactElement<SpectrumLabelableProps>[]`                                       | --        | Form field elements to render               |
| `isQuiet`            | `boolean`                                                                      | --        | Quiet styling                               |
| `isEmphasized`       | `boolean`                                                                      | --        | Emphasized styling                          |
| `isDisabled`         | `boolean`                                                                      | --        | Disables all form elements                  |
| `isRequired`         | `boolean`                                                                      | --        | Marks all fields as required by default     |
| `isReadOnly`         | `boolean`                                                                      | --        | Makes form fields read-only but selectable  |
| `validationState`    | `'valid' \| 'invalid'`                                                         | `'valid'` | Visual validation state styling             |
| `validationBehavior` | `'aria' \| 'native'`                                                           | `'aria'`  | Validation approach (ARIA or HTML5)         |
| `validationErrors`   | `Record<string, ValidationError>`                                              | --        | Server-side validation errors by field name |
| `action`             | `string \| FormAction`                                                         | --        | Form submission endpoint URL                |
| `encType`            | `'application/x-www-form-urlencoded' \| 'multipart/form-data' \| 'text/plain'` | --        | Form encoding type                          |
| `method`             | `'get' \| 'post' \| 'dialog'`                                                  | --        | HTTP method for submission                  |
| `target`             | `'_blank' \| '_self' \| '_parent' \| '_top'`                                   | --        | Window target for form submission           |
| `autoComplete`       | `'off' \| 'on'`                                                                | --        | Browser autocomplete behavior               |
| `autoCapitalize`     | `'off' \| 'none' \| 'on' \| 'sentences' \| 'words' \| 'characters'`            | --        | Text capitalization behavior                |
| `labelPosition`      | `'top' \| 'side'`                                                              | `'top'`   | Label placement relative to inputs          |
| `labelAlign`         | `'start' \| 'end'`                                                             | `'start'` | Horizontal label alignment                  |
| `necessityIndicator` | `'icon' \| 'label'`                                                            | `'icon'`  | Required field indicator style              |
| `maxWidth`           | `DimensionValue`                                                               | --        | Maximum form width                          |

### Events

| Name        | Type                                          | Description                                |
| ----------- | --------------------------------------------- | ------------------------------------------ |
| `onSubmit`  | `(event: FormEvent<HTMLFormElement>) => void` | Fires when user submits the form           |
| `onReset`   | `(event: FormEvent<HTMLFormElement>) => void` | Fires when user resets the form            |
| `onInvalid` | `(event: FormEvent<HTMLFormElement>) => void` | Fires for each invalid field on submission |

### Accessibility Props

| Name               | Type                         | Description                |
| ------------------ | ---------------------------- | -------------------------- |
| `id`               | `string`                     | Element identifier         |
| `role`             | `'search' \| 'presentation'` | ARIA role override         |
| `aria-label`       | `string`                     | Accessible form name       |
| `aria-labelledby`  | `string`                     | ID of labeling element     |
| `aria-describedby` | `string`                     | ID of describing element   |
| `aria-details`     | `string`                     | ID of detailed description |

### Layout/Spacing/Sizing/Positioning Props (Responsive)

All standard Spectrum layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Advanced Props

| Name               | Type            | Description                         |
| ------------------ | --------------- | ----------------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (use as last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (use as last resort)  |

## Validation

Three approaches:

1. **Server-side**: `validationErrors` prop maps field names to error strings/arrays. Errors display immediately and clear when users modify fields.
2. **Client-side**: `validationBehavior="aria"` (default) for real-time feedback, or `"native"` for HTML5 validation that prevents submission.
3. **Custom**: Handle through `onInvalid` event and manage focus manually.

## Accessibility

A label should be provided to the Form by adding either the `aria-label` or `aria-labelledby` prop, so that the element will be identified to assistive technology as a form landmark region.
