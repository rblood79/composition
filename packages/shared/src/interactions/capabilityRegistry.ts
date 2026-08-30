/**
 * @fileoverview ADR-158 Phase 1 — Capability Registry (어휘 SSOT 단일 파일).
 *
 * 두 축을 한 곳에서 선언한다:
 * - **When** (`events`): 그 컴포넌트가 낼 수 있는 RAC/RSP 실존 callback
 * - **Do** (`capabilities`): 그 컴포넌트가 "당할 수 있는" 고유 기능 =
 *   RAC controlled prop 1개를 patch 하는 선언
 *
 * 구 `EVENT_REGISTRY` (DOM 별칭 10종 혼재) + `IMPLEMENTED_ACTION_TYPES`
 * (camelCase 28 + snake_case 별칭 19) + `metadata.ts` supportedEvents 를 대체·흡수한다.
 *
 * ## G1 게이트
 * 모든 capability 는 `racRef` (RAC controlled prop 근거) 를 가져야 한다 — 근거 없는
 * 항목은 등재 금지. `capabilityRegistry.test.ts` 가 정적으로 집행한다.
 *
 * ## 등재 vs 보류 (Phase 0 실측 기준 — breakdown §0 표 ③)
 * Preview 렌더러의 상태 prop 배선을 3분류로 실측했다:
 * - **(a) controlled** — 상태 prop 직접 소비 → 즉시 반영
 * - **(b) uncontrolled + `key` 에 상태 포함** → prop patch 가 remount 로 반영.
 *   등재하되 `remount: true` 로 내부 상태(포커스/스크롤) 소실을 명시한다.
 * - **(c) `default*` 만 + `key` 고정, 또는 prop 미배선** → patch 무반응.
 *   `deferred` 에 키만 남기고 **등재 보류** (G1). Preview controlled 전환 후 해제.
 *
 * @see docs/adr/completed/158-interactions-rules-capability-registry.md
 * @see docs/adr/design/158-interactions-rules-capability-registry-breakdown.md §0 §3
 */

/** capability 가 값을 요구할 때 패널이 물어볼 입력의 종류 */
export interface CapabilityParam {
  kind: "itemKey" | "value" | "text" | "number";
  /** 입력 레이블의 카탈로그 키 (`labelKey` 와 같은 이유로 문구가 아니다) */
  labelKey: string;
}

export interface CapabilityDef {
  /**
   * 표시 문구의 **카탈로그 키** — 문구 자체가 아니다.
   *
   * shared 는 빌더의 i18n provider 에 닿을 수 없고 (앱 경계), 규칙은 저장돼 뒤에 다시
   * 읽히므로 문구를 여기 굳히면 언어를 바꿔도 예전 언어가 남는다. 키만 싣고 패널이
   * 렌더 시점에 푼다 (ADR-200 후속).
   */
  labelKey: string;
  /**
   * patch 대상 prop 경로. `style.` 접두는 `props.style` 하위를 뜻한다.
   * `imperative: true` 인 특례는 prop 이 아니라 DOM ref 호출이라 빈 문자열.
   */
  prop: string;
  /**
   * 설정값.
   * - 리터럴: 그 값으로 patch
   * - `"!self"`: 현재값 토글
   * - `"!param"`: 규칙의 `action.params.value` 사용 (`param` 선언 필수)
   * - `null`: 해제 (prop 제거)
   */
  value: unknown;
  /** RAC controlled prop 근거 — G1 증빙 (필수) */
  racRef: string;
  /** 값이 필요한 capability 의 입력 사양 (`value: "!param"` 과 쌍) */
  param?: CapabilityParam;
  /**
   * Preview 가 uncontrolled(`default*`) 로 렌더 중이나 `key` 에 해당 상태가 포함돼
   * prop patch 가 remount 로 반영되는 경우. 내부 상태(포커스/스크롤)가 소실된다.
   */
  remount?: boolean;
  /** generic prop patch 로 환원 불가 — DOM ref 경유 특례 */
  imperative?: boolean;
}

export interface ComponentCapability {
  /** When 축 — RAC/RSP 레퍼런스 실존 callback 만 */
  events: readonly string[];
  /** Do 축 — 등재 완료된 고유 기능 */
  capabilities: Readonly<Record<string, CapabilityDef>>;
  /**
   * G1 보류 — RAC 에는 controlled prop 이 있으나 Preview 렌더러가 미배선/무반응
   * (분류 (c)) 이라 등재를 보류한 capability 키. 사용자에게 노출되지 않는다.
   */
  deferred?: readonly string[];
}

/**
 * 모든 시각 요소가 공통으로 갖는 capability — `props.style.display` 단일 채널.
 *
 * RAC controlled prop 이 아니라 CSS 표시 제어라 `racRef` 는 CSS 근거를 적는다.
 * (G1 의 취지는 "근거 없는 등재 금지" — 공통 3종은 렌더 경로가 D3 style 을 그대로
 * 소비하므로 컴포넌트 종류와 무관하게 동작이 보장된다.)
 */
export const COMMON_CAPABILITIES: Readonly<Record<string, CapabilityDef>> = {
  show: {
    labelKey: "capabilities.show",
    prop: "style.display",
    value: null,
    racRef:
      "CSS display — props.style 은 전 렌더러가 root 에 전달 (ADR-907 Layer C)",
  },
  hide: {
    labelKey: "capabilities.hide",
    prop: "style.display",
    value: "none",
    racRef:
      "CSS display — props.style 은 전 렌더러가 root 에 전달 (ADR-907 Layer C)",
  },
  toggle: {
    labelKey: "capabilities.toggleVisibility",
    prop: "style.display",
    value: "!self",
    racRef:
      "CSS display — props.style 은 전 렌더러가 root 에 전달 (ADR-907 Layer C)",
  },
} as const;

/**
 * 컴포넌트별 선언. 키는 canonical 컴포넌트 `type` (composition-vocabulary.ts).
 *
 * `capabilities` 에는 공통 3종을 중복 선언하지 않는다 — `resolveCapabilities()` 가
 * 조회 시점에 병합한다.
 */
export const CAPABILITY_REGISTRY: Readonly<
  Record<string, ComponentCapability>
> = {
  // ── 트리거 전용 (고유 capability 없음) ──────────────────────────────
  Button: { events: ["onPress"], capabilities: {} },
  Link: { events: ["onPress"], capabilities: {} },

  // ── (a) controlled — 즉시 반영 ────────────────────────────────────
  Tree: {
    events: ["onSelectionChange", "onExpandedChange"],
    capabilities: {
      selectItem: {
        labelKey: "capabilities.selectItem",
        prop: "selectedKeys",
        value: "!param",
        param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
        racRef: "Tree.md — selectedKeys (controlled)",
      },
      clearSelection: {
        labelKey: "capabilities.clearSelection",
        prop: "selectedKeys",
        value: [],
        racRef: "Tree.md — selectedKeys (controlled)",
      },
      expand: {
        labelKey: "capabilities.expand",
        prop: "expandedKeys",
        value: "!param",
        param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
        racRef: "Tree.md — expandedKeys (controlled)",
      },
      collapse: {
        labelKey: "capabilities.collapseAll",
        prop: "expandedKeys",
        value: [],
        racRef: "Tree.md — expandedKeys (controlled)",
      },
    },
  },
  TagGroup: {
    events: ["onSelectionChange", "onRemove"],
    capabilities: {
      selectItem: {
        labelKey: "capabilities.selectItem",
        prop: "selectedKeys",
        value: "!param",
        param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
        racRef: "TagGroup.md — selectedKeys (controlled)",
      },
      clearSelection: {
        labelKey: "capabilities.clearSelection",
        prop: "selectedKeys",
        value: [],
        racRef: "TagGroup.md — selectedKeys (controlled)",
      },
    },
  },
  Modal: {
    events: ["onOpenChange"],
    capabilities: {
      open: {
        labelKey: "capabilities.open",
        prop: "isOpen",
        value: true,
        racRef: "Modal.md — ModalOverlayProps.isOpen (controlled)",
      },
      close: {
        labelKey: "capabilities.close",
        prop: "isOpen",
        value: false,
        racRef: "Modal.md — ModalOverlayProps.isOpen (controlled)",
      },
    },
  },

  // ── (b) uncontrolled + key remount — 반영되나 내부 상태 소실 ────────
  ListBox: {
    events: ["onSelectionChange"],
    capabilities: {
      selectItem: {
        labelKey: "capabilities.selectItem",
        prop: "defaultSelectedKeys",
        value: "!param",
        param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
        racRef: "ListBox.md — selectedKeys / defaultSelectedKeys",
        remount: true,
      },
      clearSelection: {
        labelKey: "capabilities.clearSelection",
        prop: "defaultSelectedKeys",
        value: [],
        racRef: "ListBox.md — selectedKeys / defaultSelectedKeys",
        remount: true,
      },
    },
  },
  GridList: {
    events: ["onSelectionChange"],
    capabilities: {
      selectItem: {
        labelKey: "capabilities.selectItem",
        prop: "defaultSelectedKeys",
        value: "!param",
        param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
        racRef: "GridList.md — selectedKeys / defaultSelectedKeys",
        remount: true,
      },
      clearSelection: {
        labelKey: "capabilities.clearSelection",
        prop: "defaultSelectedKeys",
        value: [],
        racRef: "GridList.md — selectedKeys / defaultSelectedKeys",
        remount: true,
      },
    },
  },
  Checkbox: {
    events: ["onChange"],
    capabilities: {
      check: {
        labelKey: "capabilities.check",
        prop: "isSelected",
        value: true,
        racRef: "Checkbox.md — isSelected (controlled)",
        remount: true,
      },
      uncheck: {
        labelKey: "capabilities.uncheck",
        prop: "isSelected",
        value: false,
        racRef: "Checkbox.md — isSelected (controlled)",
        remount: true,
      },
      toggleCheck: {
        labelKey: "capabilities.toggleCheck",
        prop: "isSelected",
        value: "!self",
        racRef: "Checkbox.md — isSelected (controlled)",
        remount: true,
      },
    },
  },
  ToggleButton: {
    events: ["onChange"],
    capabilities: {
      check: {
        labelKey: "capabilities.turnOn",
        prop: "isSelected",
        value: true,
        racRef: "ToggleButton.md — isSelected (controlled)",
        remount: true,
      },
      uncheck: {
        labelKey: "capabilities.turnOff",
        prop: "isSelected",
        value: false,
        racRef: "ToggleButton.md — isSelected (controlled)",
        remount: true,
      },
      toggleCheck: {
        labelKey: "capabilities.toggleOnOff",
        prop: "isSelected",
        value: "!self",
        racRef: "ToggleButton.md — isSelected (controlled)",
        remount: true,
      },
    },
  },
  RadioGroup: {
    events: ["onChange"],
    capabilities: {
      setValue: {
        labelKey: "capabilities.setValue",
        prop: "value",
        value: "!param",
        param: { kind: "value", labelKey: "capabilities.paramValueToSelect" },
        racRef: "RadioGroup.md — value (controlled)",
        remount: true,
      },
    },
  },
  Slider: {
    events: ["onChange", "onChangeEnd"],
    capabilities: {
      setValue: {
        labelKey: "capabilities.setValue",
        prop: "value",
        value: "!param",
        param: { kind: "number", labelKey: "capabilities.paramValue" },
        racRef: "Slider.md — value (controlled)",
        remount: true,
      },
    },
  },
  Tabs: {
    events: ["onSelectionChange"],
    capabilities: {
      selectTab: {
        labelKey: "capabilities.selectTab",
        // Preview 는 `defaultSelectedKey` 만 소비하고 key 에 그 값을 포함한다
        // (breakdown §0 표 ③) — patch 대상 prop 이름이 `selectedKey` 가 아니다.
        prop: "defaultSelectedKey",
        value: "!param",
        param: { kind: "itemKey", labelKey: "capabilities.paramTabKey" },
        racRef: "Tabs.md — selectedKey / defaultSelectedKey",
        remount: true,
      },
    },
  },
  Disclosure: {
    events: ["onExpandedChange"],
    capabilities: {
      expand: {
        labelKey: "capabilities.expand",
        prop: "isExpanded",
        value: true,
        racRef: "Disclosure.md — isExpanded (controlled)",
        remount: true,
      },
      collapse: {
        labelKey: "capabilities.collapse",
        prop: "isExpanded",
        value: false,
        racRef: "Disclosure.md — isExpanded (controlled)",
        remount: true,
      },
    },
  },

  // ── 특례 — DOM ref 경유 (RAC 이 native form 위임, D1 침범 아님) ──────
  Form: {
    events: ["onSubmit", "onReset"],
    capabilities: {
      submit: {
        labelKey: "capabilities.submit",
        prop: "",
        value: null,
        racRef: "Form.md — RAC 이 native <form> 위임 → ref.requestSubmit()",
        imperative: true,
      },
      reset: {
        labelKey: "capabilities.reset",
        prop: "",
        value: null,
        racRef: "Form.md — RAC 이 native <form> 위임 → ref.reset()",
        imperative: true,
      },
    },
  },

  // ── (c) 등재 보류 — 트리거로만 사용 가능 (G1) ──────────────────────
  Select: {
    events: ["onSelectionChange", "onOpenChange"],
    capabilities: {},
    deferred: ["selectItem", "clearSelection", "open", "close"],
  },
  ComboBox: {
    events: ["onSelectionChange", "onInputChange", "onOpenChange"],
    capabilities: {},
    deferred: ["selectItem", "clearSelection", "setInput"],
  },
  TextField: {
    events: ["onChange"],
    capabilities: {},
    deferred: ["setValue", "clear"],
  },
  NumberField: {
    events: ["onChange"],
    capabilities: {},
    deferred: ["setValue", "clear"],
  },
  SearchField: {
    events: ["onChange", "onSubmit"],
    capabilities: {},
    deferred: ["setValue", "clear"],
  },
  Switch: {
    events: ["onChange"],
    capabilities: {},
    deferred: ["check", "uncheck", "toggleCheck"],
  },
  Table: {
    events: ["onSelectionChange"],
    capabilities: {},
    deferred: ["selectItem", "clearSelection"],
  },
  DisclosureGroup: {
    events: ["onExpandedChange"],
    capabilities: {},
    deferred: ["expand", "collapse"],
  },
  DatePicker: {
    events: ["onChange"],
    capabilities: {},
    deferred: ["setValue", "open", "close"],
  },
  Calendar: {
    events: ["onChange"],
    capabilities: {},
    deferred: ["setValue"],
  },
  Popover: {
    events: ["onOpenChange"],
    capabilities: {},
    deferred: ["open", "close"],
  },
  Menu: {
    events: ["onAction", "onOpenChange"],
    capabilities: {},
    deferred: ["open", "close"],
  },
} as const;

/**
 * 앱 액션 — 대상 요소가 없는 전역 동작.
 *
 * `labelKey` 는 패널 Do 축 선택지(`ACTION_CHOICE_LABEL_KEYS`)와 **같은 키**를 가리킨다 —
 * 같은 동작을 두 문장으로 갈라 두면 한쪽만 고쳐지는 순간 어휘가 어긋난다.
 */
export const APP_ACTIONS = {
  navigate: {
    labelKey: "interactions.actionNavigate",
    param: { kind: "text", labelKey: "capabilities.paramPath" },
  },
  toast: {
    labelKey: "interactions.actionToast",
    param: { kind: "text", labelKey: "capabilities.paramMessage" },
  },
} as const satisfies Record<
  string,
  { labelKey: string; param: CapabilityParam }
>;

export type AppActionKind = keyof typeof APP_ACTIONS;

/**
 * 대상 요소 type 의 전체 capability (공통 3종 + 고유). 미등록 type 도 공통 3종은 갖는다.
 */
export function resolveCapabilities(
  componentType: string,
): Readonly<Record<string, CapabilityDef>> {
  const own = CAPABILITY_REGISTRY[componentType]?.capabilities;
  return own ? { ...COMMON_CAPABILITIES, ...own } : COMMON_CAPABILITIES;
}

/** 트리거로 쓸 수 있는 callback 목록. 미등록 type 은 빈 배열 (트리거 불가). */
export function resolveTriggers(componentType: string): readonly string[] {
  return CAPABILITY_REGISTRY[componentType]?.events ?? [];
}

/** 해당 type 이 Do 축 대상이 될 수 있는지 (공통 3종만 있어도 true) */
export function isCapabilityTarget(componentType: string): boolean {
  return Object.keys(resolveCapabilities(componentType)).length > 0;
}
