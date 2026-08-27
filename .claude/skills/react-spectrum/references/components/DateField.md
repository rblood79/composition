<!-- Source: https://react-spectrum.adobe.com/react-spectrum/DateField.html -->
<!-- Last fetched: 2026-04-05 -->

# DateField

DateFields allow users to enter and edit date and time values using a keyboard. Each part of the date is displayed as an individually editable segment.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { DateField } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<DateField label="Event date" />
```

## Value Management

### Supported Date Types

- **CalendarDate**: Date without time components (e.g., birthdays)
- **CalendarDateTime**: Date with time, no timezone
- **ZonedDateTime**: Date with time in a specific timezone

### Controlled vs Uncontrolled

```jsx
import { parseDate } from "@internationalized/date";

function Example() {
  let [value, setValue] = React.useState(parseDate("2020-02-03"));
  return (
    <Flex gap="size-150" wrap>
      <DateField
        label="Date (uncontrolled)"
        defaultValue={parseDate("2020-02-03")}
      />
      <DateField label="Date (controlled)" value={value} onChange={setValue} />
    </Flex>
  );
}
```

### Time Zone Support

```jsx
import { parseZonedDateTime } from "@internationalized/date";

<DateField
  label="Event date"
  defaultValue={parseZonedDateTime("2022-11-07T00:45[America/Los_Angeles]")}
/>;
```

### Granularity

Controls the smallest displayed unit (day, hour, minute, or second):

```jsx
function Example() {
  let [date, setDate] = React.useState(
    parseAbsoluteToLocal("2021-04-07T18:45:22Z"),
  );
  return (
    <Flex gap="size-150" wrap>
      <DateField
        label="Date and time"
        granularity="second"
        value={date}
        onChange={setDate}
      />
      <DateField
        label="Date"
        granularity="day"
        value={date}
        onChange={setDate}
      />
    </Flex>
  );
}
```

### International Calendars

```jsx
import { Provider } from "@adobe/react-spectrum";

function Example() {
  let [date, setDate] = React.useState(null);
  return (
    <Provider locale="hi-IN-u-ca-indian">
      <DateField label="Date" value={date} onChange={setDate} />
    </Provider>
  );
}
```

### HTML Form Integration

```jsx
<DateField label="Birth date" name="birthday" />
```

Values submit as ISO 8601 formatted strings per the component's granularity.

## Labeling

```jsx
<Flex gap="size-150" wrap>
  <DateField label="Birth date" />
  <DateField label="Birth date" isRequired necessityIndicator="icon" />
  <DateField label="Birth date" isRequired necessityIndicator="label" />
  <DateField label="Birth date" necessityIndicator="label" />
</Flex>
```

## Events

```jsx
import { getLocalTimeZone } from "@internationalized/date";
import { useDateFormatter } from "@adobe/react-spectrum";

function Example() {
  let [date, setDate] = React.useState(parseDate("1985-07-03"));
  let formatter = useDateFormatter({ dateStyle: "full" });

  return (
    <>
      <DateField label="Birth date" value={date} onChange={setDate} />
      <p>
        Selected date:{" "}
        {date ? formatter.format(date.toDate(getLocalTimeZone())) : "--"}
      </p>
    </>
  );
}
```

## Validation

### Required Field

```jsx
import { Form, ButtonGroup, Button } from "@adobe/react-spectrum";

<Form validationBehavior="native" maxWidth="size-3000">
  <DateField label="Appointment date" name="date" isRequired />
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

### Min/Max Values

```jsx
import { today } from "@internationalized/date";

<DateField
  label="Appointment date"
  minValue={today(getLocalTimeZone())}
  defaultValue={parseDate("2022-02-03")}
/>;
```

### Custom Validation

```jsx
import { isWeekend } from "@internationalized/date";
import { useLocale } from "@adobe/react-spectrum";

function Example() {
  let { locale } = useLocale();
  return (
    <Form validationBehavior="native" maxWidth="size-3000">
      <DateField
        label="Appointment date"
        validate={(date) =>
          date && isWeekend(date, locale) ? "We are closed on weekends." : null
        }
        defaultValue={parseDate("2023-10-28")}
      />
    </Form>
  );
}
```

## Visual Options

### Quiet Style

```jsx
<DateField label="Birth date" isQuiet />
```

### Disabled / Read-Only

```jsx
<DateField label="Birth date" isDisabled />
<DateField label="Birth date" value={today(getLocalTimeZone())} isReadOnly />
```

### Label Positioning

```jsx
<DateField label="Birth date" labelPosition="side" labelAlign="end" />
```

### Help Text

```jsx
<Flex gap="size-100" wrap>
  <DateField
    label="Date"
    defaultValue={today(getLocalTimeZone())}
    validationState="valid"
    description="Select a meeting date."
  />
  <DateField
    label="Date"
    validationState="invalid"
    errorMessage="Empty input is not allowed."
  />
</Flex>
```

### Format Help Text

```jsx
<DateField label="Birth date" showFormatHelpText />
```

### Contextual Help

```jsx
import { Content, ContextualHelp, Heading } from "@adobe/react-spectrum";

<DateField
  label="Appointment date"
  contextualHelp={
    <ContextualHelp variant="info">
      <Heading>Appointment changes</Heading>
      <Content>Your appointment date cannot be changed once scheduled.</Content>
    </ContextualHelp>
  }
/>;
```

### Placeholder Value

```jsx
import { CalendarDate } from "@internationalized/date";

<DateField
  label="Birth date"
  placeholderValue={new CalendarDate(1980, 1, 1)}
/>;
```

### Hour Cycle

```jsx
<DateField label="Appointment time" granularity="minute" hourCycle={24} />
```

## Props API

### Core Props

| Name                      | Type                                      | Default | Description                                                  |
| ------------------------- | ----------------------------------------- | ------- | ------------------------------------------------------------ |
| `value`                   | `DateValue \| null`                       | --      | The current controlled value                                 |
| `defaultValue`            | `DateValue \| null`                       | --      | The initial uncontrolled value                               |
| `minValue`                | `DateValue \| null`                       | --      | The minimum allowed date                                     |
| `maxValue`                | `DateValue \| null`                       | --      | The maximum allowed date                                     |
| `isDateUnavailable`       | `(date: DateValue) => boolean`            | --      | Callback to mark specific dates as unavailable               |
| `placeholderValue`        | `DateValue \| null`                       | --      | Influences placeholder format; defaults to today at midnight |
| `granularity`             | `'day' \| 'hour' \| 'minute' \| 'second'` | --      | Smallest displayed unit                                      |
| `hourCycle`               | `12 \| 24`                                | --      | 12 or 24 hour format (defaults to locale)                    |
| `hideTimeZone`            | `boolean`                                 | `false` | Hide timezone abbreviation                                   |
| `shouldForceLeadingZeros` | `boolean`                                 | --      | Always show leading zeros (locale-dependent default)         |

### Form and Labeling

| Name                 | Type                                              | Default   | Description                          |
| -------------------- | ------------------------------------------------- | --------- | ------------------------------------ |
| `label`              | `ReactNode`                                       | --        | Visible field label                  |
| `isRequired`         | `boolean`                                         | --        | Mark field as required               |
| `necessityIndicator` | `'icon' \| 'label'`                               | `'icon'`  | Show requirement as icon or text     |
| `description`        | `ReactNode`                                       | --        | Helper text below field              |
| `errorMessage`       | `ReactNode \| (v: ValidationResult) => ReactNode` | --        | Error message when invalid           |
| `name`               | `string`                                          | --        | HTML form field name                 |
| `form`               | `string`                                          | --        | Associate with `<form>` by id        |
| `isQuiet`            | `boolean`                                         | `false`   | Display with quiet styling           |
| `showFormatHelpText` | `boolean`                                         | `false`   | Show locale date format hint         |
| `labelPosition`      | `'top' \| 'side'`                                 | `'top'`   | Label placement relative to field    |
| `labelAlign`         | `'start' \| 'end'`                                | `'start'` | Label horizontal alignment           |
| `contextualHelp`     | `ReactNode`                                       | --        | ContextualHelp element next to label |

### State and Interaction

| Name                 | Type                                                                       | Default  | Description                        |
| -------------------- | -------------------------------------------------------------------------- | -------- | ---------------------------------- |
| `isDisabled`         | `boolean`                                                                  | --       | Disable the field                  |
| `isReadOnly`         | `boolean`                                                                  | --       | Prevent edits but keep focusable   |
| `autoFocus`          | `boolean`                                                                  | --       | Receive focus on render            |
| `validationBehavior` | `'aria' \| 'native'`                                                       | `'aria'` | Use native HTML or ARIA validation |
| `validate`           | `(value: MappedDateValue) => ValidationError \| true \| null \| undefined` | --       | Custom validation function         |
| `validationState`    | `'valid' \| 'invalid'`                                                     | --       | Visual validation state            |

### Events

| Name            | Type                                       | Description                     |
| --------------- | ------------------------------------------ | ------------------------------- |
| `onChange`      | `(value: MappedDateValue \| null) => void` | Fires when date value changes   |
| `onFocus`       | `(e: FocusEvent) => void`                  | Fires when field receives focus |
| `onBlur`        | `(e: FocusEvent) => void`                  | Fires when field loses focus    |
| `onFocusChange` | `(isFocused: boolean) => void`             | Fires when focus status changes |
| `onKeyDown`     | `(e: KeyboardEvent) => void`               | Fires when key is pressed       |
| `onKeyUp`       | `(e: KeyboardEvent) => void`               | Fires when key is released      |

### Accessibility Props

| Name               | Type     | Description                       |
| ------------------ | -------- | --------------------------------- |
| `id`               | `string` | Element's unique identifier       |
| `aria-label`       | `string` | Label for screen readers          |
| `aria-labelledby`  | `string` | Reference to labeling element     |
| `aria-describedby` | `string` | Reference to describing element   |
| `aria-details`     | `string` | Reference to detailed description |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description                 |
| ------------------ | --------------- | --------------------------- |
| `UNSAFE_className` | `string`        | CSS className (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort) |

## Accessibility

- If no visible label is provided, use `aria-label` for screen reader support
- For labels provided by separate elements, use `aria-labelledby`
- The component automatically handles ARIA attributes for required/optional states and validation messages
