import React from "react";
import {
  ListBox,
  ListBoxItem,
  GridList,
  GridListItem,
  Select,
  SelectItem,
  ComboBox,
  ComboBoxItem,
  Slider,
} from "../components/list";
import {
  ListBoxSection as AriaListBoxSection,
  Header as AriaHeader,
  GridListSection as AriaGridListSection,
  GridListHeader as AriaGridListHeader,
} from "react-aria-components";
import { DataField } from "../components/Field";
import type {
  PreviewElement,
  RenderContext,
  ColumnMapping,
  DataBinding,
} from "../types";
import type {
  StoredSelectItem,
  StoredComboBoxItem,
  StoredListBoxItem,
  StoredListBoxEntry,
  StoredGridListItem,
  StoredGridListEntry,
} from "@composition/specs";
import {
  isListBoxSectionEntry,
  isGridListSectionEntry,
} from "@composition/specs";
import { getElementDataBinding } from "../utils/compositionExtensionFields";

/**
 * Selection 관련 컴포넌트 렌더러
 * - ListBox, ListBoxItem
 * - GridList, GridListItem
 * - Select, SelectItem
 * - ComboBox, ComboBoxItem
 * - Slider
 */

/** srcdoc iframe에서 origin이 'null'이 되므로 '*' fallback */
function getTargetOrigin(): string {
  const origin = window.location.origin;
  if (!origin || origin === "null") return "*";
  return origin;
}

// Field Elements 생성 요청 추적 (중복 방지)
const fieldCreationRequestedRef = React.createRef<Set<string>>();
if (!fieldCreationRequestedRef.current) {
  (fieldCreationRequestedRef as React.MutableRefObject<Set<string>>).current =
    new Set();
}

/**
 * ListBox 렌더링
 */
export const renderListBox = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  // 실제 ListBoxItem 자식 요소들을 찾기
  const listBoxChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "ListBoxItem");

  // ColumnMapping이 있고 visible columns가 있으면 Field Elements 자동 생성
  const columnMapping = (element.props as { columnMapping?: ColumnMapping })
    .columnMapping;

  // PropertyDataBinding 형식 감지 (source: 'dataTable', name: 'xxx')
  const dataBinding = getElementDataBinding(element);
  const isPropertyBinding =
    dataBinding &&
    typeof dataBinding === "object" &&
    "source" in (dataBinding as object) &&
    "name" in (dataBinding as object) &&
    !("type" in (dataBinding as object));

  // ADR-076: Path 1 (템플릿, 영구 유지) — columnMapping 또는 PropertyDataBinding + ListBoxItem 자식 존재
  const hasValidTemplate =
    (columnMapping || isPropertyBinding) && listBoxChildren.length > 0;

  // ADR-076: Path 2 (items canonical) — props.items 배열 존재
  const storedItems = (element.props as { items?: StoredListBoxItem[] }).items;
  const hasItemsArray = Array.isArray(storedItems) && storedItems.length > 0;

  // ADR-076 혼합 감지 — 부모 단위 원자성 위배. Path 1 우선 (BC 보수적)
  if (hasValidTemplate && hasItemsArray) {
    console.warn(
      `[ADR-076] ListBox ${element.id}: columnMapping/dataBinding 템플릿과 props.items 가 동시 존재. ` +
        `부모 단위 원자성 위배 — Path 1 템플릿 우선, items 무시. ` +
        `applyCollectionItemsMigration 재실행 또는 수동 분리 필요.`,
    );
  }

  // ADR-076: Path 3 감지 (legacy 정적 children fallback) — items 없고 ListBoxItem 자식만 존재
  // Path 2/3 canonical contract — selectedKey/selectedKeys 우선, legacy selectedIndex/Indices 변환
  const computeDefaultSelectedKeys = (
    items?: ReadonlyArray<StoredListBoxItem>,
  ): string[] => {
    const p = element.props as {
      selectedKeys?: unknown;
      selectedKey?: unknown;
      selectedIndices?: unknown;
      selectedIndex?: unknown;
    };
    if (Array.isArray(p.selectedKeys) && p.selectedKeys.length > 0) {
      return p.selectedKeys.map(String);
    }
    if (typeof p.selectedKey === "string" && p.selectedKey.length > 0) {
      return [p.selectedKey];
    }
    // legacy index 변환 (items 필요)
    if (items && items.length > 0) {
      if (Array.isArray(p.selectedIndices) && p.selectedIndices.length > 0) {
        return (p.selectedIndices as unknown[])
          .map((idx) => (typeof idx === "number" ? items[idx]?.id : undefined))
          .filter((key): key is string => typeof key === "string");
      }
      if (typeof p.selectedIndex === "number") {
        const key = items[p.selectedIndex]?.id;
        return key ? [key] : [];
      }
    }
    return [];
  };

  // 공통 ListBox props (3-path 공유)
  const onSelectionChange = (selectedKeys: Iterable<string | number>) => {
    const keys = Array.from(selectedKeys).map(String);
    const updatedProps = {
      ...element.props,
      selectedKeys: keys,
      selectedKey: keys[0],
    };
    updateElementProps(element.id, updatedProps);

    const eventHandlerMap = context.services?.createEventHandlerMap?.(
      element,
      context,
    );
    const customHandler = eventHandlerMap?.["onSelectionChange"] as
      | ((value: unknown) => void)
      | undefined;
    customHandler?.(selectedKeys);
  };

  // Path 1: 템플릿 모드 — 영구 유지 (BC 보수)
  if (hasValidTemplate) {
    const listBoxItemTemplate = listBoxChildren[0];

    // Field 자식들 찾기 - context.childrenByParent O(1) lookup
    const fieldChildren = (
      context.childrenByParent.get(listBoxItemTemplate.id) ?? []
    ).filter((child) => child.type === "Field");

    const renderItemFunction = (item: Record<string, unknown>) => {
      return (
        <ListBoxItem
          key={String(item.id)}
          data-element-id={listBoxItemTemplate.id}
          value={item}
          isDisabled={Boolean(listBoxItemTemplate.props.isDisabled)}
          className={listBoxItemTemplate.props.className}
          textValue={String(item.name || item.label || item.id || "")}
        >
          {fieldChildren.length > 0
            ? fieldChildren.map((field) => {
                const fieldKey = (field.props as { key?: string }).key;
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
            : String(listBoxItemTemplate.props.label || "")}
        </ListBoxItem>
      );
    };

    return (
      <ListBox
        key={element.id}
        id={element.customId}
        aria-label={String(element.props.label || "List")}
        data-element-id={element.id}
        className={element.props.className}
        style={element.props.style as React.CSSProperties | undefined}
        variant={(element.props.variant as string) || undefined}
        orientation={
          (element.props.orientation as "horizontal" | "vertical") || "vertical"
        }
        selectionMode={
          (element.props.selectionMode as "none" | "single" | "multiple") ||
          "none"
        }
        selectionBehavior={
          (element.props.selectionBehavior as "toggle" | "replace") || "toggle"
        }
        disallowEmptySelection={Boolean(element.props.disallowEmptySelection)}
        autoFocus={Boolean(element.props.autoFocus)}
        enableVirtualization={Boolean(element.props.enableVirtualization)}
        height={
          typeof element.props.height === "number"
            ? element.props.height
            : undefined
        }
        overscan={
          typeof element.props.overscan === "number"
            ? element.props.overscan
            : undefined
        }
        filterText={
          element.props.filterText
            ? String(element.props.filterText)
            : undefined
        }
        filterFields={element.props.filterFields as string[] | undefined}
        defaultSelectedKeys={computeDefaultSelectedKeys()}
        dataBinding={getElementDataBinding(element) as DataBinding | undefined}
        columnMapping={columnMapping}
        onSelectionChange={onSelectionChange}
      >
        {renderItemFunction}
      </ListBox>
    );
  }

  // Path 2: items[] canonical (ADR-076 신설)
  // ADR-099 Phase 3: StoredListBoxEntry discriminated union — section entry 분기
  const renderListBoxLeaf = (item: StoredListBoxItem): React.ReactNode => (
    <ListBoxItem
      key={item.id}
      id={item.id}
      data-element-id={element.id}
      textValue={item.textValue ?? item.label}
      isDisabled={Boolean(item.isDisabled)}
      href={item.href}
    >
      {item.label}
    </ListBoxItem>
  );

  let renderChildren: React.ReactNode;
  if (hasItemsArray) {
    const entries = storedItems as unknown as StoredListBoxEntry[];
    renderChildren = entries.map((entry) => {
      if (isListBoxSectionEntry(entry)) {
        return (
          <AriaListBoxSection key={entry.id} aria-label={entry.ariaLabel}>
            <AriaHeader>{entry.header}</AriaHeader>
            {entry.items.map(renderListBoxLeaf)}
          </AriaListBoxSection>
        );
      }
      return renderListBoxLeaf(entry);
    });
  } else {
    // Path 3: legacy 정적 children fallback — migration 미적용 프로젝트 대비
    renderChildren = listBoxChildren.map((item) => context.renderElement(item));
  }

  return (
    <ListBox
      key={element.id}
      id={element.customId}
      aria-label={String(element.props.label || "List")}
      data-element-id={element.id}
      className={element.props.className}
      style={element.props.style as React.CSSProperties | undefined}
      variant={(element.props.variant as string) || undefined}
      orientation={
        (element.props.orientation as "horizontal" | "vertical") || "vertical"
      }
      selectionMode={
        (element.props.selectionMode as "none" | "single" | "multiple") ||
        "none"
      }
      disallowEmptySelection={Boolean(element.props.disallowEmptySelection)}
      autoFocus={Boolean(element.props.autoFocus)}
      enableVirtualization={Boolean(element.props.enableVirtualization)}
      height={
        typeof element.props.height === "number"
          ? element.props.height
          : undefined
      }
      overscan={
        typeof element.props.overscan === "number"
          ? element.props.overscan
          : undefined
      }
      filterText={
        element.props.filterText ? String(element.props.filterText) : undefined
      }
      filterFields={element.props.filterFields as string[] | undefined}
      defaultSelectedKeys={computeDefaultSelectedKeys(storedItems)}
      dataBinding={getElementDataBinding(element) as DataBinding | undefined}
      columnMapping={columnMapping}
      onSelectionChange={onSelectionChange}
    >
      {renderChildren}
    </ListBox>
  );
};

/**
 * ListBoxItem 렌더링 (독립적으로 렌더링될 때)
 */
export const renderListBoxItem = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  // 모든 자식 요소를 찾기 (Composition 패턴: Text, Description, Field 등)
  const childElements = context.childrenByParent.get(element.id) ?? [];

  // 스켈레톤 플레이스홀더 체크
  const isSkeleton = Boolean(element.props.isSkeleton);
  const className = isSkeleton
    ? `skeleton ${element.props.className || ""}`.trim()
    : element.props.className;

  // 콘텐츠 렌더링: 스켈레톤 → 자식 Element → label fallback
  const renderContent = () => {
    if (isSkeleton) {
      return (
        <>
          <div className="skeleton-line title" />
          <div className="skeleton-line desc" />
        </>
      );
    }
    if (childElements.length > 0) {
      return childElements.map((child) => context.renderElement(child));
    }
    return String(element.props.label || element.props.children || "");
  };

  return (
    <ListBoxItem
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      value={element.props.value as object}
      isDisabled={Boolean(element.props.isDisabled) || isSkeleton}
      className={className}
      textValue={String(
        element.props.textValue ||
          element.props.label ||
          element.customId ||
          "",
      )}
    >
      {renderContent()}
    </ListBoxItem>
  );
};

/**
 * DataField 렌더링
 *
 * Collection 컴포넌트 내에서 데이터를 표시하는 Field Element를 렌더링합니다.
 * dataBinding.source="parent"인 경우 부모의 데이터 context에서 값을 추출합니다.
 */
export const renderDataField = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { elementsById } = context;

  // dataBinding이 있고 source가 "parent"인 경우 부모 데이터에서 값 추출
  // ADR-116 G7: element.dataBinding direct (props ignore) — legacy-only priority
  let value = element.props.value;
  const dataBindingLegacy = getElementDataBinding(element, "legacy-only");

  if (
    dataBindingLegacy?.type === "field" &&
    dataBindingLegacy?.source === "parent"
  ) {
    const path = dataBindingLegacy.config?.path as string | undefined;

    // 부모 element 찾기 (ListBoxItem, GridListItem 등)
    const parent = element.parent_id
      ? elementsById.get(element.parent_id)
      : undefined;

    if (parent && path) {
      // 부모의 value에서 데이터 추출
      const parentValue = parent.props.value as
        | Record<string, unknown>
        | undefined;

      if (parentValue && typeof parentValue === "object") {
        const rawValue = parentValue[path];
        // null과 boolean을 적절히 변환 (DataField는 string | number | readonly string[] | undefined만 허용)
        value =
          rawValue === null
            ? undefined
            : typeof rawValue === "boolean"
              ? String(rawValue)
              : (rawValue as string | number | undefined);
      }
    }
  }

  // 자식 요소가 있으면 렌더링
  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <DataField
      key={element.id}
      data-element-id={element.id}
      fieldKey={element.props.key as string | undefined}
      label={element.props.label as string | undefined}
      type={
        element.props.type as
          | "string"
          | "number"
          | "boolean"
          | "date"
          | "image"
          | "url"
          | "email"
          | undefined
      }
      value={value}
      showLabel={element.props.showLabel !== false}
      visible={element.props.visible !== false}
      className={element.props.className as string | undefined}
      style={element.props.style}
    >
      {children.length > 0
        ? children.map((child) => context.renderElement(child))
        : null}
    </DataField>
  );
};

/**
 * GridList 렌더링
 */
export const renderGridList = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  // 실제 GridListItem 자식 요소들을 찾기
  const gridListChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "GridListItem");

  // ColumnMapping이 있고 visible columns가 있으면 Field Elements 자동 생성
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

  // columnMapping이 있거나 PropertyDataBinding이 있고 GridListItem 템플릿이 있으면 render function 사용
  const hasValidTemplate =
    (columnMapping || isPropertyBinding) && gridListChildren.length > 0;

  // ADR-099 Phase 5 (Addendum 099-f Part 1): Path 2 (items canonical) — props.items 배열 존재
  const storedItems = (element.props as { items?: StoredGridListItem[] }).items;
  const hasItemsArray = Array.isArray(storedItems) && storedItems.length > 0;

  // Path 1: 템플릿 모드 (영구 유지, BC 보수)
  const renderChildren = hasValidTemplate
    ? (item: Record<string, unknown>) => {
        // GridListItem 템플릿을 각 데이터 항목에 대해 렌더링
        const gridListItemTemplate = gridListChildren[0];

        // Field 자식들 찾기 - context.childrenByParent O(1) lookup
        const fieldChildren = (
          context.childrenByParent.get(gridListItemTemplate.id) ?? []
        ).filter((child) => child.type === "Field");

        return (
          <GridListItem
            key={String(item.id)}
            data-element-id={gridListItemTemplate.id}
            value={item}
            isDisabled={Boolean(gridListItemTemplate.props.isDisabled)}
            className={gridListItemTemplate.props.className}
          >
            {fieldChildren.length > 0 ? (
              fieldChildren.map((field) => {
                const fieldKey = (field.props as { key?: string }).key;
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
            ) : (
              <>
                <span className="gridlist-item-label">
                  {String(gridListItemTemplate.props.label || "")}
                </span>
                {gridListItemTemplate.props.description && (
                  <span className="gridlist-item-description">
                    {String(gridListItemTemplate.props.description)}
                  </span>
                )}
              </>
            )}
          </GridListItem>
        );
      }
    : hasItemsArray
      ? // Path 2: items[] canonical (ADR-099 Phase 5 / Addendum 099-f Part 1)
        // StoredGridListEntry discriminated union — section entry 분기
        (() => {
          const renderGridListLeaf = (
            item: StoredGridListItem,
          ): React.ReactNode => (
            <GridListItem
              key={item.id}
              id={item.id}
              data-element-id={element.id}
              textValue={item.textValue ?? item.label}
              isDisabled={Boolean(item.isDisabled)}
            >
              <>
                <span className="gridlist-item-label">{item.label}</span>
                {item.description && (
                  <span className="gridlist-item-description">
                    {item.description}
                  </span>
                )}
              </>
            </GridListItem>
          );

          const entries = storedItems as unknown as StoredGridListEntry[];
          return entries.map((entry) => {
            if (isGridListSectionEntry(entry)) {
              return (
                <AriaGridListSection
                  key={entry.id}
                  aria-label={entry.ariaLabel}
                >
                  <AriaGridListHeader>{entry.header}</AriaGridListHeader>
                  {entry.items.map(renderGridListLeaf)}
                </AriaGridListSection>
              );
            }
            return renderGridListLeaf(entry);
          });
        })()
      : // Path 3: legacy 정적 children fallback — migration 미적용 프로젝트 대비
        gridListChildren.map((item) => context.renderElement(item));

  return (
    <GridList
      key={element.id}
      id={element.customId}
      aria-label={String(element.props.label || "Grid List")}
      data-element-id={element.id}
      className={element.props.className}
      style={element.props.style as React.CSSProperties | undefined}
      variant={(element.props.variant as "default" | "accent") || "default"}
      layout={(element.props.layout as "stack" | "grid") || "stack"}
      columns={(element.props.columns as number) || 2}
      selectionMode={
        (element.props.selectionMode as "none" | "single" | "multiple") ||
        "none"
      }
      selectionBehavior={
        (element.props.selectionBehavior as "toggle" | "replace") || "toggle"
      }
      disallowEmptySelection={Boolean(element.props.disallowEmptySelection)}
      autoFocus={Boolean(element.props.autoFocus)}
      filterText={
        element.props.filterText ? String(element.props.filterText) : undefined
      }
      filterFields={element.props.filterFields as string[] | undefined}
      defaultSelectedKeys={
        Array.isArray(element.props.selectedKeys)
          ? (element.props.selectedKeys as unknown as string[])
          : []
      }
      dataBinding={getElementDataBinding(element) as DataBinding | undefined}
      columnMapping={columnMapping}
      onSelectionChange={(selectedKeys) => {
        const updatedProps = {
          ...element.props,
          selectedKeys: Array.from(selectedKeys),
        };
        updateElementProps(element.id, updatedProps);

        // 사용자 정의 onSelectionChange 이벤트 핸들러 실행
        const eventHandlerMap = context.services?.createEventHandlerMap?.(
          element,
          context,
        );
        const customHandler = eventHandlerMap?.["onSelectionChange"] as
          | ((value: unknown) => void)
          | undefined;
        customHandler?.(selectedKeys);
      }}
    >
      {renderChildren}
    </GridList>
  );
};

/**
 * GridListItem 렌더링 (독립적으로 렌더링될 때)
 */
export const renderGridListItem = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  // 모든 자식 요소를 찾기 (Composition 패턴: Text, Description, Field 등)
  const childElements = context.childrenByParent.get(element.id) ?? [];

  // 스켈레톤 플레이스홀더 체크
  const isSkeleton = Boolean(element.props.isSkeleton);
  const className = isSkeleton
    ? `skeleton ${element.props.className || ""}`.trim()
    : element.props.className;

  // 콘텐츠 렌더링: 스켈레톤 → 자식 Element → label+description fallback
  const renderContent = () => {
    if (isSkeleton) {
      return (
        <>
          <div className="skeleton-line title" />
          <div className="skeleton-line desc" />
        </>
      );
    }
    if (childElements.length > 0) {
      return childElements.map((child) => context.renderElement(child));
    }
    const label = String(element.props.label || element.props.children || "");
    const description = element.props.description as string | undefined;
    return (
      <>
        <span className="gridlist-item-label">{label}</span>
        {description && (
          <span className="gridlist-item-description">{description}</span>
        )}
      </>
    );
  };

  return (
    <GridListItem
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      value={element.props.value as object}
      isDisabled={Boolean(element.props.isDisabled) || isSkeleton}
      className={className}
      textValue={String(
        element.props.textValue ||
          element.props.label ||
          element.customId ||
          "",
      )}
    >
      {renderContent()}
    </GridListItem>
  );
};

/**
 * Select 렌더링
 */
export const renderSelect = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  // ADR-100 Phase 1 (098-a 슬롯): "SelectItem" = RAC 공식 `ListBoxItem` alias.
  //   신규 Select 는 items SSOT (factory 가 SelectItem Element 생성 안 함) —
  //   본 필터는 migration 전 기존 프로젝트 저장 데이터 호환 경로.
  const selectItemChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "SelectItem");

  // ADR-073 P2: items[] SSOT
  const storedItems = (element.props as { items?: StoredSelectItem[] }).items;
  const hasItemsArray = Array.isArray(storedItems) && storedItems.length > 0;

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

  // columnMapping이 있거나 PropertyDataBinding이 있고 SelectItem 템플릿이 있으면 render function 사용
  // dataBinding 우선: hasValidTemplate은 template 기반 경로 (items[] 우선 대상 아님)
  const hasValidTemplate =
    (columnMapping || isPropertyBinding) && selectItemChildren.length > 0;

  // props를 안전하게 보존
  const elementProps = { ...element.props };

  // Child element에서 props 읽기 (compositional 패턴)
  const allSelectChildren = context.childrenByParent.get(element.id) ?? [];
  const selectLabelEl = allSelectChildren.find((c) => c.type === "Label");
  const triggerEl = allSelectChildren.find((c) => c.type === "SelectTrigger");
  const triggerChildren = triggerEl
    ? (context.childrenByParent.get(triggerEl.id) ?? [])
    : [];
  const selectValueEl = triggerChildren.find((c) => c.type === "SelectValue");

  // child element props 우선 → parent props fallback
  const labelValue = selectLabelEl
    ? (selectLabelEl.props?.children as string)
    : elementProps.label;
  const processedLabel = labelValue ? String(labelValue).trim() : undefined;
  const placeholderValue = selectValueEl
    ? (selectValueEl.props?.children as string)
    : elementProps.placeholder;
  const processedPlaceholder = placeholderValue
    ? String(placeholderValue).trim()
    : undefined;

  // selectedKey 상태 확인
  const currentSelectedKey = elementProps.selectedKey;

  // 접근성을 위한 aria-label 설정
  const ariaLabel = processedLabel
    ? undefined
    : (typeof elementProps["aria-label"] === "string"
        ? elementProps["aria-label"]
        : undefined) ||
      processedPlaceholder ||
      `Select ${element.id}`;

  // ADR-073 P3: 3-path renderChildren
  // 경로 1: dataBinding template (hasValidTemplate) — 기존 동작 유지
  // 경로 2: items[] SSOT (hasItemsArray) — NEW
  // 경로 3: legacy SelectItem element tree — P6 소멸 예정
  let renderChildren:
    | React.ReactNode
    | ((item: Record<string, unknown>) => React.ReactNode);

  if (hasValidTemplate) {
    // 경로 1: dataBinding/columnMapping template 기반 렌더링 (현 동작 유지)
    renderChildren = (item: Record<string, unknown>) => {
      const selectItemTemplate = selectItemChildren[0];
      const fieldChildren = (
        context.childrenByParent.get(selectItemTemplate.id) ?? []
      ).filter((child) => child.type === "Field");

      return (
        <SelectItem
          key={String(item.id)}
          data-element-id={selectItemTemplate.id}
          value={item as object}
          isDisabled={Boolean(selectItemTemplate.props.isDisabled)}
          style={selectItemTemplate.props.style}
          className={selectItemTemplate.props.className}
        >
          {fieldChildren.length > 0
            ? fieldChildren.map((field) => {
                const fieldKey = (field.props as { key?: string }).key;
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
            : String(selectItemTemplate.props.label || "")}
        </SelectItem>
      );
    };
  } else if (hasItemsArray) {
    // 경로 2 (ADR-073 NEW): items[] SSOT — Canonical contract
    renderChildren = storedItems!.map((item) => (
      <SelectItem
        key={item.id}
        id={item.id}
        data-element-id={element.id}
        textValue={item.textValue ?? item.label}
        isDisabled={Boolean(item.isDisabled)}
      >
        {item.label}
      </SelectItem>
    ));
  } else {
    // 경로 3 (legacy, P6 소멸): SelectItem element tree fallback
    renderChildren = selectItemChildren.map((item, index) => {
      const actualValue =
        item.props.value || item.props.label || `option-${index + 1}`;

      return (
        <SelectItem
          key={item.id}
          data-element-id={item.id}
          value={String(actualValue) as unknown as object}
          isDisabled={Boolean(item.props.isDisabled)}
          style={item.props.style}
          className={item.props.className}
        >
          {String(item.props.label || item.id)}
        </SelectItem>
      );
    });
  }

  return (
    <Select
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={elementProps.style}
      className={element.props.className}
      size={(element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || "md"}
      iconName={
        elementProps.iconName ? String(elementProps.iconName) : undefined
      }
      label={processedLabel}
      description={
        elementProps.description
          ? String(elementProps.description).trim()
          : undefined
      }
      errorMessage={
        elementProps.errorMessage
          ? String(elementProps.errorMessage).trim()
          : undefined
      }
      placeholder={processedPlaceholder}
      aria-label={ariaLabel}
      defaultSelectedKey={
        currentSelectedKey ? String(currentSelectedKey) : undefined
      }
      isDisabled={Boolean(elementProps.isDisabled)}
      isRequired={Boolean(elementProps.isRequired)}
      isInvalid={Boolean(elementProps.isInvalid)}
      isQuiet={Boolean(elementProps.isQuiet || false)}
      necessityIndicator={
        elementProps.necessityIndicator as "icon" | "label" | undefined
      }
      labelPosition={(elementProps.labelPosition as "top" | "side") || "top"}
      name={elementProps.name ? String(elementProps.name) : undefined}
      autoFocus={Boolean(elementProps.autoFocus)}
      dataBinding={getElementDataBinding(element) as DataBinding | undefined}
      columnMapping={columnMapping}
      onSelectionChange={async (selectedKey) => {
        // ADR-073 P3: items[] 경로에서 Canonical contract — items[].id lookup
        let actualValue: React.Key | undefined | null =
          selectedKey ?? undefined;

        if (hasItemsArray && selectedKey != null) {
          // 경로 2: items[].id で Canonical lookup
          const matched = storedItems!.find(
            (it) => it.id === String(selectedKey),
          );
          actualValue = matched?.value ?? selectedKey;
        } else if (
          selectedKey &&
          typeof selectedKey === "string" &&
          selectedKey.startsWith("react-aria-")
        ) {
          // 경로 3 (legacy): React Aria 내부 ID → 실제 값 역매핑
          const index = parseInt(selectedKey.replace("react-aria-", "")) - 1;
          const selectedItem = selectItemChildren[index];
          if (selectedItem) {
            actualValue = String(
              selectedItem.props.value ||
                selectedItem.props.label ||
                `option-${index + 1}`,
            );
          }
        }

        // placeholder를 포함한 모든 props 보존
        const updatedProps = {
          ...elementProps,
          selectedKey,
          selectedValue: actualValue,
        };

        updateElementProps(element.id, updatedProps);

        // 전체 props 전송으로 placeholder 보존
        window.parent.postMessage(
          {
            type: "UPDATE_ELEMENT_PROPS",
            elementId: element.id,
            props: updatedProps,
            merge: false,
          },
          getTargetOrigin(),
        );

        // 사용자 정의 onSelectionChange 이벤트 핸들러 실행
        const eventHandlerMap = context.services?.createEventHandlerMap?.(
          element,
          context,
        );
        const customHandler = eventHandlerMap?.["onSelectionChange"] as
          | ((value: unknown) => void)
          | undefined;
        customHandler?.(selectedKey);
      }}
      onOpenChange={(isOpen) => {
        // 사용자 정의 onOpenChange 이벤트 핸들러 실행
        const eventHandlerMap = context.services?.createEventHandlerMap?.(
          element,
          context,
        );
        const customHandler = eventHandlerMap?.["onOpenChange"] as
          | ((value: unknown) => void)
          | undefined;
        customHandler?.(isOpen);
      }}
    >
      {renderChildren}
    </Select>
  );
};

/**
 * ComboBox 렌더링
 */
export const renderComboBox = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  // ADR-101 Phase 1 (098-b 슬롯): legacy "ComboBoxItem" Element — items SSOT 흡수 후
  //   기존 프로젝트 호환 경로. RAC alias: ComboBoxItem (이름 동일). ADR-073 이관 완료.
  const comboBoxItemChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "ComboBoxItem");

  // ADR-073 P2: items[] SSOT
  const cbStoredItems = (element.props as { items?: StoredComboBoxItem[] })
    .items;
  const cbHasItemsArray =
    Array.isArray(cbStoredItems) && cbStoredItems.length > 0;

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

  // columnMapping이 있거나 PropertyDataBinding이 있고 ComboBoxItem 템플릿이 있으면 render function 사용
  // dataBinding 우선: hasValidTemplate은 template 기반 경로 (items[] 우선 대상 아님)
  const cbHasValidTemplate =
    (columnMapping || isPropertyBinding) && comboBoxItemChildren.length > 0;

  // ADR-073 P3: 3-path renderChildren
  // 경로 1: dataBinding template (cbHasValidTemplate) — 기존 동작 유지
  // 경로 2: items[] SSOT (cbHasItemsArray) — NEW
  // 경로 3: legacy ComboBoxItem element tree — P6 소멸 예정
  let cbRenderChildren:
    | React.ReactNode
    | ((item: Record<string, unknown>) => React.ReactNode);

  if (cbHasValidTemplate) {
    // 경로 1: dataBinding/columnMapping template 기반 렌더링 (현 동작 유지)
    cbRenderChildren = (item: Record<string, unknown>) => {
      const comboBoxItemTemplate = comboBoxItemChildren[0];
      const fieldChildren = (
        context.childrenByParent.get(comboBoxItemTemplate.id) ?? []
      ).filter((child) => child.type === "Field");

      const textValue = fieldChildren
        .filter(
          (field) => (field.props as { visible?: boolean }).visible !== false,
        )
        .map((field) => {
          const fieldKey = (field.props as { key?: string }).key;
          const fieldValue = fieldKey ? item[fieldKey] : undefined;
          return fieldValue != null ? String(fieldValue) : "";
        })
        .filter(Boolean)
        .join(" ");

      return (
        <ComboBoxItem
          key={String(item.id)}
          data-element-id={comboBoxItemTemplate.id}
          value={item as object}
          textValue={textValue}
          isDisabled={Boolean(comboBoxItemTemplate.props.isDisabled)}
          style={comboBoxItemTemplate.props.style}
          className={comboBoxItemTemplate.props.className}
        >
          {fieldChildren.length > 0
            ? fieldChildren.map((field) => {
                const fieldKey = (field.props as { key?: string }).key;
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
            : String(comboBoxItemTemplate.props.label || "")}
        </ComboBoxItem>
      );
    };
  } else if (cbHasItemsArray) {
    // 경로 2 (ADR-073 NEW): items[] SSOT — Canonical contract
    cbRenderChildren = cbStoredItems!.map((item) => (
      <ComboBoxItem
        key={item.id}
        id={item.id}
        data-element-id={element.id}
        textValue={item.textValue ?? item.label}
        isDisabled={Boolean(item.isDisabled)}
      >
        {item.label}
      </ComboBoxItem>
    ));
  } else {
    // 경로 3 (legacy, P6 소멸): ComboBoxItem element tree fallback
    cbRenderChildren = comboBoxItemChildren.map((item, index) => {
      const reactAriaId = `react-aria-${index + 1}`;

      return (
        <ComboBoxItem
          key={item.id}
          data-element-id={item.id}
          value={reactAriaId as unknown as object}
          isDisabled={Boolean(item.props.isDisabled)}
          style={item.props.style}
          className={item.props.className}
        >
          {String(item.props.label || item.id)}
        </ComboBoxItem>
      );
    });
  }

  // Child element에서 props 읽기 (compositional 패턴)
  const allChildren = context.childrenByParent.get(element.id) ?? [];
  const labelEl = allChildren.find((c) => c.type === "Label");
  const wrapperEl = allChildren.find((c) => c.type === "ComboBoxWrapper");
  const wrapperChildren = wrapperEl
    ? (context.childrenByParent.get(wrapperEl.id) ?? [])
    : [];
  const inputEl = wrapperChildren.find((c) => c.type === "ComboBoxInput");

  // child element props 우선 → parent props fallback
  const comboLabel = labelEl
    ? String(labelEl.props?.children || "")
    : String(element.props.label || "");
  const comboPlaceholder = inputEl
    ? String(inputEl.props?.placeholder || "")
    : String(element.props.placeholder || "");

  return (
    <ComboBox
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      size={(element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || "md"}
      iconName={
        element.props.iconName ? String(element.props.iconName) : undefined
      }
      label={comboLabel}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      placeholder={comboPlaceholder}
      {...(element.props.selectedKey || element.props.selectedValue
        ? {
            defaultSelectedKey: String(
              element.props.selectedKey || element.props.selectedValue,
            ),
          }
        : {})}
      defaultInputValue={String(element.props.inputValue || "")}
      allowsCustomValue={Boolean(element.props.allowsCustomValue)}
      isDisabled={Boolean(element.props.isDisabled)}
      isRequired={Boolean(element.props.isRequired)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isInvalid={Boolean(element.props.isInvalid)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      autoFocus={Boolean(element.props.autoFocus)}
      menuTrigger={
        (element.props.menuTrigger as "input" | "focus" | "manual") || "focus"
      }
      validationBehavior={
        (element.props.validationBehavior as "native" | "aria") || undefined
      }
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      necessityIndicator={
        element.props.necessityIndicator as "icon" | "label" | undefined
      }
      name={element.props.name ? String(element.props.name) : undefined}
      dataBinding={getElementDataBinding(element) as DataBinding | undefined}
      columnMapping={columnMapping}
      onSelectionChange={async (selectedKey) => {
        // selectedKey가 undefined이면 선택 해제로 처리
        if (selectedKey === undefined || selectedKey === null) {
          const updatedProps = {
            ...element.props,
            selectedKey: undefined,
            selectedValue: undefined,
            inputValue: "",
          };
          updateElementProps(element.id, updatedProps);
          return;
        }

        // ADR-073 P3: items[] 경로에서 Canonical contract — items[].id lookup
        let actualValue: React.Key = selectedKey;
        let displayValue = String(selectedKey);

        if (cbHasItemsArray) {
          // 경로 2: items[].id Canonical lookup
          const matched = cbStoredItems!.find(
            (it) => it.id === String(selectedKey),
          );
          if (matched) {
            actualValue = matched.value ?? selectedKey;
            displayValue = matched.label;
          }
        } else if (
          selectedKey &&
          typeof selectedKey === "string" &&
          selectedKey.startsWith("react-aria-")
        ) {
          // 경로 3 (legacy): React Aria 내부 ID → 실제 값 역매핑
          const index = parseInt(selectedKey.replace("react-aria-", "")) - 1;
          const selectedItem = comboBoxItemChildren[index];
          if (selectedItem) {
            actualValue = String(
              selectedItem.props.value ||
                selectedItem.props.label ||
                `option-${index + 1}`,
            );
            displayValue = String(
              selectedItem.props.label ||
                selectedItem.props.value ||
                `option-${index + 1}`,
            );
          }
        } else {
          const selectedItem = comboBoxItemChildren.find(
            (item) =>
              String(item.props.value) === String(selectedKey) ||
              String(item.props.label) === String(selectedKey),
          );

          if (selectedItem) {
            actualValue = String(
              selectedItem.props.value ||
                selectedItem.props.label ||
                selectedKey,
            );
            displayValue = String(
              selectedItem.props.label ||
                selectedItem.props.value ||
                selectedKey,
            );
          }
        }

        const updatedProps = {
          ...element.props,
          selectedKey,
          selectedValue: actualValue,
          inputValue: displayValue,
        };

        updateElementProps(element.id, updatedProps);

        window.parent.postMessage(
          {
            type: "UPDATE_ELEMENT_PROPS",
            elementId: element.id,
            props: {
              selectedKey,
              selectedValue: actualValue,
              inputValue: displayValue,
            },
            merge: true,
          },
          getTargetOrigin(),
        );

        // 사용자 정의 onSelectionChange 이벤트 핸들러 실행
        const eventHandlerMap = context.services?.createEventHandlerMap?.(
          element,
          context,
        );
        const customHandler = eventHandlerMap?.["onSelectionChange"] as
          | ((value: unknown) => void)
          | undefined;
        customHandler?.(selectedKey);
      }}
      onOpenChange={(isOpen) => {
        // 사용자 정의 onOpenChange 이벤트 핸들러 실행
        const eventHandlerMap = context.services?.createEventHandlerMap?.(
          element,
          context,
        );
        const customHandler = eventHandlerMap?.["onOpenChange"] as
          | ((value: unknown) => void)
          | undefined;
        customHandler?.(isOpen);
      }}
      onInputChange={(rawInputValue) => {
        // ADR-073 P3: items[] 경로에서 onInputChange reconcile
        // label 정확 일치 → selectedKey/selectedValue 동기화 (stale selection 방지)
        if (cbHasItemsArray) {
          const matchedItem = cbStoredItems!.find(
            (it) => it.label === rawInputValue,
          );
          updateElementProps(element.id, {
            ...element.props,
            inputValue: rawInputValue,
            selectedKey: matchedItem?.id,
            selectedValue: matchedItem?.value,
          });
        } else {
          // legacy 경로: inputValue만 업데이트
          const updatedProps = {
            ...element.props,
            inputValue: rawInputValue,
          };
          updateElementProps(element.id, updatedProps);
        }
      }}
    >
      {cbRenderChildren}
    </ComboBox>
  );
};

/**
 * Slider 렌더링
 */
export const renderSlider = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const rawValue = element.props.value;
  const normalizedValue = Array.isArray(rawValue)
    ? (rawValue as number[])
    : [Number(rawValue) || 50];

  return (
    <Slider
      key={`${element.id}-${normalizedValue.length}`}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      label={String(element.props.label || "")}
      value={normalizedValue}
      minValue={Number(element.props.minValue) || 0}
      maxValue={Number(element.props.maxValue) || 100}
      step={Number(element.props.step) || 1}
      orientation={
        (element.props.orientation as "horizontal" | "vertical") || "horizontal"
      }
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      isDisabled={Boolean(element.props.isDisabled)}
      isEmphasized={Boolean(element.props.isEmphasized)}
      formatOptions={
        element.props.formatOptions as Intl.NumberFormatOptions | undefined
      }
      locale={(element.props.locale as string) || undefined}
      onChange={(value) => {
        updateElementProps(element.id, {
          ...element.props,
          value,
        });
      }}
    />
  );
};
