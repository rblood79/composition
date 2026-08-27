<!-- Source: https://react-spectrum.adobe.com/react-spectrum/RangeCalendar.html -->
<!-- Last fetched: 2026-04-05 -->

# RangeCalendar

RangeCalendars display a grid of days in one or more months and allow users to select a contiguous range of dates.

```jsx
import { RangeCalendar } from "@adobe/react-spectrum";

<RangeCalendar aria-label="Trip dates" />;
```

## Value

### Uncontrolled & Controlled

```jsx
import { parseDate } from "@internationalized/date";

function Example() {
  let [value, setValue] = React.useState({
    start: parseDate("2020-02-03"),
    end: parseDate("2020-02-12"),
  });

  return (
    <Flex gap="size-300" wrap>
      <RangeCalendar
        aria-label="Date range (uncontrolled)"
        defaultValue={{
          start: parseDate("2020-02-03"),
          end: parseDate("2020-02-12"),
        }}
      />
      <RangeCalendar
        aria-label="Date range (controlled)"
        value={value}
        onChange={setValue}
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
      <RangeCalendar
        aria-label="Date range"
        value={range}
        onChange={setRange}
      />
      <p>Start date: {range?.start.toString()}</p>
      <p>End date: {range?.end.toString()}</p>
    </Provider>
  );
}
```

## Events

### onChange

```jsx
import { getLocalTimeZone, parseDate } from "@internationalized/date";
import { useDateFormatter } from "@adobe/react-spectrum";

function Example() {
  let [range, setRange] = React.useState({
    start: parseDate("2020-07-03"),
    end: parseDate("2020-07-10"),
  });
  let formatter = useDateFormatter({ dateStyle: "long" });

  return (
    <>
      <RangeCalendar
        aria-label="Date range"
        value={range}
        onChange={setRange}
      />
      <p>
        Selected date:{" "}
        {formatter.formatRange(
          range.start.toDate(getLocalTimeZone()),
          range.end.toDate(getLocalTimeZone()),
        )}
      </p>
    </>
  );
}
```

## Validation

### Min & Max Values

```jsx
import { today, getLocalTimeZone } from "@internationalized/date";

<RangeCalendar aria-label="Trip dates" minValue={today(getLocalTimeZone())} />;
```

### Unavailable Dates

```jsx
import { today, getLocalTimeZone } from "@internationalized/date";

function Example() {
  let now = today(getLocalTimeZone());
  let disabledRanges = [
    [now, now.add({ days: 5 })],
    [now.add({ days: 14 }), now.add({ days: 16 })],
    [now.add({ days: 23 }), now.add({ days: 24 })],
  ];

  let isDateUnavailable = (date) =>
    disabledRanges.some(
      (interval) =>
        date.compare(interval[0]) >= 0 && date.compare(interval[1]) <= 0,
    );

  return (
    <RangeCalendar
      aria-label="Trip dates"
      minValue={today(getLocalTimeZone())}
      isDateUnavailable={isDateUnavailable}
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
    <RangeCalendar
      aria-label="Time off request"
      isDateUnavailable={(date) => isWeekend(date, locale)}
      allowsNonContiguousRanges
    />
  );
}
```

## Controlling Focused Date

```jsx
import { CalendarDate } from "@internationalized/date";

function Example() {
  let defaultDate = new CalendarDate(2021, 7, 1);
  let [focusedDate, setFocusedDate] = React.useState(defaultDate);

  return (
    <Flex direction="column" alignItems="start" gap="size-200">
      <ActionButton onPress={() => setFocusedDate(defaultDate)}>
        Reset focused date
      </ActionButton>
      <RangeCalendar
        focusedValue={focusedDate}
        onFocusChange={setFocusedDate}
      />
    </Flex>
  );
}
```

## Multiple Visible Months

```jsx
<div style={{ maxWidth: "100%", overflow: "auto" }}>
  <RangeCalendar aria-label="Trip dates" visibleMonths={3} />
</div>
```

## Disabled

```jsx
<RangeCalendar aria-label="Trip dates" isDisabled />
```

## Read Only

```jsx
<RangeCalendar
  aria-label="Trip dates"
  value={{
    start: today(getLocalTimeZone()),
    end: today(getLocalTimeZone()).add({ weeks: 1 }),
  }}
  isReadOnly
/>
```

## Props

| Name                        | Type                                                          | Default     | Description                           |
| --------------------------- | ------------------------------------------------------------- | ----------- | ------------------------------------- |
| `value`                     | `RangeValue<DateValue> \| null`                               | --          | Controlled value.                     |
| `defaultValue`              | `RangeValue<DateValue> \| null`                               | --          | Uncontrolled default value.           |
| `visibleMonths`             | `number`                                                      | `1`         | Number of months displayed (max 3).   |
| `createCalendar`            | `(identifier: CalendarIdentifier) => Calendar`                | --          | Function to create Calendar object.   |
| `allowsNonContiguousRanges` | `boolean`                                                     | --          | Allows ranges with unavailable dates. |
| `minValue`                  | `DateValue \| null`                                           | --          | Minimum selectable date.              |
| `maxValue`                  | `DateValue \| null`                                           | --          | Maximum selectable date.              |
| `isDateUnavailable`         | `(date: DateValue) => boolean`                                | --          | Callback marking unavailable dates.   |
| `isDisabled`                | `boolean`                                                     | `false`     | Disables calendar.                    |
| `isReadOnly`                | `boolean`                                                     | `false`     | Makes value immutable.                |
| `autoFocus`                 | `boolean`                                                     | `false`     | Auto-focuses on mount.                |
| `focusedValue`              | `DateValue \| null`                                           | --          | Controls focused date.                |
| `defaultFocusedValue`       | `DateValue \| null`                                           | --          | Initial focused date (uncontrolled).  |
| `isInvalid`                 | `boolean`                                                     | --          | Marks selection as invalid.           |
| `errorMessage`              | `ReactNode`                                                   | --          | Error message display.                |
| `pageBehavior`              | `'single' \| 'visible'`                                       | `'visible'` | Pagination advancement method.        |
| `firstDayOfWeek`            | `'sun' \| 'mon' \| 'tue' \| 'wed' \| 'thu' \| 'fri' \| 'sat'` | --          | Week starting day.                    |
| `selectionAlignment`        | `'start' \| 'center' \| 'end'`                                | `'center'`  | Visible month alignment.              |

### Events

| Name            | Type                                           | Description                          |
| --------------- | ---------------------------------------------- | ------------------------------------ |
| `onChange`      | `(value: RangeValue<MappedDateValue>) => void` | Triggered on value changes.          |
| `onFocusChange` | `(date: CalendarDate) => void`                 | Triggered when focused date changes. |

### Accessibility Props

| Name               | Type     | Description                         |
| ------------------ | -------- | ----------------------------------- |
| `id`               | `string` | Element's unique identifier.        |
| `aria-label`       | `string` | Defines label for element.          |
| `aria-labelledby`  | `string` | ID of labeling element.             |
| `aria-describedby` | `string` | IDs describing element.             |
| `aria-details`     | `string` | IDs providing detailed description. |

### Layout/Spacing/Sizing/Positioning Props (all Responsive)

Layout: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`

Spacing: `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`

Sizing: `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`

Positioning: `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

Advanced: `UNSAFE_className`, `UNSAFE_style`

## Accessibility

An `aria-label` must be provided to the RangeCalendar for accessibility. If it is labeled by a separate element, an `aria-labelledby` prop must be provided using the id of the labeling element instead.

## Internationalization

Dates automatically display in the user's locale. The calendar system can be overridden using Unicode locale extensions. For RTL languages (Hebrew, Arabic), layout automatically flips.
