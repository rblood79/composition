import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";

/**
 * Avatar 컴포넌트 정의
 *
 * CSS DOM 구조:
 * Avatar (parent, type="Avatar", circle shape)
 */
export function createAvatarDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Avatar",
    parent: {
      type: "Avatar",
      props: {
        src: "",
        alt: "Avatar",
        initials: "A",
        size: "md",
        isDisabled: false,
        style: {
          width: 32,
          height: 32,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [],
  };
}

/**
 * AvatarGroup 컴포넌트 정의
 *
 * CSS DOM 구조:
 * AvatarGroup (parent, type="AvatarGroup", flex row)
 *   ├─ Avatar (initials="A")
 *   ├─ Avatar (initials="B")
 *   └─ Avatar (initials="C")
 */
export function createAvatarGroupDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "AvatarGroup",
    parent: {
      type: "AvatarGroup",
      props: {
        size: "md",
        label: "Team",
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Avatar",
        props: {
          initials: "A",
          size: "md",
          style: {
            width: 32,
            height: 32,
            marginLeft: -8,
          },
        } as ComponentElementProps,
      },
      {
        type: "Avatar",
        props: {
          initials: "B",
          size: "md",
          style: {
            width: 32,
            height: 32,
            marginLeft: -8,
          },
        } as ComponentElementProps,
      },
      {
        type: "Avatar",
        props: {
          initials: "C",
          size: "md",
          style: {
            width: 32,
            height: 32,
            marginLeft: -8,
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * StatusLight 컴포넌트 정의
 *
 * CSS DOM 구조:
 * StatusLight (parent, type="StatusLight", flex row with dot + label)
 */
export function createStatusLightDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "StatusLight",
    parent: {
      type: "StatusLight",
      props: {
        variant: "positive",
        children: "Available",
        size: "md",
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [],
  };
}

/**
 * InlineAlert 컴포넌트 정의
 *
 * CSS DOM 구조:
 * InlineAlert (parent, type="InlineAlert", flex column)
 *   ├─ Heading (type="Heading", children="Alert Title")
 *   └─ Description (type="Description", children="Alert description text.")
 */
export function createInlineAlertDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "InlineAlert",
    parent: {
      type: "InlineAlert",
      props: {
        variant: "info",
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Heading",
        props: {
          children: "Alert Heading",
          level: 3,
          className: "alert-heading",
        } as ComponentElementProps,
      },
      {
        type: "Description",
        props: {
          children:
            "There was an error processing your request. Please try again.",
          className: "react-aria-Description",
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * ButtonGroup 컴포넌트 정의
 *
 * CSS DOM 구조:
 * ButtonGroup (parent, type="ButtonGroup", flex row)
 *   ├─ Button ("Cancel", outline)
 *   └─ Button ("Save", accent fill)
 */
export function createButtonGroupDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "ButtonGroup",
    parent: {
      type: "ButtonGroup",
      props: {
        size: "md",
        orientation: "horizontal",
        align: "end",
        style: {
          display: "flex",
          flexDirection: "row",
          gap: 8,
          width: "fit-content",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Button",
        props: {
          children: "Cancel",
          variant: "secondary",
          fillStyle: "outline",
          size: "md",
        } as ComponentElementProps,
      },
      {
        type: "Button",
        props: {
          children: "Save",
          variant: "accent",
          fillStyle: "fill",
          size: "md",
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Accordion 컴포넌트 정의 (DisclosureGroup 확장)
 *
 * CSS DOM 구조:
 * Accordion (parent, type="Accordion", flex column)
 *   ├─ Disclosure (type="Disclosure", isExpanded=false)
 *   └─ Disclosure (type="Disclosure", isExpanded=false)
 */
export function createAccordionDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Accordion",
    parent: {
      type: "Accordion",
      props: {
        allowsMultipleExpanded: false,
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Disclosure",
        props: {
          children: "Section 1",
          isExpanded: false,
          style: {
            display: "block",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "DisclosureHeader",
            props: {
              children: "Section 1",
            } as ComponentElementProps,
          },
          {
            type: "DisclosureContent",
            props: {
              children: "Section 1 content goes here.",
            } as ComponentElementProps,
          },
        ],
      },
      {
        type: "Disclosure",
        props: {
          children: "Section 2",
          isExpanded: false,
          style: {
            display: "block",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "DisclosureHeader",
            props: {
              children: "Section 2",
            } as ComponentElementProps,
          },
          {
            type: "DisclosureContent",
            props: {
              children: "Section 2 content goes here.",
            } as ComponentElementProps,
          },
        ],
      },
    ],
  };
}

/**
 * ProgressBar 컴포넌트 정의 (하이브리드 패턴)
 *
 * CSS DOM 구조:
 * ProgressBar (parent, flex column, track+fill은 spec shapes)
 *   └─ Label (child element, optional)
 *
 * track/fill은 spec shapes(paddingBottom 영역)에서 렌더링,
 * Label은 child Element로 분리하여 padding/gap이 Taffy를 통해 자연 적용.
 */
export function createProgressBarDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "ProgressBar",
    parent: {
      type: "ProgressBar",
      props: {
        label: "Progress",
        value: 50,
        showValue: true,
        size: "md",
        // Grid 속성 store 직접 주입 (Skia/Taffy 즉시 반영).
        // store 에는 longhand (rowGap/columnGap) 만 — shorthand `gap` 은 미저장
        // 하여 React inline style 의 shorthand/longhand collision 경고 회피.
        // Panel 의 Gap 필드는 inspectorActions 에서 gap → rowGap + columnGap
        // 동시 쓰기로 처리.
        style: {
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gridTemplateRows: "auto auto",
          gridTemplateAreas: '"label value" "bar bar"',
          rowGap: 4,
          columnGap: 12,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Progress",
          style: {
            backgroundColor: "transparent",
            width: "fit-content",
            height: "fit-content",
            // Skia Taffy grid 경로는 gridArea 이름 해석 미지원 → 숫자 line 명시.
            // CSS 는 spec.composition.staticSelectors 의 grid-area 이름 적용 (대칭 유지).
            gridColumnStart: "1",
            gridColumnEnd: "2",
            gridRowStart: "1",
            gridRowEnd: "2",
            gridArea: "label",
          },
        } as ComponentElementProps,
      },
      {
        type: "ProgressBarValue",
        props: {
          children: "50%",
          style: {
            width: "fit-content",
            gridColumnStart: "2",
            gridColumnEnd: "3",
            gridRowStart: "1",
            gridRowEnd: "2",
            gridArea: "value",
            justifySelf: "end",
          },
        } as ComponentElementProps,
      },
      {
        type: "ProgressBarTrack",
        props: {
          style: {
            width: "100%",
            gridColumnStart: "1",
            gridColumnEnd: "3",
            gridRowStart: "2",
            gridRowEnd: "3",
            gridArea: "bar",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Meter 컴포넌트 정의 (하이브리드 패턴 — ProgressBar와 동일 구조)
 *
 * CSS DOM 구조:
 * Meter (parent, flex row wrap)
 *   ├─ Label (child element, optional)
 *   ├─ MeterValue (child element, value 텍스트)
 *   └─ MeterTrack (child element, track + fill bar)
 */
export function createMeterDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Meter",
    parent: {
      type: "Meter",
      props: {
        label: "Storage",
        value: 75,
        minValue: 0,
        maxValue: 100,
        showValue: true,
        variant: "informative",
        size: "md",
        // Grid 속성 store 직접 주입 (ProgressBar 와 동일 이유).
        style: {
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gridTemplateRows: "auto auto",
          gridTemplateAreas: '"label value" "bar bar"',
          rowGap: 4,
          columnGap: 12,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Storage",
          style: {
            backgroundColor: "transparent",
            width: "fit-content",
            height: "fit-content",
            gridColumnStart: "1",
            gridColumnEnd: "2",
            gridRowStart: "1",
            gridRowEnd: "2",
            gridArea: "label",
          },
        } as ComponentElementProps,
      },
      {
        type: "MeterValue",
        props: {
          children: "75%",
          style: {
            width: "fit-content",
            gridColumnStart: "2",
            gridColumnEnd: "3",
            gridRowStart: "1",
            gridRowEnd: "2",
            gridArea: "value",
            justifySelf: "end",
          },
        } as ComponentElementProps,
      },
      {
        type: "MeterTrack",
        props: {
          style: {
            width: "100%",
            gridColumnStart: "1",
            gridColumnEnd: "3",
            gridRowStart: "2",
            gridRowEnd: "3",
            gridArea: "bar",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * ProgressCircle 컴포넌트 정의
 *
 * CSS DOM 구조:
 * ProgressCircle (parent, type="ProgressCircle", circular progress indicator)
 */
export function createProgressCircleDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "ProgressCircle",
    parent: {
      type: "ProgressCircle",
      props: {
        value: 75,
        size: "md",
        isIndeterminate: false,
        isDisabled: false,
        style: {
          width: 32,
          height: 32,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [],
  };
}

/**
 * Image 컴포넌트 정의
 *
 * CSS DOM 구조:
 * Image (parent, type="Image", responsive image)
 */
export function createImageDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Image",
    parent: {
      type: "Image",
      props: {
        src: "",
        alt: "Image",
        objectFit: "cover",
        style: {
          width: "100%",
          height: 200,
          borderRadius: 8,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [],
  };
}

/**
 * RangeCalendar 컴포넌트 정의 (CalendarSpec 재사용)
 *
 * CSS DOM 구조:
 * RangeCalendar (parent, type="RangeCalendar", flex column)
 *   ├─ CalendarHeader (type="CalendarHeader")
 *   └─ CalendarGrid (type="CalendarGrid")
 */
export function createRangeCalendarDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const calTotalDays = new Date(calYear, calMonth + 1, 0).getDate();

  return {
    type: "RangeCalendar",
    parent: {
      type: "RangeCalendar",
      props: {
        variant: "default",
        size: "md",
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
          children: new Intl.DateTimeFormat(navigator.language || "ko-KR", {
            year: "numeric",
            month: "long",
          }).format(now),
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

// ==================== Phase 4: Advanced Components (ADR-030) ====================

/**
 * IllustratedMessage 컴포넌트 정의
 *
 * CSS DOM 구조:
 * IllustratedMessage (parent, type="IllustratedMessage", flex column centered)
 */
export function createIllustratedMessageDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "IllustratedMessage",
    parent: {
      type: "IllustratedMessage",
      props: {
        size: "md",
        heading: "No results",
        description: "Try another search term.",
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
          width: 320,
          height: 280,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [],
  };
}

/**
 * CardView 컴포넌트 정의
 *
 * CSS DOM 구조:
 * CardView (parent, type="CardView", grid container)
 *   ├─ Card (variant="primary")
 *   ├─ Card (variant="primary")
 *   └─ Card (variant="primary")
 */
export function createCardViewDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "CardView",
    parent: {
      type: "CardView",
      props: {
        layout: "grid",
        size: "md",
        density: "regular",
        columns: 3,
        gap: 16,
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Card",
        props: {
          variant: "primary",
          children: "Card 1",
          style: {
            width: 200,
            height: 160,
            padding: 16,
          },
        } as ComponentElementProps,
      },
      {
        type: "Card",
        props: {
          variant: "primary",
          children: "Card 2",
          style: {
            width: 200,
            height: 160,
            padding: 16,
          },
        } as ComponentElementProps,
      },
      {
        type: "Card",
        props: {
          variant: "primary",
          children: "Card 3",
          style: {
            width: 200,
            height: 160,
            padding: 16,
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * TableView 컴포넌트 정의
 *
 * CSS DOM 구조:
 * TableView (parent, type="TableView", flex column)
 *   └─ Table 자식 구조 재사용
 */
export function createTableViewDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "TableView",
    parent: {
      type: "TableView",
      props: {
        density: "regular",
        isStriped: false,
        isQuiet: false,
        allowsSorting: true,
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "TableHeader",
        props: {
          style: {
            display: "flex",
            flexDirection: "row",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "Column",
            props: {
              children: "Name",
              style: { flex: 1, padding: 8, fontWeight: 600 },
            } as ComponentElementProps,
          },
          {
            type: "Column",
            props: {
              children: "Type",
              style: { flex: 1, padding: 8, fontWeight: 600 },
            } as ComponentElementProps,
          },
          {
            type: "Column",
            props: {
              children: "Status",
              style: { flex: 1, padding: 8, fontWeight: 600 },
            } as ComponentElementProps,
          },
        ],
      },
      {
        type: "TableBody",
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "Row",
            props: {
              style: { display: "flex", flexDirection: "row" },
            } as ComponentElementProps,
            children: [
              {
                type: "Cell",
                props: {
                  children: "Item 1",
                  style: { flex: 1, padding: 8 },
                } as ComponentElementProps,
              },
              {
                type: "Cell",
                props: {
                  children: "File",
                  style: { flex: 1, padding: 8 },
                } as ComponentElementProps,
              },
              {
                type: "Cell",
                props: {
                  children: "Active",
                  style: { flex: 1, padding: 8 },
                } as ComponentElementProps,
              },
            ],
          },
        ],
      },
    ],
  };
}
