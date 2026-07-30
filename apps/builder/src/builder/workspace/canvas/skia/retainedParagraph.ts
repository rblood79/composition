/**
 * paragraph 소유 = 텍스트 노드 (ADR-174 Phase 2)
 *
 * 전역 content-키 LRU 는 "이 항목이 더는 필요 없다" 를 알려 줄 주체가 없다.
 * 그래서 상한을 두게 되고, 상한은 퇴거를, 퇴거는 프레임 중 폐기를 부른다 —
 * 그 사슬 끝이 ADR-174 Context 의 텍스트 소실이다. 소유자를 노드로 두면
 * 수명이 노드 수명이 되어 그 질문 자체가 사라진다 (Pen v1.2.1 동형 —
 * `PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md` §3-4-1).
 *
 * **소유자는 텍스트 `SkiaNodeData` 객체**다 — element id 가 아니다.
 * `specShapeConverter` 가 spec text shape 마다 노드를 하나씩 만들므로
 * (`specShapeConverter.ts:817`) element 로 잡으면 한 요소가 여러 텍스트를
 * 그릴 때 1:N 이 되어 둘째 텍스트가 소유자를 잃는다.
 *
 * **슬롯은 심볼 키**여야 한다. `StoreRenderBridge.skiaNodeContentEqualsIgnoringPosition`
 * 이 `Object.keys` 로 노드 동등성을 판정해 identity 를 안정화하는데
 * (ADR-153 Phase 3 — 이동은 노드 객체를 교체하지 않는다), 열거 가능한 필드로
 * 붙이면 "보유한 prev" 와 "미보유 new" 가 항상 불일치가 되어 노드가 매 프레임
 * 교체된다. 그러면 retained 소유가 곧 매 프레임 재생성이 된다.
 * `Symbol.for` 인 것은 HMR 로 모듈이 두 번 로드돼도 같은 슬롯을 가리키게 하기
 * 위해서다 (모듈-지역 `Symbol()` 이면 구 인스턴스가 붙인 paragraph 가 고아가 된다).
 */
import type { FontMgr, Paragraph } from "canvaskit-wasm";

import type { SkiaNodeData } from "./nodeRendererTypes";
import { scheduleWasmDisposal } from "./deferredDisposal";

const PARAGRAPH_SLOT = Symbol.for("composition.retainedParagraph");

/**
 * 파생 노드 → 원본 노드 링크.
 *
 * `renderCommands.emitDrawCommands` / `emitInternalChildDraw` 는 DRAW 커맨드마다
 * `{...node, x:0, y:0, children:undefined}` 로 **새 객체**를 만든다 (좌표가
 * ELEMENT_BEGIN 에서 이미 translate 됐기 때문). 그 파생 객체를 소유자로 삼으면
 * 커맨드 스트림이 재빌드될 때마다 소유자가 사라져 매번 재생성이 된다 —
 * 실측 hit 0 / miss 24 (2026-07-31). 소유자는 레지스트리에 사는 **원본** 노드다.
 */
const OWNER_SLOT = Symbol.for("composition.paragraphOwner");

export interface RetainedParagraph {
  paragraph: Paragraph;
  /** 텍스트 축 캐시 키 — 노드 객체가 그대로 mutate 되는 경로까지 잡는다 */
  key: string;
  /** 생성 시점 fontMgr — 교체되면 shaping 결과가 달라지므로 무효 */
  fontMgr: FontMgr;
  /** justify 계열 정렬 보정 (구 `paragraphAlignOffsetCache` 대응) */
  alignOffset: number;
}

interface SlotHost {
  [PARAGRAPH_SLOT]?: RetainedParagraph;
  [OWNER_SLOT]?: SkiaNodeData;
}

/** 현재 보유 중인 retained paragraph 수 — 메모리 축 관측 (G1/G4) */
let retainedCount = 0;

/**
 * 소유자 노드를 돌려준다 — 파생 노드면 링크된 원본, 아니면 자기 자신.
 */
function slotOf(node: SkiaNodeData): SlotHost {
  const host = node as unknown as SlotHost;
  const owner = host[OWNER_SLOT];
  return owner ? (owner as unknown as SlotHost) : host;
}

/**
 * 렌더 커맨드용 파생 노드에 원본 소유자를 연결한다.
 *
 * 슬롯 자체는 **non-enumerable** — 파생을 만드는 스프레드(`{...node}`)가 own
 * enumerable 심볼까지 복사하므로, 열거 가능하면 파생본에 소유권이 번져
 * 해제 지점(`releaseParagraphsIn` 은 원본 트리만 순회)과 어긋난다.
 */
export function linkParagraphOwner(
  derived: SkiaNodeData,
  origin: SkiaNodeData,
): SkiaNodeData {
  Object.defineProperty(derived, OWNER_SLOT, {
    value: origin,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return derived;
}

/**
 * 슬롯을 비우고 폐기를 **예약**한다.
 *
 * 즉시 `.delete()` 금지 — 이 함수는 walk 도중에도 불린다 (무효 판정 / 교체).
 * 이번 프레임에 이미 `drawParagraph` 로 제출된 객체를 flush 전에 파괴하면
 * 그 텍스트가 화면에서 조용히 사라진다 (ADR-174 Phase 1).
 */
/** 슬롯 대입 — 최초 1회만 non-enumerable 로 정의한다 (스프레드 전파 차단). */
function setSlot(host: SlotHost, entry: RetainedParagraph | undefined): void {
  if (PARAGRAPH_SLOT in host) {
    host[PARAGRAPH_SLOT] = entry;
    return;
  }
  Object.defineProperty(host, PARAGRAPH_SLOT, {
    value: entry,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

function disposeSlot(host: SlotHost): void {
  const entry = host[PARAGRAPH_SLOT];
  if (!entry) return;
  setSlot(host, undefined);
  retainedCount--;
  scheduleWasmDisposal(entry.paragraph);
}

/**
 * 노드가 보유한 paragraph 를 돌려준다 — 텍스트 축과 fontMgr 이 모두 같을 때만.
 * 무효면 폐기를 예약하고 `undefined` 를 돌려준다 (호출부가 재생성).
 */
export function resolveRetainedParagraph(
  node: SkiaNodeData,
  key: string,
  fontMgr: FontMgr,
): RetainedParagraph | undefined {
  const host = slotOf(node);
  const entry = host[PARAGRAPH_SLOT];
  if (!entry) return undefined;
  if (entry.key === key && entry.fontMgr === fontMgr) return entry;
  disposeSlot(host);
  return undefined;
}

/** 노드에 paragraph 를 부착한다 — 기존 보유분이 있으면 지연 폐기 후 교체. */
export function retainParagraph(
  node: SkiaNodeData,
  paragraph: Paragraph,
  key: string,
  fontMgr: FontMgr,
  alignOffset: number,
): void {
  const host = slotOf(node);
  disposeSlot(host);
  setSlot(host, { paragraph, key, fontMgr, alignOffset });
  retainedCount++;
}

/**
 * 서브트리가 보유한 paragraph 를 전부 지연 폐기한다.
 *
 * 호출 지점은 노드가 버려지는 곳 — `registerSkiaNode` 의 교체된 구 데이터 /
 * `unregisterSkiaNode` / `clearSkiaRegistry`. 즉 "노드가 죽을 때 같이 죽는다"
 * 를 구현하는 유일한 경로다.
 */
export function releaseParagraphsIn(node: SkiaNodeData): void {
  disposeSlot(slotOf(node));
  const children = node.children;
  if (!children) return;
  for (const child of children) releaseParagraphsIn(child);
}

export function getRetainedParagraphCount(): number {
  return retainedCount;
}
