/**
 * ADR-198 Phase 1·3 — Preview leg 드라이버 (test-only)
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
 *
 * Phase 3 가 여기 더한 것:
 *
 * - **런타임 진입 단언** (`assertProductionEntry`) — 이 leg 이 정말 Preview 소비자인가.
 *   R3 의 런타임 절반이다. 정적 절반은 `productionPath.browser.test.ts` 가 본다.
 * - **checksum 키 ack** — 런타임에 문서별 ack 이 없어서 테스트 전용으로 만든다.
 *   같은 문서는 같은 DOM 지문, 다른 문서는 다른 지문이어야 한다.
 * - **리소스 안정 대기 + 매니페스트** (R6) 와 정규화 style (L2 입력).
 * - **콘솔/페이지 에러를 문서 파싱 중에 부착** — 부트 단계 에러를 놓치지 않는다.
 */

import type { CompositionDocument } from "@composition/shared";
import type {
  EnvironmentManifest,
  LegResult,
  ParityFailure,
  ParityVerdict,
  Rect,
} from "./types";
import { environmentChecksum, stableChecksum } from "./identity";
import {
  base64ToBytes,
  captureResources,
  decodePngToRgba,
  normalizeStyles,
  waitForResourceStability,
  type ResourceManifest,
} from "./domCapture";

const PREVIEW_URL = "/preview.html";
const DEFAULT_TIMEOUT = 15_000;

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * 진입 단언이 필요로 하는 최소 인터페이스.
 *
 * 인터페이스로 뽑은 이유가 있다 — negative probe (손으로 만든 DOM) 가 **같은
 * 단언 함수**를 통과시켜 보고 실패해야, 그 단언이 실제로 무언가를 막는다는 것이
 * 증명된다. probe 가 별도 단언을 쓰면 그건 자기가 자기를 채점하는 것이다.
 */
export interface PreviewEntryProbe {
  /** 프로덕션 핸드셰이크(`messageHandler.ts::messageSender.sendReady`) 수신 여부 */
  handshakeReceived: boolean;
  /** canonical 문서를 보내고 수렴 뒤 DOM 서명을 돌려준다 */
  sendAndSettle(doc: CompositionDocument): Promise<string>;
}

/**
 * G1 entry half 의 **런타임** 절반.
 *
 * 두 가지를 같이 요구한다:
 *
 * 1. 프로덕션 핸드셰이크를 실제로 받았다.
 * 2. canonical 메시지 경로가 **살아 있다** — 서로 다른 문서를 보내면 DOM 이 달라진다.
 *
 * 2번이 load-bearing 이다. 1번만 보면 핸드셰이크를 흉내 낸 정적 DOM 이 통과한다.
 * 서로 다른 문서에 같은 DOM 을 내는 leg 은 문서를 소비하고 있지 않은 것이고,
 * 그 위의 어떤 픽셀 판정도 의미가 없다.
 */
export async function assertProductionEntry(
  probe: PreviewEntryProbe,
  docs: readonly CompositionDocument[],
): Promise<ParityVerdict> {
  const failures: ParityFailure[] = [];

  if (docs.length < 2) {
    throw new Error(
      "assertProductionEntry: 서로 다른 문서 2개 이상이 필요하다 — 1개로는 소비 경로를 구별할 수 없다",
    );
  }

  if (!probe.handshakeReceived) {
    failures.push({
      code: "PARITY-ENV",
      layer: "env",
      first: "PREVIEW_READY",
      detail:
        "프로덕션 핸드셰이크를 받지 못했다 — 이 iframe 은 Preview 번들이 아니다",
    });
  }

  const signatures: string[] = [];
  for (const doc of docs) signatures.push(await probe.sendAndSettle(doc));

  const distinct = new Set(signatures);
  if (distinct.size !== signatures.length) {
    failures.push({
      code: "PARITY-ENV",
      layer: "env",
      first: "canonical-path",
      detail:
        `서로 다른 문서 ${signatures.length}개에 DOM 서명이 ${distinct.size}종 — ` +
        "canonical 메시지를 소비하지 않는다 (간이 DOM 이거나 경로가 끊겼다)",
    });
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

export interface AckEntry {
  fixtureChecksum: string;
  /** DOM 에서 유도한 지문 — nodeOrder + geometry + 정규화 style */
  domFingerprint: string;
}

export class PreviewDriver implements PreviewEntryProbe {
  private iframe: HTMLIFrameElement | null = null;
  private revision = 0;
  private readonly errors: string[] = [];
  private patchedAtReadyState: string | null = null;

  handshakeReceived = false;
  /** 문서별 ack 로그 — 런타임에 ack 이 없어서 만든 테스트 전용 계약 */
  readonly ackLog: AckEntry[] = [];

  async start(viewport: { width: number; height: number }): Promise<void> {
    const el = document.createElement("iframe");
    el.width = String(viewport.width);
    el.height = String(viewport.height);
    el.style.border = "0";

    // 핸드셰이크 부재는 여기서 던지지 않는다 — `assertProductionEntry` 가
    // `PARITY-ENV` 로 판정할 관측값이다. 던져 버리면 negative probe 가 같은
    // 단언을 통과시켜 볼 수 없다.
    const ready = new Promise<void>((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if ((e.data as { type?: string } | null)?.type === "PREVIEW_READY") {
          this.handshakeReceived = true;
          window.removeEventListener("message", onMessage);
          resolve();
        }
      };
      window.addEventListener("message", onMessage);
      setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve();
      }, DEFAULT_TIMEOUT);
    });

    el.src = PREVIEW_URL;
    document.body.appendChild(el);
    this.iframe = el;
    this.installErrorHooks(el);
    await ready;
  }

  /**
   * 콘솔/페이지 에러 훅을 **문서 파싱 중에** 붙인다.
   *
   * `load` 나 `PREVIEW_READY` 시점에 붙이면 module script 실행 중 난 에러를 전부
   * 놓친다 — 그러면 "콘솔 에러 0" 은 부트 구간에 대해 vacuous 하다. 네비게이션이
   * 커밋되면 window 가 교체되므로 짧은 주기로 폴링해 새 window 를 잡는다.
   * 실제로 언제 붙었는지는 `patchReadyState` 로 관측 가능하게 남긴다.
   */
  private installErrorHooks(el: HTMLIFrameElement): void {
    const tryPatch = (): boolean => {
      const win = el.contentWindow as
        | (Window & { __parityHooked?: boolean })
        | null;
      const doc = el.contentDocument;
      if (!win || !doc || win.__parityHooked) return false;
      if (doc.URL === "about:blank") return false;

      win.__parityHooked = true;
      this.patchedAtReadyState = doc.readyState;

      win.addEventListener("error", (e) =>
        this.errors.push(`page error: ${(e as ErrorEvent).message}`),
      );
      win.addEventListener("unhandledrejection", (e) =>
        this.errors.push(
          `unhandled rejection: ${String((e as PromiseRejectionEvent).reason)}`,
        ),
      );
      const origError = win.console.error.bind(win.console);
      win.console.error = (...args: unknown[]) => {
        this.errors.push(`console.error: ${args.map(String).join(" ")}`);
        origError(...args);
      };
      return true;
    };

    const timer = setInterval(() => {
      if (tryPatch()) clearInterval(timer);
    }, 0);
    setTimeout(() => clearInterval(timer), DEFAULT_TIMEOUT);
  }

  /** 훅이 붙은 시점의 `readyState` — 늦게 붙었으면 주장 범위가 좁아진다. */
  get patchReadyState(): string | null {
    return this.patchedAtReadyState;
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

  private post(doc: CompositionDocument, projectId: string): void {
    this.element.contentWindow!.postMessage(
      {
        type: "UPDATE_CANONICAL_DOCUMENT",
        projectId,
        documentRevision: ++this.revision,
        document: doc,
      },
      "*",
    );
  }

  /** `PreviewEntryProbe` — 문서를 보내고 수렴 뒤 서명을 돌려준다. */
  async sendAndSettle(doc: CompositionDocument): Promise<string> {
    this.post(doc, "adr198-entry-probe");
    await this.settle(this.element.contentDocument!);
    return this.signature(this.element.contentDocument!);
  }

  async render(
    doc: CompositionDocument,
    projectId: string,
    env: EnvironmentManifest,
  ): Promise<LegResult> {
    const idoc = this.element.contentDocument!;

    this.post(doc, projectId);
    await this.settle(idoc);
    // 레이아웃이 수렴한 뒤에도 폰트/이미지는 늦게 올 수 있고, 그것들은 레이아웃을
    // 안 바꾸면서 래스터만 바꾼다 (R6). 리소스를 기다린 뒤 한 번 더 수렴시킨다.
    await waitForResourceStability(idoc, DEFAULT_TIMEOUT);
    await this.settle(idoc);

    // 렌더 순서 = DOM 문서 순서. canonical id 를 가진 노드만 센다.
    //
    // **canonical node 1개 ↔ DOM element 여러 개** 인 경우가 있다. 예: `Image` 는
    // `<div style="display: contents">` 래퍼와 그 안의 `<img>` 가 **같은**
    // `data-element-id` 를 갖는다. `nodeOrder` 는 정의상 *node id* 의 목록이므로
    // 중복은 leg 의 성질이 아니라 추출의 오류다 — canonical id 로 dedupe 한다.
    const painted = Array.from(
      idoc.querySelectorAll("[data-element-id]"),
    ) as HTMLElement[];
    const hostRect = this.element.getBoundingClientRect();
    const win = this.element.contentWindow!;

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

    // 2) id 마다 **실제 상자를 갖는** 요소로 geometry/style 을 잡는다.
    //    `display: contents` 래퍼는 레이아웃 상자를 만들지 않아
    //    `getBoundingClientRect()` 가 자식 합집합이거나 0 이 된다.
    const geometry: Record<string, Rect> = {};
    const styles: Record<string, Record<string, string>> = {};
    for (const [id, els] of byId) {
      const box =
        els.find((el) => win.getComputedStyle(el).display !== "contents") ??
        els[0];
      const r = box.getBoundingClientRect();
      geometry[id] = {
        x: r.x - hostRect.x,
        y: r.y - hostRect.y,
        width: r.width,
        height: r.height,
      };
      styles[id] = normalizeStyles(win, box);
    }

    const resources: ResourceManifest = captureResources(idoc);
    const errors = [
      ...this.errors,
      ...resources.failedResources.map((r) => `resource: ${r}`),
    ];

    const result: LegResult = {
      legId: "preview",
      fixtureChecksum: stableChecksum(doc),
      environmentChecksum: environmentChecksum(env),
      nodeOrder,
      geometry,
      styles,
      resourceChecksum: stableChecksum({
        fonts: resources.fonts,
        images: resources.images,
        styleSheets: resources.styleSheets,
      }),
      externalRequests: resources.externalRequests,
      paintedNodeCount: nodeOrder.length,
      consoleErrors: errors,
    };

    // 런타임에 문서별 ack 이 없어서 만든 테스트 전용 ack: DOM 에서 유도한 지문을
    // fixture checksum 에 묶어 기록한다. 같은 문서 → 같은 지문, 다른 문서 → 다른
    // 지문이라는 두 방향을 테스트가 검사한다.
    this.ackLog.push({
      fixtureChecksum: result.fixtureChecksum,
      domFingerprint: stableChecksum({ nodeOrder, geometry, styles }),
    });

    return result;
  }

  /** 아티보드 PNG + 디코드된 RGBA. 결정성 해시와 L3 의 원본이다. */
  async capture(): Promise<{
    png: Uint8Array;
    pixels: Uint8Array;
    width: number;
    height: number;
  }> {
    const { page } = await import("vitest/browser");
    const shot = await page.screenshot({
      element: this.element,
      base64: true,
      save: false,
    });
    const b64 = typeof shot === "string" ? shot : shot.base64;
    if (!b64) throw new Error("PARITY-RESOURCE: 스크린샷 base64 없음");
    const png = base64ToBytes(b64);
    const decoded = await decodePngToRgba(png);
    return { png, ...decoded };
  }
}
