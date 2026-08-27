<!-- Source: https://react-spectrum.adobe.com/react-spectrum/TextArea.html -->
<!-- Last fetched: 2026-04-05 -->

# TextArea

TextAreas are multiline text inputs, useful for cases where users have a sizable amount of text to enter.

**Added in:** 3.0.0

```tsx
import { TextArea } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic

```jsx
<TextArea label="Description" />
```

### Uncontrolled

```jsx
<TextArea label="Notes (Uncontrolled)" defaultValue="This is on a wait list" />
```

### Controlled

```jsx
function Example() {
  let [value, setValue] = React.useState("This is on a wait list");
  return (
    <TextArea label="Notes (Controlled)" value={value} onChange={setValue} />
  );
}
```

### HTML Form Integration

```jsx
<TextArea label="Comment" name="comment" />
```

### Validation (Native)

```jsx
<Form validationBehavior="native" maxWidth="size-3000">
  <TextArea label="Comment" name="comment" isRequired minLength={10} />
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

### Visual Options

```jsx
// Quiet style
<TextArea label="Email" isQuiet />

// Disabled
<TextArea label="Email" isDisabled />

// Read-only (focusable, content selectable)
<TextArea label="Email" defaultValue="abc@adobe.com" isReadOnly />

// Label positioning
<TextArea label="Search" labelPosition="side" labelAlign="end" />

// Custom width
<TextArea label="Email" width="size-3600" maxWidth="100%" />
```

### Help Text and Contextual Help

```jsx
<TextArea
  label="Comment"
  defaultValue="Awesome!"
  validationState="valid"
  description="Enter a comment."
/>

<TextArea
  label="Comment"
  validationState="invalid"
  errorMessage="Empty input is not allowed."
/>

<TextArea
  label="Comment"
  contextualHelp={
    <ContextualHelp variant="info">
      <Heading>Comment tips</Heading>
      <Content>Comments will be screened prior to publication.</Content>
    </ContextualHelp>
  }
/>
```

## Props API

| Name                  | Type                                                                                  | Default   | Description                                  |
| --------------------- | ------------------------------------------------------------------------------------- | --------- | -------------------------------------------- |
| `label`               | `ReactNode`                                                                           | --        | Visual label for the field                   |
| `value`               | `string`                                                                              | --        | Controlled value                             |
| `defaultValue`        | `string`                                                                              | --        | Uncontrolled initial value                   |
| `name`                | `string`                                                                              | --        | HTML form attribute                          |
| `isRequired`          | `boolean`                                                                             | --        | Marks field as required                      |
| `isDisabled`          | `boolean`                                                                             | --        | Disables user interaction                    |
| `isReadOnly`          | `boolean`                                                                             | --        | Prevents editing; content remains selectable |
| `isQuiet`             | `boolean`                                                                             | --        | Applies quiet styling                        |
| `isInvalid`           | `boolean`                                                                             | --        | Sets invalid state                           |
| `validationState`     | `'valid' \| 'invalid'`                                                                | --        | Visual validation indicator                  |
| `validationBehavior`  | `'aria' \| 'native'`                                                                  | `'aria'`  | Form validation approach                     |
| `validate`            | `(value: string) => ValidationError \| true \| null \| undefined`                     | --        | Custom validation function                   |
| `description`         | `ReactNode`                                                                           | --        | Helper text below field                      |
| `errorMessage`        | `ReactNode \| function`                                                               | --        | Error message display                        |
| `minLength`           | `number`                                                                              | --        | Minimum character count                      |
| `maxLength`           | `number`                                                                              | --        | Maximum character count                      |
| `inputMode`           | `'none' \| 'text' \| 'tel' \| 'url' \| 'email' \| 'numeric' \| 'decimal' \| 'search'` | --        | Mobile keyboard type hint                    |
| `autoComplete`        | `string`                                                                              | --        | Browser autocomplete behavior                |
| `spellCheck`          | `string`                                                                              | --        | Spell-check enablement                       |
| `autoCorrect`         | `string`                                                                              | --        | Auto-correct behavior                        |
| `enterKeyHint`        | `'enter' \| 'done' \| 'go' \| 'next' \| 'previous' \| 'search' \| 'send'`             | --        | Virtual keyboard enter key label             |
| `autoFocus`           | `boolean`                                                                             | --        | Focuses on render                            |
| `icon`                | `ReactElement \| null`                                                                | --        | Leading icon                                 |
| `labelPosition`       | `'top' \| 'side'`                                                                     | `'top'`   | Label placement                              |
| `labelAlign`          | `'start' \| 'end'`                                                                    | `'start'` | Label horizontal alignment                   |
| `necessityIndicator`  | `'icon' \| 'label'`                                                                   | `'icon'`  | Required indicator style                     |
| `contextualHelp`      | `ReactNode`                                                                           | --        | ContextualHelp element                       |
| `form`                | `string`                                                                              | --        | Associated form id                           |
| `id`                  | `string`                                                                              | --        | Unique identifier                            |
| `excludeFromTabOrder` | `boolean`                                                                             | --        | Removes from tab sequence                    |

### Accessibility Props

| Name                    | Type                                                             | Description                              |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `aria-label`            | `string`                                                         | Accessibility label when no visual label |
| `aria-labelledby`       | `string`                                                         | ID of labeling element                   |
| `aria-describedby`      | `string`                                                         | ID of describing element                 |
| `aria-details`          | `string`                                                         | ID of detailed description               |
| `aria-errormessage`     | `string`                                                         | ID of error message element              |
| `aria-activedescendant` | `string`                                                         | Active element in composite widget       |
| `aria-autocomplete`     | `'none' \| 'inline' \| 'list' \| 'both'`                         | Autocomplete indication                  |
| `aria-haspopup`         | `boolean \| 'menu' \| 'listbox' \| 'tree' \| 'grid' \| 'dialog'` | Popup availability                       |
| `aria-controls`         | `string`                                                         | Controlled element ID(s)                 |

### Layout/Spacing/Sizing/Positioning Props (abbreviated)

Standard Responsive layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, etc. Standard spacing: `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`. Standard sizing: `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`. Standard positioning: `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`.

### Advanced Props

| Name               | Type            | Description                    |
| ------------------ | --------------- | ------------------------------ |
| `UNSAFE_className` | `string`        | Direct CSS class (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort)    |

## Events

| Name                  | Type                           | Description                     |
| --------------------- | ------------------------------ | ------------------------------- |
| `onChange`            | `(value: T) => void`           | Fires on value change           |
| `onFocus`             | `(e: FocusEvent) => void`      | Fires on focus                  |
| `onBlur`              | `(e: FocusEvent) => void`      | Fires on blur                   |
| `onFocusChange`       | `(isFocused: boolean) => void` | Fires on focus state change     |
| `onKeyDown`           | `(e: KeyboardEvent) => void`   | Fires on key press              |
| `onKeyUp`             | `(e: KeyboardEvent) => void`   | Fires on key release            |
| `onCopy`              | `ClipboardEventHandler`        | Fires on copy                   |
| `onCut`               | `ClipboardEventHandler`        | Fires on cut                    |
| `onPaste`             | `ClipboardEventHandler`        | Fires on paste                  |
| `onCompositionStart`  | `CompositionEventHandler`      | Fires when composition starts   |
| `onCompositionEnd`    | `CompositionEventHandler`      | Fires when composition ends     |
| `onCompositionUpdate` | `CompositionEventHandler`      | Fires during composition        |
| `onSelect`            | `ReactEventHandler`            | Fires on text selection         |
| `onBeforeInput`       | `FormEventHandler`             | Fires before input modification |
| `onInput`             | `FormEventHandler`             | Fires on input modification     |

## Accessibility

- Provide `label` or `aria-label` for screen readers
- Use `aria-labelledby` when labeled by separate element
- Localize all text content including labels
