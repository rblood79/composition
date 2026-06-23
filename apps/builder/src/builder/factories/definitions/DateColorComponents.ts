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
 * field-trigger canonical 자식 통일 (NumberField/SearchField 동형 — 그룹 A↔B 통일):
 *   DatePicker (parent, flex column)
 *     ├─ Label
 *     ├─ SelectTrigger   (trigger, flex row, bg+border — box)
 *     │    ├─ DateInput   (segment text, _parentTag="DatePicker")
 *     │    └─ SelectIcon  (calendar glyph)
 *     └─ Calendar        (CalendarHeader + CalendarGrid)
 *
 * 기존엔 DateInput 이 picker 직속이고 calendar icon 을 datefield_segments 가 box 안에 그려
 *   icon 좌표가 box폭에 결합됐다(발산). Select/ComboBox/NumberField/SearchField 처럼
 *   SelectTrigger 래퍼 + DateInput + SelectIcon 별도 자식으로 두면 트리/Skia/CSS 가 자동
 *   일관되고 icon 이 flex 자식이라 box폭 무관. RAC DatePicker DOM(D1) 도
 *   `<Group><DateInput/><Button>📅</Button></Group>` 구조라 canonical 반영이 D1 정합.
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
        // calendar 아이콘 SSOT (D2) — Select 동형. Skia SelectIcon 은 조부모(DatePicker) iconName
        //   위임(resolveIconDelegation), Preview self-compose 는 element.props.iconName 소비.
        //   사용자가 Inspector 에서 이 값을 바꾸면 Skia/Preview 양쪽 대칭 반영.
        iconName: "calendar",
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
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        // field-trigger box 래퍼 (NumberField/SearchField 동형) — DateInput + calendar icon 을
        //   flex row 로 묶는다. SelectTrigger 는 Skia/CSS/layout 에서 box+border flex-row 로
        //   이미 처리되는 그룹 B 공통 type → 새 메커니즘 0.
        type: "SelectTrigger",
        props: {
          style: {
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          },
        } as ComponentElementProps,
        children: [
          {
            type: "DateInput",
            props: {
              _parentTag: "DatePicker",
              style: { flex: 1, minWidth: 0 },
            } as ComponentElementProps,
          },
          {
            // iconName 미지정 — 조부모 DatePicker.props.iconName 위임(resolveIconDelegation).
            //   iconName SSOT 는 부모 DatePicker(D2) 단일 source → Skia/Preview 대칭.
            type: "SelectIcon",
            props: {} as ComponentElementProps,
          },
        ],
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
 *   DateRangePicker (parent, flex column)
 *     ├─ Label
 *     ├─ SelectTrigger   (trigger, flex row, bg+border — box)
 *     │    ├─ DateInput   (segment text, _parentTag="DateRangePicker")
 *     │    └─ SelectIcon  (calendar glyph)
 *     └─ Calendar      (CalendarHeader + CalendarGrid)
 *
 * field-trigger canonical 자식 통일 (DatePicker 동형). 상세는 createDatePickerDefinition 주석.
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
        // calendar 아이콘 SSOT (D2) — DatePicker 동형. 상세는 createDatePickerDefinition.
        iconName: "calendar",
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
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "SelectTrigger",
        props: {
          style: {
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          },
        } as ComponentElementProps,
        children: [
          {
            type: "DateInput",
            props: {
              _parentTag: "DateRangePicker",
              style: { flex: 1, minWidth: 0 },
            } as ComponentElementProps,
          },
          {
            // iconName 미지정 — 조부모 DateRangePicker.props.iconName 위임. SSOT 는 부모(D2).
            type: "SelectIcon",
            props: {} as ComponentElementProps,
          },
        ],
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
 * Element 구조 (factory children):
 *   DateField (parent)
 *     ├─ Label    (type="Label", children="Date")
 *     └─ DateInput (type="DateInput")  — segment 합성은 RAC `<DateInput>{(segment)=><DateSegment/>}` 가 render-time 담당 (D1, store element 아님)
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
 * Element 구조 (factory children):
 *   TimeField (parent)
 *     ├─ Label    (type="Label", children="Time")
 *     └─ DateInput (type="DateInput")  — segment 합성은 RAC `<DateInput>{(segment)=><DateSegment/>}` 가 render-time 담당 (D1, store element 아님)
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
