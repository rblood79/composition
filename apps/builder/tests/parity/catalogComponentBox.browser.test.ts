import { describe, it, expect, beforeAll } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import type { Bounds, CaseNode } from "./harness";
import { TOL, pipelineLeg } from "./harness";

/**
 * ADR-171 Phase 5 — catalog 전달 축 parity 오라클 (G3)
 *
 * 기존 parity 918 케이스는 전부 generic `box` + 인라인 style 이라 **catalog 값이
 * 소비자에게 도달하는지**를 한 건도 검증하지 않는다(ADR-171 Hard Constraint 6).
 * 그래서 ADR-171 이 고친 비대칭이 회귀해도 red 가 되는 테스트가 없었다.
 *
 * 본 fixture 가 그 축을 잠근다:
 *   leg 1 (ground truth) — `.react-aria-{Type}` 클래스 + **실 번들 CSS**(생성 CSS +
 *                          수동 CSS 가 캐스케이드된 결과) 의 `getBoundingClientRect`
 *   leg 3 (pipeline)     — 같은 트리를 `elementType: "{Type}"` 로 빌더 실 진입점
 *                          (`calculateFullTreeLayout` → `applyImplicitStyles` →
 *                          `resolveContainerStylesFallback`) 에 태운 결과
 *
 * 두 leg 사이에 **인라인 style 이 없다** — 컨테이너는 스타일을 catalog(→CSS/resolver)
 * 에서만 받는다. 그래서 전달이 끊기면 즉시 발산한다.
 *
 * ## 왜 클래스 probe 가 아니라 트리를 렌더하는가 (Phase 2 판정)
 * `base.css` 의 Input padding 은 `var(--input-padding, var(--spacing))` 이고
 * `--input-padding` 은 **부모 field 의 생성 CSS**가 정한다(TextField/ComboBox/
 * ColorField/NumberField). 빈 div 에 클래스만 붙여 재면 fallback 을 읽는다 —
 * 부모가 정하는 custom property 가 값의 일부이므로 fixture 는 실제 트리를 만든다.
 *
 * ## 계약 (harness.ts §계약 차이에 더해)
 * - 컨테이너 노드에는 **인라인 style 을 주지 않는다** (`style: {}`). 주는 순간
 *   `resolveContainerStylesFallback` 의 `parentStyle[key] !== undefined` 규칙이
 *   catalog 를 건너뛰어 fixture 가 자기 자신을 검증하게 된다.
 * - 자식은 고정 크기 `box` — 텍스트 측정 편차를 배제하고 padding/gap/정렬만 잰다.
 * - DOM leg 은 컨테이너에 리셋을 걸지 않는다. 리셋 `padding:0` 은 인라인이라
 *   클래스의 padding 을 이겨 버린다 (harness `domLeg` 과 다른 점).
 */

// ── 번들 CSS 주입 (leg 1 ground truth 의 소스) + 엔진 WASM 준비 ──
beforeAll(async () => {
  const style = document.createElement("style");
  style.id = "adr171-catalog-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  await initCompositionEngineWasm();
});

interface CatalogCase {
  /** catalog / CSS 클래스의 PascalCase type. */
  type: string;
  /** 컨테이너 안에 넣을 고정 크기 자식 (w×h px). */
  children: Array<{ w: number; h: number }>;
  availW: number;
}

/**
 * leg 1 — 실 번들 CSS 로 렌더한 DOM.
 * 컨테이너에는 리셋을 걸지 않는다(클래스가 유일한 스타일 소스). 자식만 리셋 + 고정 크기.
 */
function catalogDomLeg(c: CatalogCase): Bounds[] {
  const wrapper = document.createElement("div");
  // root 를 flex row 로 둔다 — 엔진에는 inline formatting context 가 없어
  //   `display:inline-flex` 컨테이너가 block 자식처럼 부모 폭을 채운다. flex 부모
  //   안에서는 양쪽 모두 flex item(shrink-to-fit)이라 그 미지원 축이 빠진다.
  //   (엔진의 inline flow 미지원은 ADR-170 §사각 표에 기재된 별개 표면이다.)
  wrapper.style.cssText = `position:absolute;top:0;left:0;width:${c.availW}px;margin:0;padding:0;border:0;box-sizing:border-box;display:flex;flex-direction:row;align-items:flex-start;`;

  const host = document.createElement("div");
  host.className = `react-aria-${c.type}`;

  const kids = c.children.map((k) => {
    const el = document.createElement("div");
    el.style.cssText = `margin:0;padding:0;border:0;box-sizing:border-box;flex:none;width:${k.w}px;height:${k.h}px;`;
    host.appendChild(el);
    return el;
  });

  wrapper.appendChild(host);
  document.body.appendChild(wrapper);

  const wrapRect = wrapper.getBoundingClientRect();
  const rel = (el: Element): Bounds => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x - wrapRect.x,
      y: r.y - wrapRect.y,
      w: r.width,
      h: r.height,
    };
  };
  // 순서: 자식들 → 컨테이너 (post-order, pipelineLeg 노드 순서와 동일)
  const out = [...kids.map(rel), rel(host)];

  document.body.removeChild(wrapper);
  return out;
}

/** leg 3 입력 — 자식(고정 box) → 컨테이너(catalog type) → root wrapper(block). */
function catalogNodes(c: CatalogCase): CaseNode[] {
  const kids: CaseNode[] = c.children.map((k, i) => ({
    label: `child${i}`,
    style: {
      width: `${k.w}px`,
      height: `${k.h}px`,
      flexGrow: 0,
      flexShrink: 0,
    },
  }));
  const hostIdx = kids.length;
  return [
    ...kids,
    // 인라인 style 없음 — catalog 가 유일한 스타일 소스다.
    {
      label: c.type,
      style: {},
      elementType: c.type,
      children: kids.map((_, i) => i),
    },
    {
      label: "root",
      style: {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        width: `${c.availW}px`,
      },
      children: [hostIdx],
    },
  ];
}

function runCatalogCase(c: CatalogCase): string[] {
  const nodes = catalogNodes(c);
  const dom = catalogDomLeg(c);
  const pipe = pipelineLeg(nodes, c.availW, -1);
  // pipelineLeg 은 root 상대 좌표를 낸다. dom 도 wrapper 상대라 같은 기준.
  const bad: string[] = [];
  for (let i = 0; i < dom.length; i++) {
    for (const f of ["x", "y", "w", "h"] as const) {
      const d = Math.abs(dom[i][f] - pipe[i][f]);
      if (d > TOL) {
        bad.push(
          `${nodes[i].label}.${f}: dom=${dom[i][f].toFixed(1)} pipe=${pipe[i][f].toFixed(1)} (Δ${d.toFixed(1)})`,
        );
      }
    }
  }
  return bad;
}

// ── 케이스 ─────────────────────────────────────────────────────────────
// 아이콘+라벨 형태를 고정 크기 box 2개로 대신한다 (텍스트 측정 배제).
const KIDS_2 = [
  { w: 24, h: 24 },
  { w: 60, h: 16 },
];
const KIDS_1 = [{ w: 40, h: 14 }];

/**
 * ADR 본문 Hard Constraint 1 의 대표 사례. catalog 는 `display`/`alignItems` 를
 * `structure.containerStyles` 에, `height 32 · padding 4/12 · gap 8` 을
 * `sizes.md` 에 나눠 갖는다 — 세 층(L1 게이트 / L2 키 allowlist / L3 sizes 축)이
 * 모두 열려야 DOM 과 같아진다.
 */
const CASES: CatalogCase[] = [
  { type: "MenuItem", children: KIDS_2, availW: 320 },
  { type: "ListBoxItem", children: KIDS_2, availW: 320 },
  { type: "GridListItem", children: KIDS_2, availW: 320 },
  { type: "Tooltip", children: KIDS_1, availW: 320 },
  { type: "InlineAlert", children: KIDS_2, availW: 320 },
  { type: "DisclosureGroup", children: KIDS_2, availW: 320 },
];

/**
 * **잔존 — Phase 3 의 size 축 게이트가 생성기 규칙과 갈리는 6종.**
 *
 * Phase 3 은 "top-level `containerStyles` 를 가지면 `sizes` 는 하위 부품 크기" 라는
 * 휴리스틱으로 size 축 적용 여부를 갈랐다(Tree 36=행 / TagGroup 12=태그 / Slider 8=트랙
 * 을 막기 위해). 본 fixture 가 그 휴리스틱이 **생성기의 실제 규칙과 다르다**는 것을
 * 잡아냈다. 생성기(`CSSGenerator.ts`)는 이렇게 판정한다:
 *   - `ownsContainerBox` = `structure.composition` 이 layout/containerStyles/
 *     containerVariants 중 하나라도 가짐 → **sizes 의 height·padding emit skip**
 *   - `skipPadding` = ownsContainerBox ∨ 병합된 `containerStyles.padding` 존재
 *   - `skipGap` = 병합된 `containerStyles.gap` 존재
 *
 * 실측 발산과 그 원인:
 *   - Toolbar(pad 12) · Form(pad 20) · CheckboxGroup/RadioGroup(padY 12) — 넷 다
 *     `composition` 보유라 생성 CSS 는 sizes padding 을 **안 낸다**. 캔버스만 넣는다.
 *   - TabPanel(pad 12 미도달) — `composition` 부재라 생성 CSS 는 **낸다**. 그런데
 *     top-level `containerStyles` 를 가져 휴리스틱이 size 축을 막았다.
 *   - ListBox(h Δ2) — `borderWidth: 1` 이 `structure.containerStyles` 에 있는데
 *     top-level 대체 규칙이 structure 층을 통째로 건너뛴다.
 *
 * 해소는 **Phase 3-b** 로 분리한다 — size 축 게이트를 생성기 규칙 미러로 교체하고
 * (`archetype` 보유 = 생성 CSS 존재, 실측 118/123 일치), Menu 트리거 박스(B7)만
 * 명시 예외로 남긴다. 아래는 그때까지의 발산을 **고정**해 조용한 변화를 막는다.
 */
const RESIDUAL_SIZE_AXIS: Array<{ c: CatalogCase; why: string }> = [
  {
    c: { type: "ListBox", children: KIDS_2, availW: 320 },
    why: "structure.containerStyles.borderWidth 미도달 (top-level 대체 규칙)",
  },
  {
    c: { type: "TabPanel", children: KIDS_2, availW: 320 },
    why: "sizes padding 12 미도달 (composition 부재라 생성 CSS 는 emit)",
  },
  {
    c: { type: "Toolbar", children: KIDS_2, availW: 320 },
    why: "sizes paddingX 12 과잉 도달 (composition 보유 → 생성 CSS 는 skip)",
  },
  {
    c: { type: "Form", children: KIDS_2, availW: 320 },
    why: "sizes paddingX 20 과잉 도달 (동일)",
  },
  {
    c: { type: "CheckboxGroup", children: KIDS_2, availW: 320 },
    why: "sizes paddingY/gap 과잉 도달 (동일)",
  },
  {
    c: { type: "RadioGroup", children: KIDS_2, availW: 320 },
    why: "sizes paddingY/gap 과잉 도달 (동일)",
  },
];

/**
 * 대상에서 제외한 종과 사유 — **fixture 가 못 재는 축이지 정합이라는 뜻이 아니다.**
 *
 * - **leaf primitive** (`Badge`/`Kbd`/`Code`/`Icon`/`ColorSwatch`/`SliderOutput`/`Tab`)
 *   — 캔버스는 이들을 `buildCatalogShapes` 로 **직접 그린다**. 자식을 가진 flex
 *   컨테이너로 두는 형태가 실사용에 없고, `enrichWithIntrinsicSize` 의 leaf 폭 주입이
 *   컨테이너 계산을 덮는다(실측: Badge/Kbd/Code 모두 host w=64 고정). leaf box parity 는
 *   `calculateFullTreeLayout` 자식 배치와 다른 축이다.
 * - `Checkbox`/`Radio`/`Switch` — `applyImplicitStyles` 가 **합성 indicator** 를
 *   자식으로 주입한다(캔버스가 체크박스 사각형을 직접 그린다). DOM 은 그 자리를
 *   `::before` 로 그리므로 자식 좌표가 구조적으로 다르다.
 * - `Menu`/`TabPanels` — `applyImplicitStyles` 가 자식을 레이아웃에서 제외한다
 *   (Menu 는 트리거만 그리고 목록은 popover). 자식 좌표가 존재하지 않는다.
 * - `CardHeader`/`CardContent` 류 — Phase 2 가 판정한 **dead selector**. DOM 이
 *   `.react-aria-{X}` 를 달지 않아 ground truth 가 브라우저 기본값이다.
 * - `Dialog`/`Modal`/`Popover`, `Card` — 아래 잔존 스냅샷에서 따로 다룬다.
 */

/**
 * **G3 민감도 실측 (2026-07-29)** — `resolveContainerStylesFallback` 의 catalog 보강을
 * 통째로 되돌리면(`return specOut` 조기 반환) 아래 6종 중 **5종이 RED** 가 된다:
 * MenuItem · ListBoxItem · GridListItem · Tooltip · InlineAlert.
 *
 * `DisclosureGroup` 만 GREEN 을 유지한다 — 그 종은 값이 spec fallback(`specOut`)에서
 * 이미 오므로 catalog 채널의 감시자가 아니다. 이 fixture 로 catalog 전달을 검증했다고
 * 말할 때 DisclosureGroup 은 근거가 되지 않는다.
 */
describe("ADR-171 Phase 5 — catalog 전달 축 parity (G3)", () => {
  it.each(CASES.map((c) => [c.type, c] as const))(
    "%s — 인라인 없이 catalog 값만으로 DOM box 재현",
    (_type, c) => {
      const bad = runCatalogCase(c);
      expect(bad, `${c.type} 발산:\n  ${bad.join("\n  ")}`).toEqual([]);
    },
  );
});

describe("ADR-171 [잔존] size 축 게이트 ↔ 생성기 규칙 불일치 (Phase 3-b)", () => {
  it.each(RESIDUAL_SIZE_AXIS.map((r) => [r.c.type, r] as const))(
    "%s — 아직 발산한다",
    (_type, r) => {
      const bad = runCatalogCase(r.c);
      // 발산이 **사라지면** Phase 3-b 가 반영된 것이다 — 이 스냅샷을 지우고
      //   해당 종을 위 CASES 로 승격할 것.
      expect(bad.length, `${r.c.type} — ${r.why}`).toBeGreaterThan(0);
    },
  );
});

/**
 * ADR-171 Phase 3 §G2 의 **의도적 잔존**을 스냅샷으로 고정한다.
 *
 * Dialog/Modal/Popover 의 생성 CSS 는 archetype "overlay" 에서 `position: fixed` 를
 * 받는데, 캔버스의 이들은 저작 대상 **in-flow 요소**다. `fixed` 를 전달하면 out-of-flow
 * 로 빠져 배치가 무너진다 — Menu 트리거 박스(ADR-151 B7)와 같은 종류의 의도된
 * 소비자별 차이라 catalog 로 이관하지 않았다.
 *
 * 따라서 이 3종은 DOM(fixed) ↔ pipeline(in-flow) 의 **y 좌표가 다른 것이 정상**이다.
 * 여기서 발산이 사라지면 누군가 `position` 을 전달하기 시작한 것이므로, 그 변경이
 * 의도적인지 확인해야 한다.
 */
describe("ADR-171 — overlay position:fixed 의도적 잔존 (스냅샷)", () => {
  it.each(["Dialog", "Modal", "Popover"] as const)(
    "%s — DOM 은 fixed, 캔버스는 in-flow",
    (type) => {
      const c: CatalogCase = { type, children: KIDS_1, availW: 320 };
      const host = document.createElement("div");
      host.className = `react-aria-${type}`;
      document.body.appendChild(host);
      const pos = getComputedStyle(host).position;
      document.body.removeChild(host);
      expect(pos).toBe("fixed");

      // pipeline 은 position 을 받지 않는다 (전달 대상 아님) → in-flow 배치.
      const nodes = catalogNodes(c);
      const pipe = pipelineLeg(nodes, c.availW, -1);
      expect(pipe[nodes.length - 2].y).toBe(0);
    },
  );
});
