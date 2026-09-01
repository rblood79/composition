import {
  Button,
  Menu,
  MenuItem as AriaMenuItem,
  MenuItemProps,
  MenuProps,
  MenuTrigger,
  MenuTriggerProps,
  Popover,
  Selection,
  SubmenuTrigger,
  composeRenderProps,
} from "react-aria-components";
import type {
  ComponentSize,
  DataBinding,
  ColumnMapping,
  DataBindingValue,
} from "../types";
import type { RuntimeMenuItem } from "@composition/specs";

import { useResolvedCollectionItems } from "../hooks";
// ADR-148 Phase 4 — MenuItem slot 구성 소비 (origin slot 자식의 존재 gating / 스타일 overlay).
import {
  isSlotEnabled,
  type SlotComposition,
  type SlotRole,
} from "../catalog/slotRoles";
import "./styles/generated/Menu.css";
import "./styles/Menu.css";
import { useComponentStrings } from "../i18n";

/**
 * Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 *
 * Phase 5 (ADR-068): items SSOT 경로 추가
 * - MenuItem interface 제거 → RuntimeMenuItem (specs) 사용
 * - MenuButtonProps.items: RuntimeMenuItem[] 추가
 * - dataBinding 없음 → items prop 소비
 */

export interface MenuButtonProps<T>
  extends
    Omit<
      MenuProps<T>,
      "items" | "selectionMode" | "selectedKeys" | "onSelectionChange"
    >,
    Omit<MenuTriggerProps, "children"> {
  label?: string;
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  /** items SSOT 경로 (ADR-068 Phase 5): CollectionRenderers가 StoredMenuItem[] → RuntimeMenuItem[] 변환 후 전달 */
  items?: RuntimeMenuItem[];
  // M3 props
  variant?: string;
  size?: ComponentSize;
  /** ADR-073 Task 7: selection wiring — RAC Menu selectionMode */
  selectionMode?: "none" | "single" | "multiple";
  /** ADR-073 Task 7: controlled selected keys (string[]) — passed as Set to RAC Menu */
  selectedKeys?: string[];
  /** ADR-073 Task 7: selection change callback */
  onSelectionChange?: (keys: string[]) => void;
  /**
   * ADR-148 Phase 4 — MenuItem slot 구성 (origin `component-menu-item-default` 자식에서
   * 파생, provider 가 renderMenu 경유로 주입). null/미주입 = legacy 문서 → 기존 동작.
   */
  slotComposition?: SlotComposition | null;
}

/**
 * ADR-148 Phase 4: MenuItem slot 콘텐츠 — icon/label/shortcut(content 행) + description
 * (2번째 행) 을 slot 구성으로 **존재 gating**(구성에 없는 slot 은 데이터가 있어도 미 emit —
 * origin 에서 slot 자식을 지우면 사라진다) + **스타일 overlay**(slot 자식 props.style) 소비.
 * 행 배치(icon|label|shortcut 한 행 / description 아래 행)는 Menu markup 구조 고정 —
 * 순서 축은 content 행 구조상 소비하지 않는다 (ListBox 의 icon 고정 배치와 동형 판정).
 * null 이면 기존 동작(BC).
 */
export function renderMenuItemSlotParts(
  item: Pick<RuntimeMenuItem, "icon" | "label" | "shortcut" | "description">,
  slotComposition?: SlotComposition | null,
): React.ReactNode {
  const styleOf = (role: SlotRole): React.CSSProperties | undefined =>
    slotComposition?.slots[role]?.style as React.CSSProperties | undefined;
  return (
    <>
      <span className="menu-item-content">
        {isSlotEnabled(slotComposition, "icon") && item.icon && (
          <span className="menu-item-icon" style={styleOf("icon")}>
            {item.icon}
          </span>
        )}
        {isSlotEnabled(slotComposition, "label") && (
          <span className="menu-item-label" style={styleOf("label")}>
            {item.label}
          </span>
        )}
        {isSlotEnabled(slotComposition, "shortcut") && item.shortcut && (
          <kbd className="menu-item-shortcut" style={styleOf("shortcut")}>
            {item.shortcut}
          </kbd>
        )}
      </span>
      {isSlotEnabled(slotComposition, "description") && item.description && (
        <span className="menu-item-description" style={styleOf("description")}>
          {item.description}
        </span>
      )}
    </>
  );
}

export function MenuButton<T extends object>({
  label,
  children,
  dataBinding,
  columnMapping,
  items,
  variant = "primary",
  size = "md",
  selectionMode,
  selectedKeys,
  onSelectionChange,
  slotComposition,
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

  // ColumnMapping이 있으면 각 데이터 항목마다 MenuItem 렌더링
  // ListBox와 동일한 패턴: Element tree의 MenuItem 템플릿 + Field 자식 사용
  if (hasDataBinding && columnMapping) {
    // Loading 상태
    if (loading) {
      return (
        <MenuTrigger {...props}>
          <Button
            className="react-aria-Button button-base"
            data-variant={variant}
            data-size={size}
          >
            {triggerLabel}
          </Button>
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
          <Button
            className="react-aria-Button button-base"
            data-variant={variant}
            data-size={size}
          >
            {triggerLabel}
          </Button>
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
          <Button
            className="react-aria-Button button-base"
            data-variant={variant}
            data-size={size}
          >
            {triggerLabel}
          </Button>
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
        <Button
          className="react-aria-Button button-base"
          data-variant={variant}
          data-size={size}
        >
          {triggerLabel}
        </Button>
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
        <Button
          className="react-aria-Button button-base"
          data-variant={variant}
          data-size={size}
        >
          {triggerLabel}
        </Button>
        <Popover>
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
      <Button
        className="react-aria-Button button-base"
        data-variant={variant}
        data-size={size}
      >
        {triggerLabel}
      </Button>
      <Popover>
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
          {!loading && !error && (children as React.ReactNode)}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export interface ExtendedMenuItemProps extends Omit<MenuItemProps, "children"> {
  children?: React.ReactNode;
  /** 직접 지정하는 단축키 문자열 */
  shortcut?: string;
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
          {hasSubmenu && (
            <svg className="chevron" viewBox="0 0 24 24">
              <path d="m9 18 6-6-6-6" />
            </svg>
          )}
        </>
      )}
    </AriaMenuItem>
  );
}

export { MenuItem as MyItem };
