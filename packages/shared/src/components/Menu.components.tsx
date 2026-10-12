import type { RuntimeMenuItem } from "@composition/rendering";

import { ChevronRightIcon } from "lucide-react";

import { Button } from "react-aria-components/Button";

import { Selection } from "react-aria-components/ListBox";

import {
  MenuItem as AriaMenuItem,
  Menu,
  MenuTrigger,
  SubmenuTrigger,
} from "react-aria-components/Menu";

import { Popover } from "react-aria-components/Popover";

import { composeRenderProps } from "react-aria-components/composeRenderProps";

import type { ComponentSize, DataBinding } from "../types";

import { useResolvedCollectionItems } from "../hooks";

// ADR-148 Phase 4 — MenuItem slot 구성 소비 (origin slot 자식의 존재 gating / 스타일 overlay).

import { useComponentStrings } from "../i18n";
import {
  ExtendedMenuItemProps,
  MenuButtonProps,
  renderMenuItemSlotParts,
} from "./Menu.runtime";

export function MenuButton<T extends object>({
  label,
  children,
  dataBinding,
  columnMapping,
  items,
  variant = "primary",
  size = "M",
  selectionMode,
  selectedKeys,
  onSelectionChange,
  slotComposition,
  style,
  ...props
}: MenuButtonProps<T>) {
  const t = useComponentStrings();
  // ADR-073 Task 7: selection props → RAC Menu props 변환
  // 주의: Partial<MenuProps<T>> 로 타입하면 items T 추론이 깨짐 → T-독립 타입으로 선언
  const racSelectedKeys: Set<string> | undefined =
    selectedKeys !== undefined ? new Set(selectedKeys) : undefined;
  const selectionMenuProps: {
    selectionMode?: "none" | "single" | "multiple";
    selectedKeys?: Set<string>;
    onSelectionChange?: (keys: Selection) => void;
  } = {
    ...(selectionMode !== undefined && { selectionMode }),
    ...(racSelectedKeys !== undefined && { selectedKeys: racSelectedKeys }),
    ...(onSelectionChange !== undefined && {
      onSelectionChange: (keys: Selection) => {
        if (keys !== "all") {
          onSelectionChange(Array.from(keys) as string[]);
        }
      },
    }),
  };
  // ADR-912 영역 B Task 3: collection source acquisition 단일화.
  //   useCollectionData 직접 호출(이중 source)을 useResolvedCollectionItems 단일 진입점으로 통일.
  //   dataBinding(async/dataTable/API)과 정적 props.items 가 같은 toItemProjectionRow normalizer 통과.
  //   Menu 는 submenu(children)/icon/shortcut/onAction/href 차원이 있어, normalizer 가 추출하는
  //   fixed-field 대신 row.item(raw 보존)에서 직접 읽어 기존 render 로직(renderMenuItem)을 유지한다.
  //   boundData(raw 배열)는 rows.map(r => r.item) 으로 derive — 기존 dataBinding 경로 소비 코드 보존.
  const {
    rows: resolvedRows,
    loading,
    error,
  } = useResolvedCollectionItems({
    dataBinding: dataBinding as DataBinding,
    items: items as unknown[] | undefined,
    componentName: "Menu",
    fallbackData: [
      {
        label: "File",
        icon: "📁",
        children: [
          { label: "New", shortcut: "⌘N" },
          { label: "Open", shortcut: "⌘O" },
        ],
      },
      { label: "Edit", icon: "✏️" },
    ],
  });

  // 데이터 바인딩이 있는 경우
  // PropertyDataBinding 형식 (source, name) 또는 DataBinding 형식 (type: "collection") 둘 다 지원
  const isPropertyBinding =
    dataBinding &&
    "source" in dataBinding &&
    "name" in dataBinding &&
    !("type" in dataBinding);
  const hasDataBinding =
    (!isPropertyBinding &&
      dataBinding &&
      "type" in dataBinding &&
      dataBinding.type === "collection") ||
    isPropertyBinding;

  // dataBinding 경로 소비용 raw 배열 — normalizer 가 보존한 row.item.
  //   dataBinding 이 있을 때만 rows 가 dataBinding source(정적 items 경로는 별도 분기에서 items 직접).
  const boundData = hasDataBinding
    ? resolvedRows.map((row) => row.item as Record<string, unknown>)
    : [];

  // Menu className generator (reused across all conditional renders)
  // props.className can be string or function, so we extract string value if available
  const baseClassName =
    typeof props.className === "string" ? props.className : undefined;
  const getMenuClassName = () =>
    composeRenderProps(baseClassName, (className) =>
      className ? `react-aria-Menu ${className}` : "react-aria-Menu",
    );
  // ADR-923 r19m1 — 종전 `label || "Menu"` 는 렌더러 (`renderMenu`, r18m1) 가 텍스트 원천 계약으로
  //   낸 빈 label 을 다시 "Menu" 로 되살렸다 (Skia 는 기본 글자 없음). 계약 결과 그대로 — 부재도 "".
  const triggerLabel = label ?? "";
  // ADR-923 r20m2 — 보이는 글자 (텍스트 원천 계약) 와 D1 접근성 이름은 다른 경로다. `{...props}` 는
  //   `MenuTrigger` (context provider — `BaseMenuTriggerProps` 에 aria 없음) 로 가서 호출자의
  //   aria-label/aria-labelledby 가 버려졌으므로 trigger Button 에 직접 건다. 보이는 글자도 호출자
  //   이름도 없으면 컴포넌트 기본 이름 (i18n — 속성이라 화면·Skia 에는 아무것도 없다).
  const ariaLabel = props["aria-label"];
  const ariaLabelledBy = props["aria-labelledby"];
  const triggerAriaLabel =
    ariaLabel ??
    (triggerLabel === "" && ariaLabelledBy === undefined
      ? t("menuTriggerLabel")
      : undefined);
  const triggerButton = (
    <Button
      className="react-aria-Button button-base"
      data-variant={variant}
      data-size={size}
      aria-label={triggerAriaLabel}
      aria-labelledby={ariaLabelledBy}
      // ADR-239 Preview 확인 — owner style (위치 · 폭 · 모양) 은 트리거 상자 (Canvas 가 그리는 Menu 상자, ADR-151 B7).
      //   종전 `{...props}` 로 MenuTrigger 에 넘겨 RAC 가 목록 (popover 안 Menu) 에 실었다 — 목록이 popover 밖 절대
      //   위치로 떨어지고 트리거는 문서 흐름 자리에 그려졌다.
      style={typeof style === "object" ? style : undefined}
    >
      {triggerLabel}
    </Button>
  );

  // ColumnMapping이 있으면 각 데이터 항목마다 MenuItem 렌더링
  // ListBox와 동일한 패턴: Element tree의 MenuItem 템플릿 + Field 자식 사용
  if (hasDataBinding && columnMapping) {
    // Loading 상태
    if (loading) {
      return (
        <MenuTrigger {...props}>
          {triggerButton}
          <Popover data-size={size}>
            <Menu className={getMenuClassName()} data-size={size}>
              <AriaMenuItem key="loading" textValue="Loading">
                {t("loadingData")}
              </AriaMenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      );
    }

    // Error 상태
    if (error) {
      return (
        <MenuTrigger {...props}>
          {triggerButton}
          <Popover data-size={size}>
            <Menu className={getMenuClassName()} data-size={size}>
              <AriaMenuItem key="error" textValue="Error">
                {t("errorWithMessage", { message: String(error) })}
              </AriaMenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      );
    }

    // 데이터가 있을 때: items prop 사용
    if (boundData.length > 0) {
      const menuItems = boundData.map((item, index) => {
        const itemId = String(item.id !== undefined ? item.id : index);
        return {
          id: itemId,
          label: String(
            item.label || item.text || item.name || `Item ${index + 1}`,
          ),
          isDisabled: Boolean(item.isDisabled),
          icon: item.icon as string | undefined,
          shortcut: item.shortcut as string | undefined,
          description: item.description as string | undefined,
          children: Array.isArray(item.children) ? item.children : undefined,
          ...item,
        };
      });

      // Recursive render function for menu items with submenus
      const renderMenuItem = (item: RuntimeMenuItem) => {
        const hasSubmenu = item.children && item.children.length > 0;

        if (hasSubmenu) {
          const submenuItems = item.children!.map(
            (child: RuntimeMenuItem, childIndex: number) => ({
              ...child,
              id: String(child.id || `${item.id}-${childIndex}`),
              label: String(
                child.label ||
                  (child as unknown as Record<string, unknown>).text ||
                  (child as unknown as Record<string, unknown>).name ||
                  `Item ${childIndex + 1}`,
              ),
              isDisabled: Boolean(child.isDisabled),
              icon: child.icon as string | undefined,
              shortcut: child.shortcut as string | undefined,
              description: child.description as string | undefined,
              children: Array.isArray(child.children)
                ? child.children
                : undefined,
            }),
          );

          return (
            <SubmenuTrigger>
              <AriaMenuItem textValue={item.label} isDisabled={item.isDisabled}>
                {renderMenuItemSlotParts(item, slotComposition)}
              </AriaMenuItem>
              <Popover data-size={size}>
                <Menu
                  items={submenuItems as Iterable<T>}
                  className={getMenuClassName()}
                  data-size={size}
                >
                  {(subItem) =>
                    renderMenuItem(subItem as unknown as RuntimeMenuItem)
                  }
                </Menu>
              </Popover>
            </SubmenuTrigger>
          );
        }

        return (
          <AriaMenuItem textValue={item.label} isDisabled={item.isDisabled}>
            {renderMenuItemSlotParts(item, slotComposition)}
          </AriaMenuItem>
        );
      };

      return (
        <MenuTrigger {...props}>
          {triggerButton}
          <Popover data-size={size}>
            <Menu
              items={menuItems as Iterable<T>}
              className={getMenuClassName()}
              data-size={size}
            >
              {(item) => renderMenuItem(item as unknown as RuntimeMenuItem)}
            </Menu>
          </Popover>
        </MenuTrigger>
      );
    }

    // 데이터 없음
    return (
      <MenuTrigger {...props}>
        {triggerButton}
        <Popover data-size={size}>
          <Menu className={getMenuClassName()} data-size={size}>
            {children}
          </Menu>
        </Popover>
      </MenuTrigger>
    );
  }

  // ADR-912 영역 B Task 3: dataBinding 경로 + 정적 items 경로를 resolvedRows 단일 source 로 통합.
  //   기존 dynamic(boundData) 경로와 정적 items 경로가 거의 동일한 submenu 재귀 render 를 중복 보유했다.
  //   useResolvedCollectionItems 가 두 source 를 같은 row 로 정규화하므로, row.item(raw RuntimeMenuItem
  //   호환)을 renderRuntimeMenuItem(onAction/href 지원 일반형) 단일 render 로 통일한다.
  //   (정적 items 의 `if (!hasDataBinding && items)` 분기 제거 = seam 0.)
  if (!loading && !error && resolvedRows.length > 0) {
    // row.item(raw) → RuntimeMenuItem. 정규화 itemKey/label 을 id/label 로 주입(누락 시 fallback).
    const menuItems: RuntimeMenuItem[] = resolvedRows.map((row) => {
      const raw = (row.item ?? {}) as Record<string, unknown>;
      return {
        ...(raw as object),
        id: row.itemKey,
        label: row.label,
        isDisabled: row.isDisabled,
      } as RuntimeMenuItem;
    });

    const renderRuntimeMenuItem = (item: RuntimeMenuItem): React.ReactNode => {
      const hasSubmenu = item.children && item.children.length > 0;

      const content = renderMenuItemSlotParts(item, slotComposition);

      if (hasSubmenu) {
        return (
          <SubmenuTrigger key={item.id}>
            <AriaMenuItem textValue={item.label} isDisabled={item.isDisabled}>
              {content}
            </AriaMenuItem>
            <Popover data-size={size}>
              <Menu
                items={item.children}
                className={getMenuClassName()}
                data-size={size}
              >
                {(subItem) => renderRuntimeMenuItem(subItem as RuntimeMenuItem)}
              </Menu>
            </Popover>
          </SubmenuTrigger>
        );
      }

      return (
        <AriaMenuItem
          key={item.id}
          id={item.id}
          textValue={item.label}
          isDisabled={item.isDisabled}
          href={item.href}
        >
          {content}
        </AriaMenuItem>
      );
    };

    return (
      <MenuTrigger {...props}>
        {triggerButton}
        <Popover data-size={size}>
          <Menu
            items={menuItems}
            className={getMenuClassName()}
            data-size={size}
            {...selectionMenuProps}
          >
            {(item) => renderRuntimeMenuItem(item as RuntimeMenuItem)}
          </Menu>
        </Popover>
      </MenuTrigger>
    );
  }

  // Static Children 또는 Loading/Error 상태
  return (
    <MenuTrigger {...props}>
      {triggerButton}
      <Popover data-size={size}>
        <Menu
          {...props}
          className={getMenuClassName()}
          data-size={size}
          {...selectionMenuProps}
        >
          {loading && (
            <AriaMenuItem key="loading" textValue="Loading">
              {t("loadingData")}
            </AriaMenuItem>
          )}
          {error && (
            <AriaMenuItem key="error" textValue="Error">
              {t("errorWithMessage", { message: String(error) })}
            </AriaMenuItem>
          )}
          {/* ADR-013 HC5 — 바인딩이 있고 행이 0 이면 정적 children 으로 되돌아가지 않는다
              (연결된 0건 ≠ 미연결 · Skia 와 대칭) */}
          {!loading &&
            !error &&
            !hasDataBinding &&
            (children as React.ReactNode)}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/**
 * ADR-239 Phase 3 — 하위 메뉴 한 칸 (RAC `SubmenuTrigger > MenuItem + Popover > Menu`, R4). items 경로 (`renderMenuItem`
 * · `renderRuntimeMenuItem`) 와 같은 구조 · 클래스 (`react-aria-Menu` + 호출자 className · `data-size`) — 정적 자식 경로 ·
 * 구조 (section) 경로가 이 부품 하나로 같은 DOM 을 낸다.
 */
export function MenuSubmenu({
  trigger,
  size = "M",
  className,
  children,
}: {
  /** 하위 메뉴를 여는 항목 (MenuItem). */
  trigger: React.ReactElement;
  size?: ComponentSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <SubmenuTrigger>
      {trigger}
      <Popover data-size={size}>
        <Menu
          className={
            className ? `react-aria-Menu ${className}` : "react-aria-Menu"
          }
          data-size={size}
        >
          {children}
        </Menu>
      </Popover>
    </SubmenuTrigger>
  );
}

export function MenuItem({
  shortcut,
  children,
  ...props
}: ExtendedMenuItemProps) {
  const textValue =
    props.textValue || (typeof children === "string" ? children : undefined);

  // 직접 지정된 shortcut 문자열 사용
  const shortcutDisplay = shortcut || null;

  return (
    <AriaMenuItem {...props} textValue={textValue}>
      {({ hasSubmenu }) => (
        <>
          <span className="menu-item-content">
            <span className="menu-item-label">{children}</span>
            {shortcutDisplay && (
              <kbd className="menu-item-shortcut">{shortcutDisplay}</kbd>
            )}
          </span>
          {/* ADR-239 Preview 확인 — 하위 메뉴 표식은 선 아이콘 · 항목 글자 크기 (catalog MenuItem size 별 fontSize).
              종전 크기 · 선 속성 없는 `<svg>` 는 채움 검정 81px 로 그려져 라벨을 밀었다 (Tree chevron 과 같은 lucide). */}
          {hasSubmenu && (
            <ChevronRightIcon
              className="chevron"
              size="1em"
              aria-hidden="true"
            />
          )}
        </>
      )}
    </AriaMenuItem>
  );
}
export { MenuItem as MyItem };
