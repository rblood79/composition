/**
 * Taffy WASM 레이아웃 엔진 공통 추상 클래스
 *
 * TaffyFlexEngine과 TaffyGridEngine의 공통 로직을 통합합니다:
 * - 싱글톤 TaffyLayout 인스턴스 관리 (생성, 가용 여부, 초기화 실패)
 * - calculate() 스켈레톤 (empty check → Taffy 획득 → Dropflow fallback → try/finally/clear)
 * - 결과 수집 (handle → ComputedLayout[])
 * - 부모 노드 설정 (dimensions, padding/border reset)
 *
 * @since 2026-02-26 Phase 4-2
 */

import type { CanvasLayoutNode } from "../layoutNode";
import type {
  LayoutEngine,
  ComputedLayout,
  LayoutContext,
} from "./LayoutEngine";
import { TaffyLayout } from "../../wasm-bindings/taffyLayout";
import type {
  TaffyStyle,
  TaffyNodeHandle,
} from "../../wasm-bindings/taffyLayout";
import { parseMargin, resolveParentContext } from "./utils";
import type { ComputedStyle } from "./cssResolver";
import type { CSSValueContext } from "./cssValueParser";

/**
 * Taffy WASM 엔진 공통 추상 클래스
 *
 * 서브클래스는 `computeWithTaffy()`만 구현하면 됩니다.
 */
export abstract class BaseTaffyEngine implements LayoutEngine {
  abstract readonly displayTypes: string[];
  readonly shouldDelegate = false;

  private taffyInstance: TaffyLayout | null = null;
  private taffyInitFailed = false;

  /** 엔진 이름 (로그용) */
  protected abstract readonly engineName: string;

  /**
   * Taffy WASM 엔진 가용 여부
   *
   * selectEngine()에서 조기 라우팅 판단에 사용.
   */
  isAvailable(): boolean {
    return !this.taffyInitFailed;
  }

  /** 싱글톤 TaffyLayout 인스턴스 획득 (초기화 실패 시 null) */
  protected getTaffy(): TaffyLayout | null {
    if (this.taffyInitFailed) return null;
    if (!this.taffyInstance) {
      try {
        this.taffyInstance = new TaffyLayout();
      } catch (err) {
        this.taffyInitFailed = true;
        if (import.meta.env.DEV) {
          console.warn(
            `[${this.engineName}] TaffyLayout creation failed:`,
            err,
          );
        }
        return null;
      }
    }
    if (!this.taffyInstance.isAvailable()) {
      this.taffyInitFailed = true;
      return null;
    }
    return this.taffyInstance;
  }

  calculate(
    parent: CanvasLayoutNode,
    children: CanvasLayoutNode[],
    availableWidth: number,
    availableHeight: number,
    context?: LayoutContext,
  ): ComputedLayout[] {
    if (children.length === 0) {
      return [];
    }

    const taffy = this.getTaffy();
    if (!taffy) {
      return [];
    }

    const { parentComputed, cssCtx } = resolveParentContext(parent, context);

    try {
      return this.computeWithTaffy(
        taffy,
        parent,
        children,
        availableWidth,
        availableHeight,
        parentComputed,
        cssCtx,
        context,
      );
    } finally {
      try {
        taffy.clear();
      } catch (cleanupError) {
        if (import.meta.env.DEV) {
          console.warn(`[${this.engineName}] cleanup error:`, cleanupError);
        }
      }
    }
  }

  /**
   * Taffy로 레이아웃 계산 (서브클래스 구현)
   */
  protected abstract computeWithTaffy(
    taffy: TaffyLayout,
    parent: CanvasLayoutNode,
    children: CanvasLayoutNode[],
    availableWidth: number,
    availableHeight: number,
    parentComputed: ComputedStyle,
    cssCtx: CSSValueContext,
    context?: LayoutContext,
  ): ComputedLayout[];

  /**
   * 부모 TaffyStyle에 available dimensions 설정 + padding/border 리셋
   *
   * 부모의 padding/border는 이미 availableWidth/Height에서 제외되어 있으므로 0으로 리셋.
   * RC-1: availableHeight < 0 (sentinel -1) = height:auto → height 생략 → Taffy 콘텐츠 기반 계산.
   */
  protected setupParentDimensions(
    parentStyle: TaffyStyle,
    availableWidth: number,
    availableHeight: number,
  ): void {
    parentStyle.width = availableWidth;
    if (availableHeight >= 0) {
      parentStyle.height = availableHeight;
    }
    parentStyle.paddingTop = 0;
    parentStyle.paddingRight = 0;
    parentStyle.paddingBottom = 0;
    parentStyle.paddingLeft = 0;
    parentStyle.borderTop = 0;
    parentStyle.borderRight = 0;
    parentStyle.borderBottom = 0;
    parentStyle.borderLeft = 0;
  }

  /**
   * Taffy 결과를 ComputedLayout[] 로 수집
   *
   * childHandles와 childMap에서 레이아웃 결과를 매핑합니다.
   * childMap에 없는 handle(phantom 노드 등)은 자동 스킵됩니다.
   */
  protected collectResults(
    taffy: TaffyLayout,
    childHandles: TaffyNodeHandle[],
    childMap: Map<TaffyNodeHandle, CanvasLayoutNode>,
  ): ComputedLayout[] {
    const layoutMap = taffy.getLayoutsBatch(childHandles);
    const results: ComputedLayout[] = [];

    for (const handle of childHandles) {
      const child = childMap.get(handle);
      const layout = layoutMap.get(handle);
      if (!child || !layout) continue;

      const childStyle = child.props?.style as
        | Record<string, unknown>
        | undefined;
      const margin = parseMargin(childStyle);

      results.push({
        elementId: child.id,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        margin: {
          top: margin.top,
          right: margin.right,
          bottom: margin.bottom,
          left: margin.left,
        },
      });
    }

    return results;
  }
}
