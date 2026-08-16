/**
 * EventTypePicker - 이벤트 타입 선택 컴포넌트
 *
 * DialogTrigger + Popover 기반 검색 가능한 이벤트 선택기
 * React Aria Components를 사용하여 검색 기능 제공
 *
 * Phase 2: Events Panel 재설계 - 검색 기능 추가
 * Phase 6: 추천 이벤트 섹션 추가 (컴포넌트별 최적 이벤트 빠른 추가)
 */

import { useState, useMemo, useRef } from "react";
import {
  DialogTrigger,
  Button,
  ListBox,
  ListBoxItem,
} from "react-aria-components";
import { Popover } from "@composition/shared/components/Popover";
import { Search, ChevronDown, Zap } from "lucide-react";
import type { EventType } from "@/types/events/events.types";
import { EVENT_TYPE_LABELS } from "@/types/events/events.types";
import { EVENT_CATEGORIES } from "../data/eventCategories";
import { iconProps, iconEditProps, iconSmall } from "@/utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

// 추천 이벤트 우선순위 (컴포넌트별 가장 많이 사용되는 이벤트 순서)
// ⚠️ 순서 중요: 사용자 상호작용 → 값 변경 → 포커스 순
const EVENT_PRIORITY: EventType[] = [
  "onClick", // 가장 일반적인 클릭 이벤트 (Button, Link 등)
  "onChange", // 값 변경 이벤트 (TextField, Select, Checkbox 등)
  "onSubmit", // 폼 제출 이벤트 (Form)
  "onKeyDown", // 키보드 이벤트 (TextField, NumberField 등)
  "onKeyUp", // 키보드 이벤트
  "onMouseEnter", // 마우스 진입
  "onMouseLeave", // 마우스 나감
  "onFocus", // 포커스 (낮은 우선순위)
  "onBlur", // 블러 (낮은 우선순위)
];

interface EventTypePickerProps {
  /** 이벤트 선택 시 호출되는 콜백 */
  onSelect: (eventType: EventType) => void;
  /** 이미 등록된 이벤트 타입 목록 (중복 방지용) */
  registeredTypes?: EventType[];
  /** 현재 선택된 이벤트 타입 (WhenBlock에서 사용) */
  selectedType?: EventType;
  /** 허용된 이벤트 타입만 노출 (컴포넌트 지원 이벤트 제한용) */
  allowedTypes?: EventType[];
  /** 비활성화 여부 */
  isDisabled?: boolean;
  /** 인라인 모드 (버튼 대신 입력 필드 표시) */
  inline?: boolean;
}

/**
 * EventTypePicker 컴포넌트
 *
 * @example
 * // 헤더 버튼 모드
 * <EventTypePicker
 *   onSelect={(eventType) => addHandler(eventType)}
 *   registeredTypes={handlers.map(h => h.event_type)}
 * />
 *
 * // 인라인 모드 (검색 입력 필드)
 * <EventTypePicker
 *   onSelect={(eventType) => updateTrigger({ event: eventType })}
 *   selectedType={trigger.event}
 *   inline
 * />
 */
export function EventTypePicker({
  onSelect,
  registeredTypes = [],
  selectedType,
  allowedTypes,
  isDisabled = false,
  inline = false,
}: EventTypePickerProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // 기본 이벤트 목록: allowedTypes가 있으면 그것을 우선 사용하고, 없으면 전체
  const baseEventTypes = useMemo(() => {
    const base =
      allowedTypes && allowedTypes.length > 0
        ? allowedTypes
        : (Object.keys(EVENT_TYPE_LABELS) as EventType[]);

    // 현재 선택된 타입이 목록에 없으면 포함시켜 편집 시 보존
    if (selectedType && !base.includes(selectedType)) {
      return Array.from(new Set([...base, selectedType]));
    }

    return base;
  }, [allowedTypes, selectedType]);

  // 사용 가능한 이벤트 타입 목록 (이미 등록된 타입 제외)
  const availableEventTypes = useMemo(() => {
    return baseEventTypes.filter(
      (type) => !registeredTypes.includes(type) || type === selectedType,
    );
  }, [baseEventTypes, registeredTypes, selectedType]);

  // 추천 이벤트 목록 (우선순위 기반, 최대 3개)
  const recommendedEvents = useMemo(() => {
    const recommendations: EventType[] = [];
    for (const type of EVENT_PRIORITY) {
      if (availableEventTypes.includes(type) && type !== selectedType) {
        recommendations.push(type);
        if (recommendations.length >= 3) break;
      }
    }
    return recommendations;
  }, [availableEventTypes, selectedType]);

  // 검색 필터링된 목록
  const filteredEventTypes = useMemo(() => {
    if (!searchValue) return availableEventTypes;

    const searchLower = searchValue.toLowerCase();
    return availableEventTypes.filter((type) => {
      const label = EVENT_TYPE_LABELS[type]?.toLowerCase() || "";
      return (
        type.toLowerCase().includes(searchLower) || label.includes(searchLower)
      );
    });
  }, [availableEventTypes, searchValue]);

  // 카테고리별 그룹화
  const groupedEventTypes = useMemo(() => {
    const groups: { category: string; events: EventType[] }[] = [];
    const added = new Set<EventType>();

    // EVENT_CATEGORIES가 있으면 사용, 없으면 단일 그룹
    if (typeof EVENT_CATEGORIES !== "undefined") {
      Object.entries(EVENT_CATEGORIES).forEach(([, categoryData]) => {
        // categoryData는 { label: string, events: readonly string[] } 형태
        const categoryInfo = categoryData as {
          label: string;
          events: readonly string[];
        };
        const filtered = (categoryInfo.events as unknown as EventType[]).filter(
          (e) => filteredEventTypes.includes(e),
        );
        if (filtered.length > 0) {
          groups.push({ category: categoryInfo.label, events: filtered });
          filtered.forEach((e) => added.add(e));
        }
      });
    } else {
      groups.push({ category: "Events", events: filteredEventTypes });
    }

    // 카테고리에서 누락된 타입이 있다면 기본 그룹으로 추가
    const leftovers = filteredEventTypes.filter((e) => !added.has(e));
    if (leftovers.length > 0 && typeof EVENT_CATEGORIES !== "undefined") {
      groups.push({ category: "Events", events: leftovers });
    }

    return groups;
  }, [filteredEventTypes]);

  // 이벤트 선택 핸들러
  const handleSelect = (eventType: EventType) => {
    onSelect(eventType);
    setSearchValue("");
    setIsOpen(false);
  };

  // 검색 입력 ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Popover가 열릴 때 검색 입력에 포커스
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // 약간의 지연 후 포커스
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchValue("");
    }
  };

  // 인라인 모드: 검색 입력 필드
  if (inline) {
    return (
      <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Button
          className="event-picker-inline-trigger"
          isDisabled={isDisabled}
          aria-label="이벤트 타입 선택"
        >
          <span className="event-picker-value">
            {selectedType
              ? EVENT_TYPE_LABELS[selectedType] || selectedType
              : "Select event..."}
          </span>
          <ChevronDown size={iconEditProps.size} />
        </Button>

        <Popover
          placement="bottom start"
          offset={4}
          className="event-picker-popover"
          hideArrow
        >
          <div className="event-picker-search">
            <Search size={iconEditProps.size} color={iconProps.color} />
            <input
              ref={searchInputRef}
              className="event-picker-search-input"
              placeholder="Search events..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>

          <ListBox
            className="event-picker-list"
            aria-label="이벤트 타입 목록"
            selectionMode="single"
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as EventType;
              if (selected) handleSelect(selected);
            }}
          >
            {filteredEventTypes.length === 0 ? (
              <ListBoxItem id="empty" textValue="No events found">
                <div className="event-picker-empty">
                  <Search size={iconProps.size} color={iconProps.color} />
                  <span>No events found</span>
                </div>
              </ListBoxItem>
            ) : (
              groupedEventTypes.flatMap((group) => [
                <ListBoxItem
                  key={`label-${group.category}`}
                  id={`label-${group.category}`}
                  textValue={group.category}
                  className="event-group-label-item"
                >
                  <div className="event-group-label">{group.category}</div>
                </ListBoxItem>,
                ...group.events.map((eventType) => (
                  <ListBoxItem
                    key={eventType}
                    id={eventType}
                    className="event-item"
                    textValue={EVENT_TYPE_LABELS[eventType] || eventType}
                  >
                    <span className="event-name">
                      {EVENT_TYPE_LABELS[eventType] || eventType}
                    </span>
                    <span className="event-type-code">{eventType}</span>
                  </ListBoxItem>
                )),
              ])
            )}
          </ListBox>
        </Popover>
      </DialogTrigger>
    );
  }

  // 버튼 모드: 헤더에서 + 버튼 클릭
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        className="iconButton"
        isDisabled={isDisabled || availableEventTypes.length === 0}
        aria-label="이벤트 추가"
      >
        <AddIcon
          color={iconProps.color}
          strokeWidth={iconProps.strokeWidth}
          size={iconProps.size}
        />
      </Button>

      <Popover
        placement="bottom end"
        offset={4}
        className="event-picker-popover"
        hideArrow
      >
        {/* 추천 이벤트 섹션 - 검색어가 없고 추천 이벤트가 있을 때만 표시 */}
        {!searchValue && recommendedEvents.length > 0 && (
          <div className="event-picker-recommended">
            <div className="event-picker-recommended-header">
              <Zap size={iconSmall.size} color={iconProps.color} />
              <span>Recommended</span>
            </div>
            <div className="event-picker-recommended-list">
              {recommendedEvents.map((eventType) => (
                <button
                  key={eventType}
                  type="button"
                  className="event-picker-recommended-item"
                  onClick={() => handleSelect(eventType)}
                >
                  <span className="event-name">
                    {EVENT_TYPE_LABELS[eventType] || eventType}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="event-picker-search">
          <Search size={iconEditProps.size} color={iconProps.color} />
          <input
            ref={searchInputRef}
            className="event-picker-search-input"
            placeholder="Search events..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>

        <ListBox
          className="event-picker-list"
          aria-label="이벤트 타입 목록"
          selectionMode="single"
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as EventType;
            if (selected) handleSelect(selected);
          }}
        >
          {filteredEventTypes.length === 0 ? (
            <ListBoxItem id="empty" textValue="No events found">
              <div className="event-picker-empty">
                <span>No events found</span>
              </div>
            </ListBoxItem>
          ) : (
            groupedEventTypes.flatMap((group) => [
              <ListBoxItem
                key={`label-${group.category}`}
                id={`label-${group.category}`}
                textValue={group.category}
                className="event-group-label-item"
              >
                <div className="event-group-label">{group.category}</div>
              </ListBoxItem>,
              ...group.events.map((eventType) => (
                <ListBoxItem
                  key={eventType}
                  id={eventType}
                  className="event-item"
                  textValue={EVENT_TYPE_LABELS[eventType] || eventType}
                >
                  <span className="event-name">
                    {EVENT_TYPE_LABELS[eventType] || eventType}
                  </span>
                  <span className="event-type-code">{eventType}</span>
                </ListBoxItem>
              )),
            ])
          )}
        </ListBox>
      </Popover>
    </DialogTrigger>
  );
}
