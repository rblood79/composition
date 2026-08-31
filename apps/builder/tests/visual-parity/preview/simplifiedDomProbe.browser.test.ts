/**
 * ADR-198 Phase 3 (task 5) — negative probe: 간이 DOM 은 진입 단언을 통과 못 한다
 *
 * ## 이 파일이 `srcdoc` 으로 DOM 을 직접 만드는 이유 (명시 예외)
 *
 * 이 파일은 parity leg 이 **아니다**. HC3("간이 DOM 금지") 가 실제로 무언가를
 * 막는지 확인하는 **negative probe** 다 — 금지 규칙은 그것을 어긴 입력이 실제로
 * 거부되는 걸 봐야 규칙이 된다. 여기서 만든 DOM 의 산출물은 어떤 parity 판정에도
 * 입력되지 않는다.
 *
 * ## 왜 두 변종인가
 *
 * 단순 정적 DOM 하나만 떨어뜨리는 건 약한 증명이다 — "핸드셰이크가 없어서 막혔다"
 * 로 끝나면, 핸드셰이크를 흉내 내는 순간 규칙이 뚫린다. 그래서 **핸드셰이크를
 * 실제로 보내는** 변종을 같이 둔다. 그 변종은 겉보기 DOM 이 진짜 Preview 와
 * 구별되지 않지만, canonical 문서를 바꿔도 화면이 안 바뀌므로 여전히 막힌다.
 * 막는 것은 겉모습이 아니라 **문서를 소비하는가** 다.
 */

import { afterEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import {
  assertProductionEntry,
  type PreviewEntryProbe,
} from "../harness/previewDriver";
import { basicGeometryPaint, catalogStatePaint } from "../cases";

const HANDSHAKE_SCRIPT = `<script>parent.postMessage({ type: "PREVIEW_READY" }, "*");<\/script>`;

/**
 * 진짜 Preview 와 **겉보기 DOM 이 같은** 정적 문서. 같은 `data-element-id`,
 * 같은 상자. 다른 점은 하나뿐이다 — canonical 메시지를 듣지 않는다.
 */
function staticDomHtml(withHandshake: boolean): string {
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0}
    body{width:240px;height:180px;padding:20px;background:#FFFFFF;box-sizing:border-box}
    .outer{width:160px;height:110px;padding:24px;background:#2F6FED;border-radius:12px;
      border:2px solid #102A5C;box-sizing:border-box}
    .inner{width:60px;height:40px;background:#E8443F;box-sizing:border-box}
  </style></head><body data-element-id="basic-body">
    <div class="outer" data-element-id="basic-outer">
      <div class="inner" data-element-id="basic-inner"></div>
    </div>
    ${withHandshake ? HANDSHAKE_SCRIPT : ""}
  </body></html>`;
}

class StaticDomProbe implements PreviewEntryProbe {
  handshakeReceived = false;
  private iframe: HTMLIFrameElement | null = null;

  async start(withHandshake: boolean): Promise<void> {
    const el = document.createElement("iframe");
    el.width = "240";
    el.height = "180";
    el.style.border = "0";

    const settled = new Promise<void>((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if ((e.data as { type?: string } | null)?.type === "PREVIEW_READY") {
          this.handshakeReceived = true;
        }
      };
      window.addEventListener("message", onMessage);
      el.addEventListener("load", () => {
        // 핸드셰이크 메시지는 load 직후 한 틱 안에 도착한다.
        setTimeout(() => {
          window.removeEventListener("message", onMessage);
          resolve();
        }, 50);
      });
    });

    // 예외 사유는 파일 상단 주석에 있다 — 이 leg 은 parity leg 이 아니라 probe 다.
    el.srcdoc = staticDomHtml(withHandshake);
    document.body.appendChild(el);
    this.iframe = el;
    await settled;
  }

  stop(): void {
    this.iframe?.remove();
    this.iframe = null;
  }

  async sendAndSettle(doc: CompositionDocument): Promise<string> {
    const el = this.iframe!;
    // 진짜 leg 과 **같은 메시지**를 보낸다. 듣는 쪽이 없을 뿐이다.
    el.contentWindow!.postMessage(
      {
        type: "UPDATE_CANONICAL_DOCUMENT",
        projectId: "adr198-negative-probe",
        documentRevision: Date.now(),
        document: doc,
      },
      "*",
    );
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const idoc = el.contentDocument!;
    const parts: string[] = [];
    const walk = (node: Element, d: number) => {
      if (d > 14) return;
      const r = node.getBoundingClientRect();
      parts.push(
        `${node.tagName}#${node.getAttribute("data-element-id") ?? ""}@${r.width.toFixed(2)}x${r.height.toFixed(2)}`,
      );
      for (const c of Array.from(node.children)) walk(c, d + 1);
    };
    walk(idoc.body, 0);
    return parts.join("|");
  }
}

const DOCS: readonly CompositionDocument[] = [
  basicGeometryPaint.document,
  catalogStatePaint.document,
];

describe("ADR-198 Phase 3 (task 5) — 간이 DOM 은 진입 단언을 통과 못 한다", () => {
  let probe: StaticDomProbe | null = null;
  afterEach(() => probe?.stop());

  it("핸드셰이크 없는 정적 DOM: PARITY-ENV 2건 (핸드셰이크 + canonical 경로)", async () => {
    probe = new StaticDomProbe();
    await probe.start(false);

    const verdict = await assertProductionEntry(probe, DOCS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;

    const firsts = verdict.failures.map((f) => f.first).sort();
    console.log(
      `[ADR-198 P3-neg] no-handshake failures=${verdict.failures.length} ` +
        `codes=${verdict.failures.map((f) => f.code).join(",")} first=${firsts.join(",")}`,
    );
    expect(verdict.failures.every((f) => f.code === "PARITY-ENV")).toBe(true);
    expect(firsts).toEqual(["PREVIEW_READY", "canonical-path"]);
  }, 60_000);

  it("핸드셰이크를 흉내 내도 막힌다 — 남는 실패는 canonical 경로 하나", async () => {
    probe = new StaticDomProbe();
    await probe.start(true);

    // 겉보기로는 진짜 Preview 와 구별되지 않는다: 핸드셰이크를 보냈다.
    expect(probe.handshakeReceived).toBe(true);

    const verdict = await assertProductionEntry(probe, DOCS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;

    console.log(
      `[ADR-198 P3-neg] faked-handshake failures=${verdict.failures.length} ` +
        `detail=${verdict.failures[0].detail}`,
    );
    expect(verdict.failures).toHaveLength(1);
    expect(verdict.failures[0].code).toBe("PARITY-ENV");
    expect(verdict.failures[0].first).toBe("canonical-path");
  }, 60_000);

  it("단언 자체가 vacuous 하지 않다 — 문서 1개로는 호출을 거부한다", async () => {
    probe = new StaticDomProbe();
    await probe.start(true);
    await expect(
      assertProductionEntry(probe, [basicGeometryPaint.document]),
    ).rejects.toThrow(/2개 이상/);
  }, 60_000);
});
