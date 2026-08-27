<!-- Source: https://react-spectrum.adobe.com/react-spectrum/DatePicker.html -->
<!-- Last fetched: 2026-04-05 -->

# DatePicker

DatePickers combine a DateField and a Calendar popover to allow users to enter or select a date and time value.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { DatePicker } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<DatePicker label="Event date" />
```

## Value Management

### Supported Date Types

- **CalendarDate**: Date only, no time components (e.g., birthdays)
- **CalendarDateTime**: Date with time, no timezone
- **ZonedDateTime**: Date with time in specific timezone

### Uncontrolled

```jsx
import { parseDate } from "@internationalized/date";

<DatePicker
  label="Date (uncontrolled)"
  defaultValue={parseDate("2020-02-03")}
/>;
```

### Controlled

```jsx
function Example() {
  let [value, setValue] = React.useState(parseDate("2020-02-03"));
  return (
    <DatePicker label="Date (controlled)" value={value} onChange={setValue} />
  );
}
```

### Time Zone Support

```jsx
import { parseZonedDateTime } from "@internationalized/date";

<DatePicker
  label="Event date"
  defaultValue={parseZonedDateTime("2022-11-07T00:45[America/Los_Angeles]")}
/>;
```

### Granularity

```jsx
function Example() {
  let [date, setDate] = React.useState(
    parseAbsoluteToLocal("2021-04-07T18:45:22Z"),
  );
  return (
    <>
      <DatePicker
        label="Date and time"
        granularity="second"
        value={date}
        onChange={setDate}
      />
      <DatePicker
        label="Date only"
        granularity="day"
        value={date}
        onChange={setDate}
      />
    </>
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
      <DatePicker label="Date" value={date} onChange={setDate} />
    </Provider>
  );
}
```

### HTML Forms Integration

```jsx
<DatePicker label="Birth date" name="birthday" />
```

Values submit as ISO 8601 strings matching granularity.

## Labeling

```jsx
<Flex gap="size-150" wrap>
  <DatePicker label="Birth date" />
  <DatePicker label="Birth date" isRequired necessityIndicator="icon" />
  <DatePicker label="Birth date" isRequired necessityIndicator="label" />
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
      <DatePicker label="Birth date" value={date} onChange={setDate} />
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
  <DatePicker label="Appointment date" name="date" isRequired />
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

<DatePicker
  label="Appointment date"
  minValue={today(getLocalTimeZone())}
  defaultValue={parseDate("2022-02-03")}
/>;
```

### Unavailable Dates

```jsx
function Example() {
  let now = today(getLocalTimeZone());
  let disabledRanges = [
    [now, now.add({ days: 5 })],
    [now.add({ days: 14 }), now.add({ days: 16 })],
    [now.add({ days: 23 }), now.add({ days: 24 })],
  ];
  let { locale } = useLocale();

  return (
    <DatePicker
      label="Appointment date"
      minValue={today(getLocalTimeZone())}
      isDateUnavailable={(date) =>
        isWeekend(date, locale) ||
        disabledRanges.some(
          (interval) =>
            date.compare(interval[0]) >= 0 && date.compare(interval[1]) <= 0,
        )
      }
      validationBehavior="native"
    />
  );
}
```

### Custom Validation

```jsx
function Example() {
  let { locale } = useLocale();
  return (
    <Form validationBehavior="native" maxWidth="size-3000">
      <DatePicker
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
<DatePicker label="Birth date" isQuiet />
```

### Disabled / Read-Only

```jsx
<DatePicker label="Birth date" isDisabled />
<DatePicker label="Birth date" value={today(getLocalTimeZone())} isReadOnly />
```

### Label Position

```jsx
<DatePicker label="Birth date" labelPosition="side" labelAlign="end" />
```

### Help Text

```jsx
<Flex gap="size-100" wrap>
  <DatePicker
    label="Date"
    defaultValue={today(getLocalTimeZone())}
    validationState="valid"
    description="Select a meeting date."
  />
  <DatePicker
    label="Date"
    validationState="invalid"
    errorMessage="Empty input is not allowed."
  />
</Flex>
```

### Contextual Help

```jsx
import { Content, ContextualHelp, Heading } from "@adobe/react-spectrum";

<DatePicker
  label="Appointment date"
  contextualHelp={
    <ContextualHelp variant="info">
      <Heading>Appointment changes</Heading>
      <Content>Your appointment date cannot be changed once scheduled.</Content>
    </ContextualHelp>
  }
/>;
```

### Multiple Visible Months

```jsx
<DatePicker label="Appointment date" maxVisibleMonths={3} />
```

### Hour Cycle

```jsx
<DatePicker label="Appointment time" granularity="minute" hourCycle={24} />
```

### Custom Week Start

```jsx
<DatePicker label="Appointment date" firstDayOfWeek="mon" />
```

## Props API

### Core Props

| Name           | Type                | Default | Description                  |
| -------------- | ------------------- | ------- | ---------------------------- |
| `value`        | `DateValue \| null` | --      | Current value (controlled)   |
| `defaultValue` | `DateValue \| null` | --      | Initial value (uncontrolled) |
| `label`        | `ReactNode`         | --      | Field label text             |
| `name`         | `string`            | --      | HTML form field name         |
| `form`         | `string`            | --      | Associated form element ID   |
| `isRequired`   | `boolean`           | --      | Whether input is required    |
| `isDisabled`   | `boolean`           | --      | Disable interaction          |
| `isReadOnly`   | `boolean`           | --      | Prevent value changes        |
| `autoFocus`    | `boolean`           | --      | Focus on render              |

### Date/Time Props

| Name                      | Type                                      | Default | Description                        |
| ------------------------- | ----------------------------------------- | ------- | ---------------------------------- |
| `granularity`             | `'day' \| 'hour' \| 'minute' \| 'second'` | --      | Smallest displayed unit            |
| `minValue`                | `DateValue \| null`                       | --      | Minimum selectable date            |
| `maxValue`                | `DateValue \| null`                       | --      | Maximum selectable date            |
| `isDateUnavailable`       | `(date: DateValue) => boolean`            | --      | Mark specific dates as unavailable |
| `placeholderValue`        | `DateValue \| null`                       | --      | Influences placeholder format      |
| `hourCycle`               | `12 \| 24`                                | --      | Time display format                |
| `hideTimeZone`            | `boolean`                                 | `false` | Hide timezone abbreviation         |
| `shouldForceLeadingZeros` | `boolean`                                 | --      | Always show leading zeros          |

### Calendar Props

| Name               | Type                                                          | Default     | Description                    |
| ------------------ | ------------------------------------------------------------- | ----------- | ------------------------------ |
| `maxVisibleMonths` | `number`                                                      | `1`         | Max months shown in popover    |
| `firstDayOfWeek`   | `'sun' \| 'mon' \| 'tue' \| 'wed' \| 'thu' \| 'fri' \| 'sat'` | --          | Week starting day              |
| `pageBehavior`     | `'visible' \| 'single'`                                       | `'visible'` | Pagination behavior            |
| `shouldFlip`       | `boolean`                                                     | `true`      | Auto-flip when space limited   |
| `createCalendar`   | `(id: CalendarIdentifier) => Calendar`                        | --          | Custom calendar implementation |

### Overlay Props

| Name           | Type                        | Default | Description                     |
| -------------- | --------------------------- | ------- | ------------------------------- |
| `isOpen`       | `boolean`                   | --      | Overlay open state (controlled) |
| `defaultOpen`  | `boolean`                   | --      | Initial overlay state           |
| `onOpenChange` | `(isOpen: boolean) => void` | --      | Open state change handler       |

### Validation Props

| Name                 | Type                                            | Default  | Description                |
| -------------------- | ----------------------------------------------- | -------- | -------------------------- |
| `validationBehavior` | `'aria' \| 'native'`                            | `'aria'` | Validation approach        |
| `validate`           | `(value: DateValue) => ValidationError \| null` | --       | Custom validation function |
| `validationState`    | `'valid' \| 'invalid'`                          | --       | Validation display state   |
| `isInvalid`          | `boolean`                                       | --       | Mark as invalid            |
| `errorMessage`       | `ReactNode \| (result) => ReactNode`            | --       | Error display text         |

### Label Props

| Name                 | Type                | Default   | Description              |
| -------------------- | ------------------- | --------- | ------------------------ |
| `labelPosition`      | `'top' \| 'side'`   | `'top'`   | Label placement          |
| `labelAlign`         | `'start' \| 'end'`  | `'start'` | Label alignment          |
| `necessityIndicator` | `'icon' \| 'label'` | `'icon'`  | Required indicator style |
| `description`        | `ReactNode`         | --        | Help text description    |
| `contextualHelp`     | `ReactNode`         | --        | Contextual help popover  |
| `isQuiet`            | `boolean`           | `false`   | Quiet styling variant    |
| `showFormatHelpText` | `boolean`           | `false`   | Show date format helper  |

### Events

| Name            | Type                                 | Description                     |
| --------------- | ------------------------------------ | ------------------------------- |
| `onChange`      | `(value: DateValue \| null) => void` | Fired when value changes        |
| `onOpenChange`  | `(isOpen: boolean) => void`          | Fired when popover opens/closes |
| `onFocus`       | `(e: FocusEvent) => void`            | Focus event handler             |
| `onBlur`        | `(e: FocusEvent) => void`            | Blur event handler              |
| `onFocusChange` | `(isFocused: boolean) => void`       | Focus status change             |
| `onKeyDown`     | `(e: KeyboardEvent) => void`         | Key down event handler          |
| `onKeyUp`       | `(e: KeyboardEvent) => void`         | Key up event handler            |

### Accessibility Props

| Name               | Type     | Description               |
| ------------------ | -------- | ------------------------- |
| `id`               | `string` | Element unique identifier |
| `aria-label`       | `string` | Accessible label          |
| `aria-labelledby`  | `string` | Label element ID          |
| `aria-describedby` | `string` | Description element ID    |
| `aria-details`     | `string` | Details element ID        |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description    |
| ------------------ | --------------- | -------------- |
| `UNSAFE_className` | `string`        | CSS class name |
| `UNSAFE_style`     | `CSSProperties` | Inline styles  |

## Accessibility

- Provide a visible `label` or use `aria-label` for screen readers
- Use `aria-labelledby` if labeled by a separate element
- Full keyboard navigation support
- Screen reader friendly with ARIA labels
- Respects system dark/light mode preferences
