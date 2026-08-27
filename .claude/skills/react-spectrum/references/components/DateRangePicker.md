<!-- Source: https://react-spectrum.adobe.com/react-spectrum/DateRangePicker.html -->
<!-- Last fetched: 2026-04-05 -->

# DateRangePicker

DateRangePickers combine two DateFields and a RangeCalendar popover to allow users to enter or select a range of dates and times.

Added in version 3.19.0.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { DateRangePicker } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<DateRangePicker label="Date range" />
```

## Value Management

### Supported Date Types

- **CalendarDate**: Date without time components
- **CalendarDateTime**: Date with time, no timezone
- **ZonedDateTime**: Date with time in a specific timezone

### Controlled vs Uncontrolled

```jsx
import { parseDate } from "@internationalized/date";

function Example() {
  let [value, setValue] = React.useState({
    start: parseDate("2020-02-03"),
    end: parseDate("2020-02-08"),
  });

  return (
    <Flex gap="size-150" wrap>
      <DateRangePicker
        label="Date range (uncontrolled)"
        defaultValue={{
          start: parseDate("2020-02-03"),
          end: parseDate("2020-02-08"),
        }}
      />
      <DateRangePicker
        label="Date range (controlled)"
        value={value}
        onChange={setValue}
      />
    </Flex>
  );
}
```

### Time Zone Support

```jsx
import { parseZonedDateTime } from "@internationalized/date";

<DateRangePicker
  label="Date range"
  defaultValue={{
    start: parseZonedDateTime("2022-11-07T00:45[America/Los_Angeles]"),
    end: parseZonedDateTime("2022-11-08T11:15[America/Los_Angeles]"),
  }}
/>;
```

### Granularity

```jsx
function Example() {
  let [date, setDate] = React.useState({
    start: parseAbsoluteToLocal("2021-04-07T18:45:22Z"),
    end: parseAbsoluteToLocal("2021-04-08T20:00:00Z"),
  });

  return (
    <Flex gap="size-150" wrap>
      <DateRangePicker
        label="Date and time range"
        granularity="second"
        value={date}
        onChange={setDate}
      />
      <DateRangePicker
        label="Date range"
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
  let [range, setRange] = React.useState(null);
  return (
    <Provider locale="hi-IN-u-ca-indian">
      <DateRangePicker label="Date range" value={range} onChange={setRange} />
    </Provider>
  );
}
```

### HTML Form Integration

```jsx
<DateRangePicker label="Trip dates" startName="startDate" endName="endDate" />
```

## Labeling

```jsx
<Flex gap="size-150" wrap>
  <DateRangePicker label="Date range" />
  <DateRangePicker label="Date range" isRequired necessityIndicator="icon" />
  <DateRangePicker label="Date range" isRequired necessityIndicator="label" />
  <DateRangePicker label="Date range" necessityIndicator="label" />
</Flex>
```

When no visible label exists, provide `aria-label` or `aria-labelledby`.

## Events

```jsx
import { getLocalTimeZone } from "@internationalized/date";
import { useDateFormatter } from "@adobe/react-spectrum";

function Example() {
  let [range, setRange] = React.useState({
    start: parseDate("2020-07-03"),
    end: parseDate("2020-07-10"),
  });
  let formatter = useDateFormatter({ dateStyle: "long" });

  return (
    <>
      <DateRangePicker label="Date range" value={range} onChange={setRange} />
      <p>
        Selected date:{" "}
        {range
          ? formatter.formatRange(
              range.start.toDate(getLocalTimeZone()),
              range.end.toDate(getLocalTimeZone()),
            )
          : "--"}
      </p>
    </>
  );
}
```

## Validation

### Required & Min/Max

```jsx
import { today } from "@internationalized/date";
import { Button, ButtonGroup, Form } from "@adobe/react-spectrum";

<Form validationBehavior="native" maxWidth="size-3000">
  <DateRangePicker
    label="Trip dates"
    minValue={today(getLocalTimeZone())}
    defaultValue={{
      start: parseDate("2022-02-03"),
      end: parseDate("2022-05-03"),
    }}
  />
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

### Custom Validation

```jsx
<DateRangePicker
  label="Trip dates"
  validate={(range) =>
    range?.end.compare(range.start) > 7
      ? "Maximum stay duration is 1 week."
      : null
  }
  defaultValue={{
    start: today(getLocalTimeZone()),
    end: today(getLocalTimeZone()).add({ weeks: 1, days: 3 }),
  }}
/>
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

  return (
    <DateRangePicker
      label="Trip dates"
      minValue={today(getLocalTimeZone())}
      isDateUnavailable={(date) =>
        disabledRanges.some(
          (interval) =>
            date.compare(interval[0]) >= 0 && date.compare(interval[1]) <= 0,
        )
      }
      validate={(value) =>
        disabledRanges.some(
          (interval) =>
            value &&
            value.end.compare(interval[0]) >= 0 &&
            value.start.compare(interval[1]) <= 0,
        )
          ? "Selected date range may not include unavailable dates."
          : null
      }
      validationBehavior="native"
    />
  );
}
```

### Non-Contiguous Ranges

```jsx
import { isWeekend } from "@internationalized/date";
import { useLocale } from "@adobe/react-spectrum";

function Example() {
  let { locale } = useLocale();
  return (
    <DateRangePicker
      label="Time off request"
      isDateUnavailable={(date) => isWeekend(date, locale)}
      allowsNonContiguousRanges
    />
  );
}
```

## Visual Options

### Quiet Style

```jsx
<DateRangePicker label="Date range" isQuiet />
```

### Disabled / Read-Only

```jsx
<DateRangePicker label="Date range" isDisabled />
<DateRangePicker
  label="Date range"
  value={{
    start: today(getLocalTimeZone()),
    end: today(getLocalTimeZone()).add({ weeks: 1 })
  }}
  isReadOnly
/>
```

### Label Position

```jsx
<DateRangePicker label="Date range" labelPosition="side" labelAlign="end" />
```

### Help Text

```jsx
<Flex gap="size-100" wrap>
  <DateRangePicker
    label="Date range"
    defaultValue={{
      start: today(getLocalTimeZone()),
      end: today(getLocalTimeZone()).add({ weeks: 1 }),
    }}
    validationState="valid"
    description="Select your trip dates."
  />
  <DateRangePicker
    label="Date range"
    validationState="invalid"
    errorMessage="Empty input is not allowed."
  />
</Flex>
```

### Contextual Help

```jsx
import { Content, ContextualHelp, Heading } from "@adobe/react-spectrum";

<DateRangePicker
  label="Trip dates"
  contextualHelp={
    <ContextualHelp variant="info">
      <Heading>Date changes</Heading>
      <Content>Your trip dates cannot be changed once scheduled.</Content>
    </ContextualHelp>
  }
/>;
```

### Multiple Visible Months

```jsx
<DateRangePicker label="Date range" maxVisibleMonths={3} />
```

### Hour Cycle

```jsx
<DateRangePicker label="Date range" granularity="minute" hourCycle={24} />
```

### Custom Week Start

```jsx
<DateRangePicker label="Date range" firstDayOfWeek="mon" />
```

## Props API

### Core Props

| Name                 | Type                                                                | Default  | Description                      |
| -------------------- | ------------------------------------------------------------------- | -------- | -------------------------------- |
| `value`              | `RangeValue<DateValue> \| null`                                     | --       | The current value (controlled)   |
| `defaultValue`       | `RangeValue<DateValue> \| null`                                     | --       | The default value (uncontrolled) |
| `label`              | `ReactNode`                                                         | --       | The field label                  |
| `description`        | `ReactNode`                                                         | --       | Hint text below the field        |
| `errorMessage`       | `ReactNode \| (v: ValidationResult) => ReactNode`                   | --       | Error message when invalid       |
| `isRequired`         | `boolean`                                                           | --       | Whether input is required        |
| `isDisabled`         | `boolean`                                                           | --       | Whether input is disabled        |
| `isReadOnly`         | `boolean`                                                           | --       | Whether value is immutable       |
| `autoFocus`          | `boolean`                                                           | --       | Whether to focus on render       |
| `validationBehavior` | `'aria' \| 'native'`                                                | `'aria'` | Form validation approach         |
| `validationState`    | `'valid' \| 'invalid'`                                              | --       | Manual validation state          |
| `validate`           | `(value: RangeValue<DateValue>) => ValidationError \| true \| null` | --       | Custom validation function       |

### Date Props

| Name                      | Type                                                          | Default | Description                              |
| ------------------------- | ------------------------------------------------------------- | ------- | ---------------------------------------- |
| `minValue`                | `DateValue \| null`                                           | --      | Minimum selectable date                  |
| `maxValue`                | `DateValue \| null`                                           | --      | Maximum selectable date                  |
| `isDateUnavailable`       | `(date: DateValue) => boolean`                                | --      | Callback to mark dates as unavailable    |
| `placeholderValue`        | `DateValue \| null`                                           | --      | Default date for new interactions        |
| `granularity`             | `'day' \| 'hour' \| 'minute' \| 'second'`                     | --      | Smallest displayed time unit             |
| `hideTimeZone`            | `boolean`                                                     | `false` | Whether to hide timezone abbreviation    |
| `shouldForceLeadingZeros` | `boolean`                                                     | --      | Always show leading zeros in date fields |
| `hourCycle`               | `12 \| 24`                                                    | --      | 12 or 24-hour time format                |
| `firstDayOfWeek`          | `'sun' \| 'mon' \| 'tue' \| 'wed' \| 'thu' \| 'fri' \| 'sat'` | --      | Week start day                           |

### Calendar Props

| Name                        | Type                                   | Default     | Description                          |
| --------------------------- | -------------------------------------- | ----------- | ------------------------------------ |
| `maxVisibleMonths`          | `number`                               | `1`         | Max months displayed in popover      |
| `pageBehavior`              | `'visible' \| 'single'`                | `'visible'` | Month pagination behavior            |
| `shouldFlip`                | `boolean`                              | `true`      | Auto-flip popover when space limited |
| `createCalendar`            | `(id: CalendarIdentifier) => Calendar` | --          | Custom calendar system factory       |
| `allowsNonContiguousRanges` | `boolean`                              | --          | Allow ranges with unavailable dates  |

### Form Props

| Name        | Type     | Default | Description                    |
| ----------- | -------- | ------- | ------------------------------ |
| `startName` | `string` | --      | HTML form name for start date  |
| `endName`   | `string` | --      | HTML form name for end date    |
| `form`      | `string` | --      | Associated `<form>` element id |

### Label Props

| Name                 | Type                | Default   | Description                       |
| -------------------- | ------------------- | --------- | --------------------------------- |
| `labelPosition`      | `'top' \| 'side'`   | `'top'`   | Label placement relative to input |
| `labelAlign`         | `'start' \| 'end'`  | `'start'` | Label horizontal alignment        |
| `necessityIndicator` | `'icon' \| 'label'` | `'icon'`  | Required indicator display        |
| `contextualHelp`     | `ReactNode`         | --        | Contextual help popover element   |

### Overlay Props

| Name           | Type                        | Default | Description                   |
| -------------- | --------------------------- | ------- | ----------------------------- |
| `isOpen`       | `boolean`                   | --      | Controlled popover state      |
| `defaultOpen`  | `boolean`                   | --      | Uncontrolled popover state    |
| `onOpenChange` | `(isOpen: boolean) => void` | --      | Popover state change callback |

### Visual Props

| Name                 | Type      | Default | Description                  |
| -------------------- | --------- | ------- | ---------------------------- |
| `isQuiet`            | `boolean` | `false` | Quiet style variant          |
| `showFormatHelpText` | `boolean` | `false` | Display expected date format |

### Events

| Name            | Type                                     | Description                          |
| --------------- | ---------------------------------------- | ------------------------------------ |
| `onChange`      | `(value: RangeValue<DateValue>) => void` | Fired when start or end date changes |
| `onOpenChange`  | `(isOpen: boolean) => void`              | Fired when popover opens/closes      |
| `onFocus`       | `(e: FocusEvent) => void`                | Element receives focus               |
| `onBlur`        | `(e: FocusEvent) => void`                | Element loses focus                  |
| `onFocusChange` | `(isFocused: boolean) => void`           | Focus status changes                 |
| `onKeyDown`     | `(e: KeyboardEvent) => void`             | Key is pressed                       |
| `onKeyUp`       | `(e: KeyboardEvent) => void`             | Key is released                      |

### Accessibility Props

| Name               | Type     | Description                |
| ------------------ | -------- | -------------------------- |
| `id`               | `string` | Unique element identifier  |
| `aria-label`       | `string` | ARIA label text            |
| `aria-labelledby`  | `string` | ID of labeling element     |
| `aria-describedby` | `string` | ID of describing element   |
| `aria-details`     | `string` | ID of detailed description |

### Layout Props (summary)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow` -- all `Responsive<>` typed.

### Spacing Props (summary)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (summary)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (summary)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description                  |
| ------------------ | --------------- | ---------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort)  |

## Accessibility

- Provide a visible `label` or use `aria-label` for screen readers
- Use `aria-labelledby` if labeled by a separate element
- Localize all label and error message text
- When `necessityIndicator="label"`, localized "(required)" or "(optional)" text displays automatically
- Full keyboard navigation support
