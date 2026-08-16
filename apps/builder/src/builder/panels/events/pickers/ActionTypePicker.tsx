/**
 * ActionTypePicker - 액션 타입 선택 컴포넌트
 *
 * DialogTrigger + Popover 기반 검색 가능한 액션 선택기
 * React Aria Components를 사용하여 검색 기능 제공
 *
 * Phase 3: Events Panel 재설계 - 검색 기능 추가
 */

import { useState, useMemo, useRef } from "react";
import {
  DialogTrigger,
  Button,
  ListBox,
  ListBoxItem,
} from "react-aria-components";
import { Popover } from "@composition/shared/components/Popover";
import { Search, ChevronDown } from "lucide-react";
import type { ActionType } from "@/types/events/events.types";
import {
  ACTION_TYPE_LABELS,
  REGISTRY_ACTION_CATEGORIES,
} from "@/types/events/events.types";
import { iconProps, iconEditProps } from "@/utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

interface ActionTypePickerProps {
  /** 액션 선택 시 호출되는 콜백 */
  onSelect: (actionType: ActionType) => void;
  /** 현재 선택된 액션 타입 */
  selectedType?: ActionType;
  /** 비활성화 여부 */
  isDisabled?: boolean;
  /** 인라인 모드 (버튼 대신 입력 필드 표시) */
  inline?: boolean;
  /** placeholder 텍스트 */
  placeholder?: string;
  /** 카테고리별 그룹핑 여부 */
  showCategories?: boolean;
}

/**
 * ActionTypePicker 컴포넌트
 *
 * @example
 * // 헤더 버튼 모드
 * <ActionTypePicker
 *   onSelect={(actionType) => addAction(actionType)}
 * />
 *
 * // 인라인 모드 (검색 입력 필드)
 * <ActionTypePicker
 *   onSelect={(actionType) => updateAction({ type: actionType })}
 *   selectedType={action.type}
 *   inline
 * />
 */
export function ActionTypePicker({
  onSelect,
  selectedType,
  isDisabled = false,
  inline = false,
  placeholder = "Search actions...",
  showCategories = true,
}: ActionTypePickerProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // 사용 가능한 액션 타입 목록
  const availableActionTypes = useMemo(() => {
    return Object.keys(ACTION_TYPE_LABELS) as ActionType[];
  }, []);

  // 검색 필터링된 목록
  const filteredActionTypes = useMemo(() => {
    if (!searchValue) return availableActionTypes;

    const searchLower = searchValue.toLowerCase();
    return availableActionTypes.filter((type) => {
      const label = ACTION_TYPE_LABELS[type]?.toLowerCase() || "";
      return (
        type.toLowerCase().includes(searchLower) || label.includes(searchLower)
      );
    });
  }, [availableActionTypes, searchValue]);

  // 카테고리별 그룹화
  const groupedActionTypes = useMemo(() => {
    if (!showCategories) {
      return [{ category: "Actions", actions: filteredActionTypes }];
    }

    const groups: { category: string; actions: ActionType[] }[] = [];

    // REGISTRY_ACTION_CATEGORIES가 있으면 사용, 없으면 단일 그룹
    if (typeof REGISTRY_ACTION_CATEGORIES !== "undefined") {
      Object.entries(REGISTRY_ACTION_CATEGORIES).forEach(([, categoryData]) => {
        // categoryData는 { label: string, actions: readonly string[] } 형태
        const categoryInfo = categoryData as {
          label: string;
          actions: readonly string[];
        };
        const filtered = (
          categoryInfo.actions as unknown as ActionType[]
        ).filter((a) => filteredActionTypes.includes(a));
        if (filtered.length > 0) {
          groups.push({ category: categoryInfo.label, actions: filtered });
        }
      });
    } else {
      groups.push({ category: "Actions", actions: filteredActionTypes });
    }

    return groups;
  }, [filteredActionTypes, showCategories]);

  // 액션 선택 핸들러
  const handleSelect = (actionType: ActionType) => {
    onSelect(actionType);
    setSearchValue("");
    setIsOpen(false);
  };

  // 검색 입력 ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Popover가 열릴 때 검색 입력에 포커스
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
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
          className="action-picker-inline-trigger"
          isDisabled={isDisabled}
          aria-label="액션 타입 선택"
        >
          <span className="action-picker-value">
            {selectedType
              ? ACTION_TYPE_LABELS[selectedType] || selectedType
              : placeholder}
          </span>
          <ChevronDown size={iconEditProps.size} />
        </Button>

        <Popover
          placement="bottom start"
          offset={4}
          className="action-picker-popover"
          hideArrow
        >
          <div className="action-picker-search">
            <Search size={iconEditProps.size} color={iconProps.color} />
            <input
              ref={searchInputRef}
              className="action-picker-search-input"
              placeholder={placeholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>

          <ListBox
            className="action-picker-list"
            aria-label="액션 타입 목록"
            selectionMode="single"
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as ActionType;
              if (selected) handleSelect(selected);
            }}
          >
            {filteredActionTypes.length === 0 ? (
              <ListBoxItem id="empty" textValue="No actions found">
                <div className="action-picker-empty">
                  <Search size={iconProps.size} color={iconProps.color} />
                  <span>No actions found</span>
                </div>
              </ListBoxItem>
            ) : (
              groupedActionTypes.flatMap((group) => [
                <ListBoxItem
                  key={`label-${group.category}`}
                  id={`label-${group.category}`}
                  textValue={group.category}
                  className="action-group-label-item"
                >
                  <div className="action-group-label">{group.category}</div>
                </ListBoxItem>,
                ...group.actions.map((actionType) => (
                  <ListBoxItem
                    key={actionType}
                    id={actionType}
                    className="action-item"
                    textValue={ACTION_TYPE_LABELS[actionType] || actionType}
                  >
                    <span className="action-name">
                      {ACTION_TYPE_LABELS[actionType] || actionType}
                    </span>
                    <span className="action-type-code">{actionType}</span>
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
        isDisabled={isDisabled || availableActionTypes.length === 0}
        aria-label="액션 추가"
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
        className="action-picker-popover"
        hideArrow
      >
        <div className="action-picker-search">
          <Search size={iconEditProps.size} color={iconProps.color} />
          <input
            ref={searchInputRef}
            className="action-picker-search-input"
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>

        <ListBox
          className="action-picker-list"
          aria-label="액션 타입 목록"
          selectionMode="single"
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as ActionType;
            if (selected) handleSelect(selected);
          }}
        >
          {filteredActionTypes.length === 0 ? (
            <ListBoxItem id="empty" textValue="No actions found">
              <div className="action-picker-empty">
                <span>No actions found</span>
              </div>
            </ListBoxItem>
          ) : (
            groupedActionTypes.flatMap((group) => [
              <ListBoxItem
                key={`label-${group.category}`}
                id={`label-${group.category}`}
                textValue={group.category}
                className="action-group-label-item"
              >
                <div className="action-group-label">{group.category}</div>
              </ListBoxItem>,
              ...group.actions.map((actionType) => (
                <ListBoxItem
                  key={actionType}
                  id={actionType}
                  className="action-item"
                  textValue={ACTION_TYPE_LABELS[actionType] || actionType}
                >
                  <span className="action-name">
                    {ACTION_TYPE_LABELS[actionType] || actionType}
                  </span>
                  <span className="action-type-code">{actionType}</span>
                </ListBoxItem>
              )),
            ])
          )}
        </ListBox>
      </Popover>
    </DialogTrigger>
  );
}
