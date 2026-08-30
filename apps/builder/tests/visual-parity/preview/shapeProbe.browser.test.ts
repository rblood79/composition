/**
 * ADR-198 Phase 0 — Preview leg 이 받는 문서 형태 판정
 *
 * 네 형태(S1~S4)를 같은 Preview 인스턴스에 차례로 먹이고, 각 형태에서
 * outer/inner 노드가 DOM 에 도달하는지 본다. S1 은 대조군 — 이미 3/3 이
 * 확인된 형태라, S1 이 여기서도 3/3 이 나와야 이 계측기 자체를 믿을 수 있다.
 * (직전 세션에서 축약 probe 가 네 조합 모두 `none` 을 반환해 무효로 판명난 적이
 *  있다. 대조군이 그 재발을 막는다.)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  SHAPES,
  SHAPE_OUTER_ID,
  SHAPE_INNER_ID,
  SHAPE_PAGE_ID,
  SHAPE_ARTBOARD,
} from "../harness/shapes";
import { makeShape } from "../harness/shapes";
import { FIXTURE_PROJECT_ID } from "../harness/fixture";

const PREVIEW_URL = "/preview.html";
const TIMEOUT = 15_000;

let iframe: HTMLIFrameElement;

/**
 * `documentRevision` 은 **매 전송마다 증가**해야 한다. 같은 revision 을 다시 보내면
 * runtime store 가 stale 로 무시할 수 있고, 그러면 "형태가 렌더 안 된다" 와
 * "업데이트가 무시됐다" 가 구별되지 않는다 — 계측기가 교란 변수를 안고 도는 셈이다.
 * (실제로 이 probe 의 1차 버전이 그 함정에 빠져 같은 형태를 두 번 재면 결과가
 *  갈렸다.)
 */
let revision = 0;
const nextRevision = () => ++revision;

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function signature(doc: Document): string {
  const parts: string[] = [];
  const walk = (el: Element, d: number) => {
    if (d > 12) return;
    const r = el.getBoundingClientRect();
    parts.push(
      `${el.tagName}#${el.id}@${r.width.toFixed(1)}x${r.height.toFixed(1)}`,
    );
    for (const c of Array.from(el.children)) walk(c, d + 1);
  };
  if (doc.body) walk(doc.body, 0);
  return parts.join("|");
}

async function settle(doc: Document): Promise<string> {
  const start = performance.now();
  let prev = signature(doc);
  while (performance.now() - start < TIMEOUT) {
    await raf();
    await raf();
    const next = signature(doc);
    if (next === prev && next.length > 0) return next;
    prev = next;
  }
  throw new Error("PARITY-RESOURCE: 수렴 실패");
}

describe("ADR-198 Phase 0 — Preview 가 받는 문서 형태", () => {
  beforeAll(async () => {
    iframe = document.createElement("iframe");
    iframe.width = String(SHAPE_ARTBOARD.width);
    iframe.height = String(SHAPE_ARTBOARD.height);
    iframe.style.border = "0";
    iframe.src = PREVIEW_URL;

    const ready = new Promise<void>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error("PREVIEW_READY 타임아웃")),
        TIMEOUT,
      );
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === "PREVIEW_READY") {
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

  afterAll(() => iframe?.remove());

  it("S1~S4 중 어느 형태가 자식 노드까지 렌더되는지 가른다", async () => {
    const win = iframe.contentWindow!;
    const idoc = iframe.contentDocument!;
    const rows: string[] = [];
    const reached: Record<string, boolean> = {};

    for (const shape of SHAPES) {
      win.postMessage(
        {
          type: "UPDATE_CANONICAL_DOCUMENT",
          projectId: FIXTURE_PROJECT_ID,
          documentRevision: nextRevision(),
          document: makeShape(shape.opts),
        },
        "*",
      );
      await settle(idoc);

      const page = idoc.querySelector(`[data-element-id="${SHAPE_PAGE_ID}"]`);
      const outer = idoc.querySelector(`[data-element-id="${SHAPE_OUTER_ID}"]`);
      const inner = idoc.querySelector(`[data-element-id="${SHAPE_INNER_ID}"]`);
      const outerRect = outer?.getBoundingClientRect();
      reached[shape.id] = !!outer && !!inner;

      rows.push(
        `${shape.id} ${shape.label} → page=${!!page} outer=${!!outer} inner=${!!inner}` +
          (outerRect ? ` outerBox=${outerRect.width}x${outerRect.height}` : ""),
      );

      // 다음 형태로 넘어가기 전 초기화 — 이전 형태의 잔상이 다음 판정에 섞이지 않게
      win.postMessage(
        {
          type: "UPDATE_CANONICAL_DOCUMENT",
          projectId: FIXTURE_PROJECT_ID,
          documentRevision: nextRevision(),
          document: { version: "composition-1.0", children: [] },
        },
        "*",
      );
      await settle(idoc).catch(() => "");
    }

    for (const r of rows) console.log(`[ADR-198 P0-shape] ${r}`);

    // 대조군 검증 — S1 이 3/3 이 아니면 이 계측기를 믿을 수 없다.
    expect(reached.S1, "S1 대조군이 실패하면 probe 자체가 무효").toBe(true);
  }, 120_000);

  /**
   * 형태 축(S1~S4)이 전부 3/3 이면 남는 변수는 **색 표기** 하나다.
   * `harness/fixture.ts` 는 hex8(`#2F6FEDFF`), `harness/shapes.ts` 는 hex6.
   * 같은 형태(S4)에 표기만 바꿔 먹여 한 축을 고립시킨다.
   */
  it("색 표기 축 고립 — 같은 S4 형태에 hex6 / hex8 을 각각 먹인다", async () => {
    const win = iframe.contentWindow!;
    const idoc = iframe.contentDocument!;

    const run = async (notation: "hex6" | "hex8") => {
      const doc = makeShape({
        legacyPageMetadata: true,
        bodyWrapper: true,
      }) as unknown as {
        children: Array<Record<string, unknown>>;
      };
      if (notation === "hex8") {
        // 문서를 순회하며 backgroundColor / border*Color 의 hex6 을 hex8 로 승격
        const bump = (n: Record<string, unknown>) => {
          const props = n.props as
            { style?: Record<string, string> } | undefined;
          const st = props?.style;
          if (st) {
            for (const k of Object.keys(st)) {
              if (/^#[0-9A-Fa-f]{6}$/.test(st[k])) st[k] = `${st[k]}FF`;
            }
          }
          for (const c of (n.children as
            Record<string, unknown>[] | undefined) ?? [])
            bump(c);
        };
        for (const c of doc.children) bump(c);
      }

      win.postMessage(
        {
          type: "UPDATE_CANONICAL_DOCUMENT",
          projectId: FIXTURE_PROJECT_ID,
          documentRevision: nextRevision(),
          document: doc,
        },
        "*",
      );
      await settle(idoc);

      const outer = idoc.querySelector(`[data-element-id="${SHAPE_OUTER_ID}"]`);
      const inner = idoc.querySelector(`[data-element-id="${SHAPE_INNER_ID}"]`);
      const bg = outer
        ? getComputedStyle(outer as Element).backgroundColor
        : "(no node)";
      console.log(
        `[ADR-198 P0-notation] ${notation} → outer=${!!outer} inner=${!!inner} outerBg=${bg}`,
      );
      return { outer: !!outer, inner: !!inner, bg };
    };

    const hex6 = await run("hex6");
    const hex8 = await run("hex8");

    // S4 는 표기와 무관하게 자식이 도달하지 않는다 — 즉 **색 표기는 이 축이
    // 아니다**. Preview 쪽 변수는 `Body` 래퍼 하나로 좁혀진다 (S1/S2 vs S3/S4).
    expect(hex6.outer).toBe(false);
    expect(hex8.outer).toBe(false);
  }, 120_000);
});
