import React from "react";
import {
  Form,
  TextField,
  TextArea,
  NumberField,
  SearchField,
  Input,
  Label,
  Description,
  FieldError,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Switch,
  FileTrigger,
  DropZone,
} from "../components/list";
import { MyColorSwatches } from "../components/TailSwatch";
import { parseColor, type Color } from "react-aria-components";
import type { ElementProps, PreviewElement, RenderContext } from "../types";
import { getSelectedChildIds } from "./selection";

/**
 * Form 관련 컴포넌트 렌더러
 * - TextField, Input, Label, Description, FieldError
 * - Checkbox, CheckboxGroup
 * - Radio, RadioGroup
 * - Switch
 */

type InheritedFormFieldProps = {
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "center" | "end";
  necessityIndicator?: "icon" | "label";
};

function findNearestAncestorForm(
  element: PreviewElement,
  elementsById: ReadonlyMap<string, PreviewElement>,
): PreviewElement | null {
  let currentParentId = element.parent_id;

  while (currentParentId) {
    const parent = elementsById.get(currentParentId);
    if (!parent) return null;
    if (parent.type === "Form") return parent;
    currentParentId = parent.parent_id;
  }

  return null;
}

export function resolveInheritedFormFieldProps(
  element: PreviewElement,
  context: RenderContext,
): InheritedFormFieldProps {
  const formElement = findNearestAncestorForm(element, context.elementsById);
  if (!formElement) return {};

  return {
    labelPosition: formElement.props.labelPosition as
      "top" | "side" | undefined,
    labelAlign: formElement.props.labelAlign as
      "start" | "center" | "end" | undefined,
    necessityIndicator: formElement.props.necessityIndicator as
      "icon" | "label" | undefined,
  };
}

/**
 * 텍스트 HTML 입력 힌트 attr 묶음 (ADR-915 P1.5-b).
 * RAC TextField/SearchField 공식 prop — `<input>` 전달, controlled-value 와 직교.
 * inputMode/enterKeyHint 의 union 타입은 컴포넌트 prop 에서 파생 (인라인 union 재선언 회피).
 */
type TextFieldRacProps = React.ComponentProps<typeof TextField>;

function resolveInputHintProps(props: ElementProps) {
  return {
    autoComplete: props.autoComplete ? String(props.autoComplete) : undefined,
    autoCorrect: props.autoCorrect ? String(props.autoCorrect) : undefined,
    inputMode: props.inputMode
      ? (props.inputMode as TextFieldRacProps["inputMode"])
      : undefined,
    enterKeyHint: props.enterKeyHint
      ? (props.enterKeyHint as TextFieldRacProps["enterKeyHint"])
      : undefined,
    spellCheck: props.spellCheck ? String(props.spellCheck) : undefined,
  };
}

/**
 * Form 렌더링
 */
export const renderForm = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Form
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      action={element.props.action ? String(element.props.action) : undefined}
      method={(element.props.method as "get" | "post" | undefined) || undefined}
      encType={
        (element.props.encType as
          | "application/x-www-form-urlencoded"
          | "multipart/form-data"
          | "text/plain"
          | undefined) || undefined
      }
      target={
        (element.props.target as
          "_self" | "_blank" | "_parent" | "_top" | undefined) || undefined
      }
      autoFocus={Boolean(element.props.autoFocus)}
      restoreFocus={Boolean(element.props.restoreFocus)}
      validationBehavior={
        (element.props.validationBehavior as "native" | "aria" | undefined) ||
        undefined
      }
      labelPosition={
        (element.props.labelPosition as "top" | "side" | undefined) || undefined
      }
      labelAlign={
        (element.props.labelAlign as "start" | "center" | "end" | undefined) ||
        undefined
      }
      necessityIndicator={
        (element.props.necessityIndicator as "icon" | "label" | undefined) ||
        undefined
      }
    >
      {children.map((child) => renderElement(child, child.id))}
    </Form>
  );
};

/**
 * TextField 렌더링
 */
export const renderTextField = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;
  const inheritedProps = resolveInheritedFormFieldProps(element, context);

  return (
    <TextField
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      size={element.props.size as "sm" | "md" | "lg"}
      label={String(element.props.label || "")}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      placeholder={String(element.props.placeholder || "")}
      type={
        (element.props.type as
          | "text"
          | "email"
          | "password"
          | "search"
          | "tel"
          | "url"
          | "number") || "text"
      }
      defaultValue={String(element.props.value || "")}
      isDisabled={Boolean(element.props.isDisabled || false)}
      isRequired={Boolean(element.props.isRequired || false)}
      isReadOnly={Boolean(element.props.isReadOnly || false)}
      isInvalid={Boolean(element.props.isInvalid || false)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      necessityIndicator={
        (element.props.necessityIndicator as "icon" | "label" | undefined) ??
        inheritedProps.necessityIndicator
      }
      labelPosition={
        (element.props.labelPosition as "top" | "side" | undefined) ??
        inheritedProps.labelPosition ??
        "top"
      }
      labelAlign={
        (element.props.labelAlign as "start" | "center" | "end" | undefined) ??
        inheritedProps.labelAlign
      }
      name={element.props.name ? String(element.props.name) : undefined}
      maxLength={
        element.props.maxLength !== undefined
          ? Number(element.props.maxLength)
          : undefined
      }
      minLength={
        element.props.minLength !== undefined
          ? Number(element.props.minLength)
          : undefined
      }
      pattern={
        element.props.pattern ? String(element.props.pattern) : undefined
      }
      autoFocus={Boolean(element.props.autoFocus)}
      {...resolveInputHintProps(element.props)}
      onChange={(value) => {
        const updatedProps = {
          ...element.props,
          value: String(value),
        };
        updateElementProps(element.id, updatedProps);
      }}
    />
  );
};

/**
 * TextArea 렌더링 (2026-08-21 신설).
 *
 * 이전에는 catalog generic 경로가 `RAC.TextField` 를 그리고 그 안에 canonical `Input` 자식이
 * 들어가 DOM 이 **한 줄 `<input>`** 이었다 — `rows` 무반영. TextField 선례대로 wrapper 로
 * self-compose 해서 진짜 `<textarea>` 를 그린다. canonical 자식(Label/Input/FieldError)은
 * TextField 와 마찬가지로 DOM 에서 소비하지 않는다 — 그 자식들은 캔버스(Skia) 트리의 것이다.
 */
export const renderTextArea = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;
  const inheritedProps = resolveInheritedFormFieldProps(element, context);

  return (
    <TextArea
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      size={(element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || "md"}
      label={String(element.props.label || "")}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      placeholder={String(element.props.placeholder || "")}
      rows={
        element.props.rows !== undefined
          ? Number(element.props.rows)
          : undefined
      }
      defaultValue={String(element.props.value || "")}
      isDisabled={Boolean(element.props.isDisabled || false)}
      isRequired={Boolean(element.props.isRequired || false)}
      isReadOnly={Boolean(element.props.isReadOnly || false)}
      isInvalid={Boolean(element.props.isInvalid || false)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      necessityIndicator={
        (element.props.necessityIndicator as "icon" | "label" | undefined) ??
        inheritedProps.necessityIndicator
      }
      labelPosition={
        (element.props.labelPosition as "top" | "side" | undefined) ??
        inheritedProps.labelPosition ??
        "top"
      }
      labelAlign={
        (element.props.labelAlign as "start" | "center" | "end" | undefined) ??
        inheritedProps.labelAlign
      }
      name={element.props.name ? String(element.props.name) : undefined}
      maxLength={
        element.props.maxLength !== undefined
          ? Number(element.props.maxLength)
          : undefined
      }
      minLength={
        element.props.minLength !== undefined
          ? Number(element.props.minLength)
          : undefined
      }
      autoFocus={Boolean(element.props.autoFocus)}
      {...resolveInputHintProps(element.props)}
      onChange={(value) => {
        updateElementProps(element.id, {
          ...element.props,
          value: String(value),
        });
      }}
    />
  );
};

/**
 * NumberField 렌더링
 */
export const renderNumberField = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;
  const inheritedProps = resolveInheritedFormFieldProps(element, context);
  const formatOptions =
    element.props.formatOptions &&
    typeof element.props.formatOptions === "object"
      ? (element.props.formatOptions as Intl.NumberFormatOptions)
      : undefined;

  return (
    <NumberField
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      size={(element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || "md"}
      label={String(element.props.label || "")}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      defaultValue={Number(element.props.value || 0)}
      minValue={
        element.props.minValue !== undefined
          ? Number(element.props.minValue)
          : undefined
      }
      maxValue={
        element.props.maxValue !== undefined
          ? Number(element.props.maxValue)
          : undefined
      }
      step={
        element.props.step !== undefined
          ? Number(element.props.step)
          : undefined
      }
      locale={element.props.locale ? String(element.props.locale) : undefined}
      formatOptions={formatOptions}
      isDisabled={Boolean(element.props.isDisabled || false)}
      isRequired={Boolean(element.props.isRequired || false)}
      isReadOnly={Boolean(element.props.isReadOnly || false)}
      isInvalid={Boolean(element.props.isInvalid || false)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      necessityIndicator={
        (element.props.necessityIndicator as "icon" | "label" | undefined) ??
        inheritedProps.necessityIndicator
      }
      labelPosition={
        (element.props.labelPosition as "top" | "side" | undefined) ??
        inheritedProps.labelPosition ??
        "top"
      }
      labelAlign={
        (element.props.labelAlign as "start" | "center" | "end" | undefined) ??
        inheritedProps.labelAlign
      }
      name={element.props.name ? String(element.props.name) : undefined}
      autoFocus={Boolean(element.props.autoFocus)}
      isWheelDisabled={Boolean(element.props.isWheelDisabled)}
      onChange={(value) => {
        const updatedProps = {
          ...element.props,
          value: Number(value),
        };
        updateElementProps(element.id, updatedProps);
      }}
    />
  );
};

/**
 * SearchField 렌더링
 */
export const renderSearchField = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;
  const inheritedProps = resolveInheritedFormFieldProps(element, context);

  // Child element에서 props 읽기 (compositional 패턴)
  const childElements = context.childrenByParent.get(element.id) ?? [];

  const labelEl = childElements.find((c) => c.type === "Label");
  // ADR-912 R1 (2026-06-12): SearchFieldWrapper/SearchInput → Select family 공용 type retype.
  const wrapperEl = childElements.find((c) => c.type === "SelectTrigger");
  const wrapperChildren = wrapperEl
    ? (context.childrenByParent.get(wrapperEl.id) ?? [])
    : [];
  const inputEl = wrapperChildren.find((c) => c.type === "SelectValue");

  // child element props 우선 → parent props fallback
  const label = labelEl
    ? String(labelEl.props?.children || "")
    : String(element.props.label || "");
  const placeholder = inputEl
    ? String(inputEl.props?.placeholder || "")
    : String(element.props.placeholder || "");

  return (
    <SearchField
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      label={label}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      placeholder={placeholder}
      defaultValue={String(element.props.value || "")}
      isDisabled={Boolean(element.props.isDisabled || false)}
      isRequired={Boolean(element.props.isRequired || false)}
      isReadOnly={Boolean(element.props.isReadOnly || false)}
      isInvalid={Boolean(element.props.isInvalid || false)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      necessityIndicator={
        (element.props.necessityIndicator as "icon" | "label" | undefined) ??
        inheritedProps.necessityIndicator
      }
      labelPosition={
        (element.props.labelPosition as "top" | "side" | undefined) ??
        inheritedProps.labelPosition ??
        "top"
      }
      labelAlign={
        (element.props.labelAlign as "start" | "center" | "end" | undefined) ??
        inheritedProps.labelAlign
      }
      name={element.props.name ? String(element.props.name) : undefined}
      maxLength={
        element.props.maxLength !== undefined
          ? Number(element.props.maxLength)
          : undefined
      }
      minLength={
        element.props.minLength !== undefined
          ? Number(element.props.minLength)
          : undefined
      }
      pattern={
        element.props.pattern ? String(element.props.pattern) : undefined
      }
      autoFocus={Boolean(element.props.autoFocus)}
      {...resolveInputHintProps(element.props)}
      size={(element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || "md"}
      onChange={(value) => {
        const updatedProps = {
          ...element.props,
          value: String(value),
        };
        updateElementProps(element.id, updatedProps);
      }}
      onSubmit={(value) => {
        const updatedProps = {
          ...element.props,
          value: String(value),
        };
        updateElementProps(element.id, updatedProps);
      }}
      onClear={() => {
        const updatedProps = {
          ...element.props,
          value: "",
        };
        updateElementProps(element.id, updatedProps);
      }}
    />
  );
};

/**
 * Input 렌더링
 */
export const renderInput = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  return (
    <Input
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      type={
        (element.props.type as
          | "text"
          | "email"
          | "password"
          | "search"
          | "tel"
          | "url"
          | "number") || "text"
      }
      placeholder={String(element.props.placeholder || "")}
      defaultValue={String(element.props.value || "")}
      disabled={Boolean(element.props.isDisabled || false)}
      readOnly={Boolean(element.props.isReadOnly || false)}
      name={element.props.name ? String(element.props.name) : undefined}
      onChange={(value) => {
        const updatedProps = {
          ...element.props,
          value: String(value),
        };
        updateElementProps(element.id, updatedProps);
      }}
    />
  );
};

/**
 * Label 렌더링
 *
 * 부모가 <label> 요소(Checkbox, Radio, Switch)면 <span>으로 렌더
 * HTML 규격상 <label> 중첩 금지
 */
const LABEL_AS_SPAN_PARENTS = new Set(["Checkbox", "Radio", "Switch"]);

export const renderLabel = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { elementsById, renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  const content = (
    <>
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
      {children.map((child) => renderElement(child, child.id))}
    </>
  );

  // 부모가 <label> 요소면 <span>으로 렌더 (label 중첩 방지)
  const parentTag = element.parent_id
    ? elementsById.get(element.parent_id)?.type
    : null;

  if (parentTag && LABEL_AS_SPAN_PARENTS.has(parentTag)) {
    return (
      <span
        key={element.id}
        data-element-id={element.id}
        className="react-aria-Label"
      >
        {content}
      </span>
    );
  }

  return (
    <Label key={element.id} id={element.customId} data-element-id={element.id}>
      {content}
    </Label>
  );
};

/**
 * Description 렌더링
 */
export const renderDescription = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Description
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
    >
      {typeof element.props.text === "string"
        ? element.props.text
        : typeof element.props.children === "string"
          ? element.props.children
          : null}
      {children.map((child) => renderElement(child, child.id))}
    </Description>
  );
};

/**
 * FieldError 렌더링
 */
export const renderFieldError = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <FieldError
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
    >
      {typeof element.props.text === "string" ? element.props.text : null}
      {children.map((child) => renderElement(child, child.id))}
    </FieldError>
  );
};

/**
 * Checkbox 렌더링
 */
export const renderCheckbox = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps, renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Checkbox
      // key 에 selected/indeterminate 를 묶어, 패널에서 isSelected 를 토글하면
      //   key 가 바뀌어 RAC Checkbox 가 re-mount → 새 defaultSelected 를 다시 읽는다.
      //   defaultSelected 는 uncontrolled 라 mount 시점 값만 쓰므로, key 변경 없이는
      //   패널 토글이 DOM 에 반영 안 됨(Skia 는 props 직접 읽어 즉시 반영 → 두 경로 drift).
      //   preview 직접 클릭은 onChange→store 갱신 후 같은 값으로 key 가 재계산되므로
      //   불필요한 re-mount 없이 RAC 내부 상태로 정상 표시.
      key={`${element.id}:${Boolean(element.props.isSelected)}:${Boolean(
        element.props.isIndeterminate,
      )}`}
      id={element.customId}
      data-element-id={element.id}
      defaultSelected={Boolean(element.props.isSelected)}
      isIndeterminate={Boolean(element.props.isIndeterminate)}
      isDisabled={Boolean(element.props.isDisabled)}
      isInvalid={Boolean(element.props.isInvalid)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isRequired={Boolean(element.props.isRequired)}
      name={element.props.name ? String(element.props.name) : undefined}
      value={element.props.value ? String(element.props.value) : undefined}
      autoFocus={Boolean(element.props.autoFocus)}
      isEmphasized={Boolean(element.props.isEmphasized)}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      onChange={async (isSelected) => {
        const updatedProps = {
          ...element.props,
          isSelected: Boolean(isSelected),
        };

        // 1. Store 업데이트
        updateElementProps(element.id, updatedProps);

        // 2. SaveService 호출 (DI를 통해 context에서 주입)
        try {
          await context.services?.saveService?.savePropertyChange?.({
            table: "elements",
            id: element.id,
            data: { props: updatedProps },
          });
        } catch (error) {
          console.warn("⚠️ Preview Checkbox 저장 실패:", error);
        }
      }}
    >
      {/* Label 자식이 있으면 props.children 텍스트 생략 (이중 렌더링 방지) */}
      {typeof element.props.children === "string" &&
      !children.some((c) => c.type === "Label")
        ? element.props.children
        : null}
      {children.map((child) => renderElement(child, child.id))}
    </Checkbox>
  );
};

/**
 * CheckboxGroup 렌더링
 */
export const renderCheckboxGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { elements, batchUpdateElementProps, renderElement } = context;

  // Compositional: Label + CheckboxItems(중간 컨테이너) + Checkbox(레거시) 자식 분리
  const allChildren = context.childrenByParent.get(element.id) ?? [];

  const labelChild = allChildren.find((child) => child.type === "Label");
  const checkboxItemsChild = allChildren.find(
    (child) => child.type === "CheckboxItems",
  );

  // CheckboxItems가 있으면 그 하위에서 Checkbox 검색, 없으면(레거시) 직접 자식에서 검색
  const checkboxParentId = checkboxItemsChild
    ? checkboxItemsChild.id
    : element.id;
  const checkboxChildren = (
    context.childrenByParent.get(checkboxParentId) ?? []
  ).filter((child) => child.type === "Checkbox");

  // isSelected: true인 체크박스들의 ID를 value 배열로 생성
  const selectedValues = getSelectedChildIds(checkboxChildren);

  // 그룹 라벨: Label 자식 Element의 텍스트 사용 (renderElement 호출 제거 — 이중 렌더링 방지)
  const groupLabel =
    (labelChild?.props?.children as string) ||
    (element.props.label as string) ||
    undefined;

  return (
    <CheckboxGroup
      // key 에 selectedValues 시그니처를 묶어, 패널에서 자식 isSelected 를 토글하면
      //   key 가 바뀌어 RAC CheckboxGroup 이 re-mount → 새 defaultValue 를 다시 읽는다.
      //   defaultValue 는 uncontrolled(아래 주석 참조) 라 mount 시점 값만 쓰므로, key 변경
      //   없이는 패널 토글이 DOM 에 반영 안 됨. preview 직접 클릭은 onChange→store 갱신 후
      //   같은 selection 으로 key 가 재계산되어 불필요한 re-mount 없이 정상 표시.
      key={`${element.id}:${selectedValues.join(",")}`}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      label={groupLabel}
      // CheckboxGroup 선택을 RadioGroup 과 동일한 uncontrolled 패턴으로 정렬한다.
      //   controlled `value={selectedValues}` 는 selectedValues 가 preview canonical
      //   ResolvedNode 트리(flattenNodeChildrenByParent)에서 추출한 props.isSelected 기반인데,
      //   onChange 는 runtime store 의 elements 배열만 갱신(batchUpdateElementProps)한다. canonical
      //   렌더 경로(CanonicalNodeRenderer)는 canonicalDocument 만 감시 → elements 변화가 resolve
      //   재계산을 트리거하지 않아 selectedValues 가 영원히 stale → 체크 토글이 화면에 반영 안 됨
      //   (ADR-116/122 canonical 전환 잔존 결함). renderRadioGroup(아래)은 `defaultValue` uncontrolled
      //   라 RAC 자체 상태로 토글이 즉시 보이며 정상 동작 — 그 작동 참조에 맞춰 `defaultValue` 로 전환.
      //   store 갱신은 onChange 에서 그대로 수행(영속화 — 표시는 RAC, 저장은 store 분리).
      defaultValue={selectedValues}
      orientation={
        (element.props.orientation as "horizontal" | "vertical") || "vertical"
      }
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      isDisabled={Boolean(element.props.isDisabled)}
      isInvalid={Boolean(element.props.isInvalid)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isRequired={Boolean(element.props.isRequired)}
      necessityIndicator={
        element.props.necessityIndicator as "icon" | "label" | undefined
      }
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      name={element.props.name ? String(element.props.name) : undefined}
      errorMessage={
        element.props.errorMessage
          ? String(element.props.errorMessage)
          : undefined
      }
      onChange={async (newSelectedValues) => {
        const batch: Array<{ id: string; props: Record<string, unknown> }> = [
          {
            id: element.id,
            props: { ...element.props, value: newSelectedValues },
          },
        ];
        for (const checkbox of checkboxChildren) {
          const isSelected = newSelectedValues.includes(checkbox.id);
          if (checkbox.props.isSelected !== isSelected) {
            batch.push({
              id: checkbox.id,
              props: { ...checkbox.props, isSelected } as Record<
                string,
                unknown
              >,
            });
          }
        }
        batchUpdateElementProps(batch);
      }}
    >
      <div className="checkbox-items">
        {checkboxChildren.map((checkbox) => {
          // Checkbox의 자식 Label 요소 검색
          const checkboxLabelChildren = (
            context.childrenByParent.get(checkbox.id) ?? []
          ).filter((child) => child.type === "Label");

          return (
            // 자식 Checkbox 에 개별 onChange 를 주지 않는다(renderRadioGroup 의 자식 Radio 와 동일).
            //   uncontrolled 그룹에서 selection 토글은 RAC CheckboxGroup 이 내부 상태로 관리하고,
            //   store 영속화는 그룹 onChange(위)가 전체 selection 배열로 일괄 수행한다. 자식 개별
            //   onChange 를 두면 그룹 onChange 와 경합하여 단편적 store 갱신을 유발한다(RAC controlled
            //   계약 위반 잔재). `value={checkbox.id}` 는 그룹 멤버십 식별용으로 유지.
            <Checkbox
              key={checkbox.id}
              data-element-id={checkbox.id}
              value={checkbox.id}
              isIndeterminate={Boolean(checkbox.props.isIndeterminate)}
              isDisabled={Boolean(checkbox.props.isDisabled)}
            >
              {/* Label 자식이 있으면 렌더, 없으면 props.children 텍스트 */}
              {checkboxLabelChildren.length > 0
                ? checkboxLabelChildren.map((child) =>
                    renderElement(child, child.id),
                  )
                : typeof checkbox.props.children === "string"
                  ? checkbox.props.children
                  : null}
            </Checkbox>
          );
        })}
      </div>
    </CheckboxGroup>
  );
};

/**
 * Radio 렌더링
 */
export const renderRadio = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { elementsById, renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  // 부모 또는 조부모가 RadioGroup인지 확인
  // Factory 구조: RadioGroup > RadioItems > Radio
  const parentElement = element.parent_id
    ? elementsById.get(element.parent_id)
    : undefined;
  const grandparentElement = parentElement?.parent_id
    ? elementsById.get(parentElement.parent_id)
    : null;
  const isInsideRadioGroup =
    parentElement?.type === "RadioGroup" ||
    parentElement?.type === "RadioItems" ||
    grandparentElement?.type === "RadioGroup";

  if (isInsideRadioGroup) {
    return (
      <Radio
        key={element.id}
        id={element.customId}
        data-element-id={element.id}
        value={String(element.props.value || "")}
        isDisabled={Boolean(element.props.isDisabled || false)}
      >
        {/* Label 자식이 있으면 props.children 텍스트 생략 (이중 렌더링 방지) */}
        {typeof element.props.children === "string" &&
        !children.some((c) => c.type === "Label")
          ? element.props.children
          : null}
        {children.map((child) => renderElement(child, child.id))}
      </Radio>
    );
  } else {
    // RadioGroup이 없으면 기본 RadioGroup으로 감싸기
    return (
      <RadioGroup
        key={`group-${element.id}`}
        id={`group-${element.customId}`}
        data-element-id={`group-${element.id}`}
      >
        <Radio
          key={element.id}
          id={element.customId}
          data-element-id={element.id}
          value={String(element.props.value || "")}
          isDisabled={Boolean(element.props.isDisabled || false)}
        >
          {/* Label 자식이 있으면 props.children 텍스트 생략 (이중 렌더링 방지) */}
          {typeof element.props.children === "string" &&
          !children.some((c) => c.type === "Label")
            ? element.props.children
            : null}
          {children.map((child) => renderElement(child, child.id))}
        </Radio>
      </RadioGroup>
    );
  }
};

/**
 * RadioGroup 렌더링
 */
export const renderRadioGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { elements, batchUpdateElementProps, renderElement } = context;

  // Compositional: Label + RadioItems(중간 컨테이너) + Radio(레거시) 자식 분리
  const allChildren = context.childrenByParent.get(element.id) ?? [];

  const labelChild = allChildren.find((child) => child.type === "Label");
  const radioItemsChild = allChildren.find(
    (child) => child.type === "RadioItems",
  );

  // RadioItems가 있으면 그 하위에서 Radio 검색, 없으면(레거시) 직접 자식에서 검색
  const radioParentId = radioItemsChild ? radioItemsChild.id : element.id;
  const radioChildren = (
    context.childrenByParent.get(radioParentId) ?? []
  ).filter((child) => child.type === "Radio");

  // 그룹 라벨: Label 자식 Element의 텍스트 사용 (renderElement 호출 제거 — 이중 렌더링 방지)
  const groupLabel =
    (labelChild?.props?.children as string) ||
    (element.props.label as string) ||
    undefined;

  // 선택값 정본: 자식 Radio 의 isSelected 우선, 없으면 그룹 value fallback.
  //   RAC Radio 에는 isSelected prop 이 없고 선택은 그룹 value(자기 value 일치) 로만
  //   표현된다(RAC 표준). 그런데 composition catalog 는 Radio 에 "Selected" 토글을
  //   패널에 노출하고(Radio.binding states/renderProps), Skia 는 개별 Radio 의
  //   props.isSelected 를 직접 읽어 그린다. preview 도 같은 정본(자식 isSelected)을
  //   따르되 RAC 계약 안에서 honor 하려면 "isSelected=true 인 Radio 의 value" 를
  //   그룹 defaultValue 로 번역한다(CheckboxGroup getSelectedChildIds 와 동형 — 단일
  //   선택이라 첫 매치만). 패널에서 자식 isSelected 토글 시 이 값이 바뀌어야 preview 반영.
  const selectedRadioChild = radioChildren.find((radio) =>
    Boolean(radio.props.isSelected),
  );
  const selectedRadioValue =
    selectedRadioChild?.props?.value !== undefined
      ? String(selectedRadioChild.props.value)
      : String(element.props.value || "");

  return (
    <RadioGroup
      // key 에 선택값을 묶어, 패널에서 자식 Radio 의 isSelected(또는 그룹 value)를 토글하면
      //   key 가 바뀌어 RAC RadioGroup 이 re-mount → 새 defaultValue 를 다시 읽는다.
      //   defaultValue 는 uncontrolled 라 mount 시점 값만 쓰므로, key 변경 없이는 패널 토글이
      //   DOM 에 반영 안 됨(Skia 는 props 직접 읽어 즉시 반영 → 두 경로 drift). preview 직접
      //   클릭은 onChange→store 갱신 후 같은 값으로 key 가 재계산되어 불필요한 re-mount 없이 정상.
      key={`${element.id}:${selectedRadioValue}`}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      label={groupLabel}
      defaultValue={selectedRadioValue}
      orientation={
        (element.props.orientation as "horizontal" | "vertical") || "vertical"
      }
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      isDisabled={Boolean(element.props.isDisabled)}
      isInvalid={Boolean(element.props.isInvalid)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isRequired={Boolean(element.props.isRequired)}
      necessityIndicator={
        element.props.necessityIndicator as "icon" | "label" | undefined
      }
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      name={element.props.name ? String(element.props.name) : undefined}
      errorMessage={
        element.props.errorMessage
          ? String(element.props.errorMessage)
          : undefined
      }
      onChange={(selectedValue) => {
        const batch: Array<{ id: string; props: Record<string, unknown> }> = [
          {
            id: element.id,
            props: { ...element.props, value: selectedValue },
          },
        ];
        // 개별 Radio의 isSelected도 동기화
        for (const radio of radioChildren) {
          const isSelected = radio.props.value === selectedValue;
          if (radio.props.isSelected !== isSelected) {
            batch.push({
              id: radio.id,
              props: { ...radio.props, isSelected } as Record<string, unknown>,
            });
          }
        }
        batchUpdateElementProps(batch);
      }}
    >
      <div className="radio-items">
        {radioChildren.map((radio) => renderElement(radio))}
      </div>
    </RadioGroup>
  );
};

/**
 * Switch 렌더링
 */
export const renderSwitch = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  return (
    <Switch
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      defaultSelected={Boolean(element.props.isSelected)}
      isDisabled={Boolean(element.props.isDisabled)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      name={element.props.name ? String(element.props.name) : undefined}
      value={element.props.value ? String(element.props.value) : undefined}
      autoFocus={Boolean(element.props.autoFocus)}
      style={element.props.style}
      className={element.props.className}
      isEmphasized={Boolean(element.props.isEmphasized)}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      onChange={(isSelected) => {
        const updatedProps = {
          ...element.props,
          isSelected,
        };
        updateElementProps(element.id, updatedProps);
      }}
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
    </Switch>
  );
};

/**
 * FileTrigger 렌더링
 *
 * 파일 선택 트리거 컴포넌트. 자식 요소(Button 등)를 클릭하면 파일 선택 다이얼로그 열림.
 */
export const renderFileTrigger = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <FileTrigger
      key={element.id}
      acceptedFileTypes={
        element.props.acceptedFileTypes as string[] | undefined
      }
      allowsMultiple={Boolean(element.props.allowsMultiple)}
      acceptDirectory={Boolean(element.props.acceptDirectory)}
      defaultCamera={
        element.props.defaultCamera as "user" | "environment" | undefined
      }
      onSelect={(files) => {
        if (files) {
          const fileList = Array.from(files).map((f) => f.name);
          context.updateElementProps(element.id, {
            ...element.props,
            selectedFiles: fileList,
          });
        }
      }}
    >
      {children.length > 0
        ? children.map((child) => renderElement(child, child.id))
        : null}
    </FileTrigger>
  );
};

/**
 * DropZone 렌더링
 *
 * 드래그앤드롭 파일 업로드 영역.
 */
export const renderDropZone = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;
  const eventHandlers =
    context.services?.createEventHandlerMap?.(element, context) ?? {};

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <DropZone
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      label={
        typeof element.props.label === "string"
          ? element.props.label
          : undefined
      }
      description={
        typeof element.props.description === "string"
          ? element.props.description
          : undefined
      }
      isDisabled={Boolean(element.props.isDisabled)}
      style={element.props.style}
      className={element.props.className}
      onDrop={eventHandlers.onDrop as unknown as (e: unknown) => void}
    >
      {children.length > 0
        ? children.map((child) => renderElement(child, child.id))
        : undefined}
    </DropZone>
  );
};

/**
 * TailSwatch (Color Picker) 렌더링
 */
export const renderTailSwatch = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  // Parse color value or use default
  const colorValue = element.props.value || "#3b82f6";
  let color;
  try {
    color = parseColor(colorValue as string);
  } catch {
    color = parseColor("#3b82f6");
  }

  const handleColorChange = (newColor: Color) => {
    const hexColor = newColor.toString("hex");
    const updatedProps = {
      ...element.props,
      value: hexColor,
    };
    updateElementProps(element.id, updatedProps);
    // Save will be handled by updateElementProps
  };

  return (
    <div
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
    >
      <MyColorSwatches
        areaProps={{
          value: color,
          onChange: handleColorChange,
          colorSpace:
            (element.props.colorSpace as "rgb" | "hsl" | "hsb") || "hsb",
          isDisabled: Boolean(element.props.isDisabled),
        }}
        sliderProps={{
          value: color,
          onChange: handleColorChange,
          channel: "hue" as const,
          isDisabled: Boolean(element.props.isDisabled),
        }}
        swatchPickerProps={{
          value: color,
          onChange: handleColorChange,
        }}
      />
    </div>
  );
};
