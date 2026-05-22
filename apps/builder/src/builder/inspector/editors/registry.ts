import { createElement, type ComponentType } from "react";
import type { ComponentEditorProps } from "../types";
import { componentMetadata } from "@composition/shared/components/metadata";
import { GenericPropertyEditor } from "../../panels/properties/generic";
import { getPropertyEditorSpec } from "../../panels/properties/specRegistry";
import { TabsHybridAfterSections } from "../../panels/properties/editors/TabsEditor";
import { SliderHybridAfterSections } from "../../panels/properties/editors/SliderEditor";

/**
 * 에디터 캐시
 */
const editorCache = new Map<string, ComponentType<ComponentEditorProps>>();

function getHybridAfterSections(type: string) {
  switch (type) {
    case "Tabs":
      return TabsHybridAfterSections;
    case "Slider":
      return SliderHybridAfterSections;
    default:
      return undefined;
  }
}

/**
 * ADR-076 P6 — pre-generic custom editor hook.
 *
 * Spec 등록 컴포넌트라도 subtree 관찰이나 듀얼 모드 분기 같은 특수 로직이 필요하면
 * 여기에 등록. GenericPropertyEditor 에 도달하기 전에 wrapping editor 가 선택된다.
 * `metadata.editorName` 단독 연결은 `spec-first early return` 때문에 로드되지 않으므로
 * 이 경로가 필수 진입점. `getHybridAfterSections` 선례와 대칭 확장.
 */
function getCustomPreEditor(type: string): string | undefined {
  switch (type) {
    case "ListBox":
      return "ListBoxPropertyEditor";
    case "TagGroup":
      // ADR-097 P3: items SSOT + TagGroupPropertyEditor items 편집 UI.
      //   ListBox 선례와 달리 템플릿 모드 분기 없음 (Tag Field 자식 불가).
      //   spec-first bypass 회피 + GenericPropertyEditor 전체 주입이 목적.
      return "TagGroupPropertyEditor";
    case "Menu":
      // ADR-099 Phase 4: MenuPropertyEditor — GenericPropertyEditor 전체 주입.
      //   Section/Separator 추가 UI (allowSections/allowSeparators) 포함.
      //   spec-first bypass 회피와 동일 패턴.
      return "MenuPropertyEditor";
    case "GridList":
      // ADR-099 Phase 4: GridListPropertyEditor — GenericPropertyEditor 전체 주입.
      //   Section 추가 UI 포함 (GridList는 children-manager이므로 별도 처리 필요 없음,
      //   단순 spec-first bypass 회피 목적).
      return "GridListPropertyEditor";
    default:
      return undefined;
  }
}

/**
 * Vite의 import.meta.glob을 사용하여 모든 에디터를 사전 로드
 * 이 방식은 빌드 타임에 모든 가능한 import를 정적으로 분석할 수 있게 함
 */
const editorModules = import.meta.glob<{
  default: ComponentType<ComponentEditorProps>;
}>("../../panels/properties/editors/*.tsx");

/**
 * 에디터 모듈 동적 import
 */
async function importEditor(
  editorName: string,
): Promise<ComponentType<ComponentEditorProps> | null> {
  try {
    // editorName에 해당하는 모듈 경로 생성
    const modulePath = `../../panels/properties/editors/${editorName}.tsx`;

    // import.meta.glob 결과에서 해당 경로의 모듈 찾기
    const moduleLoader = editorModules[modulePath];

    if (!moduleLoader) {
      console.warn(`[importEditor] Editor not found in glob: ${editorName}`, {
        requestedPath: modulePath,
        availablePaths: Object.keys(editorModules).slice(0, 5), // 처음 5개만 출력
        totalCount: Object.keys(editorModules).length,
      });
      return null;
    }

    // 모듈 로드
    //console.log('[importEditor] Loading module:', modulePath);
    const module = await moduleLoader();

    // default export 우선, 없으면 named export (editorName) 시도
    const editor =
      module.default ||
      (
        module as unknown as Record<string, ComponentType<ComponentEditorProps>>
      )[editorName];

    return editor || null;
  } catch (error) {
    console.warn(`[importEditor] Failed to load editor: ${editorName}`, error);
    return null;
  }
}

/**
 * Editor 조회 컨텍스트
 */
export interface EditorContext {
  layoutId?: string | null;
  pageId?: string | null;
  /** 현재 편집 모드 (page/layout) - body 에디터 선택 시 사용 */
  editMode?: "page" | "layout";
}

/**
 * 에디터 조회 (자동 로딩)
 *
 * @param type - 요소 타입
 * @param context - 추가 컨텍스트 (body 타입의 경우 layoutId로 Editor 결정)
 */
export async function getEditor(
  type: string,
  context?: EditorContext,
): Promise<ComponentType<ComponentEditorProps> | null> {
  // ⭐ Special case: body 타입은 현재 편집 모드에 따라 다른 Editor 반환
  // ⭐ Phase 6 Fix: layout_id가 아닌 editMode를 기준으로 결정
  // - Page 모드: PageBodyEditor (Layout 선택 기능)
  // - Layout 모드: LayoutBodyEditor (프리셋 + Slot 생성)
  if (type === "body") {
    const isLayoutMode = context?.editMode === "layout";
    const editorName = isLayoutMode ? "LayoutBodyEditor" : "PageBodyEditor";
    const cacheKey = `body:${isLayoutMode ? "layout" : "page"}`;

    // 캐시 확인
    if (editorCache.has(cacheKey)) {
      return editorCache.get(cacheKey)!;
    }

    // 동적 import
    const editor = await importEditor(editorName);

    if (editor) {
      editorCache.set(cacheKey, editor);
    } else {
      console.warn("[getEditor] Failed to import body editor:", editorName);
    }

    return editor;
  }

  // 일반 에디터: 캐시 확인
  if (editorCache.has(type)) {
    return editorCache.get(type)!;
  }

  // ADR-076: pre-generic custom editor — spec-first 경로보다 먼저 평가
  const preEditorName = getCustomPreEditor(type);
  if (preEditorName) {
    const preEditor = await importEditor(preEditorName);
    if (preEditor) {
      editorCache.set(type, preEditor);
      return preEditor;
    }
    console.warn(
      "[getEditor] pre-editor import failed, falling back to generic:",
      preEditorName,
    );
  }

  const propertySpec = getPropertyEditorSpec(type);
  if (propertySpec?.properties) {
    const renderAfterSections = getHybridAfterSections(type);
    const genericEditor: ComponentType<ComponentEditorProps> = (props) =>
      createElement(GenericPropertyEditor, {
        ...props,
        spec: propertySpec,
        renderAfterSections,
      });
    editorCache.set(type, genericEditor);
    return genericEditor;
  }

  // 메타데이터에서 에디터 정보 확인
  const metadata = componentMetadata.find((c) => c.type === type);

  if (!metadata?.inspector.hasCustomEditor || !metadata.inspector.editorName) {
    return null;
  }

  // 동적 import
  const editor = await importEditor(metadata.inspector.editorName);

  if (editor) {
    editorCache.set(type, editor);
  } else {
    console.warn(
      "[getEditor] Failed to import editor:",
      metadata.inspector.editorName,
    );
  }

  return editor;
}

/**
 * 에디터 캐시 초기화
 */
export function clearEditorCache(): void {
  editorCache.clear();
}

/**
 * 특정 에디터 캐시 제거
 */
export function removeEditorFromCache(type: string): void {
  editorCache.delete(type);
}
