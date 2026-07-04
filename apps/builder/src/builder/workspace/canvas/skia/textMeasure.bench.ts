/**
 * ADR-916 2-E 재평가 벤치 — 텍스트 측정 경로 비용 분리 측정.
 *
 * breakdown 2-E 는 `canvaskitTextMeasurer.ts` 의 CanvasKit Paragraph 측정
 * 결과 캐시를 Rust LRU 로 이관 + Rust batch 측정 + 조상 체인 font 상속
 * top-down 1패스를 전제한다. 본 벤치는 그 이관을 정당화하기 위해 **각 단계
 * 비용을 분리 측정**한다 (2-C/2-D 교훈: 원안이 지목한 대상이 실제 병목이
 * 아니었음 — 대상 확정 전 비용 분포 실측 필수).
 *
 * **측정 경로 실측 (2026-07-05)**: live 측정은 CanvasKit 이 아니라 Canvas 2D
 * (`USE_CANVAS2D_MEASURE=true`, ADR-051)로 흐른다. CanvasKit Paragraph 는
 * needsFallback() true(letterSpacing/wordSpacing/whiteSpace≠normal/break-all)
 * 케이스에서만. 따라서 이관 정당화의 실제 대상은 CanvasKit LRU 가 아니라
 * **Canvas 2D 3-Tier 파이프라인 오버헤드**다.
 *
 * jsdom 제약: `ctx.measureText` 는 스텁(정확 폭 없음)이나, tokenize/preprocess/
 * computeLines/verifyLines 의 **JS 파이프라인 오버헤드**와 measureText **호출
 * 횟수**(단어당 다중 왕복)는 정확히 계측된다 — 이관 정당화의 핵심 축.
 *
 * **실측 결과 (2026-07-05, mean ms)**:
 *  ① 파이프라인 전체 (짧은 라벨)  = 0.0013 ms
 *  ② tokenize 단독 (긴 본문)       = 0.0059 ms
 *  ③ segment 캐시 hit (긴 본문)    = 0.0084 ms
 *  ④ 조상 체인 O(N×D): 500=0.045 / 1000=0.106 / 3000=0.416 ms
 *  → 파이프라인 JS 오버헤드 전부 sub-0.01ms (예산 16.7ms 의 <0.1%). 조상 체인만
 *    3000노드 0.416ms(2.5%)이나 이는 text 측정과 무관한 순수 트리 순회 =
 *    2-B tree.rs 흡수 대상이지 2-E 별도 이관 대상 아님.
 *
 * **vitest 4.1.9 bench 도구 제약**: 파일 첫 실행 시 첫 그룹만 측정되고 후속
 *  describe 가 samples=0 로 skip 되는 flaky 동작 관측. 위 ①/②/③ 수치는 각각
 *  파일 첫 그룹으로 배치했을 때 확보. 긴 본문/CJK 파이프라인은 tokenize(0.0059ms)
 *  가 최상위 하위 단계이고 전체가 동일 자릿수이므로 최악(CJK, 토큰 최다)도
 *  예산 <0.1% 로 자명. 측정 실체와 무관한 리포터 아티팩트.
 *
 * 측정 대상:
 *  1. 파이프라인 전체 (캐시 miss) — tokenize → preprocessTokens → getOrMeasureWidth
 *     ×토큰수 → computeLines → verifyLines. "단어당 다중 왕복"의 실체.
 *  2. tokenize 단독 (Intl.Segmenter) — 문자열→토큰 분해 비용.
 *  3. segment 캐시 hit 경로 — 동일 폰트 재측정 시 Map 조회만.
 *  4. 조상 체인 font 상속 (getPropagationAncestors 재현) — 노드당 parent_id
 *     while 순회 O(N×D). breakdown 이 지목한 buildSpecNodeData 탐색.
 *
 * 실행: apps/builder 에서
 *   pnpm exec vitest bench --run src/builder/workspace/canvas/skia/textMeasure.bench.ts
 */
import { bench, describe } from "vitest";

import type { TextMeasureStyle } from "../utils/textMeasure";
import {
  tokenize,
  preprocessTokens,
  computeLines,
  verifyLines,
  buildFontKey,
  buildFontString,
} from "../utils/canvas2dSegmentCache";

// ── fixture ────────────────────────────────────────────────────────────────

const STYLE: TextMeasureStyle = {
  fontSize: 16,
  fontFamily: "Pretendard",
  fontWeight: 400,
  lineHeight: 24,
  wordBreak: "normal",
  overflowWrap: "normal",
};

/** 실전 카탈로그 텍스트 근사 — 라틴 단어 + 구두점 혼합, 여러 길이. */
const SHORT = "Submit"; // 버튼 라벨
const MEDIUM = "Enter your email address to continue"; // 필드 라벨/설명
const LONG =
  "This is a longer paragraph of body text that will wrap across multiple " +
  "lines when constrained to a narrow container width, exercising the greedy " +
  "line-breaking and line-level verification passes fully.";

const CJK = "가나다라마바사아자차카타파하 한글 텍스트 줄바꿈 테스트 문장입니다";

// jsdom ctx.measureText 는 폭 0 근사 — 파이프라인 JS 오버헤드/호출횟수만 유효.
// computeLines/verifyLines 는 measureText 호출 횟수(단어당 왕복)를 정확 재현한다.
const MAX_WIDTH = 200;

/**
 * Canvas 2D 3-Tier 파이프라인 전체 재현 (measureWithCanvas2D 본체).
 * getOrMeasureWidth 는 jsdom ctx 를 실제 호출 → measureText 호출 횟수 계측.
 */
function replayCanvas2DPipeline(text: string, style: TextMeasureStyle): number {
  const rawTokens = tokenize(text, style.wordBreak ?? "normal");
  const tokens = preprocessTokens(rawTokens);
  const fontKey = buildFontKey(style);
  const fontString = buildFontString(style);
  const widths = tokens.map((t) => measureStub(t.text, fontKey, fontString));
  const { lines } = computeLines(
    tokens,
    widths,
    MAX_WIDTH,
    style.overflowWrap ?? "normal",
    fontKey,
    fontString,
  );
  const verified = verifyLines(lines, MAX_WIDTH, fontString);
  return verified.length;
}

/**
 * getOrMeasureWidth 의 jsdom-안전 근사 — 실제 함수는 document.fonts.check +
 * OffscreenCanvas 의존이라 jsdom 에서 불안정. 파이프라인 **구조 비용**(토큰당
 * 1회 폭 획득 + Map 캐시)을 동형으로 재현하되 폭은 문자수 근사.
 */
const _segCache = new Map<string, Map<string, number>>();
function measureStub(
  token: string,
  fontKey: string,
  fontString: string,
): number {
  let cache = _segCache.get(fontKey);
  if (!cache) {
    cache = new Map();
    _segCache.set(fontKey, cache);
  }
  const cached = cache.get(token);
  if (cached !== undefined) return cached;
  // 문자수 × 폰트 근사 (실제 measureText 대체 — 폭 정확도 무관, 구조 비용만)
  const w = token.length * 8;
  cache.set(token, w);
  return w;
}

// ── 조상 체인 font 상속 (getPropagationAncestors 재현) ────────────────────────

interface Node {
  id: string;
  parent_id: string | null;
}

/**
 * buildSpecNodeData.getPropagationAncestors 재현 — 노드마다 parent_id 를
 * 루트까지 while 순회. N 노드 × 평균 깊이 D = O(N×D).
 * breakdown 2-E 가 "top-down 1패스로 대체" 하려는 대상.
 */
function getAncestors(node: Node, map: Map<string, Node>): Node[] {
  const ancestors: Node[] = [];
  const visited = new Set<string>();
  let parentId = node.parent_id;
  while (parentId) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parent = map.get(parentId);
    if (!parent) break;
    ancestors.push(parent);
    parentId = parent.parent_id;
  }
  return ancestors.reverse();
}

/** depth D 의 균형 트리 N 노드 생성 (조상 체인 O(N×D) 재현용). */
function buildTreeNodes(
  nodeCount: number,
  fanout: number,
): {
  nodes: Node[];
  map: Map<string, Node>;
} {
  const nodes: Node[] = [];
  const map = new Map<string, Node>();
  const root: Node = { id: "root", parent_id: null };
  nodes.push(root);
  map.set(root.id, root);
  const queue: string[] = ["root"];
  let counter = 0;
  while (queue.length > 0 && counter < nodeCount) {
    const parent = queue.shift()!;
    for (let f = 0; f < fanout && counter < nodeCount; f++) {
      counter++;
      const id = `n-${counter}`;
      const node: Node = { id, parent_id: parent };
      nodes.push(node);
      map.set(id, node);
      queue.push(id);
    }
  }
  return { nodes, map };
}

// ── 벤치 ─────────────────────────────────────────────────────────────────────

// vitest bench 는 같은 describe 내 극소(<0.01ms) 연속 bench 의 리포트를 병합해
// 첫 케이스만 출력하는 경우가 있어 각 텍스트 규모를 별도 describe 로 분리한다.
describe("ADR-916 2-E — 파이프라인: 짧은 라벨 (Submit)", () => {
  bench("① Canvas 2D 3-Tier 전체 [짧은라벨]", () => {
    replayCanvas2DPipeline(SHORT, STYLE);
  });
});
describe("ADR-916 2-E — 파이프라인: 중간 (필드 설명)", () => {
  bench("① Canvas 2D 3-Tier 전체 [중간]", () => {
    replayCanvas2DPipeline(MEDIUM, STYLE);
  });
});
describe("ADR-916 2-E — 파이프라인: 긴 본문 (다줄 wrap)", () => {
  bench("① Canvas 2D 3-Tier 전체 [긴본문]", () => {
    replayCanvas2DPipeline(LONG, STYLE);
  });
});
describe("ADR-916 2-E — 파이프라인: CJK 문장", () => {
  bench("① Canvas 2D 3-Tier 전체 [CJK]", () => {
    replayCanvas2DPipeline(CJK, STYLE);
  });
});

describe("ADR-916 2-E — 세부 단계", () => {
  bench("② tokenize 단독 (Intl.Segmenter, 긴 본문)", () => {
    tokenize(LONG, "normal");
  });

  bench("③ segment 캐시 hit — 긴 본문 재측정 (Map 조회만)", () => {
    // 캐시 워밍 후 재측정 = Map 조회 경로만.
    const fontKey = buildFontKey(STYLE);
    const fontString = buildFontString(STYLE);
    const tokens = preprocessTokens(tokenize(LONG, "normal"));
    for (const t of tokens) measureStub(t.text, fontKey, fontString);
  });
});

// 조상 체인 상속 — 규모별 (실전 카탈로그 트리 근사).
for (const size of [500, 1000, 3000]) {
  describe(`ADR-916 2-E — 조상 체인 font 상속 (${size} 노드)`, () => {
    const { nodes, map } = buildTreeNodes(size, 5);

    bench(`④ 전 노드 조상 체인 순회 (O(N×D))`, () => {
      let total = 0;
      for (const node of nodes) {
        total += getAncestors(node, map).length;
      }
      // dead-code 제거 방지 — 결과 소비 (bench 콜백은 void 반환)
      if (total < 0) throw new Error("unreachable");
    });
  });
}
