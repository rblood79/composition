// @vitest-environment node
/**
 * paragraph 소유 = 텍스트 노드 (ADR-174 Phase 2, G3)
 *
 * 전역 LRU 는 "이 항목이 더는 필요 없다" 를 알려 줄 주체가 없어 상한을 강제하고,
 * 상한은 퇴거를, 퇴거는 프레임 중 폐기를 부른다 (= ADR-174 Context 의 병).
 * 소유자를 노드로 두면 수명이 노드 수명이 되어 그 사슬이 끊긴다.
 *
 * 계약:
 * 1. 같은 노드 · 같은 텍스트 축 · 같은 fontMgr → 재사용 (재생성 0)
 * 2. 텍스트 축 또는 fontMgr 이 바뀌면 → 무효 + 구 paragraph 는 **지연** 폐기
 * 3. 노드가 버려지면 서브트리 전체가 지연 폐기
 * 4. 상한 없음 — 노드 수만큼 보유하고 퇴거하지 않는다
 * 5. 슬롯은 심볼 키 — `Object.keys` 기반 노드 동등성 비교에 영향 0
 *    (일반 필드면 StoreRenderBridge 의 identity 안정화가 깨져 매 프레임 재생성)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FontMgr, Paragraph } from "canvaskit-wasm";

import type { SkiaNodeData } from "./nodeRendererTypes";
import {
  getRetainedParagraphCount,
  linkParagraphOwner,
  releaseParagraphsIn,
  resolveRetainedParagraph,
  retainParagraph,
} from "./retainedParagraph";
import {
  drainPendingWasmDisposals,
  getPendingWasmDisposalCount,
} from "./deferredDisposal";

function makeParagraph(): Paragraph & { delete: ReturnType<typeof vi.fn> } {
  return { delete: vi.fn() } as unknown as Paragraph & {
    delete: ReturnType<typeof vi.fn>;
  };
}

const FONT_MGR = { id: "fm-1" } as unknown as FontMgr;
const OTHER_FONT_MGR = { id: "fm-2" } as unknown as FontMgr;

function makeTextNode(content: string): SkiaNodeData {
  return {
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    visible: true,
    text: {
      content,
      fontFamilies: ["Inter"],
      fontSize: 14,
      color: new Float32Array([0, 0, 0, 1]),
      maxWidth: 100,
      paddingLeft: 0,
    },
  } as unknown as SkiaNodeData;
}

beforeEach(() => {
  drainPendingWasmDisposals();
});

describe("소유자 = 텍스트 노드", () => {
  it("같은 노드 · 같은 키 · 같은 fontMgr 은 재사용된다", () => {
    const node = makeTextNode("Home");
    const paragraph = makeParagraph();
    retainParagraph(node, paragraph, "key-1", FONT_MGR, 4);

    const hit = resolveRetainedParagraph(node, "key-1", FONT_MGR);
    expect(hit?.paragraph).toBe(paragraph);
    expect(hit?.alignOffset).toBe(4);
    expect(paragraph.delete).not.toHaveBeenCalled();
  });

  it("텍스트 축이 바뀌면 무효 — 구 paragraph 는 지연 폐기", () => {
    const node = makeTextNode("Home");
    const stale = makeParagraph();
    retainParagraph(node, stale, "key-1", FONT_MGR, 0);

    expect(resolveRetainedParagraph(node, "key-2", FONT_MGR)).toBeUndefined();
    expect(stale.delete).not.toHaveBeenCalled();
    expect(getPendingWasmDisposalCount()).toBeGreaterThan(0);

    drainPendingWasmDisposals();
    expect(stale.delete).toHaveBeenCalledTimes(1);
  });

  it("fontMgr 이 바뀌면 무효 — 전량 clear 없이 노드 단위로 갈린다", () => {
    const node = makeTextNode("Home");
    const stale = makeParagraph();
    retainParagraph(node, stale, "key-1", FONT_MGR, 0);

    expect(
      resolveRetainedParagraph(node, "key-1", OTHER_FONT_MGR),
    ).toBeUndefined();
    expect(stale.delete).not.toHaveBeenCalled();
    drainPendingWasmDisposals();
    expect(stale.delete).toHaveBeenCalledTimes(1);
  });

  it("교체 retain 도 이전 것을 즉시 delete 하지 않는다", () => {
    const node = makeTextNode("Home");
    const first = makeParagraph();
    const second = makeParagraph();
    retainParagraph(node, first, "key-1", FONT_MGR, 0);
    retainParagraph(node, second, "key-2", FONT_MGR, 0);

    expect(first.delete).not.toHaveBeenCalled();
    drainPendingWasmDisposals();
    expect(first.delete).toHaveBeenCalledTimes(1);
    expect(second.delete).not.toHaveBeenCalled();
  });
});

describe("수명 = 노드 수명", () => {
  it("releaseParagraphsIn 은 서브트리 전체를 지연 폐기한다", () => {
    const leafA = makeTextNode("A");
    const leafB = makeTextNode("B");
    const root = {
      ...makeTextNode("root"),
      type: "container",
      children: [leafA, { ...makeTextNode("mid"), children: [leafB] }],
    } as unknown as SkiaNodeData;

    const pa = makeParagraph();
    const pb = makeParagraph();
    retainParagraph(leafA, pa, "a", FONT_MGR, 0);
    retainParagraph(leafB, pb, "b", FONT_MGR, 0);

    releaseParagraphsIn(root);

    expect(pa.delete).not.toHaveBeenCalled();
    expect(pb.delete).not.toHaveBeenCalled();
    drainPendingWasmDisposals();
    expect(pa.delete).toHaveBeenCalledTimes(1);
    expect(pb.delete).toHaveBeenCalledTimes(1);
  });

  it("상한이 없다 — 노드 수만큼 보유하고 퇴거하지 않는다", () => {
    const before = getRetainedParagraphCount();
    const nodes: SkiaNodeData[] = [];
    const paragraphs: ReturnType<typeof makeParagraph>[] = [];
    for (let i = 0; i < 5000; i++) {
      const node = makeTextNode(`t-${i}`);
      const p = makeParagraph();
      nodes.push(node);
      paragraphs.push(p);
      retainParagraph(node, p, `key-${i}`, FONT_MGR, 0);
    }

    expect(getRetainedParagraphCount() - before).toBe(5000);
    // 전량 생존 — 어느 것도 퇴거로 폐기되지 않았다
    expect(getPendingWasmDisposalCount()).toBe(0);
    expect(
      resolveRetainedParagraph(nodes[0], "key-0", FONT_MGR)?.paragraph,
    ).toBe(paragraphs[0]);

    for (const node of nodes) releaseParagraphsIn(node);
    expect(getRetainedParagraphCount()).toBe(before);
    drainPendingWasmDisposals();
  });
});

describe("소유자는 원본 노드 — 렌더 커맨드의 파생본이 아니다", () => {
  // renderCommands 는 DRAW 커맨드마다 `{...node, x:0, y:0, children:undefined}`
  // 로 새 객체를 만든다. 파생본을 소유자로 삼으면 커맨드 스트림이 재빌드될
  // 때마다 소유자가 사라져 매 프레임 재생성이 된다 (live 실측 hit 0 / miss 24).
  it("파생본으로 조회해도 원본이 보유한 paragraph 를 찾는다", () => {
    const origin = makeTextNode("Home");
    const paragraph = makeParagraph();
    retainParagraph(origin, paragraph, "key-1", FONT_MGR, 2);

    const derived = linkParagraphOwner(
      { ...origin, x: 0, y: 0, children: undefined } as SkiaNodeData,
      origin,
    );
    expect(
      resolveRetainedParagraph(derived, "key-1", FONT_MGR)?.paragraph,
    ).toBe(paragraph);
  });

  it("파생본으로 retain 해도 보유는 원본에 남는다 — 다음 커맨드 빌드가 hit", () => {
    const origin = makeTextNode("Home");
    const paragraph = makeParagraph();

    const firstDerived = linkParagraphOwner(
      { ...origin, x: 0, y: 0 } as SkiaNodeData,
      origin,
    );
    retainParagraph(firstDerived, paragraph, "key-1", FONT_MGR, 0);

    // 다음 프레임: 커맨드가 새로 만들어져도 원본은 그대로다
    const nextDerived = linkParagraphOwner(
      { ...origin, x: 0, y: 0 } as SkiaNodeData,
      origin,
    );
    expect(
      resolveRetainedParagraph(nextDerived, "key-1", FONT_MGR)?.paragraph,
    ).toBe(paragraph);

    // 해제도 원본 트리 순회로 도달한다
    releaseParagraphsIn(origin);
    drainPendingWasmDisposals();
    expect(paragraph.delete).toHaveBeenCalledTimes(1);
  });

  it("보유 슬롯은 스프레드로 파생본에 새지 않는다", () => {
    // 열거 가능하면 파생본이 소유권을 복사해 가, 원본 해제 후에도 파생본이
    // 죽은 paragraph 를 hit 으로 돌려준다 (use-after-free).
    const origin = makeTextNode("Home");
    retainParagraph(origin, makeParagraph(), "key-1", FONT_MGR, 0);

    const copy = { ...origin } as SkiaNodeData;
    expect(resolveRetainedParagraph(copy, "key-1", FONT_MGR)).toBeUndefined();

    releaseParagraphsIn(origin);
    drainPendingWasmDisposals();
  });
});

describe("슬롯은 노드 동등성 비교에 보이지 않는다", () => {
  it("retain 후에도 Object.keys / JSON 직렬화가 변하지 않는다", () => {
    // StoreRenderBridge.skiaNodeContentEqualsIgnoringPosition 은 Object.keys 로
    // 키 개수와 값을 비교한다. 슬롯이 열거 가능하면 prev(보유) 와 new(미보유)
    // 가 항상 불일치로 판정되어 노드 identity 가 매 프레임 교체되고,
    // 그러면 retained 소유가 곧 매 프레임 재생성이 된다.
    const node = makeTextNode("Home");
    const keysBefore = Object.keys(node);
    const jsonBefore = JSON.stringify(node);

    retainParagraph(node, makeParagraph(), "key-1", FONT_MGR, 0);

    expect(Object.keys(node)).toEqual(keysBefore);
    expect(JSON.stringify(node)).toBe(jsonBefore);

    releaseParagraphsIn(node);
    drainPendingWasmDisposals();
  });
});
