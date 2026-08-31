/**
 * ADR-198 Phase 1 — Preview leg 드라이버 (test-only)
 *
 * 실제 `preview.html` 번들을 iframe 으로 띄우고 **프로덕션 canonical 메시지 경로**
 * 로만 문서를 주입한다. 간이 DOM 을 만들지 않는다 (HC3).
 *
 * Phase 0 에서 값비싸게 배운 두 계약이 여기 박혀 있다:
 *
 * 1. `PREVIEW_READY` 를 기다린다. `load` 는 HTML 도착 시점이라 React mount 와
 *    리스너 부착보다 이르다 — 그 사이에 보낸 메시지는 아무도 듣지 않고, 빈 body 가
 *    "수렴" 으로 보인다.
 * 2. `documentRevision` 은 **매 전송 증가**. 비증가 revision 은 store 가 조용히
 *    무시해서 이전 문서의 DOM 을 다음 측정 결과로 오독하게 만든다.
 */

import type { CompositionDocument } from "@composition/shared";
import type { EnvironmentManifest, LegResult, Rect } from "./types";
import { environmentChecksum, stableChecksum } from "./identity";

const PREVIEW_URL = "/preview.html";
const DEFAULT_TIMEOUT = 15_000;

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export class PreviewDriver {
  private iframe: HTMLIFrameElement | null = null;
  private revision = 0;
  private readonly errors: string[] = [];

  async start(viewport: { width: number; height: number }): Promise<void> {
    const el = document.createElement("iframe");
    el.width = String(viewport.width);
    el.height = String(viewport.height);
    el.style.border = "0";
    el.src = PREVIEW_URL;

    const ready = new Promise<void>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error("PARITY-RESOURCE: PREVIEW_READY 타임아웃")),
        DEFAULT_TIMEOUT,
      );
      const onMessage = (e: MessageEvent) => {
        if ((e.data as { type?: string } | null)?.type === "PREVIEW_READY") {
          clearTimeout(t);
          window.removeEventListener("message", onMessage);
          resolve();
        }
      };
      window.addEventListener("message", onMessage);
    });

    document.body.appendChild(el);
    this.iframe = el;
    await ready;

    el.contentWindow?.addEventListener("error", (e) =>
      this.errors.push(String((e as ErrorEvent).message)),
    );
  }

  stop(): void {
    this.iframe?.remove();
    this.iframe = null;
  }

  get element(): HTMLIFrameElement {
    if (!this.iframe)
      throw new Error("PreviewDriver.start() 를 먼저 호출할 것");
    return this.iframe;
  }

  /** DOM 구조 + 박스 서명 — 수렴 판정 입력. */
  private signature(doc: Document): string {
    const parts: string[] = [];
    const walk = (el: Element, d: number) => {
      if (d > 14) return;
      const r = el.getBoundingClientRect();
      parts.push(
        `${el.tagName}#${el.getAttribute("data-element-id") ?? ""}@${r.width.toFixed(2)}x${r.height.toFixed(2)}`,
      );
      for (const c of Array.from(el.children)) walk(c, d + 1);
    };
    if (doc.body) walk(doc.body, 0);
    return parts.join("|");
  }

  /** 고정 프레임 수가 아니라 **수렴** 으로 캡처 시점을 정한다. */
  private async settle(doc: Document): Promise<number> {
    const start = performance.now();
    let prev = this.signature(doc);
    let iterations = 0;
    while (performance.now() - start < DEFAULT_TIMEOUT) {
      await raf();
      await raf();
      iterations++;
      const next = this.signature(doc);
      if (next === prev && next.length > 0) return iterations;
      prev = next;
    }
    throw new Error("PARITY-RESOURCE: preview leg 수렴 실패");
  }

  async render(
    doc: CompositionDocument,
    projectId: string,
    env: EnvironmentManifest,
  ): Promise<LegResult> {
    const win = this.element.contentWindow!;
    const idoc = this.element.contentDocument!;

    win.postMessage(
      {
        type: "UPDATE_CANONICAL_DOCUMENT",
        projectId,
        documentRevision: ++this.revision,
        document: doc,
      },
      "*",
    );
    await this.settle(idoc);

    // 렌더 순서 = DOM 문서 순서. canonical id 를 가진 노드만 센다.
    //
    // **canonical node 1개 ↔ DOM element 여러 개** 인 경우가 있다. 예: `Image` 는
    // `<div style="display: contents">` 래퍼와 그 안의 `<img>` 가 **같은**
    // `data-element-id` 를 갖는다. `nodeOrder` 는 정의상 *node id* 의 목록이므로
    // 중복은 leg 의 성질이 아니라 추출의 오류다 — canonical id 로 dedupe 한다.
    //
    // geometry 는 `display: contents` 래퍼를 피한다. 그 래퍼는 레이아웃 상자를
    // 만들지 않아 `getBoundingClientRect()` 가 자식 합집합이거나 0 이 되므로,
    // 같은 id 를 가진 요소 중 **실제 상자를 갖는 쪽**을 택해야 L1 이 의미를 갖는다.
    const painted = Array.from(
      idoc.querySelectorAll("[data-element-id]"),
    ) as HTMLElement[];
    const hostRect = this.element.getBoundingClientRect();
    const win2 = this.element.contentWindow!;

    // 1) canonical id 별로 요소를 모은다 (문서 순서 보존)
    const byId = new Map<string, HTMLElement[]>();
    const nodeOrder: string[] = [];
    for (const el of painted) {
      const id = el.getAttribute("data-element-id");
      if (!id) continue;
      const bucket = byId.get(id);
      if (bucket) {
        bucket.push(el);
      } else {
        byId.set(id, [el]);
        nodeOrder.push(id);
      }
    }

    // 2) id 마다 **실제 상자를 갖는** 요소로 geometry 를 잡는다.
    //    `display: contents` 래퍼는 레이아웃 상자를 만들지 않아
    //    `getBoundingClientRect()` 가 자식 합집합이거나 0 이 된다.
    const geometry: Record<string, Rect> = {};
    for (const [id, els] of byId) {
      const box =
        els.find((el) => win2.getComputedStyle(el).display !== "contents") ??
        els[0];
      const r = box.getBoundingClientRect();
      geometry[id] = {
        x: r.x - hostRect.x,
        y: r.y - hostRect.y,
        width: r.width,
        height: r.height,
      };
    }

    return {
      legId: "preview",
      fixtureChecksum: stableChecksum(doc),
      environmentChecksum: environmentChecksum(env),
      nodeOrder,
      geometry,
      paintedNodeCount: nodeOrder.length,
      consoleErrors: [...this.errors],
    };
  }
}
