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

import { useCollectionData } from "../hooks";
import "./styles/generated/Menu.css";

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
  extends Omit<
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
  ...props
}: MenuButtonProps<T>) {
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
  // useCollectionData Hook으로 데이터 가져오기 (Static, API, Supabase 통합)
  const {
    data: boundData,
    loading,
    error,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
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

  console.log("🎯 Menu 렌더링:", {
    hasDataBinding,
    loading,
    error,
    boundDataLength: boundData.length,
    boundData,
    childrenExists: !!children,
    hasColumnMapping: !!columnMapping,
  });

  // Menu className generator (reused across all conditional renders)
  // props.className can be string or function, so we extract string value if available
  const baseClassName =
    typeof props.className === "string" ? props.className : undefined;
  const getMenuClassName = () =>
    composeRenderProps(baseClassName, (className) =>
      className ? `react-aria-Menu ${className}` : "react-aria-Menu",
    );

  // ColumnMapping이 있으면 각 데이터 항목마다 MenuItem 렌더링
  // ListBox와 동일한 패턴: Element tree의 MenuItem 템플릿 + Field 자식 사용
  if (hasDataBinding && columnMapping) {
    console.log("🎯 Menu: columnMapping 감지 - 데이터로 아이템 렌더링", {
      columnMapping,
      hasChildren: !!children,
      dataCount: boundData.length,
    });

    // Loading 상태
    if (loading) {
      return (
        <MenuTrigger {...props}>
          <Button
            className="react-aria-Button button-base"
            data-variant={variant}
            data-size={size}
          >
            {label}
          </Button>
          <Popover data-size={size}>
            <Menu className={getMenuClassName()} data-size={size}>
              <AriaMenuItem key="loading" textValue="Loading">
                ⏳ 데이터 로딩 중...
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
            {label}
          </Button>
          <Popover data-size={size}>
            <Menu className={getMenuClassName()} data-size={size}>
              <AriaMenuItem key="error" textValue="Error">
                ❌ 오류: {error}
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

      console.log("✅ Menu with columnMapping - items:", menuItems);

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
                <span className="menu-item-content">
                  {item.icon && (
                    <span className="menu-item-icon">{item.icon}</span>
                  )}
                  <span className="menu-item-label">{item.label}</span>
                  {item.shortcut && (
                    <kbd className="menu-item-shortcut">{item.shortcut}</kbd>
                  )}
                </span>
                {item.description && (
                  <span className="menu-item-description">
                    {item.description}
                  </span>
                )}
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
            <span className="menu-item-content">
              {item.icon && <span className="menu-item-icon">{item.icon}</span>}
              <span className="menu-item-label">{item.label}</span>
              {item.shortcut && (
                <kbd className="menu-item-shortcut">{item.shortcut}</kbd>
              )}
            </span>
            {item.description && (
              <span className="menu-item-description">{item.description}</span>
            )}
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
            {label}
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
          {label}
        </Button>
        <Popover data-size={size}>
          <Menu className={getMenuClassName()} data-size={size}>
            {children}
          </Menu>
        </Popover>
      </MenuTrigger>
    );
  }

  // Dynamic Collection: items prop 사용 (columnMapping 없을 때)
  if (hasDataBinding && !loading && !error && boundData.length > 0) {
    const menuItems = boundData.map((item, index) => {
      const itemId = String(item.id !== undefined ? item.id : index);
      const processedItem = {
        id: itemId, // 고유 ID
        label: String(
          item.label || item.text || item.name || `Item ${index + 1}`,
        ),
        isDisabled: Boolean(item.isDisabled),
        icon: item.icon as string | undefined,
        shortcut: item.shortcut as string | undefined,
        description: item.description as string | undefined,
        children: Array.isArray(item.children) ? item.children : undefined, // 원본 children 유지
      };
      console.log("🔸 메뉴 아이템 변환:", {
        index,
        originalItem: item,
        processedItem,
      });
      return processedItem;
    });

    console.log("✅ Menu Dynamic Collection - items:", menuItems);
    console.log("✅ Menu items 개수:", menuItems.length);
    console.log(
      "✅ Menu items 상세:",
      menuItems.map((item) => ({
        id: item.id,
        label: item.label,
        hasChildren: !!item.children,
      })),
    );

    // Recursive render function for menu items with submenus
    const renderMenuItem = (item: (typeof menuItems)[0]) => {
      console.log("🔹 renderMenuItem 호출:", {
        id: item.id,
        label: item.label,
        hasChildren: !!item.children,
      });

      const hasSubmenu = item.children && item.children.length > 0;

      const content = (
        <>
          <span className="menu-item-content">
            {item.icon && <span className="menu-item-icon">{item.icon}</span>}
            <span className="menu-item-label">{item.label}</span>
            {item.shortcut && (
              <kbd className="menu-item-shortcut">{item.shortcut}</kbd>
            )}
          </span>
          {item.description && (
            <span className="menu-item-description">{item.description}</span>
          )}
        </>
      );

      if (hasSubmenu) {
        // Convert children to same format as parent items
        const submenuItems = item.children!.map(
          (child: Record<string, unknown>, childIndex: number) => ({
            id: String(child.id || `${item.id}-${childIndex}`),
            label: String(
              child.label ||
                child.text ||
                child.name ||
                `Item ${childIndex + 1}`,
            ),
            isDisabled: Boolean(child.isDisabled),
            icon: child.icon as string | undefined,
            shortcut: child.shortcut as string | undefined,
            description: child.description as string | undefined,
            children: Array.isArray(child.children)
              ? child.children
              : undefined,
            ...child,
          }),
        );

        console.log("🔹 서브메뉴 생성:", {
          parentId: item.id,
          submenuItemsCount: submenuItems.length,
        });

        return (
          <SubmenuTrigger>
            <AriaMenuItem textValue={item.label} isDisabled={item.isDisabled}>
              {content}
            </AriaMenuItem>
            <Popover>
              <Menu
                items={submenuItems}
                onAction={(key) => {
                  console.log("Submenu item selected:", key);
                }}
                className={getMenuClassName()}
                data-size={size}
              >
                {(subItem) => renderMenuItem(subItem)}
              </Menu>
            </Popover>
          </SubmenuTrigger>
        );
      }

      console.log("🔹 일반 메뉴 아이템 생성:", item.id);

      return (
        <AriaMenuItem textValue={item.label} isDisabled={item.isDisabled}>
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
          {label}
        </Button>
        <Popover>
          <Menu
            items={menuItems}
            onAction={(key) => {
              console.log("Menu item selected:", key);
              const selectedItem = menuItems.find((item) => item.id === key);
              console.log("Selected item data:", selectedItem);
              // 이벤트 핸들러 실행 가능
            }}
            className={getMenuClassName()}
            data-size={size}
            {...selectionMenuProps}
          >
            {(item) => renderMenuItem(item)}
          </Menu>
        </Popover>
      </MenuTrigger>
    );
  }

  // items SSOT 경로 (ADR-068 Phase 5): dataBinding 없고 items prop이 있을 때
  if (!hasDataBinding && items && items.length > 0) {
    const renderRuntimeMenuItem = (item: RuntimeMenuItem): React.ReactNode => {
      const hasSubmenu = item.children && item.children.length > 0;

      const content = (
        <>
          <span className="menu-item-content">
            {item.icon && <span className="menu-item-icon">{item.icon}</span>}
            <span className="menu-item-label">{item.label}</span>
            {item.shortcut && (
              <kbd className="menu-item-shortcut">{item.shortcut}</kbd>
            )}
          </span>
          {item.description && (
            <span className="menu-item-description">{item.description}</span>
          )}
        </>
      );

      if (hasSubmenu) {
        return (
          <SubmenuTrigger key={item.id}>
            <AriaMenuItem
              textValue={item.label}
              isDisabled={item.isDisabled}
              onAction={item.onAction}
            >
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
          onAction={item.onAction}
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
          {label}
        </Button>
        <Popover>
          <Menu
            items={items}
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
        {label}
      </Button>
      <Popover>
        <Menu {...props} className={getMenuClassName()} data-size={size} {...selectionMenuProps}>
          {loading && (
            <AriaMenuItem key="loading" textValue="Loading">
              ⏳ 데이터 로딩 중...
            </AriaMenuItem>
          )}
          {error && (
            <AriaMenuItem key="error" textValue="Error">
              ❌ 오류: {error}
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
