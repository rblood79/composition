import { X } from "lucide-react";

import React, { JSX, useState } from "react";

import { Button } from "react-aria-components/Button";

import type { Key } from "react-aria-components/Collection";

import type { Selection } from "react-aria-components/ListBox";

import {
  Tag as AriaTag,
  TagGroup as AriaTagGroup,
  TagList,
  TagProps,
} from "react-aria-components/TagGroup";

import {
  renderFieldDescription,
  renderFieldLabel,
} from "./FieldNecessityIndicator";

// chip leading icon glyph — DOM 아이콘은 프로젝트 관례상 고정 크기(14px), Skia 는
//   Tag rule `sizes[*].iconSize`(전 size 14)로 같은 값을 쓴다.
import type { DataBinding, TagItemTemplate } from "../types";

import { renderTagLeadingSlot } from "./tagLeadingSlot";

import { useResolvedCollectionItems } from "../hooks";

import { useComponentStrings } from "../i18n";
import {
  TagGroupProps,
  renderTagGroupError,
  useTagMaxRows,
} from "./TagGroup.runtime";

export function TagGroup<T extends object>({
  label,
  description,
  errorMessage,
  style,
  items,
  children,
  renderEmptyState,
  allowsRemoving,
  onRemove,
  selectionMode = "none",
  selectionBehavior = "toggle",
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  disallowEmptySelection = false,
  dataBinding,
  columnMapping,
  removedItemIds = [],
  variant = "default",
  size = "M",
  maxRows,
  filter,
  filterText,
  filterFields = ["label", "name", "title"] as (keyof T)[],
  labelPosition = "top",
  itemTemplate,
  staticItems,
  ...props
}: TagGroupProps<T>): JSX.Element {
  // ADR-229 Phase 1 — chip template: base style 은 모든 chip, selected 는 RAC isSelected chip 에 overlay
  //   (Skia `appendTagRowProjection` 의 default ⊕ selected origin style 과 대칭). 구성은 leading slot
  //   존재 gating 에 쓴다 — selected chip 은 selected origin 의 구성 (없으면 default).
  const chipBaseStyle = (itemTemplate?.rootStyles.base ?? undefined) as
    React.CSSProperties | undefined;
  const chipSelectedStyle = (itemTemplate?.rootStyles.selected ?? undefined) as
    React.CSSProperties | undefined;
  const chipStyle = (isSelected: boolean): React.CSSProperties | undefined => {
    if (!chipBaseStyle && !chipSelectedStyle) return undefined;
    return {
      ...chipBaseStyle,
      ...(isSelected ? chipSelectedStyle : undefined),
    };
  };
  const chipComposition = (isSelected: boolean) =>
    isSelected
      ? (itemTemplate?.selectedComposition ?? itemTemplate?.composition)
      : itemTemplate?.composition;
  const t = useComponentStrings();
  // Build className with variant and size (재사용을 위해 최상위에 선언)
  const tagGroupClassName = "react-aria-TagGroup";

  // maxRows: S2 패턴 — 숨겨진 미러 DOM에서 측정, 실제 DOM에서 슬라이스 (`useTagMaxRows`).
  const {
    hiddenRef,
    wrapperRef: tagListWrapperRef,
    hasMaxRows,
    isCollapsed,
    setIsCollapsed,
    showCollapsed,
    visibleTagCount,
  } = useTagMaxRows(maxRows);
  // ADR-256 Phase 5d: the reference's `onRemove` for authored tags — a removed tag leaves the list
  // (Preview run state; the document keeps it). RAC shows a tag's remove button only with one.
  const [removedStatic, setRemovedStatic] = useState<ReadonlySet<Key>>(
    () => new Set(),
  );
  // (Authored tags stay the source after every one is removed — the list is then empty.)
  const liveStaticItems =
    staticItems && staticItems.length > 0
      ? staticItems.filter(
          (entry) => entry.id === undefined || !removedStatic.has(entry.id),
        )
      : undefined;
  const handleRemove =
    onRemove ??
    (staticItems
      ? (keys: Selection) =>
          setRemovedStatic(
            (previous) =>
              new Set([
                ...previous,
                ...(keys === "all"
                  ? staticItems.flatMap((entry) =>
                      entry.id === undefined ? [] : [entry.id],
                    )
                  : keys),
              ]),
          )
      : undefined);

  // ADR-912 영역 B Task 2-B: collection source acquisition 단일화.
  //   useCollectionData 직접 호출(이중 source)을 제거하고 useResolvedCollectionItems 단일 진입점으로 통일.
  //   dataBinding(async/dataTable/API)과 정적 props.items 가 같은 toItemProjectionRow normalizer 를
  //   통과 → DOM wrapper 와 Skia projector(getFlatProjectionRows)가 동일 row 형태(CollectionProjectionRow).
  //   wrapper 별 `if(!hasDataBinding && items)` 분기 복제(ADR-142 no-classification 역행) 소멸.
  const {
    rows: resolvedRows,
    loading,
    error,
  } = useResolvedCollectionItems({
    dataBinding: dataBinding as DataBinding,
    items: items as unknown[] | undefined,
    componentName: "TagGroup",
    fallbackData: [
      { id: 1, name: "Tag 1", label: "Tag 1" },
      { id: 2, name: "Tag 2", label: "Tag 2" },
    ],
  });

  // React Aria 1.13.0: 필터링 로직 (raw item 기반 — row.item 에 원본 보존).
  //   filter/filterText 는 raw item 시그니처(T)를 받으므로 정규화 rows 의 row.item 으로 적용.
  const filteredRows = React.useMemo(() => {
    let result = resolvedRows;

    // 커스텀 필터 적용
    if (filter) {
      result = result.filter((row) => filter(row.item as T));
    }

    // 텍스트 필터 적용
    if (filterText && filterText.trim()) {
      const searchText = filterText.toLowerCase().trim();
      result = result.filter((row) => {
        const item = row.item as Record<string, unknown>;
        if (!item || typeof item !== "object") {
          return row.label.toLowerCase().includes(searchText);
        }
        return filterFields.some((field) => {
          const value = item[field as string];
          return value && String(value).toLowerCase().includes(searchText);
        });
      });
    }

    return result;
  }, [resolvedRows, filter, filterText, filterFields]);

  // DataBinding이 있고 데이터가 로드되었을 때 동적 아이템 생성
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

  // Static Children: data-binding/정규화 rows 경로에서는 사용하지 않으므로 스킵.
  //   외부 직접 사용(`<TagGroup><Tag>...`)에서만 children 이 실제 Tag JSX → RAC static collection.
  const allMappedChildren = hasDataBinding
    ? children
    : typeof children === "function"
      ? children
      : React.Children.map(children as React.ReactNode, (child) => {
          if (!React.isValidElement(child)) return child;
          const { children: tagContent, ...tagProps } = child.props as TagProps;
          const textValue =
            typeof tagContent === "string" ? tagContent : undefined;
          return (
            <AriaTag
              textValue={textValue}
              {...tagProps}
              className="react-aria-Tag"
            >
              {({ allowsRemoving }) => (
                <>
                  {tagContent}
                  {allowsRemoving && (
                    <Button slot="remove" className="tag-remove-btn">
                      <X size={14} />
                    </Button>
                  )}
                </>
              )}
            </AriaTag>
          );
        });

  // 미러 DOM 텍스트 추출 (maxRows 측정 전용).
  //   정규화 rows 가 source 면 row.label 에서, 외부 static children 이면 child props 에서 추출.
  const tagTexts = React.useMemo<
    Array<{ text: string; icon: string | null; avatar: string | null }>
  >(() => {
    if (hasDataBinding) return [];
    if (liveStaticItems)
      return liveStaticItems.map((entry) => ({
        text: entry.text,
        icon: null,
        avatar: null,
      }));
    if (filteredRows.length > 0)
      return filteredRows.map((row) => ({
        text: row.label,
        icon: row.icon ?? null,
        avatar: row.avatar ?? null,
      }));
    if (typeof children === "function") return [];
    // 원본 `<Tag>` 자식에서 글자를 뽑는다 — allMappedChildren 은 자식을 render function
    //   (`({ allowsRemoving }) => …`) 으로 감싸 `String(props.children)` 이 **함수 소스 코드** (3,000px)
    //   가 됐고, 미러 chip 이 하나씩 한 줄을 차지해 maxRows 접힘이 항상 maxRows 개만 남겼다
    //   (2026-09-21 Compare Mode 실측: Canvas 4 chip ↔ Preview 2 chip + Show all).
    const extractText = (node: unknown): string => {
      if (node == null || typeof node === "boolean") return "";
      if (typeof node === "string" || typeof node === "number")
        return String(node);
      if (Array.isArray(node)) return node.map(extractText).join("");
      if (React.isValidElement(node)) {
        const p = node.props as { textValue?: string; children?: unknown };
        return p.textValue || extractText(p.children);
      }
      return "";
    };
    return React.Children.toArray(children as React.ReactNode).map((child) => ({
      text: extractText(child),
      icon: null,
      avatar: null,
    }));
  }, [hasDataBinding, filteredRows, children, liveStaticItems]);

  // children이 render function인지 확인 (Field children 렌더링 모드)
  const isRenderFunction = typeof children === "function";

  // ColumnMapping이 있거나 children이 render function이면 Field 렌더링 모드 사용
  // ListBox와 동일한 패턴: Element tree의 Tag 템플릿 + Field 자식 사용
  if (hasDataBinding && (columnMapping || isRenderFunction)) {
    // Loading 상태
    if (loading) {
      return (
        <AriaTagGroup
          {...props}
          selectionMode="none"
          className={tagGroupClassName}
          data-tag-variant={variant}
          data-tag-size={size}
          data-label-position={labelPosition}
        >
          {renderFieldLabel(label)}
          <TagList className="react-aria-TagList">
            <AriaTag textValue={t("loadingLabel")}>{t("loadingData")}</AriaTag>
          </TagList>
          {renderFieldDescription(description)}
        </AriaTagGroup>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaTagGroup
          {...props}
          selectionMode="none"
          className={tagGroupClassName}
          data-tag-variant={variant}
          data-tag-size={size}
          data-label-position={labelPosition}
        >
          {renderFieldLabel(label)}
          <TagList className="react-aria-TagList">
            <AriaTag textValue={t("errorLabel")}>
              {t("errorWithMessage", { message: String(error) })}
            </AriaTag>
          </TagList>
          {renderFieldDescription(description)}
        </AriaTagGroup>
      );
    }

    // 데이터가 있을 때: items prop 사용
    if (filteredRows.length > 0) {
      // removedItemIds로 필터링 (map 전에 필터링). raw item 은 row.item 에 보존.
      const tagItems = filteredRows
        .filter((row) => !removedItemIds.includes(row.itemKey))
        // ADR-152 Phase 4: raw item 을 먼저 펼치고 정규화 id 를 뒤에 — 반대 순서면 raw `id`
        //   ("auto-1") 가 fieldMap value 역할 key 를 덮어 Skia 투영 key 와 갈렸다 (sweep 실측).
        .map((row) => ({
          ...(row.item as Record<string, unknown>),
          id: row.itemKey,
        })) as T[];

      return (
        <AriaTagGroup
          {...props}
          selectionMode={selectionMode}
          selectionBehavior={selectionBehavior}
          selectedKeys={selectedKeys}
          defaultSelectedKeys={defaultSelectedKeys}
          onSelectionChange={onSelectionChange}
          disallowEmptySelection={disallowEmptySelection}
          onRemove={allowsRemoving ? handleRemove : undefined}
          className={tagGroupClassName}
          data-tag-variant={variant}
          data-tag-size={size}
          data-label-position={labelPosition}
        >
          {renderFieldLabel(label)}
          <TagList
            items={tagItems}
            renderEmptyState={renderEmptyState}
            className="react-aria-TagList"
          >
            {children}
          </TagList>
          {renderFieldDescription(description)}
          {renderTagGroupError(errorMessage)}
        </AriaTagGroup>
      );
    }

    // 데이터 없음
    return (
      <AriaTagGroup
        {...props}
        selectionMode={selectionMode}
        selectionBehavior={selectionBehavior}
        selectedKeys={selectedKeys}
        defaultSelectedKeys={defaultSelectedKeys}
        onSelectionChange={onSelectionChange}
        disallowEmptySelection={disallowEmptySelection}
        onRemove={allowsRemoving ? handleRemove : undefined}
        className={tagGroupClassName}
        data-tag-variant={variant}
        data-tag-size={size}
        data-label-position={labelPosition}
      >
        {renderFieldLabel(label)}
        <TagList
          items={items}
          renderEmptyState={renderEmptyState}
          className="react-aria-TagList"
        >
          {children}
        </TagList>
        {renderFieldDescription(description)}
        {renderTagGroupError(errorMessage)}
      </AriaTagGroup>
    );
  }

  // Dynamic Collection: items prop 사용 (columnMapping 없을 때)
  if (hasDataBinding) {
    // Loading 상태
    if (loading) {
      return (
        <AriaTagGroup
          {...props}
          selectionMode="none"
          className={tagGroupClassName}
          data-tag-variant={variant}
          data-tag-size={size}
          data-label-position={labelPosition}
        >
          {renderFieldLabel(label)}
          <TagList className="react-aria-TagList">
            <AriaTag textValue={t("loadingLabel")}>{t("loadingData")}</AriaTag>
          </TagList>
          {renderFieldDescription(description)}
        </AriaTagGroup>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaTagGroup
          {...props}
          selectionMode="none"
          className={tagGroupClassName}
          data-tag-variant={variant}
          data-tag-size={size}
          data-label-position={labelPosition}
        >
          {renderFieldLabel(label)}
          <TagList className="react-aria-TagList">
            <AriaTag textValue={t("errorLabel")}>
              {t("errorWithMessage", { message: String(error) })}
            </AriaTag>
          </TagList>
          {renderFieldDescription(description)}
        </AriaTagGroup>
      );
    }

    // 데이터가 로드되었을 때 — 정규화 rows 사용 (label 휴리스틱은 normalizer 가 이미 적용).
    if (filteredRows.length > 0) {
      // ADR-152 Phase 4: raw 먼저, 정규화 id/label 뒤에 (위 items 경로와 같은 이유)
      const tagItems = filteredRows.map((row) => ({
        ...(row.item as Record<string, unknown>),
        id: row.itemKey,
        label: row.label,
      }));

      return (
        <AriaTagGroup
          {...props}
          selectionMode={selectionMode}
          selectionBehavior={selectionBehavior}
          selectedKeys={selectedKeys}
          defaultSelectedKeys={defaultSelectedKeys}
          onSelectionChange={onSelectionChange}
          disallowEmptySelection={disallowEmptySelection}
          onRemove={allowsRemoving ? handleRemove : undefined}
          className={tagGroupClassName}
          data-tag-variant={variant}
          data-tag-size={size}
          data-label-position={labelPosition}
        >
          {renderFieldLabel(label)}
          <TagList
            items={tagItems}
            renderEmptyState={renderEmptyState}
            className="react-aria-TagList"
          >
            {(item) => (
              <AriaTag
                key={item.id}
                id={item.id}
                textValue={item.label}
                className="react-aria-Tag"
              >
                {({ allowsRemoving: removing }) => (
                  <>
                    {item.label}
                    {removing && (
                      <Button slot="remove" className="tag-remove-btn">
                        <X size={14} />
                      </Button>
                    )}
                  </>
                )}
              </AriaTag>
            )}
          </TagList>
          {renderFieldDescription(description)}
          {renderTagGroupError(errorMessage)}
        </AriaTagGroup>
      );
    }
  }

  // ADR-912 영역 B Task 2-B: 정적 items 전용 분기(`9e84c2707`)는 source 단일화로 제거됨.
  //   catalog cutover DOM 경로(renderCatalogDom → INTERNAL_RENDERERS["taggroup"])가 넘기는
  //   canonical props.items 는 useResolvedCollectionItems 가 dataBinding 과 동일 normalizer 로 흡수
  //   → 아래 default 경로가 filteredRows(정규화 row) 를 RAC render function 으로 그린다.
  //   RAC <TagList> 는 static children 이 있으면 items 를 무시하므로, rows 가 있으면 children 대신
  //   items+render function 을 쓴다(rows 가 비면 외부 static JSX children = RAC static collection).

  // rows 기반 render 가능 여부 — items 또는 dataBinding source 가 정규화 row 를 산출했는가.
  const hasResolvedRows = filteredRows.length > 0;

  // removedItemIds 반영한 정규화 row → RAC items(id/label/isDisabled). row.item 에 raw 보존.
  const resolvedTagItems = filteredRows
    .filter((row) => !removedItemIds.includes(row.itemKey))
    .map((row) => ({
      id: row.itemKey,
      label: row.label,
      isDisabled: row.isDisabled,
      // 항목별 leading icon (2026-08-21) — Skia 는 Tag rule `leadingIcon.nameProp` 으로
      //   같은 값을 읽는다. 폭(fit-content)에 직접 영향이라 미러 측정도 함께 반영해야 한다.
      icon: row.icon,
      // 항목별 avatar 이미지 (2026-08-21) — icon 과 **같은 좌측 슬롯**이라 둘 다 있으면
      //   avatar 만 그린다(Skia `resolveLeadingSlot` 의 우선순위와 같은 결론).
      avatar: row.avatar,
    }));

  const totalChildCount = liveStaticItems
    ? liveStaticItems.length
    : hasResolvedRows
      ? resolvedTagItems.length
      : tagTexts.length;

  // 실제 렌더링할 children: static children 경로(외부 JSX)에서만 collapsed 슬라이스 적용.
  const staticNodes = liveStaticItems
    ? liveStaticItems.map((entry) => entry.node)
    : null;
  const displayChildren = staticNodes
    ? showCollapsed
      ? staticNodes.slice(0, visibleTagCount)
      : staticNodes
    : showCollapsed && Array.isArray(allMappedChildren)
      ? allMappedChildren.slice(0, visibleTagCount)
      : allMappedChildren;

  // rows render 도 collapsed 시 슬라이스 (외부 static children 과 동일 maxRows 동작).
  const displayTagItems =
    showCollapsed && hasResolvedRows
      ? resolvedTagItems.slice(0, visibleTagCount)
      : resolvedTagItems;

  const showAllButton = showCollapsed && visibleTagCount < totalChildCount;

  return (
    <div style={{ position: "relative", ...style }}>
      {/* S2 패턴: 숨겨진 미러 DOM — 항상 전체 태그를 span으로 렌더 (측정 전용) */}
      {hasMaxRows && (
        <TagMaxRowsMirror
          hiddenRef={hiddenRef}
          size={size}
          labelPosition={labelPosition}
          entries={tagTexts}
          chipStyle={chipStyle(false)}
          composition={chipComposition(false)}
        />
      )}
      <AriaTagGroup
        {...props}
        selectionMode={selectionMode}
        selectionBehavior={selectionBehavior}
        selectedKeys={selectedKeys}
        defaultSelectedKeys={defaultSelectedKeys}
        onSelectionChange={onSelectionChange}
        disallowEmptySelection={disallowEmptySelection}
        onRemove={allowsRemoving ? handleRemove : undefined}
        className={tagGroupClassName}
        data-tag-variant={variant}
        data-tag-size={size}
        data-label-position={labelPosition}
      >
        {renderFieldLabel(label)}
        <div ref={tagListWrapperRef} className="tag-list-wrapper">
          {hasResolvedRows && !staticNodes ? (
            <TagList
              items={displayTagItems}
              renderEmptyState={renderEmptyState}
              className="react-aria-TagList"
            >
              {(item) => (
                <AriaTag
                  key={item.id}
                  id={item.id}
                  textValue={item.label}
                  isDisabled={item.isDisabled}
                  className="react-aria-Tag"
                  style={({ isSelected: chipSelected }) =>
                    chipStyle(chipSelected) ?? {}
                  }
                >
                  {({ allowsRemoving: removing, isSelected: chipSelected }) => (
                    <>
                      {renderTagLeadingSlot(
                        item,
                        chipComposition(chipSelected),
                      )}
                      {item.label}
                      {removing && (
                        <Button slot="remove" className="tag-remove-btn">
                          <X size={14} />
                        </Button>
                      )}
                    </>
                  )}
                </AriaTag>
              )}
            </TagList>
          ) : (
            <TagList
              items={staticNodes ? undefined : items}
              renderEmptyState={renderEmptyState}
              className="react-aria-TagList"
            >
              {displayChildren}
            </TagList>
          )}
          {showAllButton && (
            <button
              className="tag-show-all-btn"
              onClick={() => setIsCollapsed(false)}
              type="button"
            >
              Show all ({totalChildCount})
            </button>
          )}
          {hasMaxRows && !isCollapsed && (
            <button
              className="tag-show-all-btn"
              onClick={() => setIsCollapsed(true)}
              type="button"
            >
              Show less
            </button>
          )}
        </div>
        {renderFieldDescription(description)}
        {renderTagGroupError(errorMessage)}
      </AriaTagGroup>
    </div>
  );
}

/** The maxRows measuring mirror: every tag as a plain chip (`useTagMaxRows` counts its rows). */
export function TagMaxRowsMirror({
  hiddenRef,
  size,
  labelPosition,
  entries,
  chipStyle,
  composition,
}: {
  hiddenRef: React.RefObject<HTMLDivElement | null>;
  size: string;
  labelPosition: string;
  entries: ReadonlyArray<{
    text: string;
    icon: string | null;
    avatar: string | null;
  }>;
  chipStyle?: React.CSSProperties;
  composition?: TagItemTemplate["composition"];
}): JSX.Element {
  return (
    <div
      ref={hiddenRef}
      inert
      aria-hidden="true"
      className="react-aria-TagList"
      data-tag-size={size}
      data-label-position={labelPosition}
      style={{
        display: "flex",
        flexWrap: "wrap",
        // chip 간 gap 정본 = TagList catalog rule (lg=6, 그 외 4). 실제 wrapper(.tag-list-wrapper)
        //   의 size 별 gap 과 동일해야 maxRows wrap 측정이 정확. Skia resolveTagListGap 과 정합.
        gap: size === "L" ? "6px" : "var(--spacing-xs)",
        position: "absolute",
        visibility: "hidden",
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
        width: "100%",
      }}
    >
      {entries.map((entry, i) => (
        <span key={i} className="react-aria-Tag" style={chipStyle}>
          {/* 미러는 실제 chip 의 **정확한 폭 대체**여야 한다 — 좌측 슬롯(icon/avatar)을
              빼면 슬롯 있는 chip 이 실제보다 좁게 측정돼 행당 개수가 과다 산출된다
              (같은 축의 과거 결함: chip size CSS 미적용 / side-label 폭 미차감).
              ADR-229: template style · slot gating 도 실제 chip 과 같은 값으로. */}
          {renderTagLeadingSlot(entry, composition)}
          {entry.text}
        </span>
      ))}
    </div>
  );
}

export function Tag({ children, ...props }: TagProps): JSX.Element {
  const textValue = typeof children === "string" ? children : undefined;
  return (
    <AriaTag textValue={textValue} {...props} className="react-aria-Tag">
      {(renderProps) => (
        <>
          {/* ADR-234 Phase 3 — 정적 Tag instance 는 자손 상태 층을 children 함수로 받는다. */}
          {/* ADR-256 Phase 5d — 지우기 버튼은 Tag 원본의 `Button[slot=remove]` 노드다 (showWhen
              allowsRemoving): 여기서 덧붙이지 않는다. */}
          {typeof children === "function"
            ? (children as (p: typeof renderProps) => React.ReactNode)(
                renderProps,
              )
            : children}
        </>
      )}
    </AriaTag>
  );
}
