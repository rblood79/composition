/**
 * useTextEdit Hook
 *
 * Pencil textEditorManager 패턴:
 * - startEdit: 원본 스냅샷 저장 + Skia 텍스트 숨김
 * - completeEdit: 히스토리 기록 + store 업데이트 + Skia 텍스트 복원
 * - cancelEdit: Skia 텍스트 복원 (store 변경 없음)
 *
 * @since 2025-12-11 Phase 10 B1.5
 * @updated 2026-03-07 Pencil 패턴 적용 (히스토리, Skia 연동)
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useStore } from "../../stores";
import {
  areCanonicalMutationStoreActionsRegistered,
  mergeElementsCanonicalPrimary,
} from "../../../adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "../../stores/canonical/canonicalElementsView";
import type { TextStyleConfig } from "./TextEditOverlay";
import { setEditingElementId } from "../canvas/skia/nodeRenderers";
import { useCanvasStore } from "../../stores/canvasStore";
import { getSkiaNode, notifyLayoutChange } from "../canvas/skia/useSkiaNode";
import { extractFullSpecTextStyle } from "./specTextStyleForOverlay";
import {
  resolveTextSourceKey,
  resolveTextSourceText,
  textSourceOrder,
} from "@composition/specs";

type TextEditNode = Parameters<
  Parameters<typeof visitCanonicalDocumentElements>[1]
>[0];

// ============================================
// Types
// ============================================

export interface TextEditState {
  /** 편집 중인 요소 ID */
  elementId: string | null;
  /** 현재 텍스트 값 */
  value: string;
  /** 위치 (screen 좌표) */
  position: { x: number; y: number };
  /** 크기 (screen 픽셀) */
  size: { width: number; height: number };
  /** 스타일 */
  style: TextStyleConfig;
}

/** 레이아웃 위치 정보 */
export interface LayoutPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseTextEditReturn {
  /** 편집 상태 */
  editState: TextEditState | null;
  /** 편집 시작 (layoutPosition: screen 좌표 bounds) */
  startEdit: (elementId: string, layoutPosition?: LayoutPosition) => void;
  /** 텍스트 변경 */
  updateText: (elementId: string, newValue: string) => void;
  /** 편집 완료 (저장) */
  completeEdit: (elementId: string) => void;
  /** 편집 취소 */
  cancelEdit: (elementId: string) => void;
  /** 편집 중 여부 */
  isEditing: boolean;
}

// ============================================
// Text Element Tags
// ============================================

const TEXT_ELEMENT_TAGS = new Set([
  "Text",
  "Heading",
  "Label",
  "Paragraph",
  "Link",
  // 소문자 태그 (handleElementDoubleClick의 textTags와 호환)
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "a",
  "label",
  "button",
  "Description",
  "Strong",
  "Em",
  "Code",
  "Tag",
  "Badge",
  // Input 관련
  "Button",
  "ToggleButton",
  "Input",
  "TextField",
  "TextInput",
  "SearchField",
  "TextArea",
]);

// ============================================
// Helper Functions
// ============================================

function getActiveCanonicalTextEditElements(): TextEditNode[] | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;

  const doc = canonical.documents.get(projectId);
  if (!doc) return null;

  const elements: TextEditNode[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  return elements;
}

function getTextEditElement(elementId: string): TextEditNode | null {
  const canonicalElements = getActiveCanonicalTextEditElements();
  if (canonicalElements) {
    return (
      canonicalElements.find((element) => element.id === elementId) ?? null
    );
  }

  const { elements: legacyElements } = useStore.getState();
  return legacyElements.find((element) => element.id === elementId) ?? null;
}

function applyLegacyBootstrapTextProp(updatedElement: TextEditNode): void {
  const state = useStore.getState();
  const { elements: legacyElements } = state;
  const elementIndex = legacyElements.findIndex(
    (element) => element.id === updatedElement.id,
  );
  if (elementIndex < 0) return;

  const nextElements = legacyElements.with(elementIndex, updatedElement);
  const nextElementsMap = new Map(
    nextElements.map((element) => [element.id, element] as const),
  );

  useStore.setState((currentState) => ({
    elements: nextElements,
    elementsMap: nextElementsMap,
    layoutVersion: currentState.layoutVersion + 1,
  }));
}

/**
 * Store props를 히스토리 없이 업데이트 (편집 중 실시간 레이아웃 반영용)
 *
 * ADR-122: active canonical document 가 있으면 live text edit도
 * canonical mutation wrapper를 먼저 통과한다. legacy store patch는 canonical
 * hydration 전 bootstrap fallback으로만 남긴다.
 */
function silentUpdateTextProp(elementId: string, value: string): void {
  const element = getTextEditElement(elementId);
  if (!element) return;
  const props = element.props as Record<string, unknown> | undefined;
  const propKey = getTextPropKey(element.type, props);
  const updatedElement = { ...element, props: { ...props, [propKey]: value } };

  if (areCanonicalMutationStoreActionsRegistered()) {
    const result = mergeElementsCanonicalPrimary([updatedElement]);
    if (result.changed || getActiveCanonicalTextEditElements()) return;
  }

  applyLegacyBootstrapTextProp(updatedElement);
}

/**
 * 편집 시작 텍스트 — 렌더 표면 (Skia · Preview · 레이아웃) 과 같은 타입별 텍스트 원천 계약
 * (`@composition/specs` `resolveTextSourceText`, ADR-923 r15m1) 에 위임한다.
 *
 * round 16 (2026-09-01) 까지 overlay 는 자체 순서 `value || defaultValue || children || text || label`
 * 을 들고 있었다 — AI `create_element`/`update_element` 가 Button 에 `label` 만 쓰면 캔버스·Preview 는
 * 아무것도 안 그리는데 편집창에는 "Go" 가 떴고, 확정 시 `label` 에 다시 써서 계속 안 보였다.
 * 입력 계열 (value 편집) 만 종전대로 — TEXT_EDITABLE_TAGS 밖이라 도달하지 않지만 의미를 보존.
 */
const INPUT_VALUE_EDIT_TAGS = new Set([
  "Input",
  "TextField",
  "TextInput",
  "SearchField",
  "TextArea",
]);

export function extractText(
  type: string,
  props: Record<string, unknown> | undefined,
): string {
  if (!props) return "";
  if (INPUT_VALUE_EDIT_TAGS.has(type)) {
    return String(props.value || props.defaultValue || "");
  }
  return resolveTextSourceText(type, props);
}

/**
 * Skia 렌더 데이터에서 텍스트 스타일 추출 (가장 정확한 소스)
 * fallback: element.props.style
 */
function findTextData(
  node: ReturnType<typeof getSkiaNode>,
): NonNullable<NonNullable<ReturnType<typeof getSkiaNode>>["text"]> | null {
  if (!node) return null;
  if (node.text) return node.text;
  if (node.children) {
    for (const child of node.children) {
      const found = findTextData(child);
      if (found) return found;
    }
  }
  return null;
}

function extractTextStyle(
  type: string,
  elementId: string,
  props: Record<string, unknown> | undefined,
  style: Record<string, unknown> | undefined,
): TextStyleConfig {
  // 1. Spec shapes에서 추출 (CSS Preview와 동일한 소스 — Button, Badge 등)
  const specStyle = extractFullSpecTextStyle(type, props);
  if (specStyle) return specStyle;

  // 2. Skia 노드에서 추출 (비-Spec 텍스트 요소: p, h1, span 등)
  const skiaNode = getSkiaNode(elementId);
  const t = findTextData(skiaNode);
  if (t) {
    // Float32Array color → CSS hex
    const r = Math.round((t.color[0] ?? 0) * 255);
    const g = Math.round((t.color[1] ?? 0) * 255);
    const b = Math.round((t.color[2] ?? 0) * 255);
    const hexColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

    // fontFamilies → CSS fontFamily
    const fontFamily = t.fontFamilies.join(", ") || "Pretendard, sans-serif";

    // align: EmbindEnumEntity | string → CSS textAlign
    let textAlign: "left" | "center" | "right" = "left";
    if (typeof t.align === "string") {
      textAlign = t.align as "left" | "center" | "right";
    }

    return {
      fontFamily,
      fontSize: t.fontSize,
      fontWeight: t.fontWeight ?? 400,
      color: hexColor,
      textAlign,
      lineHeight: t.lineHeight,
      padding: t.paddingLeft ?? 0,
      letterSpacing: t.letterSpacing,
      paddingTop: t.paddingTop ?? 0,
    };
  }

  // 3. fallback: inline style
  return {
    fontFamily: String(style?.fontFamily || "Pretendard, sans-serif"),
    fontSize: Number(style?.fontSize) || 16,
    fontWeight: style?.fontWeight as string | number | undefined,
    color: String(style?.color || "#000000"),
    textAlign: (style?.textAlign as "left" | "center" | "right") || "left",
    lineHeight: style?.lineHeight as number | string | undefined,
    padding: Number(style?.padding || style?.paddingLeft || 0),
  };
}

/**
 * 텍스트 속성 키 결정 (저장 시 사용)
 */
/**
 * 편집 결과를 쓸 prop 키 — 계약이 지금 텍스트를 읽는 키 (`resolveTextSourceKey`), 내용이 없으면 타입
 * 순서의 첫 키 (기본 `children`, item `label`, 텍스트 leaf `children`). 계약 밖 키 (`label` on Button
 * 등) 에는 쓰지 않는다 — 써도 세 표면이 안 읽는다.
 */
export function getTextPropKey(
  type: string,
  props: Record<string, unknown> | undefined,
): string {
  if (INPUT_VALUE_EDIT_TAGS.has(type)) return "value";
  return resolveTextSourceKey(type, props) ?? textSourceOrder(type)[0];
}

// ============================================
// Hook
// ============================================

export function useTextEdit(): UseTextEditReturn {
  const [editState, setEditState] = useState<TextEditState | null>(null);

  // Pencil originalUndoSnapshot 패턴: 편집 시작 시 원본 값 저장
  const originalValueRef = useRef<string>("");
  const editingIdRef = useRef<string | null>(null);
  const currentValueRef = useRef<string>("");

  // 편집 시작 (Pencil startTextEditing + nUt constructor 패턴)
  const startEdit = useCallback(
    (elementId: string, layoutPosition?: LayoutPosition) => {
      const element = getTextEditElement(elementId);
      if (!element) return;

      // 텍스트 요소만 편집 가능
      if (!TEXT_ELEMENT_TAGS.has(element.type)) {
        console.warn(
          `[useTextEdit] Element ${element.type} is not a text element`,
        );
        return;
      }

      const props = element.props as Record<string, unknown> | undefined;
      const text = extractText(element.type, props);
      const elStyle = element.props?.style as
        Record<string, unknown> | undefined;

      // Pencil: 원본 스냅샷 저장 (undo용)
      originalValueRef.current = text;
      currentValueRef.current = text;
      editingIdRef.current = elementId;

      // Skia 텍스트 숨김은 TextEditOverlay 마운트 후 수행 (깜빡임 방지)
      // → TextEditOverlay useEffect에서 setEditingElementId 호출

      // 위치 결정 (layoutPosition = screen 좌표 from layoutBoundsRegistry)
      const position = layoutPosition
        ? { x: layoutPosition.x, y: layoutPosition.y }
        : { x: 0, y: 0 };
      const size = layoutPosition
        ? { width: layoutPosition.width, height: layoutPosition.height }
        : { width: 100, height: 40 };

      setEditState({
        elementId,
        value: text,
        position,
        size,
        style: extractTextStyle(element.type, elementId, props, elStyle),
      });
      // ADR-192 — 바/셸이 텍스트 편집 중임을 읽는 유일한 반응형 플래그
      useCanvasStore.getState().setEditing(true, elementId);
    },
    [],
  );

  // 텍스트 변경 (실시간 — store props 업데이트, 히스토리 미기록)
  // fit-content 버튼 등 텍스트 기반 크기 요소의 실시간 레이아웃 반영
  // completeEdit에서 히스토리 1건만 기록
  const updateText = useCallback((elementId: string, newValue: string) => {
    if (editingIdRef.current !== elementId) return;
    currentValueRef.current = newValue;
    setEditState((prev) => {
      if (!prev || prev.elementId !== elementId) return prev;
      return { ...prev, value: newValue };
    });

    // store props 직접 업데이트 (히스토리 없이) → 레이아웃 재계산 트리거
    silentUpdateTextProp(elementId, newValue);
  }, []);

  // 편집 완료 (Pencil: commitBlock with undo: true)
  const completeEdit = useCallback((elementId: string) => {
    if (editingIdRef.current !== elementId) return;

    const finalValue = currentValueRef.current;
    const originalValue = originalValueRef.current;

    // Pencil showText: Skia 텍스트 렌더링 복원 + 리렌더 트리거
    setEditingElementId(null);
    notifyLayoutChange();
    editingIdRef.current = null;

    // 변경이 있으면 히스토리 기록 + DB 저장
    // updateText에서 이미 store props를 실시간 반영했으므로
    // 원본으로 복원 → updateElementProps (히스토리 기록) → 최종값 반영
    if (finalValue !== originalValue) {
      const element = getTextEditElement(elementId);
      if (element) {
        const props = element.props as Record<string, unknown> | undefined;
        const propKey = getTextPropKey(element.type, props);

        // 원본 값으로 복원 (updateElementProps가 변경 감지하도록)
        silentUpdateTextProp(elementId, originalValue);

        // silentUpdateTextProp이 store를 변경했으므로 최신 state 재조회
        const freshState = useStore.getState();
        // updateElementProps: 히스토리 기록 + DB persist + layoutVersion
        freshState.updateElementProps(elementId, {
          ...props,
          [propKey]: finalValue,
        });
        freshState.invalidateLayout?.();
      }
    }

    useCanvasStore.getState().setEditing(false);
    setEditState(null);
  }, []);

  // 편집 취소 (Pencil: 원본 복원)
  const cancelEdit = useCallback((elementId: string) => {
    if (editingIdRef.current !== elementId) return;

    // Pencil showText: Skia 텍스트 렌더링 복원 + 리렌더 트리거
    setEditingElementId(null);
    notifyLayoutChange();
    editingIdRef.current = null;

    // updateText가 store를 실시간 반영했으므로 원본 복원 필요
    const originalValue = originalValueRef.current;
    const currentValue = currentValueRef.current;
    if (currentValue !== originalValue) {
      silentUpdateTextProp(elementId, originalValue);
    }

    useCanvasStore.getState().setEditing(false);
    setEditState(null);
  }, []);

  // 언마운트 시 편집 플래그 회수 (2026-08-27 code-review #6).
  // `isEditing` 은 `useCanvasStore` 싱글턴이고 내려가는 경로가
  // completeEdit/cancelEdit 뿐이다. 마우스 클릭은 TextEditOverlay 의 document
  // mousedown 이 먼저 완료를 부르지만, 비-마우스 경로(브라우저 Back, compare
  // 모드 토글)로 BuilderCanvas 가 사라지면 true 가 남아 액션 바가 다시는
  // 마운트되지 않는다. 문서 내용은 건드리지 않는다 — 언마운트는 사용자의
  // 취소 제스처가 아니라서 실시간 반영된 텍스트를 되돌리면 편집 손실이 된다.
  useEffect(() => {
    return () => {
      if (editingIdRef.current === null) return;
      editingIdRef.current = null;
      setEditingElementId(null);
      useCanvasStore.getState().setEditing(false);
    };
  }, []);

  const isEditing = editState !== null;

  return {
    editState,
    startEdit,
    updateText,
    completeEdit,
    cancelEdit,
    isEditing,
  };
}

export default useTextEdit;
