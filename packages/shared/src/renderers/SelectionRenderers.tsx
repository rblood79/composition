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
  Icon,
} from "../components/list";
import {
  ListBoxSection as AriaListBoxSection,
  Header as AriaHeader,
  GridListSection as AriaGridListSection,
  GridListHeader as AriaGridListHeader,
  Text as AriaText,
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
// ADR-148 Phase 0 — slot 구성 소비 (origin slot 자식의 존재 gating / 스타일 / 순서).
import {
  isSlotEnabled,
  resolveSlotComposition,
  type SlotComposition,
  type SlotRole,
} from "../catalog/slotRoles";
// ADR-159 P3 — 행 텍스트 `{field}` 템플릿: Skia projection(canvasSceneNode)과 동일한
//   shared 단일 resolver 소비 (G2). 구 ad-hoc regex(resolveTemplateText)는 slot text 를
//   못 읽고 토큰 없는 literal 을 그대로 표시해 Skia BC 판정(휴리스틱 fallback)과 발산했다.
import {
  compileFieldTemplate,
  interpolateCollectionRowTemplate as interpolateRowTemplate,
  resolveRowTemplateSource,
  type CompiledTemplate,
  type RowTemplateRole,
} from "../collections/fieldTemplate";
import {
  getItemDescription,
  getItemIcon,
  getItemLabel,
} from "../collections/resolveCollectionItems";

/**
 * ADR-159 P3: 행 role 템플릿 compile — 행 루프 밖 1회 호출 계약 (R5).
 * 소스 precedence 는 shared `resolveRowTemplateSource`(§2-3-1) 단일 판정:
 * slot text > template item props(children/textValue | description) > null.
 */
function compileRowTemplateFor(
  slotComposition: SlotComposition | null | undefined,
  role: RowTemplateRole,
  templateItemProps: Record<string, unknown> | null | undefined,
): CompiledTemplate | null {
  const source = resolveRowTemplateSource(
    slotComposition,
    role,
    templateItemProps ?? null,
  );
  return source ? compileFieldTemplate(source) : null;
}

/**
 * ADR-147/148: ListBoxItem slot 콘텐츠 — RAC `<Text slot="label">`/`<Text slot="description">`
 * + decorative icon + selection 체크마크. Builder Skia `listbox_item` skiaPrimitive 의
 * icon/label/description/check 와 D3 시각 대칭. 체크마크는 `isSelected` 일 때만(Skia 와 동일).
 *
 * **ADR-148 Phase 0 (slot 자식 배선)**: `slotComposition`(origin slot 조합 자식에서 파생) 이
 * 있으면 slot **존재 gating**(구성에 없는 slot 미 emit) + **스타일 overlay**(slot 자식
 * props.style) + **emit 순서**(label/description 등장 순서 — ListBox.css 가 flex-column 이라
 * DOM 순서 = 시각 스택 순서, Skia stackEntries 와 대칭) 를 소비한다. null 이면 기존 동작(BC).
 */
function renderListBoxItemSlotContent(opts: {
  label: React.ReactNode;
  description: string | null;
  iconName: string | null;
  isSelected: boolean;
  slotComposition?: SlotComposition | null;
}): React.ReactNode {
  const { label, description, iconName, isSelected, slotComposition } = opts;
  const slotStyleOf = (role: SlotRole): React.CSSProperties | undefined =>
    slotComposition?.slots[role]?.style as React.CSSProperties | undefined;

  const iconStyle = slotStyleOf("icon");
  const iconNode =
    isSlotEnabled(slotComposition, "icon") && iconName ? (
      // 컨테이너 박스·텍스트 여백은 ListBox.css `--lb-icon-size` 가 스케일 (행 스코프 주입).
      <span slot="icon" aria-hidden="true">
        <Icon iconName={iconName} style={{ fontSize: 16, ...iconStyle }} />
      </span>
    ) : null;

  const labelNode = isSlotEnabled(slotComposition, "label") ? (
    <AriaText slot="label" style={slotStyleOf("label")}>
      {label}
    </AriaText>
  ) : null;
  const descriptionNode =
    isSlotEnabled(slotComposition, "description") && description ? (
      <AriaText slot="description" style={slotStyleOf("description")}>
        {description}
      </AriaText>
    ) : null;

  // label/description emit 순서 — slot 자식 등장 순서 (기본: label → description).
  const descriptionFirst =
    slotComposition != null &&
    slotComposition.order.indexOf("description") !== -1 &&
    slotComposition.order.indexOf("description") <
      slotComposition.order.indexOf("label");

  return (
    <>
      {iconNode}
      {descriptionFirst ? descriptionNode : labelNode}
      {descriptionFirst ? labelNode : descriptionNode}
      {isSelected ? (
        <Icon
          iconName="check"
          aria-hidden="true"
          className="listbox-item-check"
          style={{ fontSize: 16 }}
        />
      ) : null}
    </>
  );
}

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
 * ADR-148 Phase 4: GridListItem slot 콘텐츠 — label/description span 을 slot 구성으로
 * **존재 gating**(구성에 없는 slot 미 emit) + **스타일 overlay**(slot 자식 props.style) +
 * **emit 순서**(등장 순서 — 카드 flex-column 이라 DOM 순서 = 시각 스택 순서, Skia
 * gridlist_card stackEntries 와 대칭) 소비한다. null 이면 기존 동작(BC).
 */
function renderGridListItemSlotContent(opts: {
  label: React.ReactNode;
  description: string | null;
  slotComposition?: SlotComposition | null;
}): React.ReactNode {
  const { label, description, slotComposition } = opts;
  const slotStyleOf = (role: SlotRole): React.CSSProperties | undefined =>
    slotComposition?.slots[role]?.style as React.CSSProperties | undefined;

  // ADR-148 후속 (2026-07-22): label/description 은 RAC `<Text>` (react-aria-Text) — origin
  //   (reusable template 실 Text 자식) 및 Skia gridlist_card metric(둘 다 16 → line box 24 → 카드
  //   76)과 정합. 과거 `.gridlist-item-*` 레거시 클래스(label 14 / desc 12)는 64로 발산했다.
  //   RAC GridListItem 의 TextContext 는 DEFAULT_SLOT + description 만 제공(label slot 없음) →
  //   `slot="label"` 은 "Invalid slot" 크래시. label 은 default slot Text 로 렌더하고 GridList.css
  //   `.react-aria-Text:not([slot="description"])` 로 bold 유지. muted desc 는 `[slot="description"]`.
  const labelNode = isSlotEnabled(slotComposition, "label") ? (
    <AriaText style={slotStyleOf("label")}>{label}</AriaText>
  ) : null;
  const descriptionNode =
    isSlotEnabled(slotComposition, "description") && description ? (
      <AriaText slot="description" style={slotStyleOf("description")}>
        {description}
      </AriaText>
    ) : null;

  const descriptionFirst =
    slotComposition != null &&
    slotComposition.order.indexOf("description") !== -1 &&
    slotComposition.order.indexOf("description") <
      slotComposition.order.indexOf("label");

  return (
    <>
      {descriptionFirst ? descriptionNode : labelNode}
      {descriptionFirst ? labelNode : descriptionNode}
    </>
  );
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
  const listBoxTemplateChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "ListBoxItem" || child.type === "ref");

  // ADR-148 Phase 0 — slot 구성: template anchor(resolved ref)의 자식(= origin slot 조합
  //   자식이 ref resolution 으로 확장된 것)에서 파생. PreviewElement 는 metadata 를 운반하지
  //   않으므로 판독은 props.slot fallback(getSlotRole) 경유. null = legacy 문서 → 기존 동작.
  const templateSlotComposition = (() => {
    const anchor = listBoxTemplateChildren[0];
    const fromAnchor = anchor
      ? resolveSlotComposition(context.childrenByParent.get(anchor.id))
      : null;
    if (fromAnchor) return fromAnchor;
    // Option B(anchor-less/bare-ref — 표준 신규 shape): renderer 의 childrenByParent 는
    //   현 노드 서브트리 한정이라 Components 페이지 origin 에 접근 불가 → provider(Preview
    //   App)가 문서에서 계산해 context 로 주입한 구성 사용 (builder projection
    //   resolveListBoxTemplateOriginId 의 master slot[0] → default origin 해석과 대칭).
    if (context.listBoxTemplateSlotComposition !== undefined) {
      return context.listBoxTemplateSlotComposition;
    }
    // legacy(비-canonical) preview 경로: 전체 elements 기반 childrenByParent 에서 기본
    //   origin 의 slot 자식 직접 조회. id 리터럴 = listBoxTemplateOrigins 시드 규약
    //   (shared 는 builder 를 import 할 수 없어 리터럴 공유).
    return resolveSlotComposition(
      context.childrenByParent.get("component-listbox-item-default"),
    );
  })();
  // icon slot 자식 fontSize = icon 크기 채널 (Skia iconSize 와 대칭). ListBox.css 가
  //   `--lb-icon-size` 로 icon 박스와 :has 텍스트 여백을 함께 스케일한다.
  const iconSlotFontSize = templateSlotComposition?.slots.icon?.style?.fontSize;
  const rowSlotStyleVars =
    iconSlotFontSize != null
      ? ({
          "--lb-icon-size":
            typeof iconSlotFontSize === "number"
              ? `${iconSlotFontSize}px`
              : String(iconSlotFontSize),
        } as React.CSSProperties)
      : undefined;

  // 2026-07-20 (Selected variant 배선) — 행 template origin root style 소비.
  //   base(default origin `slot[0]`) 는 모든 행에, selected(Selected variant origin) 는
  //   data-selected 행에만 overlay. builder Skia projection(templateAnchorStyle +
  //   selectedOriginStyle)과 D3 대칭 — catalog CSS(data-selected accent-subtle)는 base 로
  //   유지되고 origin style 은 inline override 층이다. 미주입(null) = legacy → 기존 동작.
  const rowTemplateStyles = context.listBoxRowTemplateStyles;
  const rowBaseTemplateStyle = (rowTemplateStyles?.base ?? undefined) as
    | React.CSSProperties
    | undefined;
  const rowSelectedTemplateStyle = (rowTemplateStyles?.selected ??
    undefined) as React.CSSProperties | undefined;
  const composeRowStyle = (
    localStyle: React.CSSProperties | undefined,
  ):
    | React.CSSProperties
    | ((values: { isSelected: boolean }) => React.CSSProperties)
    | undefined => {
    if (!rowBaseTemplateStyle && !rowSelectedTemplateStyle) return localStyle;
    return ({ isSelected }) => ({
      ...rowBaseTemplateStyle,
      ...localStyle,
      ...(isSelected ? rowSelectedTemplateStyle : undefined),
    });
  };

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
    (columnMapping || isPropertyBinding || dataBinding) &&
    listBoxTemplateChildren.length > 0;

  // ADR-076: Path 2 (items canonical) — props.items 배열 존재
  const storedItems = (element.props as { items?: StoredListBoxItem[] }).items;
  const hasItemsArray = Array.isArray(storedItems) && storedItems.length > 0;

  // ADR-146 혼합 감지 — data-bound template 우선, props.items 는 seed/fallback 으로만 유지.
  if (hasValidTemplate && hasItemsArray) {
    console.warn(
      `[ADR-146] ListBox ${element.id}: columnMapping/dataBinding 템플릿과 props.items 가 동시 존재. ` +
        `data-bound 템플릿 경로를 우선하고 props.items 는 seed/fallback 으로만 사용합니다.`,
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

  // key 시그니처용 — selection source props 직렬화. defaultSelectedKeys(uncontrolled) 는
  //   mount 시점 selection 만 읽으므로, 패널에서 selectedKeys/selectedKey/selectedIndex 토글
  //   시 이 시그니처가 바뀌어 key 가 달라지고 ListBox 가 re-mount → 새 defaultSelectedKeys 를
  //   다시 읽게 한다 (Checkbox/RadioGroup 동형). Skia 는 canvasSceneNode 가 selectedKeys 로
  //   row _isSelected 를 매 rebuild 즉시 그리므로, key 없으면 Skia↔CSS preview drift.
  const selectionSignature = (() => {
    const p = element.props as {
      selectedKeys?: unknown;
      selectedKey?: unknown;
      selectedIndices?: unknown;
      selectedIndex?: unknown;
    };
    return JSON.stringify([
      Array.isArray(p.selectedKeys) ? [...p.selectedKeys].map(String) : null,
      typeof p.selectedKey === "string" ? p.selectedKey : null,
      Array.isArray(p.selectedIndices) ? [...p.selectedIndices] : null,
      typeof p.selectedIndex === "number" ? p.selectedIndex : null,
    ]);
  })();

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
    const listBoxItemTemplate = listBoxTemplateChildren[0];

    // Field 자식들 찾기 - context.childrenByParent O(1) lookup
    const fieldChildren = (
      context.childrenByParent.get(listBoxItemTemplate.id) ?? []
    ).filter((child) => child.type === "Field");

    // ADR-159 P3: 행 템플릿 compile — 행 루프 밖 1회 (R5). slot text > template item
    //   props 순 precedence (Skia projection 과 동일 shared 판정). 토큰 없는 소스는
    //   compile null → 휴리스틱 fallback (G3 BC — Skia 와 대칭. 구 resolveTemplateText
    //   는 literal 을 그대로 표시해 발산했다).
    const templateItemProps = listBoxItemTemplate.props as Record<
      string,
      unknown
    >;
    const rowLabelTemplate = compileRowTemplateFor(
      templateSlotComposition,
      "label",
      templateItemProps,
    );
    const rowDescriptionTemplate = compileRowTemplateFor(
      templateSlotComposition,
      "description",
      templateItemProps,
    );
    // ADR-147 icon 채널: 소스는 template props.icon 단독 (Icon slot 자식은 text 미보유).
    //   토큰 없는 icon 문자열은 literal icon name 의미 유지 (heuristic 전환 아님).
    const iconTemplateSource =
      typeof templateItemProps.icon === "string" &&
      templateItemProps.icon.length > 0
        ? templateItemProps.icon
        : null;
    const rowIconTemplate = iconTemplateSource
      ? compileFieldTemplate(iconTemplateSource)
      : null;

    const renderItemFunction = (item: Record<string, unknown>) => {
      const label = getItemLabel(item, String(item.id ?? ""), 0);
      const templateLabel = rowLabelTemplate
        ? interpolateRowTemplate(rowLabelTemplate, item)
        : label;
      const templateDescription = rowDescriptionTemplate
        ? interpolateRowTemplate(rowDescriptionTemplate, item)
        : getItemDescription(item);
      // ADR-147: icon slot — template binding({icon}) 또는 data field(heuristic) 결과.
      const templateIcon = rowIconTemplate
        ? interpolateRowTemplate(rowIconTemplate, item)
        : (iconTemplateSource ?? getItemIcon(item));

      const renderFieldChildren = () =>
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
              visible={(field.props as { visible?: boolean }).visible !== false}
              style={field.props.style}
              className={field.props.className}
            />
          );
        });

      return (
        <ListBoxItem
          key={String(item.id)}
          id={String(item.id ?? label)}
          data-element-id={listBoxItemTemplate.id}
          value={item}
          isDisabled={Boolean(listBoxItemTemplate.props.isDisabled)}
          className={listBoxItemTemplate.props.className}
          // ADR-147 (layout edit): template anchor 의 layout style 을 각 행에 적용.
          //   CSS 가 flex/gap/align 을 처리 → Skia render.shapes 와 D3 대칭.
          //   ADR-148: icon slot 크기 채널(--lb-icon-size) 을 행 스코프에 주입.
          //   2026-07-20: origin root style(base) + Selected variant overlay 합성.
          style={composeRowStyle(
            rowSlotStyleVars
              ? {
                  ...(listBoxItemTemplate.props.style as
                    | React.CSSProperties
                    | undefined),
                  ...rowSlotStyleVars,
                }
              : (listBoxItemTemplate.props.style as
                  | React.CSSProperties
                  | undefined),
          )}
          textValue={label}
        >
          {({ isSelected }) =>
            // 레거시 Field 자식(ADR-147 Phase 6 마이그레이션 대상)은 보존, 그 외는 slot 콘텐츠.
            fieldChildren.length > 0 ? (
              <>{renderFieldChildren()}</>
            ) : (
              renderListBoxItemSlotContent({
                label: templateLabel,
                description: templateDescription,
                iconName: templateIcon,
                isSelected,
                slotComposition: templateSlotComposition,
              })
            )
          }
        </ListBoxItem>
      );
    };

    return (
      <ListBox
        key={`${element.id}:${selectionSignature}`}
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
  // ADR-159 P3: 정적 items 행에도 slot 템플릿 적용 (Skia projection 이 props.items 행에도
  //   동일 적용하는 것과 대칭). compile 은 행 루프 밖 1회.
  const staticLabelTemplate = compileRowTemplateFor(
    templateSlotComposition,
    "label",
    (listBoxTemplateChildren[0]?.props as Record<string, unknown>) ?? null,
  );
  const staticDescriptionTemplate = compileRowTemplateFor(
    templateSlotComposition,
    "description",
    (listBoxTemplateChildren[0]?.props as Record<string, unknown>) ?? null,
  );
  const renderListBoxLeaf = (item: StoredListBoxItem): React.ReactNode => (
    <ListBoxItem
      key={item.id}
      id={item.id}
      // ADR-154 responsive @media 전가 방지: buildResponsiveElementCss 는 컨테이너의
      //   responsive override 를 `@media { [data-element-id="{owner}"] { ...!important } }` 로
      //   emit 한다. items[] 행이 owner element.id 를 data-element-id 로 물려받으면 그 규칙이
      //   모든 행에 매치되어 min-height/gap 등이 자식으로 전가된다(2026-07-21). 행은 owner id 를
      //   갖지 않는다 — 클릭 매핑은 preview App 의 closest([data-element-id]) 가 상위 ListBox
      //   루트(data-element-id={owner})를 찾아 보존된다. (Path 1 템플릿 행은 template.id 를
      //   써 owner 와 충돌하지 않으므로 별도 유지.)
      textValue={item.textValue ?? item.label}
      isDisabled={Boolean(item.isDisabled)}
      // ADR-148: icon slot 크기 채널(--lb-icon-size) — Path 1 과 동일 주입.
      //   2026-07-20: origin root style(base) + Selected variant overlay 합성.
      style={composeRowStyle(rowSlotStyleVars)}
      // RAC ListBoxItem 은 `href` 키가 존재하기만 하면(undefined 값이어도) link 모드로
      // 진입해 DOM 에 `href=""` 를 렌더 → React 경고("empty string passed to href").
      // 따라서 href 가 있을 때만 prop 을 전개(conditional spread)해 키 자체를 제거한다.
      {...(item.href ? { href: item.href } : {})}
    >
      {({ isSelected }) =>
        // ADR-147: items[] 경로도 label/description/icon slot emit (기존 description 미렌더 버그 수정).
        // ADR-159 P3: 템플릿 존재 시 stored item 보간 — 없으면 기존 item.label/description (BC).
        renderListBoxItemSlotContent({
          label: staticLabelTemplate
            ? interpolateRowTemplate(
                staticLabelTemplate,
                item as unknown as Record<string, unknown>,
              )
            : item.label,
          description: staticDescriptionTemplate
            ? interpolateRowTemplate(
                staticDescriptionTemplate,
                item as unknown as Record<string, unknown>,
              )
            : (item.description ?? null),
          iconName: item.icon ?? null,
          isSelected,
          slotComposition: templateSlotComposition,
        })
      }
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
    renderChildren = listBoxTemplateChildren.map((item) =>
      context.renderElement(item),
    );
  }

  return (
    <ListBox
      key={`${element.id}:${selectionSignature}`}
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
      // ADR-159 P3: 내부 기본 렌더(가상화/resolvedRows 경로 — 전달 children 무시)도
      //   동일 템플릿을 적용하도록 소스 문자열 전달 (bare-ref data-bound 인스턴스 커버).
      rowTemplateSources={{
        label: staticLabelTemplate?.source ?? null,
        description: staticDescriptionTemplate?.source ?? null,
      }}
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

  // ADR-148 Phase 4 — slot 구성: renderListBox 동형 3단 fallback (template child 자식 →
  //   provider 주입 → legacy 전체-트리 origin 리터럴 조회). null = legacy 문서 → 기존 동작.
  const templateSlotComposition = (() => {
    const template = gridListChildren[0];
    const fromTemplate = template
      ? resolveSlotComposition(context.childrenByParent.get(template.id))
      : null;
    if (fromTemplate) return fromTemplate;
    if (context.gridListTemplateSlotComposition !== undefined) {
      return context.gridListTemplateSlotComposition;
    }
    return resolveSlotComposition(
      context.childrenByParent.get("component-gridlist-item-default"),
    );
  })();

  // key 시그니처용 — selectedKeys 직렬화. defaultSelectedKeys(uncontrolled) 는 mount 시점
  //   selection 만 읽으므로, 패널에서 selectedKeys 토글 시 이 시그니처가 바뀌어 key 가 달라지고
  //   GridList 가 re-mount → 새 defaultSelectedKeys 를 다시 읽게 한다 (Checkbox/RadioGroup 동형).
  //   Skia 는 canvasSceneNode 가 selectedKeys 로 card _isSelected 를 매 rebuild 즉시 그리므로,
  //   key 없으면 Skia↔CSS preview drift.
  const gridSelectionSignature = JSON.stringify(
    Array.isArray(element.props.selectedKeys)
      ? [...(element.props.selectedKeys as unknown[])].map(String)
      : null,
  );

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

  // ADR-159 P3: 카드 텍스트 템플릿 compile — 행 루프 밖 1회 (R5). slot text > template
  //   item props precedence (Skia appendGridListRowProjection 과 동일 shared 판정).
  const cardTemplateItemProps =
    (gridListChildren[0]?.props as Record<string, unknown>) ?? null;
  const cardLabelTemplate = compileRowTemplateFor(
    templateSlotComposition,
    "label",
    cardTemplateItemProps,
  );
  const cardDescriptionTemplate = compileRowTemplateFor(
    templateSlotComposition,
    "description",
    cardTemplateItemProps,
  );

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
              : // ADR-159 P3: 데이터 행 보간 — 구 코드는 template props.label literal 을
                //   모든 카드에 반복 표시했다 (행 데이터 미소비). 템플릿 없으면 휴리스틱 (BC).
                renderGridListItemSlotContent({
                  label: cardLabelTemplate
                    ? interpolateRowTemplate(cardLabelTemplate, item)
                    : getItemLabel(item, String(item.id ?? ""), 0),
                  description: cardDescriptionTemplate
                    ? interpolateRowTemplate(cardDescriptionTemplate, item)
                    : getItemDescription(item),
                  slotComposition: templateSlotComposition,
                })}
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
              {/* ADR-159 P3: 정적 items 카드에도 slot 템플릿 적용 (Skia 대칭). */}
              {renderGridListItemSlotContent({
                label: cardLabelTemplate
                  ? interpolateRowTemplate(
                      cardLabelTemplate,
                      item as unknown as Record<string, unknown>,
                    )
                  : item.label,
                description: cardDescriptionTemplate
                  ? interpolateRowTemplate(
                      cardDescriptionTemplate,
                      item as unknown as Record<string, unknown>,
                    )
                  : (item.description ?? null),
                slotComposition: templateSlotComposition,
              })}
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
      key={`${element.id}:${gridSelectionSignature}`}
      id={element.customId}
      aria-label={String(element.props.label || "Grid List")}
      data-element-id={element.id}
      className={element.props.className}
      style={element.props.style as React.CSSProperties | undefined}
      variant={(element.props.variant as "default" | "accent") || "default"}
      layout={(element.props.layout as "stack" | "grid") || "grid"}
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
      // ADR-159 P3: 내부 기본 렌더(dataBinding resolvedRows 경로)도 동일 템플릿 적용
      //   (bare-ref data-bound 인스턴스 — hasValidTemplate false 로 Path 1 미경유 케이스).
      rowTemplateSources={{
        label: cardLabelTemplate?.source ?? null,
        description: cardDescriptionTemplate?.source ?? null,
      }}
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
        {/* GridListItem TextContext 는 DEFAULT_SLOT + description 만 제공(label slot 없음) →
            label 은 default slot Text. GridList.css `.react-aria-Text:not([slot="description"])`
            로 bold, accessible name 은 아래 GridListItem `textValue` 담당. */}
        <AriaText>{label}</AriaText>
        {description && <AriaText slot="description">{description}</AriaText>}
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
      labelAlign={
        elementProps.labelAlign as "start" | "center" | "end" | undefined
      }
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
  // ADR-912 R1 (2026-06-12): ComboBoxWrapper/ComboBoxInput → Select family 공용 type retype.
  const wrapperEl = allChildren.find((c) => c.type === "SelectTrigger");
  const wrapperChildren = wrapperEl
    ? (context.childrenByParent.get(wrapperEl.id) ?? [])
    : [];
  const inputEl = wrapperChildren.find((c) => c.type === "SelectValue");

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
      labelAlign={
        element.props.labelAlign as "start" | "center" | "end" | undefined
      }
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
  _context: RenderContext,
): React.ReactNode => {
  const rawValue = element.props.value;
  const normalizedValue = Array.isArray(rawValue)
    ? (rawValue as number[])
    : [Number(rawValue) || 50];

  // ADR-912 후속(2026-06-09): Preview/Publish 런타임의 Slider 드래그는 최종 사용자의
  //   런타임 상호작용이므로 RAC uncontrolled(defaultValue)로 렌더한다 (react-aria.adobe.com/Slider
  //   레퍼런스: value=controlled 인데 외부 state 미반영 시 thumb snap back → 드래그 silently 실패).
  //   기존 value(controlled) + onChange→updateElementProps 패턴은 runtime store 미반영으로
  //   value 가 고정되어 드래그가 50 으로 복원됐다. defaultValue 로 주면 RAC 가 내부 state 로
  //   드래그를 관리. 빌더 inspector 가 value 를 편집하면 key 의 value 변경으로 리마운트되어
  //   새 defaultValue 가 반영된다 (편집 초기값 동기화 유지).
  //   2026-07-06 전수조사: key 에 minValue/maxValue 도 포함. range(min/max) 편집은
  //   value 불변이라 key 가 안 바뀌어 리마운트 실패 → RAC 가 이전 range 에 stale →
  //   내부 value 가 새 max 로 clamp 되어 thumb 이 Skia(store value 기준 percent)와 발산
  //   (value=50/max 100→63 시 RAC 63 clamp → thumb 100% vs Skia 79%).
  const sliderMin = Number(element.props.minValue) || 0;
  const sliderMax = Number(element.props.maxValue) || 100;
  return (
    <Slider
      key={`${element.id}-${normalizedValue.join(",")}-${sliderMin}-${sliderMax}`}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      label={String(element.props.label || "")}
      defaultValue={normalizedValue}
      minValue={sliderMin}
      maxValue={sliderMax}
      step={Number(element.props.step) || 1}
      orientation={
        (element.props.orientation as "horizontal" | "vertical") || "horizontal"
      }
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      isDisabled={Boolean(element.props.isDisabled)}
      isEmphasized={Boolean(element.props.isEmphasized)}
      // ADR-915 P1.5-d (2026-07-16): 값 라벨 표시 여부를 DOM 에도 forward — Skia
      //   (buildSpecNodeData:800)/layout(utils:2608) 은 이미 소비하나 DOM 은 SliderOutput
      //   무조건 렌더였음(showValueLabel=false 시 비대칭). 기본 true.
      showValueLabel={element.props.showValueLabel !== false}
      // 2026-07-16: labelPosition forward — data-label-position emit 으로 generated CSS
      //   `[data-label-position="side"]` 소비 (Label · Track · Value 가로 배치). Skia 대칭은
      //   implicitStyles Slider 분기. orientation 패널 항목 제거 → labelPosition 으로 대체.
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      formatOptions={
        element.props.formatOptions as Intl.NumberFormatOptions | undefined
      }
      locale={(element.props.locale as string) || undefined}
    />
  );
};
