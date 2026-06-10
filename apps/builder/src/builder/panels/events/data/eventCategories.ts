/**
 * 이벤트 카테고리 및 메타데이터
 *
 * ⚠️ 이벤트 목록은 EVENT_REGISTRY 정본에서 파생됩니다 (ADR-055).
 * 새 이벤트 추가 시 events.registry.ts의 EVENT_REGISTRY만 수정하세요.
 * 이 파일은 UI 메타데이터(아이콘, 상세 설명, 호환성, 추천 이벤트)만 관리합니다.
 */

import { Mouse, FileText, Keyboard, Component, Zap } from "lucide-react";
import type { EventCategory, EventMetadata, EventType } from "../types";
import { EVENT_CATEGORIES_BY_ID } from "@/types/events/events.registry";

/**
 * 이벤트 카테고리 정의
 * events 목록은 EVENT_REGISTRY의 category 필드에서 자동 집계 (하드코딩 제거)
 */
export const EVENT_CATEGORIES: Record<string, EventCategory> = {
  mouse: {
    id: "mouse",
    label: "Mouse Events",
    icon: Mouse,
    events: EVENT_CATEGORIES_BY_ID.mouse ?? [],
    description: "마우스 상호작용 이벤트",
  },
  form: {
    id: "form",
    label: "Form Events",
    icon: FileText,
    events: EVENT_CATEGORIES_BY_ID.form ?? [],
    description: "폼 입력 및 제출 이벤트",
  },
  keyboard: {
    id: "keyboard",
    label: "Keyboard Events",
    icon: Keyboard,
    events: EVENT_CATEGORIES_BY_ID.keyboard ?? [],
    description: "키보드 입력 이벤트",
  },
  reactAria: {
    id: "reactAria",
    label: "React Aria Events",
    icon: Component,
    events: EVENT_CATEGORIES_BY_ID.reactAria ?? [],
    description: "React Aria 컴포넌트 전용 이벤트",
  },
  other: {
    id: "other",
    label: "Other Events",
    icon: Zap,
    events: EVENT_CATEGORIES_BY_ID.other ?? [],
    description: "기타 이벤트",
  },
};

/**
 * 이벤트 메타데이터 (사용률, 호환성 등)
 */
export const EVENT_METADATA: Record<EventType, EventMetadata> = {
  // Mouse Events
  onClick: {
    label: "클릭",
    description: "요소를 클릭했을 때 발생",
    usage: "95%",
    category: "mouse",
    compatibleWith: ["Button", "Link", "Card", "Image", "div"],
    example: "버튼 클릭 → 페이지 이동",
  },
  onDoubleClick: {
    label: "더블클릭",
    description: "요소를 빠르게 두 번 클릭했을 때 발생",
    usage: "15%",
    category: "mouse",
    compatibleWith: ["Button", "Card", "div"],
    example: "카드 더블클릭 → 상세 보기",
  },
  onMouseEnter: {
    label: "마우스 진입",
    description: "마우스 포인터가 요소 위로 올라갔을 때 발생",
    usage: "45%",
    category: "mouse",
    compatibleWith: ["Button", "Card", "Tooltip", "div"],
    example: "카드 호버 → 툴팁 표시",
  },
  onMouseLeave: {
    label: "마우스 나감",
    description: "마우스 포인터가 요소에서 벗어났을 때 발생",
    usage: "40%",
    category: "mouse",
    compatibleWith: ["Button", "Card", "Tooltip", "div"],
    example: "카드에서 마우스 나감 → 툴팁 숨김",
  },
  onMouseDown: {
    label: "마우스 다운",
    description: "마우스 버튼을 눌렀을 때 발생",
    usage: "10%",
    category: "mouse",
    compatibleWith: ["Button", "div"],
    example: "드래그 시작",
  },
  onMouseUp: {
    label: "마우스 업",
    description: "마우스 버튼을 뗐을 때 발생",
    usage: "10%",
    category: "mouse",
    compatibleWith: ["Button", "div"],
    example: "드래그 종료",
  },

  // Form Events
  onChange: {
    label: "값 변경",
    description: "입력 필드의 값이 변경되었을 때 발생",
    usage: "98%",
    category: "form",
    compatibleWith: [
      "TextField",
      "Select",
      "ComboBox",
      "Checkbox",
      "Switch",
      "RadioGroup",
      "Slider",
      "TextArea",
    ],
    example: "입력 필드 변경 → 상태 업데이트",
  },
  onInput: {
    label: "입력",
    description: "입력 필드에 텍스트가 입력될 때마다 발생",
    usage: "60%",
    category: "form",
    compatibleWith: ["TextField", "SearchField"],
    example: "검색어 입력 → 자동완성 표시",
  },
  onSubmit: {
    label: "제출",
    description: "폼이 제출되었을 때 발생",
    usage: "85%",
    category: "form",
    compatibleWith: ["Form"],
    example: "폼 제출 → API 호출",
  },
  onFocus: {
    label: "포커스",
    description: "요소가 포커스를 받았을 때 발생",
    usage: "50%",
    category: "form",
    compatibleWith: ["TextField", "Select", "ComboBox", "Button"],
    example: "입력 필드 포커스 → 도움말 표시",
  },
  onBlur: {
    label: "포커스 해제",
    description: "요소가 포커스를 잃었을 때 발생",
    usage: "45%",
    category: "form",
    compatibleWith: ["TextField", "Select", "ComboBox", "Button"],
    example: "입력 필드 벗어남 → 유효성 검사",
  },

  // Keyboard Events
  onKeyDown: {
    label: "키 누름",
    description: "키보드 키를 눌렀을 때 발생",
    usage: "35%",
    category: "keyboard",
    compatibleWith: ["TextField", "SearchField", "div"],
    example: "Enter 키 → 검색 실행",
  },
  onKeyUp: {
    label: "키 뗌",
    description: "키보드 키를 뗐을 때 발생",
    usage: "20%",
    category: "keyboard",
    compatibleWith: ["TextField", "SearchField", "div"],
    example: "Escape 키 → 모달 닫기",
  },
  onKeyPress: {
    label: "키 입력",
    description: "키보드 문자 키가 입력되었을 때 발생",
    usage: "15%",
    category: "keyboard",
    compatibleWith: ["TextField", "SearchField"],
    example: "키 입력 → 실시간 검색",
  },

  // React Aria Events
  onPress: {
    label: "프레스",
    description: "React Aria의 통합 프레스 이벤트 (클릭, 터치, Enter 키)",
    usage: "90%",
    category: "reactAria",
    compatibleWith: ["Button", "ToggleButton", "Link"],
    example: "버튼 프레스 → 액션 실행",
  },
  onSelectionChange: {
    label: "선택 변경",
    description: "리스트나 선택 컴포넌트의 선택이 변경되었을 때 발생",
    usage: "95%",
    category: "reactAria",
    compatibleWith: [
      "ListBox",
      "GridList",
      "Select",
      "ComboBox",
      "TagGroup",
      "ToggleButtonGroup",
      "RadioGroup",
    ],
    example: "리스트 아이템 선택 → 상세 정보 표시",
  },
  onAction: {
    label: "액션",
    description: "메뉴 아이템 또는 리스트 아이템에서 액션이 발생했을 때",
    usage: "80%",
    category: "reactAria",
    compatibleWith: ["Menu", "ListBox", "GridList"],
    example: "메뉴 아이템 클릭 → 명령 실행",
  },
  onOpenChange: {
    label: "열림/닫힘",
    description: "컴포넌트의 열림/닫힘 상태가 변경되었을 때 발생",
    usage: "70%",
    category: "reactAria",
    compatibleWith: ["Menu", "ComboBox", "Select", "Dialog"],
    example: "드롭다운 열림 → 데이터 로드",
  },

  onChangeEnd: {
    label: "값 변경 완료",
    description: "드래그/조작이 끝나고 최종 값이 확정되었을 때 발생",
    usage: "60%",
    category: "reactAria",
    compatibleWith: ["Slider", "ColorArea", "ColorSlider", "ColorWheel"],
    example: "슬라이더 드래그 종료 → API에 최종 값 저장",
  },
  onExpandedChange: {
    label: "펼침/접힘 변경",
    description: "확장/축소 상태가 변경되었을 때 발생",
    usage: "50%",
    category: "reactAria",
    compatibleWith: ["Disclosure", "DisclosureGroup", "Tree"],
    example: "디스클로저 섹션 열림 → 콘텐츠 로드",
  },
  onRemove: {
    label: "항목 제거",
    description: "태그나 항목이 제거되었을 때 발생",
    usage: "40%",
    category: "reactAria",
    compatibleWith: ["TagGroup"],
    example: "태그 제거 → 필터 갱신",
  },

  // Other Events
  onScroll: {
    label: "스크롤",
    description: "요소가 스크롤될 때 발생",
    usage: "30%",
    category: "other",
    compatibleWith: ["div"],
    example: "페이지 하단 도달 → 더 로드",
  },
  onResize: {
    label: "크기 변경",
    description: "요소의 크기가 변경되었을 때 발생",
    usage: "10%",
    category: "other",
    compatibleWith: ["div", "ResizablePanel"],
    example: "창 크기 변경 → 레이아웃 재계산",
  },
  onLoad: {
    label: "로드",
    description: "리소스가 로드되었을 때 발생",
    usage: "25%",
    category: "other",
    compatibleWith: ["Image", "iframe"],
    example: "이미지 로드 완료 → 애니메이션 시작",
  },
};

/**
 * 컴포넌트별 추천 이벤트
 */
export const COMPONENT_RECOMMENDED_EVENTS: Record<string, EventType[]> = {
  // Actions
  Button: ["onPress", "onClick"],
  Link: ["onPress", "onClick"],
  ToggleButton: ["onChange", "onPress"],
  ToggleButtonGroup: ["onSelectionChange"],

  // Forms
  TextField: ["onChange", "onInput", "onFocus", "onBlur"],
  SearchField: ["onChange", "onInput", "onKeyDown"],
  NumberField: ["onChange", "onFocus", "onBlur"],
  Checkbox: ["onChange"],
  Switch: ["onChange"],
  RadioGroup: ["onChange"],
  Slider: ["onChange", "onChangeEnd"],
  TextArea: ["onChange", "onFocus", "onBlur", "onKeyDown"],

  // Selection
  Select: ["onSelectionChange", "onOpenChange"],
  ComboBox: ["onSelectionChange", "onOpenChange", "onInput"],
  ListBox: ["onSelectionChange", "onAction"],
  GridList: ["onSelectionChange", "onAction"],
  Menu: ["onAction", "onOpenChange"],
  TagGroup: ["onSelectionChange", "onRemove"],

  // Collections
  Table: ["onSelectionChange"],
  Tree: ["onSelectionChange", "onExpandedChange", "onAction"],

  // Layout
  Tabs: ["onSelectionChange"],
  Dialog: ["onOpenChange"],
  Popover: ["onOpenChange"],
  Disclosure: ["onExpandedChange"],
  DisclosureGroup: ["onExpandedChange"],

  // Color
  ColorArea: ["onChange", "onChangeEnd"],
  ColorSlider: ["onChange", "onChangeEnd"],
  ColorWheel: ["onChange", "onChangeEnd"],

  // Content
  Card: ["onClick", "onMouseEnter", "onMouseLeave"],
  Image: ["onClick", "onLoad"],

  // Default
  default: ["onClick", "onPress"],
};

/**
 * 이벤트 호환성 체크
 */
export function isEventCompatible(
  eventType: EventType,
  componentType: string,
): boolean {
  const metadata = EVENT_METADATA[eventType];
  if (!metadata.compatibleWith) return true;
  return metadata.compatibleWith.includes(componentType);
}

/**
 * 컴포넌트의 추천 이벤트 가져오기
 */
export function getRecommendedEvents(componentType: string): EventType[] {
  return (
    COMPONENT_RECOMMENDED_EVENTS[componentType] ||
    COMPONENT_RECOMMENDED_EVENTS.default
  );
}

/**
 * 카테고리별 이벤트 가져오기
 */
export function getEventsByCategory(categoryId: string): EventType[] {
  const category = EVENT_CATEGORIES[categoryId];
  return category ? category.events : [];
}
