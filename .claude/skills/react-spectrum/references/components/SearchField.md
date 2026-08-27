<!-- Source: https://react-spectrum.adobe.com/react-spectrum/SearchField.html -->
<!-- Last fetched: 2026-04-05 -->

# SearchField

SearchField is a specialized text input designed for search operations.

```jsx
import { SearchField } from "@adobe/react-spectrum";

function Example() {
  let [submittedText, setSubmittedText] = React.useState(null);

  return (
    <>
      <SearchField label="Search" onSubmit={setSubmittedText} />
      <p>Submitted text: {submittedText}</p>
    </>
  );
}
```

## Value

### Uncontrolled & Controlled

```jsx
function Example() {
  let [searchValue, setSearchValue] = React.useState("puppies");
  return (
    <Flex gap="size-300">
      <SearchField defaultValue="puppies" label="Search (uncontrolled)" />

      <SearchField
        value={searchValue}
        onChange={setSearchValue}
        label="Search (controlled)"
      />
    </Flex>
  );
}
```

### HTML Forms

```jsx
<SearchField label="Email" name="email" type="email" />
```

## Labeling

```jsx
<Flex gap="size-300" wrap>
  <SearchField label="Search" />
  <SearchField label="Search" isRequired necessityIndicator="icon" />
  <SearchField label="Search" isRequired necessityIndicator="label" />
  <SearchField label="Search" necessityIndicator="label" />
</Flex>
```

## Events

```jsx
function Example() {
  let [currentText, setCurrentText] = React.useState("");
  let [submittedText, setSubmittedText] = React.useState("");

  return (
    <div>
      <SearchField
        onClear={() => setCurrentText("")}
        onChange={setCurrentText}
        onSubmit={setSubmittedText}
        label="Your text"
        value={currentText}
      />
      <pre>Mirrored text: {currentText}</pre>
      <pre>Submitted text: {submittedText}</pre>
    </div>
  );
}
```

## Validation

```jsx
import { Form, ButtonGroup, Button } from "@adobe/react-spectrum";

<Form validationBehavior="native" maxWidth="size-3000">
  <SearchField label="Search" name="search" isRequired />
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

## Quiet Variant

```jsx
<SearchField label="Search" isQuiet />
```

## Disabled

```jsx
<SearchField label="Search" isDisabled />
```

## Read Only

```jsx
<SearchField label="Search" defaultValue="abc@adobe.com" isReadOnly />
```

## Label Position & Alignment

```jsx
<SearchField label="Search" labelPosition="side" labelAlign="end" />
```

## Help Text

```jsx
<Flex gap="size-100" wrap>
  <SearchField
    label="Search"
    defaultValue="Burritos"
    validationState="valid"
    description="Enter a query."
  />
  <SearchField
    label="Search"
    validationState="invalid"
    errorMessage="Empty input is not allowed."
  />
</Flex>
```

## Contextual Help

```jsx
import { Content, ContextualHelp, Heading } from "@adobe/react-spectrum";

<SearchField
  label="Search"
  contextualHelp={
    <ContextualHelp variant="info">
      <Heading>Search tips</Heading>
      <Content>
        You can use modifiers like "date:" and "from:" to search by specific
        attributes.
      </Content>
    </ContextualHelp>
  }
/>;
```

## Custom Icon

```jsx
<SearchField label="Search for users" icon={<User />} />
```

## Custom Width

```jsx
<SearchField label="Search" width="size-3600" />
```

## Props

| Name                  | Type                                                                                  | Default    | Description                          |
| --------------------- | ------------------------------------------------------------------------------------- | ---------- | ------------------------------------ |
| `type`                | `'text' \| 'search' \| 'url' \| 'tel' \| 'email' \| 'password'`                       | `'search'` | HTML input type.                     |
| `enterKeyHint`        | `'enter' \| 'done' \| 'go' \| 'next' \| 'previous' \| 'search' \| 'send'`             | --         | Virtual keyboard enter key action.   |
| `value`               | `string`                                                                              | --         | Controlled value.                    |
| `defaultValue`        | `string`                                                                              | --         | Uncontrolled initial value.          |
| `isDisabled`          | `boolean`                                                                             | --         | Disables the input.                  |
| `isReadOnly`          | `boolean`                                                                             | --         | Makes input immutable but focusable. |
| `isRequired`          | `boolean`                                                                             | --         | Marks field as required.             |
| `autoFocus`           | `boolean`                                                                             | --         | Autofocus on render.                 |
| `label`               | `ReactNode`                                                                           | --         | Visual label text.                   |
| `labelPosition`       | `'top' \| 'side'`                                                                     | `'top'`    | Label placement relative to input.   |
| `labelAlign`          | `'start' \| 'end'`                                                                    | `'start'`  | Label horizontal alignment.          |
| `necessityIndicator`  | `'icon' \| 'label'`                                                                   | `'icon'`   | Required indicator display.          |
| `validationState`     | `'valid' \| 'invalid'`                                                                | --         | Visual validation state.             |
| `validationBehavior`  | `'aria' \| 'native'`                                                                  | `'aria'`   | Validation behavior mode.            |
| `validate`            | `(value: string) => ValidationError \| true \| null \| undefined`                     | --         | Custom validation function.          |
| `isInvalid`           | `boolean`                                                                             | --         | Realtime invalid state.              |
| `description`         | `ReactNode`                                                                           | --         | Helper text below field.             |
| `errorMessage`        | `ReactNode \| (v: ValidationResult) => ReactNode`                                     | --         | Error message display.               |
| `name`                | `string`                                                                              | --         | Form submission name.                |
| `form`                | `string`                                                                              | --         | Associated form id.                  |
| `autoComplete`        | `string`                                                                              | --         | Autocomplete hint.                   |
| `maxLength`           | `number`                                                                              | --         | Maximum character count.             |
| `minLength`           | `number`                                                                              | --         | Minimum character count.             |
| `pattern`             | `string`                                                                              | --         | Validation regex pattern.            |
| `inputMode`           | `'none' \| 'text' \| 'tel' \| 'url' \| 'email' \| 'numeric' \| 'decimal' \| 'search'` | --         | Mobile keyboard type hint.           |
| `autoCorrect`         | `string`                                                                              | --         | Autocorrect behavior.                |
| `spellCheck`          | `string`                                                                              | --         | Spellcheck enable/disable.           |
| `icon`                | `ReactElement \| null`                                                                | --         | Custom search icon.                  |
| `isQuiet`             | `boolean`                                                                             | --         | Quiet/minimal styling variant.       |
| `contextualHelp`      | `ReactNode`                                                                           | --         | Help popover next to label.          |
| `excludeFromTabOrder` | `boolean`                                                                             | --         | Exclude from tab navigation.         |

### Events

| Name                  | Type                           | Description                          |
| --------------------- | ------------------------------ | ------------------------------------ |
| `onChange`            | `(value: string) => void`      | Fired when user edits the value.     |
| `onSubmit`            | `(value: string) => void`      | Fired when user submits (Enter key). |
| `onClear`             | `() => void`                   | Fired when clear button is pressed.  |
| `onFocus`             | `(e: FocusEvent) => void`      | Fired when field gains focus.        |
| `onBlur`              | `(e: FocusEvent) => void`      | Fired when field loses focus.        |
| `onFocusChange`       | `(isFocused: boolean) => void` | Fired on focus status change.        |
| `onKeyDown`           | `(e: KeyboardEvent) => void`   | Fired on key press.                  |
| `onKeyUp`             | `(e: KeyboardEvent) => void`   | Fired on key release.                |
| `onCopy`              | `ClipboardEventHandler`        | Fired on text copy.                  |
| `onCut`               | `ClipboardEventHandler`        | Fired on text cut.                   |
| `onPaste`             | `ClipboardEventHandler`        | Fired on text paste.                 |
| `onCompositionStart`  | `CompositionEventHandler`      | Text composition starts.             |
| `onCompositionEnd`    | `CompositionEventHandler`      | Text composition ends.               |
| `onCompositionUpdate` | `CompositionEventHandler`      | New character in composition.        |
| `onSelect`            | `ReactEventHandler`            | Fired when text selected.            |
| `onBeforeInput`       | `FormEventHandler`             | Fired before input modification.     |
| `onInput`             | `FormEventHandler`             | Fired on input value change.         |

### Accessibility Props

| Name                    | Type                                         | Description                 |
| ----------------------- | -------------------------------------------- | --------------------------- |
| `id`                    | `string`                                     | Element unique identifier.  |
| `aria-activedescendant` | `string`                                     | Active descendant id.       |
| `aria-autocomplete`     | `'none' \| 'inline' \| 'list' \| 'both'`     | Autocomplete behavior hint. |
| `aria-haspopup`         | `boolean \| 'menu' \| 'listbox' \| 'dialog'` | Popup element type.         |
| `aria-controls`         | `string`                                     | Controlled element id.      |
| `aria-label`            | `string`                                     | Accessible label.           |
| `aria-labelledby`       | `string`                                     | Label element id.           |
| `aria-describedby`      | `string`                                     | Description element id.     |
| `aria-details`          | `string`                                     | Details element id.         |
| `aria-errormessage`     | `string`                                     | Error message element id.   |

### Layout/Spacing/Sizing/Positioning Props (all Responsive)

Layout: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`

Spacing: `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`

Sizing: `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`

Positioning: `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

Advanced: `UNSAFE_className`, `UNSAFE_style`

## Accessibility

A visible `label` prop should always be provided. If no visible label exists, provide `aria-label`. For external labels, use `aria-labelledby` with the label's `id`.

## Internationalization

Pass localized strings to `label` or `aria-label` props. When `necessityIndicator="label"`, required/optional text is auto-localized. For LTR languages, "start" = left, "end" = right. For RTL, this reverses.
