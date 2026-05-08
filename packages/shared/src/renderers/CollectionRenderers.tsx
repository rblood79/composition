import React from "react";
import {
  Tree,
  TreeItem,
  TagGroup,
  Tag,
  ToggleButtonGroup,
  ToggleButton,
  MenuButton,
  MenuItem,
  Toolbar,
} from "../components/list";
import {
  MenuSection as AriaMenuSection,
  Header as AriaMenuHeader,
  Separator as AriaMenuSeparator,
} from "react-aria-components";
import { DataField } from "../components/Field";
import type {
  PreviewElement,
  RenderContext,
  ColumnMapping,
  DataBinding,
} from "../types";
import type {
  StoredMenuItem,
  StoredMenuEntry,
  RuntimeMenuItem,
  StoredTagItem,
} from "@composition/specs";
import { isMenuSectionEntry, isMenuSeparatorEntry } from "@composition/specs";
import { getSelectedChildIds } from "./selection";
import { getElementDataBinding } from "../utils/legacyExtensionFields";

/**
 * Stored → Runtime 변환 (Q11=나: EVENT_REGISTRY에 직접 의존 금지)
 * resolveActionId는 RenderContext를 통해 주입받음
 */
function toRuntimeMenuItem(
  item: StoredMenuItem,
  resolve?: (id: string) => (() => void) | undefined,
): RuntimeMenuItem {
  return {
    ...item,
    onAction: item.onActionId ? resolve?.(item.onActionId) : undefined,
    children: item.children?.map((c) => toRuntimeMenuItem(c, resolve)),
  };
}

/**
 * Collection 관련 컴포넌트 렌더러
 * - Tree, TreeItem
 * - TagGroup, Tag
 * - ToggleButtonGroup, ToggleButton
 * - Menu, Toolbar
 */

/** srcdoc iframe에서 origin이 'null'이 되므로 '*' fallback */
function getTargetOrigin(): string {
  const origin = window.location.origin;
  if (!origin || origin === "null") return "*";
  return origin;
}

/**
 * Tree 렌더링
 */
export const renderTree = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const treeItemChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "TreeItem");

  const renderTreeItemsRecursively = (
    items: PreviewElement[],
  ): React.ReactNode => {
    return items.map((item) => {
      const itemChildren = context.childrenByParent.get(item.id) ?? [];
      const childTreeItems = itemChildren.filter(
        (child) => child.type === "TreeItem",
      );
      const otherChildren = itemChildren.filter(
        (child) => child.type !== "TreeItem",
      );

      const displayTitle = String(
        item.props.title ||
          item.props.label ||
          item.props.value ||
          item.props.children ||
          `Item ${item.id}`,
      );

      const hasChildren = childTreeItems.length > 0;

      return (
        <TreeItem
          key={item.id}
          data-element-id={item.id}
          id={item.id}
          title={displayTitle}
          hasChildren={hasChildren}
          showInfoButton={false}
          style={item.props.style}
          className={item.props.className}
          children={otherChildren.map((child) => context.renderElement(child))}
          childItems={
            hasChildren ? renderTreeItemsRecursively(childTreeItems) : undefined
          }
        />
      );
    });
  };

  return (
    <Tree
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      dataBinding={getElementDataBinding(element) as DataBinding | undefined}
      style={element.props.style}
      className={element.props.className}
      aria-label={String(
        element.props["aria-label"] || element.props.label || "Tree",
      )}
      selectionMode={
        (element.props.selectionMode as "none" | "single" | "multiple") ||
        "single"
      }
      selectionBehavior={
        (element.props.selectionBehavior as "replace" | "toggle") || "replace"
      }
      expandedKeys={
        Array.isArray(element.props.expandedKeys)
          ? (element.props.expandedKeys as unknown as string[])
          : []
      }
      defaultExpandedKeys={
        Array.isArray(element.props.defaultExpandedKeys)
          ? (element.props.defaultExpandedKeys as unknown as string[])
          : []
      }
      selectedKeys={
        Array.isArray(element.props.selectedKeys)
          ? (element.props.selectedKeys as unknown as string[])
          : []
      }
      defaultSelectedKeys={
        Array.isArray(element.props.defaultSelectedKeys)
          ? (element.props.defaultSelectedKeys as unknown as string[])
          : []
      }
      onSelectionChange={(selectedKeys) => {
        const updatedProps = {
          ...element.props,
          selectedKeys: Array.from(selectedKeys),
        };
        updateElementProps(element.id, updatedProps);
      }}
      onExpandedChange={(expandedKeys) => {
        const updatedProps = {
          ...element.props,
          expandedKeys: Array.from(expandedKeys),
        };
        updateElementProps(element.id, updatedProps);
      }}
    >
      {renderTreeItemsRecursively(treeItemChildren)}
    </Tree>
  );
};

/**
 * TreeItem 렌더링 (독립적으로 렌더링될 때)
 */
export const renderTreeItem = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const ownChildren = context.childrenByParent.get(element.id) ?? [];
  const childTreeItems = ownChildren.filter(
    (child) => child.type === "TreeItem",
  );
  const otherChildren = ownChildren.filter(
    (child) => child.type !== "TreeItem",
  );

  const displayTitle = String(
    element.props.title ||
      element.props.label ||
      element.props.value ||
      element.props.children ||
      `Item ${element.id}`,
  );

  const hasChildren = childTreeItems.length > 0;

  return (
    <TreeItem
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      title={displayTitle}
      hasChildren={hasChildren}
      showInfoButton={true}
      children={otherChildren.map((child) => context.renderElement(child))}
      childItems={
        hasChildren
          ? childTreeItems.map((childItem) => context.renderElement(childItem))
          : undefined
      }
    />
  );
};

/**
 * TagGroup 렌더링
 */
export const renderTagGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { elements, childrenByParent, updateElementProps, setElements } =
    context;

  // Tag 자식 검색: TagGroup 직접 자식 또는 TagList 중간 레이어 하위 모두 지원
  const tagListChild = childrenByParent
    .get(element.id)
    ?.find((child) => child.type === "TagList");
  const tagParentId = tagListChild ? tagListChild.id : element.id;
  const tagChildren =
    childrenByParent
      .get(tagParentId)
      ?.filter((child) => child.type === "Tag") ?? [];

  // ColumnMapping 추출
  const columnMapping = (element.props as { columnMapping?: ColumnMapping })
    .columnMapping;

  // PropertyDataBinding 형식 감지 (source: 'dataTable' 또는 'apiEndpoint', name: 'xxx')
  const dataBinding = getElementDataBinding(element);
  const isPropertyBinding =
    dataBinding &&
    typeof dataBinding === "object" &&
    "source" in (dataBinding as object) &&
    "name" in (dataBinding as object) &&
    !("type" in (dataBinding as object));

  // Tag 템플릿에 Field children이 있는지 미리 확인
  const tagTemplate = tagChildren.length > 0 ? tagChildren[0] : null;
  const fieldChildrenInTemplate = tagTemplate
    ? (childrenByParent
        .get(tagTemplate.id)
        ?.filter((c) => c.type === "Field") ?? [])
    : [];
  const hasFieldChildren = fieldChildrenInTemplate.length > 0;

  // columnMapping이 있거나, (PropertyDataBinding + Field children) 있으면 Field 렌더링 모드 사용
  const hasValidTemplate =
    (columnMapping || (isPropertyBinding && hasFieldChildren)) &&
    tagChildren.length > 0;

  // ADR-097 P2: items[] SSOT canonical path
  //   Select/ComboBox/ListBox(ADR-073/076) 와 동일 패턴. migration 이후 Tag element tree 는
  //   제거되고 element.props.items 로 이전됨 — Path 2 가 기본 경로.
  const storedTagItems = (element.props as { items?: StoredTagItem[] }).items;
  const hasItemsArray =
    Array.isArray(storedTagItems) && storedTagItems.length > 0;

  // ADR-097 혼합 감지 — 부모 단위 원자성 위배 (ADR-076 선례 동일). Path 1 우선.
  if (hasValidTemplate && hasItemsArray) {
    console.warn(
      `[ADR-097] TagGroup ${element.id}: columnMapping/dataBinding 템플릿과 props.items 가 동시 존재. ` +
        `부모 단위 원자성 위배 — Path 1 템플릿 우선, items 무시. ` +
        `applyCollectionItemsMigration 재실행 또는 수동 분리 필요.`,
    );
  }

  // 제거된 항목 ID 추적 (columnMapping 모드에서 동적 데이터 항목 제거용)
  const removedItemIds = Array.isArray(element.props.removedItemIds)
    ? (element.props.removedItemIds as unknown as string[])
    : [];

  const renderChildren = hasValidTemplate
    ? (item: Record<string, unknown>) => {
        const tagTemplate = tagChildren[0];
        const fieldChildren =
          context.childrenByParent
            .get(tagTemplate.id)
            ?.filter((child) => child.type === "Field") ?? [];

        return (
          <Tag
            key={String(item.id)}
            data-element-id={tagTemplate.id}
            isDisabled={Boolean(tagTemplate.props.isDisabled)}
            style={tagTemplate.props.style}
            className={tagTemplate.props.className}
          >
            {fieldChildren.length > 0
              ? fieldChildren.map((field) => {
                  // fieldKey 또는 key 속성 모두 지원 (fieldKey 우선)
                  const fieldKey =
                    (field.props as { fieldKey?: string; key?: string })
                      .fieldKey || (field.props as { key?: string }).key;
                  const fieldValue = fieldKey ? item[fieldKey] : undefined;

                  return (
                    <DataField
                      key={field.id}
                      fieldKey={fieldKey || ""}
                      label={(field.props as { label?: string }).label}
                      type={
                        (field.props as { type?: string }).type as
                          | "string"
                          | "number"
                          | "boolean"
                          | "date"
                          | "image"
                          | "url"
                          | "email"
                      }
                      value={fieldValue}
                      visible={
                        (field.props as { visible?: boolean }).visible !== false
                      }
                      style={field.props.style}
                      className={field.props.className}
                    />
                  );
                })
              : String(tagTemplate.props.children || "")}
          </Tag>
        );
      }
    : hasItemsArray
      ? // ADR-097 P2 (NEW): items[] SSOT canonical. Select/ComboBox/ListBox Path 2 와 대칭.
        storedTagItems!.map((item) => (
          <Tag
            key={item.id}
            id={item.id}
            data-element-id={element.id}
            isDisabled={Boolean(item.isDisabled)}
          >
            {item.label}
          </Tag>
        ))
      : // Path 3 (legacy, P6 소멸 예정): Tag element tree fallback
        tagChildren.map((type) => (
          <Tag
            key={type.id}
            data-element-id={type.id}
            isDisabled={Boolean(type.props.isDisabled)}
            style={type.props.style}
            className={type.props.className}
          >
            {String(type.props.children || "")}
          </Tag>
        ));

  return (
    <TagGroup
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      className={element.props.className}
      style={element.props.style as React.CSSProperties | undefined}
      variant={String(element.props.variant || "default")}
      label={String(element.props.label || "")}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      allowsRemoving={Boolean(element.props.allowsRemoving)}
      selectionMode={
        (element.props.selectionMode as "none" | "single" | "multiple") ||
        "none"
      }
      selectionBehavior={
        (element.props.selectionBehavior as "toggle" | "replace") || "toggle"
      }
      selectedKeys={
        Array.isArray(element.props.selectedKeys)
          ? (element.props.selectedKeys as unknown as string[])
          : []
      }
      orientation={
        (element.props.orientation as "horizontal" | "vertical") || "horizontal"
      }
      isDisabled={Boolean(element.props.isDisabled)}
      disallowEmptySelection={Boolean(element.props.disallowEmptySelection)}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      maxRows={
        typeof element.props.maxRows === "number"
          ? element.props.maxRows
          : undefined
      }
      dataBinding={getElementDataBinding(element) as DataBinding | undefined}
      columnMapping={columnMapping}
      removedItemIds={removedItemIds}
      onSelectionChange={async (selectedKeys) => {
        const updatedProps = {
          ...element.props,
          selectedKeys: Array.from(selectedKeys),
        };
        updateElementProps(element.id, updatedProps);

        window.parent.postMessage(
          {
            type: "UPDATE_ELEMENT_PROPS",
            elementId: element.id,
            props: {
              selectedKeys: Array.from(selectedKeys),
            },
            merge: true,
          },
          getTargetOrigin(),
        );
      }}
      onRemove={async (keys) => {
        console.log("Removing tags:", Array.from(keys));

        const keysToRemove = Array.from(keys).map(String);

        // ColumnMapping 모드: 동적 데이터 항목 제거 (removedItemIds에 추가)
        if (hasValidTemplate) {
          const currentRemovedIds = Array.isArray(element.props.removedItemIds)
            ? (element.props.removedItemIds as unknown as string[])
            : [];

          const updatedRemovedIds = [...currentRemovedIds, ...keysToRemove];

          const currentSelectedKeys = Array.isArray(element.props.selectedKeys)
            ? (element.props.selectedKeys as unknown as string[])
            : [];
          const updatedSelectedKeys = currentSelectedKeys.filter(
            (key) => !keysToRemove.includes(String(key)),
          );

          const updatedProps = {
            ...element.props,
            removedItemIds: updatedRemovedIds,
            selectedKeys: updatedSelectedKeys,
          };

          updateElementProps(element.id, updatedProps);

          window.parent.postMessage(
            {
              type: "UPDATE_ELEMENT_PROPS",
              elementId: element.id,
              props: {
                removedItemIds: updatedRemovedIds,
                selectedKeys: updatedSelectedKeys,
              },
              merge: true,
            },
            getTargetOrigin(),
          );

          return;
        }

        // ADR-097 P2: items[] SSOT 모드 — props.items 에서 해당 id 제거
        if (hasItemsArray) {
          const updatedItems = (storedTagItems ?? []).filter(
            (item) => !keysToRemove.includes(String(item.id)),
          );

          const currentSelectedKeys = Array.isArray(element.props.selectedKeys)
            ? (element.props.selectedKeys as unknown as string[])
            : [];
          const updatedSelectedKeys = currentSelectedKeys.filter(
            (key) => !keysToRemove.includes(String(key)),
          );

          const updatedProps = {
            ...element.props,
            items: updatedItems,
            selectedKeys: updatedSelectedKeys,
          };

          updateElementProps(element.id, updatedProps);

          window.parent.postMessage(
            {
              type: "UPDATE_ELEMENT_PROPS",
              elementId: element.id,
              props: {
                items: updatedItems,
                selectedKeys: updatedSelectedKeys,
              },
              merge: true,
            },
            getTargetOrigin(),
          );

          return;
        }

        // Path 3 (legacy, P6 소멸): Element 삭제
        const deletedTagIds: string[] = [];

        for (const key of keysToRemove) {
          let tagId = key;
          if (typeof key === "string" && key.startsWith("react-aria-")) {
            const index = parseInt(key.replace("react-aria-", "")) - 1;
            const tagToRemove = tagChildren[index];
            if (tagToRemove) {
              tagId = tagToRemove.id;
            }
          }

          deletedTagIds.push(String(tagId));
        }

        const currentElements = elements;
        const updatedElements = currentElements.filter(
          (el) => !deletedTagIds.includes(el.id),
        );

        const currentSelectedKeys = Array.isArray(element.props.selectedKeys)
          ? (element.props.selectedKeys as unknown as string[])
          : [];
        const updatedSelectedKeys = currentSelectedKeys.filter(
          (key) => !keysToRemove.includes(String(key)),
        );

        const updatedProps = {
          ...element.props,
          selectedKeys: updatedSelectedKeys,
        };

        setElements(updatedElements);
        updateElementProps(element.id, updatedProps);
      }}
    >
      {renderChildren}
    </TagGroup>
  );
};

/**
 * Tag 렌더링 (독립적으로 렌더링될 때)
 * - Static children 또는 Field children 지원
 */
export const renderTag = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  // Field 자식 요소 찾기
  const fieldChildren = (context.childrenByParent.get(element.id) ?? []).filter(
    (child) => child.type === "Field",
  );

  // Field children이 있으면 DataField 렌더링 (단, 데이터는 없으므로 라벨만 표시)
  if (fieldChildren.length > 0) {
    return (
      <Tag
        key={element.id}
        id={element.customId}
        data-element-id={element.id}
        isDisabled={Boolean(element.props.isDisabled)}
        style={element.props.style}
        className={element.props.className}
        textValue={String(
          element.props.textValue || element.props.children || "",
        )}
      >
        {fieldChildren.map((field) => {
          const fieldKey =
            (field.props as { fieldKey?: string; key?: string }).fieldKey ||
            (field.props as { key?: string }).key;
          return (
            <DataField
              key={field.id}
              fieldKey={fieldKey || ""}
              label={(field.props as { label?: string }).label}
              type={
                (field.props as { type?: string }).type as
                  | "string"
                  | "number"
                  | "boolean"
                  | "date"
                  | "image"
                  | "url"
                  | "email"
              }
              value={`{${fieldKey}}`} // 템플릿 모드에서 fieldKey 표시
              showLabel={
                (field.props as { showLabel?: boolean }).showLabel !== false
              }
              visible={(field.props as { visible?: boolean }).visible !== false}
              style={field.props.style}
              className={field.props.className}
            />
          );
        })}
      </Tag>
    );
  }

  // Field children이 없으면 기존 static 렌더링
  return (
    <Tag
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      isDisabled={Boolean(element.props.isDisabled)}
      style={element.props.style}
      className={element.props.className}
      textValue={String(element.props.children || "")}
    >
      {String(element.props.children || "")}
    </Tag>
  );
};

/**
 * ToggleButtonGroup 렌더링
 */
export const renderToggleButtonGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { batchUpdateElementProps } = context;

  const orientation = element.props.orientation as "horizontal" | "vertical";
  const indicator = Boolean(element.props.indicator);

  const toggleButtonChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "ToggleButton");

  const selectedKeys = new Set<string>(
    getSelectedChildIds(toggleButtonChildren),
  );

  return (
    <ToggleButtonGroup
      key={element.id}
      data-custom-id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      orientation={orientation}
      selectionMode={element.props.selectionMode as "single" | "multiple"}
      indicator={indicator}
      isEmphasized={Boolean(element.props.isEmphasized)}
      isQuiet={Boolean(element.props.isQuiet)}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      selectedKeys={selectedKeys}
      onSelectionChange={(keys) => {
        const nextKeys = new Set(Array.from(keys).map((k) => String(k)));
        const batch: Array<{ id: string; props: Record<string, unknown> }> = [];
        toggleButtonChildren.forEach((child) => {
          const shouldBeSelected = nextKeys.has(child.id);
          if (Boolean(child.props.isSelected) !== shouldBeSelected) {
            batch.push({
              id: child.id,
              props: { ...child.props, isSelected: shouldBeSelected },
            });
          }
        });
        if (batch.length > 0) batchUpdateElementProps(batch);
      }}
    >
      {toggleButtonChildren.map((toggleButton) =>
        context.renderElement(toggleButton),
      )}
    </ToggleButtonGroup>
  );
};

/**
 * ToggleButton 렌더링
 */
export const renderToggleButton = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { elementsById, updateElementProps } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  const isInGroup = element.parent_id
    ? elementsById.get(element.parent_id)?.type === "ToggleButtonGroup"
    : false;

  // id는 element.id — group의 selectedKeys Set과 키 일치 필수.
  return (
    <ToggleButton
      key={element.id}
      id={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      isSelected={Boolean(element.props.isSelected)}
      defaultSelected={
        typeof element.props.defaultSelected === "boolean"
          ? element.props.defaultSelected
          : undefined
      }
      isDisabled={Boolean(element.props.isDisabled)}
      isEmphasized={Boolean(element.props.isEmphasized)}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      style={element.props.style}
      className={element.props.className}
      onPress={
        isInGroup
          ? undefined
          : () => {
              updateElementProps(element.id, {
                ...element.props,
                isSelected: !element.props.isSelected,
              });
            }
      }
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
      {children.map((child) => context.renderElement(child, child.id))}
    </ToggleButton>
  );
};

/**
 * Menu 렌더링
 * items SSOT 경로: element.props.items (StoredMenuItem[]) → RuntimeMenuItem[] 변환 후 MenuButton에 전달
 * dataBinding 경로: useCollectionData 결과 사용 (기존 유지)
 */
export const renderMenu = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const entries = (element.props.items ?? []) as StoredMenuEntry[];

  // ADR-099 Addendum 099-f Part 2: section/separator 분기 감지
  // section 또는 separator entry 가 하나라도 있으면 children 경로 사용
  const hasStructuredEntries = entries.some(
    (e) => isMenuSectionEntry(e) || isMenuSeparatorEntry(e),
  );

  // React 19: `key` 는 props spread 로 전달 불가 — JSX 에서 직접 명시.
  const commonProps = {
    id: element.customId,
    "data-element-id": element.id,
    label: String(element.props.label || element.props.children || "Menu"),
    variant: (element.props.variant as string) || "primary",
    size: (element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || "md",
    style: element.props.style,
    className: element.props.className,
    dataBinding: getElementDataBinding(element) as DataBinding | undefined,
    selectionMode: (
      element.props as { selectionMode?: "none" | "single" | "multiple" }
    ).selectionMode,
    selectedKeys: (element.props as { selectedKeys?: string[] }).selectedKeys,
    onSelectionChange: (keys: string[]) => {
      updateElementProps(element.id, {
        ...element.props,
        selectedKeys: keys,
      });
    },
  } as const;

  if (hasStructuredEntries) {
    // section/separator 포함 — children 경로 (MenuButton static children fallback)
    // RAC D1: MenuSection / Header / Separator 공식 API 사용
    const renderMenuLeaf = (item: StoredMenuItem): React.ReactNode => (
      <MenuItem
        key={item.id}
        id={item.id}
        textValue={item.textValue ?? item.label}
        isDisabled={Boolean(item.isDisabled)}
        href={item.href}
      >
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
      </MenuItem>
    );

    const menuChildren = entries.map((entry) => {
      if (isMenuSectionEntry(entry)) {
        return (
          <AriaMenuSection
            key={entry.id}
            aria-label={entry.ariaLabel ?? entry.header}
            selectionMode={entry.selectionMode}
            selectedKeys={
              entry.selectedKeys ? new Set(entry.selectedKeys) : undefined
            }
            defaultSelectedKeys={
              entry.defaultSelectedKeys
                ? new Set(entry.defaultSelectedKeys)
                : undefined
            }
          >
            <AriaMenuHeader>{entry.header}</AriaMenuHeader>
            {entry.items.map(renderMenuLeaf)}
          </AriaMenuSection>
        );
      }
      if (isMenuSeparatorEntry(entry)) {
        return <AriaMenuSeparator key={entry.id} />;
      }
      // default: StoredMenuItem
      return renderMenuLeaf(entry as StoredMenuItem);
    });

    return (
      <MenuButton key={element.id} {...commonProps}>
        {menuChildren}
      </MenuButton>
    );
  }

  // items-only 경로 (기존 동작 유지 — BC 0%)
  const runtime = (entries as StoredMenuItem[]).map((it) =>
    toRuntimeMenuItem(it, context.resolveActionId),
  );

  return <MenuButton key={element.id} {...commonProps} items={runtime} />;
};

/**
 * MenuItem 렌더링
 */
export const renderMenuItem = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <MenuItem
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      textValue={String(
        element.props.textValue || element.props.children || "",
      )}
      isDisabled={Boolean(element.props.isDisabled)}
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
      {children.map((child) => renderElement(child, child.id))}
    </MenuItem>
  );
};

/**
 * Toolbar 렌더링
 */
export const renderToolbar = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Toolbar
      key={element.id}
      data-custom-id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      aria-label={String(element.props["aria-label"] || "Toolbar")}
    >
      {children.map((child) => renderElement(child, child.id))}
    </Toolbar>
  );
};
