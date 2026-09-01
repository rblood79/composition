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
  /**
   * DOM leg 전용 data-* 속성 (ADR-923 r21m1) — RAC 가 상태로 붙이는 속성 (`data-empty`, Tree 의
   * opt-in `data-composition-tree`). 수동 CSS 의 상태 규칙 (`[data-empty] { padding }`) 은 이 속성이
   * 있어야 캐스케이드된다. pipeline leg 은 같은 상태를 element 구조 (자식 0 · items 없음) 로 판정한다.
   */
  attrs?: Record<string, string>;
  /** pipeline leg 전용 props (`heightMode` 등 DOM 이 그리지 않는 prop). */
  props?: Record<string, unknown>;
  /**
   * 양쪽 leg 에 같이 주는 인라인 style (ADR-923 r21m2) — leaf 의 사용자 override 축 (`padding`,
   * `minWidth`). 컨테이너의 catalog 전달 축을 재는 케이스에는 주지 않는다 (위 계약).
   */
  style?: Record<string, string>;
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
  // Preview iframe 의 전역 리셋 (`apps/builder/src/preview/index.tsx` `* { box-sizing: border-box }`)
  //   을 그대로 둔다 — ground truth 환경의 일부다 (수동 CSS 가 box-sizing 을 안 쓰는 Table 의
  //   `min-height` 가 Preview 에선 border-box 로 잡힌다).
  host.style.boxSizing = "border-box";
  for (const [k, v] of Object.entries(c.attrs ?? {})) host.setAttribute(k, v);
  for (const [k, v] of Object.entries(c.style ?? {})) {
    host.style.setProperty(
      k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
      v,
    );
  }

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
    // 인라인 style 없음 (기본) — catalog 가 유일한 스타일 소스다. `style` 은 leaf override 케이스만.
    {
      label: c.type,
      style: { ...(c.style ?? {}) },
      elementType: c.type,
      ...(c.props ? { props: c.props } : {}),
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
  // ADR-171 Phase 3-b (2026-07-29) 로 승격 — size 축 게이트가 생성기 규칙을 미러하면서
  //   해소됐다. Toolbar/Form 은 `composition` 보유라 sizes padding 이 **빠졌고**(과잉
  //   도달 해소), TabPanel 은 `composition` 부재라 sizes padding 이 **들어왔다**(미도달
  //   해소). ListBox 는 catalog top-level 에 `borderWidth: 1` 을 되살려 Δ2 가 닫혔다.
  { type: "Toolbar", children: KIDS_2, availW: 320 },
  { type: "Form", children: KIDS_2, availW: 320 },
  { type: "TabPanel", children: KIDS_2, availW: 320 },
  { type: "ListBox", children: KIDS_2, availW: 320 },
  // ADR-923 r20 sweep — 내용 없는 Button (텍스트 원천 계약 "" · 아이콘 없음): DOM 은 catalog
  //   `min-width` 68 × padding 4/4 + border 1/1 = 10 (줄 상자 없음). layout 은 종전 DEFAULT_WIDTH 80
  //   (+26 → 106) × lineHeight 20 (+10 → 30) 이었고 minWidth 는 deriveSizeConfig 가 버렸다.
  { type: "Button", children: [], availW: 320 },
  // ADR-923 r21m2 — 빈 Button 의 min-content 하한은 **실효** padding/border 와 인라인 minWidth 기준.
  //   DOM: `min-width` 68 border-box 는 padding 이 20 이어도 68 (content 하한 26), `min-width:0` 이면
  //   padding 0 + border 2 = 2. layout 은 catalog padding 24 로 하한 42 를 굳혀 84 / 44 였다.
  { type: "Button", children: [], availW: 320, style: { padding: "20px" } },
  {
    type: "Button",
    children: [],
    availW: 320,
    style: { padding: "0px", minWidth: "0px" },
  },
  // ADR-923 r21m1 — 빈 구조 상자 sweep. DOM 은 자식 0 이면 자기 상자만 남고 (ToggleButtonGroup
  //   0×0, Tabs 0), RAC `data-empty` 상태 규칙이 padding 을 바꾼다 (GridList spacing-lg 16 ·
  //   Tree spacing-xl 24), Table 은 수동 CSS `min-height: 40px`. layout 은 각각 80×30 / 29 /
  //   0 / 4 / 2 였다 — catalog 기본 규칙만 알고 상태 규칙·빈 구조를 모른다.
  { type: "ToggleButtonGroup", children: [], availW: 320 },
  { type: "Tabs", children: [], availW: 320, props: { items: [] } },
  {
    type: "GridList",
    children: [],
    availW: 320,
    attrs: { "data-empty": "true" },
  },
  {
    type: "Tree",
    children: [],
    availW: 320,
    attrs: { "data-empty": "true", "data-composition-tree": "true" },
  },
  {
    type: "Table",
    children: [],
    availW: 320,
    props: { heightMode: "auto" },
  },
  // ADR-923 r22m1 — prop 없는 요소의 기본 size. generated CSS 의 base 규칙은 catalog
  //   `defaultSize` 값으로 emit 되므로 `.react-aria-Badge` 만 걸친 DOM 은 sm(padding 2/8,
  //   text-xs) 이다. layout 은 별도 표(`DEFAULT_SIZE_BY_TAG.badge = "md"`)를 들고 있어
  //   padding/폰트가 한 단계 컸다.
  { type: "Badge", children: KIDS_1, availW: 320 },
];

/**
 * **Phase 3-b 로 해소된 축의 기록** — 위 CASES 의 Toolbar/Form/TabPanel/ListBox 가
 * 어떤 결함을 감시하는지.
 *
 * Phase 3 은 "top-level `containerStyles` 를 가지면 `sizes` 는 하위 부품 크기" 라는
 * 휴리스틱으로 size 축 적용 여부를 갈랐다(Tree 36=행 / TagGroup 12=태그 / Slider 8=트랙
 * 을 막기 위해). 본 fixture 가 그 휴리스틱이 **생성기의 실제 규칙과 다르다**는 것을
 * 잡아냈다. 생성기(`CSSGenerator.ts`)는 이렇게 판정한다:
 *   - `ownsContainerBox` = `structure.composition` 이 layout/containerStyles/
 *     containerVariants 중 하나라도 가짐 → **sizes 의 height·padding emit skip**
 *   - `skipPadding` = ownsContainerBox ∨ `containerStyles.padding` 존재
 *   - `skipGap` = `containerStyles.gap` 존재
 *
 * 이 셋의 입력은 전부 `structure` 다 — 생성기의 virtual spec 은 `buildVirtualSpecs` 가
 * `structure.{archetype,containerStyles,composition}` 로 만들고 **top-level
 * `rule.containerStyles` 는 넣지 않는다**. Phase 3 휴리스틱이 갈렸던 지점이 정확히 여기다.
 *
 * 되돌림 민감도(2026-07-29 실측): `catalogSizeAxisSkip` 을 무력화하면 Toolbar/Form 이
 * 각각 padding 12/20 과잉으로 RED, TabPanel 이 padding 12 미도달로 RED. catalog 의
 * ListBox `borderWidth: 1` 을 지우면 ListBox 가 h Δ2 로 RED.
 *
 * **CheckboxGroup/RadioGroup 은 여기서 빠졌다** — Phase 5 초안이 "sizes paddingY/gap
 * 과잉" 으로 적었으나 오진이었다. 두 종의 `sizes.md` 에는 padding 이 아예 없고(gap 12
 * 뿐), 실측 Δ12 는 `applyImplicitStyles` 가 넣는 **synthetic items wrapper** 때문이다
 * (자식이 Checkbox/Radio 가 아니면 wrapper 가 빈 채로 남아 gap 한 칸을 더 만든다).
 * 아래 제외 목록의 합성 indicator 군과 같은 축이라 그쪽으로 옮겼다.
 */

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
 * - `CheckboxGroup`/`RadioGroup` — 같은 축의 컨테이너 판. `applyImplicitStyles` 가
 *   **synthetic items wrapper**(`{id}__items`)를 합성해 CSS 2단 구조를 복원하는데,
 *   자식이 실제 `Checkbox`/`Radio` 가 아니면 wrapper 가 빈 채로 남아 gap 한 칸(12)이
 *   더 생긴다(실측 Δ12). 이 fixture 의 generic box 자식으로는 잴 수 없는 형태다.
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
