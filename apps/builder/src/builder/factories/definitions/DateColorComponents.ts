import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";

/** Calendar 현재 월 초기 데이터 (DatePicker/DateRangePicker/Calendar 공유) */
function buildCalendarInitData() {
  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth();
  return {
    now,
    firstDay: new Date(calYear, calMonth, 1).getDay(),
    calTotalDays: new Date(calYear, calMonth + 1, 0).getDate(),
    monthText: new Intl.DateTimeFormat(
      (typeof navigator !== "undefined" && navigator.language) || "ko-KR",
      { year: "numeric", month: "long" },
    ).format(now),
  };
}

/**
 * DatePicker 복합 컴포넌트 정의 (Compositional Architecture)
 *
 * ComboBox 패턴: DatePicker는 투명 컨테이너, 자식이 개별 렌더링
 *   DatePicker (parent, flex column, gap:8px, width:284px)
 *     ├─ DateField       (trigger, width:100%)
 *     └─ Calendar        (flex column, padding:12px, width:100%)
 *         ├─ CalendarHeader  (nav: ← 월/년 →)
 *         └─ CalendarGrid    (요일 + 날짜 셀)
 */
export function createDatePickerDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  const { now, firstDay, calTotalDays, monthText } = buildCalendarInitData();

  return {
    type: "DatePicker",
    parent: {
      type: "DatePicker",
      props: {
        label: "Date Picker",
        variant: "default",
        size: "md",
        labelPosition: "top",
        maxVisibleMonths: 1,
        defaultToday: true,
        hideTimeZone: true,
        shouldForceLeadingZeros: true,
        isDisabled: false,
        isReadOnly: false,
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Date Picker",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "DateInput",
        props: {
          _parentTag: "DatePicker",
        } as ComponentElementProps,
      },
      {
        type: "Calendar",
        props: {
          defaultToday: true,
          isDisabled: false,
          isReadOnly: false,
        } as ComponentElementProps,
        children: [
          {
            type: "CalendarHeader",
            props: {
              children: monthText,
            } as ComponentElementProps,
          },
          {
            type: "CalendarGrid",
            props: {
              defaultToday: true,
              dayOffset: firstDay,
              totalDays: calTotalDays,
              todayDate: now.getDate(),
            } as ComponentElementProps,
          },
        ],
      },
    ],
  };
}

/**
 * DateRangePicker 복합 컴포넌트 정의 (DatePicker 와 동일한 DOM 구조 패턴)
 *
 *   DateRangePicker (parent, flex column, gap:8px, width:284px)
 *     ├─ Label         (type="Label")
 *     ├─ DateInput     (type="DateInput", _parentTag="DateRangePicker")
 *     └─ Calendar      (type="Calendar")
 *         ├─ CalendarHeader
 *         └─ CalendarGrid
 */
export function createDateRangePickerDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  const { now, firstDay, calTotalDays, monthText } = buildCalendarInitData();

  return {
    type: "DateRangePicker",
    parent: {
      type: "DateRangePicker",
      props: {
        label: "Date Range",
        variant: "default",
        size: "md",
        labelPosition: "top",
        maxVisibleMonths: 1,
        defaultToday: true,
        hideTimeZone: true,
        shouldForceLeadingZeros: true,
        isDisabled: false,
        isReadOnly: false,
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Date Range",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "DateInput",
        props: {
          _parentTag: "DateRangePicker",
        } as ComponentElementProps,
      },
      {
        type: "Calendar",
        props: {
          defaultToday: true,
          isDisabled: false,
          isReadOnly: false,
        } as ComponentElementProps,
        children: [
          {
            type: "CalendarHeader",
            props: {
              children: monthText,
            } as ComponentElementProps,
          },
          {
            type: "CalendarGrid",
            props: {
              defaultToday: true,
              dayOffset: firstDay,
              totalDays: calTotalDays,
              todayDate: now.getDate(),
            } as ComponentElementProps,
          },
        ],
      },
    ],
  };
}

/**
 * Calendar 복합 컴포넌트 정의
 *
 * CSS DOM 구조와 동일:
 *   Calendar (parent)
 *     ├─ CalendarHeader (type="CalendarHeader", children="February 2026")
 *     └─ CalendarGrid  (type="CalendarGrid",  display:grid)
 *
 * CalendarHeader / CalendarGrid 는 TAG_SPEC_MAP에 등록된 Spec 컴포넌트
 * (Compositional Architecture — 각 자식이 자체 spec shapes를 렌더링)
 */
export function createCalendarDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  // Calendar intrinsic width: cellSize*7 + gap*6 + paddingX*2 (md: 32*7+6*6+12*2 = 284)
  const { now, firstDay, calTotalDays, monthText } = buildCalendarInitData();

  return {
    type: "Calendar",
    parent: {
      type: "Calendar",
      props: {
        variant: "default",
        size: "md",
        maxVisibleMonths: 1,
        defaultToday: true,
        isDisabled: false,
        isReadOnly: false,
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "CalendarHeader",
        props: {
          children: monthText,
        } as ComponentElementProps,
      },
      {
        type: "CalendarGrid",
        props: {
          defaultToday: true,
          dayOffset: firstDay,
          totalDays: calTotalDays,
          todayDate: now.getDate(),
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * DateField 복합 컴포넌트 정의
 *
 * CSS DOM 구조:
 *   DateField (parent)
 *     ├─ Label      (type="Label", children="Date")
 *     ├─ DateSegment (type="DateSegment", segment="month")
 *     ├─ DateSegment (type="DateSegment", segment="day")
 *     └─ DateSegment (type="DateSegment", segment="year")
 */
export function createDateFieldDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "DateField",
    parent: {
      type: "DateField",
      props: {
        label: "Date Field",
        size: "md",
        labelPosition: "top",
        hideTimeZone: true,
        shouldForceLeadingZeros: true,
        isDisabled: false,
        isReadOnly: false,
        isInvalid: false,
        style: {
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Date Field",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "DateInput",
        props: {
          style: { width: "100%" },
        } as ComponentElementProps,
      },
      {
        type: "FieldError",
        props: {
          children: "",
          style: { fontSize: 12, display: "none" },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * TimeField 복합 컴포넌트 정의
 *
 * CSS DOM 구조:
 *   TimeField (parent)
 *     ├─ Label       (type="Label", children="Time")
 *     ├─ TimeSegment (type="TimeSegment", segment="hour")
 *     ├─ TimeSegment (type="TimeSegment", segment="minute")
 *     └─ TimeSegment (type="TimeSegment", segment="second")
 */
export function createTimeFieldDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "TimeField",
    parent: {
      type: "TimeField",
      props: {
        label: "Time",
        size: "md",
        labelPosition: "top",
        granularity: "minute",
        hideTimeZone: true,
        shouldForceLeadingZeros: true,
        isDisabled: false,
        isReadOnly: false,
        isInvalid: false,
        style: {
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Time",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "DateInput",
        props: {
          style: { width: "100%" },
        } as ComponentElementProps,
      },
      {
        type: "FieldError",
        props: {
          children: "",
          style: { fontSize: 12, display: "none" },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * ColorField 복합 컴포넌트 정의
 *
 * CSS DOM 구조:
 *   ColorField (parent)
 *     ├─ Label      (type="Label", children="Color")
 *     ├─ Input      (type="Input", placeholder="#000000")
 *     └─ ColorSwatch (type="ColorSwatch", preview swatch)
 */
export function createColorFieldDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "ColorField",
    parent: {
      type: "ColorField",
      props: {
        labelPosition: "top",
        isDisabled: false,
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Color",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "Input",
        props: {
          type: "text",
          placeholder: "#000000",
          style: {
            display: "block",
            width: "80px",
          },
        } as ComponentElementProps,
      },
      {
        type: "ColorSwatch",
        props: {
          color: "#000000",
          style: {
            width: "24px",
            height: "24px",
            borderRadius: "4px",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * ColorPicker 복합 컴포넌트 정의
 *
 * CSS DOM 구조와 동일:
 *   ColorPicker (parent)
 *     ├─ ColorArea   (type="ColorArea",   width:200px, height:200px)
 *     ├─ ColorSlider (type="ColorSlider", channel:"hue", display:block)
 *     └─ ColorField  (type="ColorField",  placeholder:"#000000", display:block)
 */
export function createColorPickerDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "ColorPicker",
    parent: {
      type: "ColorPicker",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "ColorArea",
        props: {
          style: {
            width: "200px",
            height: "200px",
          },
        } as ComponentElementProps,
      },
      {
        type: "ColorSlider",
        props: {
          channel: "hue",
          style: {
            display: "block",
            width: "100%",
          },
        } as ComponentElementProps,
      },
      {
        type: "ColorField",
        props: {
          placeholder: "#000000",
          style: {
            display: "block",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * ColorSwatchPicker 컴포넌트 정의
 *
 * CSS DOM 구조 대응:
 *   ColorSwatchPicker (parent, type="ColorSwatchPicker", flex wrap)
 *     ├─ ColorSwatch (#FF0000)
 *     ├─ ColorSwatch (#00FF00)
 *     ├─ ColorSwatch (#0000FF)
 *     ├─ ColorSwatch (#FFFF00)
 *     ├─ ColorSwatch (#FF00FF)
 *     └─ ColorSwatch (#00FFFF)
 */
export function createColorSwatchPickerDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  const defaultColors = [
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
  ];

  return {
    type: "ColorSwatchPicker",
    parent: {
      type: "ColorSwatchPicker",
      props: {
        columns: 6,
        style: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: defaultColors.map((color, index) => ({
      type: "ColorSwatch",
      props: {
        color,
        style: {
          width: 28,
          height: 28,
        },
      } as ComponentElementProps,
    })),
  };
}
