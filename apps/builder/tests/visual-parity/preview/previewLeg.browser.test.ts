/**
 * ADR-198 Phase 0 — Preview leg 파일럿 (task 4)
 *
 * 실제 `preview.html` 번들을 iframe 으로 띄우고, **프로덕션 canonical 메시지
 * 경로**(`UPDATE_CANONICAL_DOCUMENT` → `messageHandler` → runtime store →
 * `CanonicalNodeRenderer`) 로 fixture 를 밀어넣은 뒤 아티보드를 캡처한다.
 *
 * 단순화한 DOM 을 직접 만들지 않는다 (HC3) — 그렇게 하면 이 leg 은 Preview 가
 * 아니라 테스트가 그린 그림을 검증하게 된다.
 *
 * settle 은 고정 프레임 수가 아니라 **수렴** 으로 한다 (HC Soft): 두 번 연속
 * 같은 DOM 서명이 나올 때 캡처한다. 늦게 도착하는 폰트/이미지 디코드는 프레임
 * 수로는 잡히지 않는다.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { page } from "@vitest/browser/context";
import {
  createPilotDocument,
  fixtureChecksum,
  FIXTURE_ARTBOARD,
  FIXTURE_PAGE_ID,
  FIXTURE_PROJECT_ID,
} from "../harness/fixture";

const PREVIEW_URL = "/preview.html";
const SETTLE_TIMEOUT_MS = 15_000;

let iframe: HTMLIFrameElement;
let previewReady = false;

function raf(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

/** iframe 안 DOM 의 구조 서명 — 수렴 판정 입력. */
function domSignature(doc: Document): string {
  const root = doc.body;
  if (!root) return "";
  const parts: string[] = [];
  const walk = (el: Element, depth: number) => {
    if (depth > 12) return;
    const r = el.getBoundingClientRect();
    parts.push(
      `${el.tagName}#${el.id}.${el.className}@${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`,
    );
    for (const c of Array.from(el.children)) walk(c, depth + 1);
  };
  walk(root, 0);
  return parts.join("|");
}

/** 두 번 연속 같은 서명이 나올 때까지 기다린다 (고정 프레임 수 금지). */
async function settleByConvergence(doc: Document): Promise<{
  signature: string;
  iterations: number;
}> {
  const start = performance.now();
  let prev = domSignature(doc);
  let iterations = 0;
  while (performance.now() - start < SETTLE_TIMEOUT_MS) {
    await raf();
    await raf();
    iterations++;
    const next = domSignature(doc);
    if (next === prev && next.length > 0) {
      return { signature: next, iterations };
    }
    prev = next;
  }
  throw new Error(
    `PARITY-RESOURCE: preview leg 이 ${SETTLE_TIMEOUT_MS}ms 안에 수렴하지 않았다 (iterations=${iterations})`,
  );
}

describe("ADR-198 Phase 0 — Preview leg (task 4)", () => {
  beforeAll(async () => {
    iframe = document.createElement("iframe");
    iframe.width = String(FIXTURE_ARTBOARD.width);
    iframe.height = String(FIXTURE_ARTBOARD.height);
    iframe.style.border = "0";
    iframe.src = PREVIEW_URL;

    // Preview 는 준비되면 parent 로 PREVIEW_READY 를 보낸다
    // (`messaging/messageHandler.ts::messageSender.sendReady`). `load` 이벤트는
    // HTML 도착 시점이라 module script 의 React mount + 리스너 부착보다 이르다 —
    // load 직후 postMessage 하면 아무도 안 듣는 창에 대고 말하게 되고, 그 결과
    // 빈 body 가 "수렴" 으로 보인다 (R11 이 말한 degenerate frame).
    const ready = new Promise<void>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error("PREVIEW_READY 타임아웃")),
        SETTLE_TIMEOUT_MS,
      );
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === "PREVIEW_READY") {
          previewReady = true;
          clearTimeout(t);
          window.removeEventListener("message", onMessage);
          resolve();
        }
      };
      window.addEventListener("message", onMessage);
    });

    document.body.appendChild(iframe);
    await ready;
  }, 30_000);

  afterAll(() => {
    iframe?.remove();
  });

  it("preview.html 이 실제로 뜨고 canonical 문서를 받아 렌더한다", async () => {
    const doc = createPilotDocument();
    const checksum = fixtureChecksum(doc);

    const win = iframe.contentWindow;
    const idoc = iframe.contentDocument;
    expect(win).toBeTruthy();
    expect(idoc).toBeTruthy();

    const errors: string[] = [];
    win!.addEventListener("error", (e) => errors.push(String(e.message)));

    win!.postMessage(
      {
        type: "UPDATE_CANONICAL_DOCUMENT",
        projectId: FIXTURE_PROJECT_ID,
        documentRevision: 1,
        document: doc,
      },
      "*",
    );

    const settled = await settleByConvergence(idoc!);

    const nodeCount = idoc!.querySelectorAll("*").length;
    // liveness 는 노드 **개수** 로 판정하지 않는다 — HTML 뼈대만으로도 9개다.
    // fixture 가 실제로 렌더됐는지는 fixture 의 노드가 DOM 에 있는지로 본다.
    const rendered = {
      page: idoc!.querySelector(`[data-element-id="${FIXTURE_PAGE_ID}"]`),
      outer: idoc!.querySelector('[data-element-id="adr198-outer"]'),
      inner: idoc!.querySelector('[data-element-id="adr198-inner"]'),
    };

    console.log(
      `[ADR-198 P0-preview] ready=${previewReady} checksum=${checksum} ` +
        `settleIterations=${settled.iterations} domNodes=${nodeCount} errors=${errors.length}`,
    );
    console.log(
      `[ADR-198 P0-preview] fixture nodes: page=${!!rendered.page} outer=${!!rendered.outer} inner=${!!rendered.inner}`,
    );
    console.log(
      `[ADR-198 P0-preview] body.innerHTML(0,600)=${idoc!.body.innerHTML.slice(0, 600)}`,
    );

    expect(errors).toEqual([]);
    expect(previewReady).toBe(true);
    expect(rendered.page).toBeTruthy();
    expect(rendered.outer).toBeTruthy();
    expect(rendered.inner).toBeTruthy();

    // L1 입력 — 노드별 geometry manifest. Skia leg 의 bounds 와 대조할 값.
    const geometry: Record<string, DOMRect> = {};
    const hostRect = iframe.getBoundingClientRect();
    for (const [key, el] of Object.entries(rendered)) {
      const r = (el as Element).getBoundingClientRect();
      geometry[key] = new DOMRect(
        r.x - hostRect.x,
        r.y - hostRect.y,
        r.width,
        r.height,
      );
    }
    console.log(
      `[ADR-198 P0-preview] geometry(artboard-relative)=` +
        Object.entries(geometry)
          .map(
            ([k, r]) =>
              `${k}:${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`,
          )
          .join(" "),
    );

    // fixture 가 선언한 좌표가 실제 렌더 결과와 맞는지 — L1 이 vacuous 하지 않음을 확인
    expect(geometry.page.width).toBe(FIXTURE_ARTBOARD.width);
    expect(geometry.page.height).toBe(FIXTURE_ARTBOARD.height);
    expect(geometry.outer.x).toBe(24);
    expect(geometry.inner.x).toBe(56);
  }, 60_000);

  it("아티보드를 PNG 으로 캡처한다 (두 leg 산출물 중 Preview 쪽)", async () => {
    const shot = await page.screenshot({
      element: iframe,
      base64: true,
      save: false,
    });
    const b64 = typeof shot === "string" ? shot : shot.base64;
    expect(b64).toBeTruthy();

    const bytes = Uint8Array.from(atob(b64!), (c) => c.charCodeAt(0));
    // PNG magic — 캡처가 실제 이미지인지 (존재가 아니라 내용을 본다)
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

    console.log(
      `[ADR-198 P0-preview] png bytes=${bytes.length} magic=OK checksum=${fixtureChecksum(createPilotDocument())}`,
    );
  }, 60_000);

  it("결정성: 같은 fixture 를 10회 재전송해도 DOM 서명이 동일하다", async () => {
    const idoc = iframe.contentDocument!;
    const win = iframe.contentWindow!;
    const doc = createPilotDocument();
    const signatures = new Set<string>();

    for (let i = 0; i < 10; i++) {
      win.postMessage(
        {
          type: "UPDATE_CANONICAL_DOCUMENT",
          projectId: FIXTURE_PROJECT_ID,
          documentRevision: 1,
          document: doc,
        },
        "*",
      );
      const settled = await settleByConvergence(idoc);
      signatures.add(settled.signature);
    }

    console.log(
      `[ADR-198 P0-preview] 10-run DOM 서명 distinct=${signatures.size}`,
    );
    expect(signatures.size).toBe(1);
  }, 120_000);
});
