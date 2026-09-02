import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PreviewElement, RenderContext } from "@composition/shared";
import { rendererMap } from "@composition/shared/renderers";
import {
  getPrimitiveBinding,
  getComponentRulesTable,
} from "@composition/shared";
import {
  deriveDelegatingInternalRenderers,
  deriveDelegatingRacRenderers,
} from "../renderFacetDeclaration";

/**
 * ADR-923 r24m1 — **Preview 표면의 부재 = 기본값 명시**.
 *
 * round 22~23 은 "prop 부재 기본값의 단일 원천은 catalog binding accepts default" 라는 계약을
 * layout·scene·Skia 쪽에서만 잠갔다. 그런데 그 계약의 **근거**(= `toRacProps` 가 default 를
 * 채운다)는 generic cutover 경로에서만 성립한다 — `DELEGATING_INTERNAL_RENDERERS` /
 * `DELEGATING_RAC_RENDERERS` 에 속한 타입(Tree·GridList·ListBox·TagGroup 등)은
 * `CanonicalNodeRenderer` 가 `toRacProps` 를 건너뛰고 `rendererMap[type](element, ctx)` 에
 * 위임하므로, Preview 가 실제로 쓰는 값은 **렌더러가 들고 있는 리터럴**이었다.
 *
 * 그래서 선언(binding)과 렌더(renderer)가 조용히 갈릴 수 있었다 — 실측:
 *   - GridList / ListBox: binding `selectionMode` default `"single"` ↔ 렌더러 `|| "none"`.
 *     Inspector 는 `contract.default` 를 "현재값" 으로 보여 주므로(`resolveEditContract`)
 *     패널은 Single, DOM 은 none 이었다.
 *
 * 본 게이트는 렌더러 **자체를 실행**해서(정적 문자열 검사 아님) 두 입력의 결과를 비교한다:
 *   (a) 선언된 기본값 prop 이 전부 **없는** 요소
 *   (b) 그 기본값을 전부 **명시한** 요소
 * 두 렌더 결과가 다르면, 그 타입의 Preview 는 binding 이 아닌 다른 원천을 쓰고 있다는 뜻이다.
 */
function makeContext(el: PreviewElement): RenderContext {
  return {
    elements: [el],
    elementsById: new Map([[el.id, el]]),
    childrenByParent: new Map(),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
  } as unknown as RenderContext;
}

/**
 * 비교 오라클 = **실제로 그려진 DOM**. React element 의 props 를 그대로 비교하면
 * `undefined` 를 넘기는 자리(하위 컴포넌트/RAC 가 자기 기본값을 적용하는 자리)까지 전부
 * 차이로 잡혀 게이트가 못 쓰게 된다 — 렌더까지 밀어야 "기본값이 실제로 다른가" 만 남는다.
 */
function markup(node: React.ReactNode): string {
  return renderToStaticMarkup(<>{node}</>);
}

/**
 * 차이를 속성 단위로 압축 — 마크업 전문은 길어서 실패 메시지가 읽히지 않는다.
 *
 * ADR-923 r25m2 — 이 설명이 곧 `KNOWN_DIFFS` 의 **키**다. 그래서 설명은 **손실이 없어야**
 * 한다: 속성 차이만 적고 나머지를 버리면, 이미 속성이 갈린 타입(ProgressBar 등)에 **내용·구조**
 * 차이가 새로 생겨도 키가 그대로라 baseline 에 흡수된다 — 실제로 ProgressBar `valueLabel`
 * 기본값 `"BROKEN"` 을 binding 에 넣어 표시 문구를 바꿔도 2/2 PASS 였다 (판독 실험).
 * 그래서 양쪽에서 **서로 다른 속성만 걷어낸 나머지**를 다시 비교하고, 남는 차이가 있으면
 * 첫 갈림 지점을 설명에 붙인다 (그 차이는 어떤 baseline 항목과도 일치하지 않아 즉시 RED).
 */
function describeMarkupDiff(absent: string, explicit: string): string {
  const ATTR = /[a-zA-Z-]+="[^"]*"/g;
  const attrs = (html: string) => new Set(html.match(ATTR) ?? []);
  const a = attrs(absent);
  const e = attrs(explicit);
  const onlyAbsent = [...a].filter((x) => !e.has(x));
  const onlyExplicit = [...e].filter((x) => !a.has(x));
  // 속성을 걷어낸 자리의 공백 잔여(`a="1"  b="2"`)까지 지워야 나머지 비교가 속성 유무에 흔들리지 않는다.
  const strip = (html: string, drop: string[]) =>
    drop
      .reduce((acc, attr) => acc.split(attr).join(""), html)
      .replace(/\s+/g, " ")
      .replace(/\s+>/g, ">");
  const restAbsent = strip(absent, onlyAbsent);
  const restExplicit = strip(explicit, onlyExplicit);
  let rest = "";
  if (restAbsent !== restExplicit) {
    // 공통 접두·접미를 걷어낸 **갈리는 구간**만 (앞뒤 문맥 조금) — 오프셋은 id 하나에도 흔들려 키로 못 쓴다.
    let i = 0;
    while (i < restAbsent.length && restAbsent[i] === restExplicit[i]) i++;
    let k = 0;
    while (
      k < restAbsent.length - i &&
      k < restExplicit.length - i &&
      restAbsent[restAbsent.length - 1 - k] ===
        restExplicit[restExplicit.length - 1 - k]
    )
      k++;
    // 갈리는 구간을 태그 경계(직전 `>` · 직후 `<`)까지 넓혀 텍스트 노드 전체가 보이게 한다.
    const prevGt = restAbsent.lastIndexOf(">", i);
    if (prevGt >= 0) i = prevGt + 1;
    const nextLt = restAbsent.indexOf("<", restAbsent.length - k);
    if (nextLt >= i) k = restAbsent.length - nextLt;
    const before = restAbsent.slice(Math.max(0, i - 30), i);
    const after = restAbsent.slice(
      restAbsent.length - k,
      restAbsent.length - k + 20,
    );
    const mid = (html: string) => html.slice(i, html.length - k);
    rest = ` / 내용·구조 차이: …${before}[${mid(restAbsent)}]${after}… ↔ 명시 [${mid(restExplicit)}]`;
  }
  if (onlyAbsent.length === 0 && onlyExplicit.length === 0) {
    return `— 속성 동일${rest}`;
  }
  return `— 부재에만 [${onlyAbsent.join(" ")}] / 명시에만 [${onlyExplicit.join(" ")}]${rest}`;
}

/** binding 이 default 를 선언한 prop 집합. */
function declaredDefaults(type: string): Record<string, unknown> {
  const accepts = getPrimitiveBinding(type)?.props.accepts ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, contract] of Object.entries(accepts)) {
    if (contract.default !== undefined) out[key] = contract.default;
  }
  return out;
}

/** 자식·데이터 유무로 소비 경로가 갈리는 prop 이 있다 (r23m1) — fixture 3 변형. */
const FIXTURES: ReadonlyArray<{
  name: string;
  props: Record<string, unknown>;
}> = [
  { name: "bare", props: {} },
  { name: "children", props: { children: "A" } },
  {
    name: "items",
    props: {
      items: [
        { id: "i1", label: "A", description: "d1" },
        { id: "i2", label: "B" },
      ],
    },
  },
];

const FIXTURE_NAMES = FIXTURES.map((f) => f.name);

/**
 * 대상은 **delegating 타입만**이다. `CanonicalNodeRenderer` 는 cutover 타입을 generic
 * (`toRacProps` → primitive) 으로 그리고, delegating 집합에 속한 타입만 `rendererMap` 에
 * 위임한다 — 그 밖의 타입에서 `rendererMap[type]` 은 live 경로가 아니라 legacy 잔재라
 * 여기서 재면 "정의는 있는데 소비 경로가 아닌" 코드를 재는 셈이 된다.
 */

/**
 * 잔여 발산 인벤토리 — 축별 판정 근거 (ADR-923 r24, `docs/adr/evidence/923-phase3-differential.md`).
 *
 * - `data-label-align="start"` 미방출 (8 타입): binding 은 선언, delegating 렌더러는
 *   `undefined` 를 넘겨 속성이 안 실린다. generic(toRacProps) 경로 타입은 실린다 — 같은 축이
 *   dispatch 종류에 따라 갈린다. CSS 기본 정렬이 이미 start 라(`TextField.css` label-align 규칙)
 *   시각 차이는 없다 (round 25 판독 판정).
 * - ListBox `data-variant`: 부재 `primary`(컴포넌트 기본값 `ListBox.tsx:116`) vs binding
 *   `default`. catalog ListBox variants 는 `default|accent` 뿐이라 **`primary` 는 존재하지 않는
 *   variant** — 이쪽은 렌더 경로가 틀렸다.
 * - Menu `data-variant`: 부재 `primary` vs binding `default`. catalog Menu 는
 *   `defaultVariant: "primary"` 이고 variants 에 `default` 가 없다 — 이쪽은 **binding 이 틀렸다**
 *   (ListBox 와 방향이 반대라 한 규칙으로 못 고친다).
 * - ProgressBar/Meter `value`: binding 이 50/75 를 선언하는데 렌더러 기본은 0 — 시각(막대 채움)
 *   + 값 문구(`<span class="value">0%</span>` ↔ `50%`/`75%`) 차이. `value` 는 시각 기본값이
 *   아니라 **내용**이라 "내용 부재의 의미" 를 먼저 정해야 방향이 나온다 (round 25 판독 판정,
 *   별도 scope). binding·factory 는 50/75 로 일치하고 렌더러만 `|| 0` 이다.
 * - ColorPicker/TableView/Toast: 각각 `data-variant`/`data-density`/`data-timeout` 미방출.
 */
const KNOWN_DIFFS: readonly string[] = [
  ...["ColorPicker"].flatMap((t) =>
    FIXTURE_NAMES.map(
      (f) => `${t} [${f}] — 부재에만 [] / 명시에만 [data-variant="default"]`,
    ),
  ),
  ...["ListBox", "Menu"].flatMap((t) =>
    FIXTURE_NAMES.map(
      (f) =>
        `${t} [${f}] — 부재에만 [data-variant="primary"] / 명시에만 [data-variant="default"]`,
    ),
  ),
  // r25m2 — 키가 내용 차이까지 담는다: 값 문구 `0%` ↔ `75%`/`50%` 가 같은 항목에 같이 실린다.
  ...FIXTURE_NAMES.map(
    (f) =>
      `Meter [${f}] — 부재에만 [aria-valuenow="0" aria-valuetext="0%" style="width:0%"] / 명시에만 [aria-valuenow="75" aria-valuetext="75%" style="width:75%"] / 내용·구조 차이: …gressbar"><span class="value">[0%]</span><div class="b… ↔ 명시 [75%]`,
  ),
  ...FIXTURE_NAMES.map(
    (f) =>
      `ProgressBar [${f}] — 부재에만 [aria-valuenow="0" aria-valuetext="0%" style="width:0%"] / 명시에만 [aria-valuenow="50" aria-valuetext="50%" style="width:50%"] / 내용·구조 차이: …gressbar"><span class="value">[0%]</span><div class="b… ↔ 명시 [50%]`,
  ),
  ...[
    "ComboBox",
    "DateField",
    "NumberField",
    "SearchField",
    "Select",
    "TextArea",
    "TextField",
    "TimeField",
  ].flatMap((t) =>
    FIXTURE_NAMES.map(
      (f) => `${t} [${f}] — 부재에만 [] / 명시에만 [data-label-align="start"]`,
    ),
  ),
  ...FIXTURE_NAMES.map(
    (f) => `TableView [${f}] — 부재에만 [] / 명시에만 [data-density="regular"]`,
  ),
  ...FIXTURE_NAMES.map(
    (f) => `Toast [${f}] — 부재에만 [] / 명시에만 [data-timeout="5000"]`,
  ),
];

const DELEGATING_INTERNAL_RENDERERS = deriveDelegatingInternalRenderers();
const DELEGATING_RAC_RENDERERS = deriveDelegatingRacRenderers();

function isDelegating(type: string): boolean {
  const binding = getPrimitiveBinding(type);
  if (!binding) return false;
  return binding.source.kind === "internal"
    ? DELEGATING_INTERNAL_RENDERERS.has(binding.source.renderer)
    : DELEGATING_RAC_RENDERERS.has(type);
}

const TYPES = Object.keys(getComponentRulesTable()).filter(
  (t) =>
    isDelegating(t) &&
    rendererMap[t] !== undefined &&
    Object.keys(declaredDefaults(t)).length > 0,
);

describe("ADR-923 r24m1 — Preview 렌더러의 부재 = binding 기본값 명시 (전수)", () => {
  it("게이트 대상이 비어 있지 않다 (대조군)", () => {
    expect(TYPES.length).toBeGreaterThan(5);
    expect(TYPES).toContain("GridList");
    expect(TYPES).toContain("Tree");
  });

  it("모든 렌더러에서 두 입력의 렌더 결과가 같다", () => {
    const diffs: string[] = [];
    for (const type of TYPES) {
      const defaults = declaredDefaults(type);
      const render = (props: Record<string, unknown>): string => {
        const el: PreviewElement = {
          id: `${type}-r24`,
          type,
          props,
        } as PreviewElement;
        try {
          return markup(rendererMap[type](el, makeContext(el)));
        } catch (e) {
          return `throw:${(e as Error).message}`;
        }
      };
      for (const fixture of FIXTURES) {
        const absent = render({ ...fixture.props });
        const explicit = render({ ...fixture.props, ...defaults });
        if (absent !== explicit) {
          diffs.push(
            `${type} [${fixture.name}] ${describeMarkupDiff(absent, explicit)}`,
          );
        }
      }
    }
    // 이 게이트가 처음 드러낸 잔여 축 5개 45건(2026-09-02). **선택 축은 이번에 수리**돼 목록에 없다.
    //   나머지는 축마다 "어느 쪽이 맞는가" 가 갈려(아래 주석) 한 번에 못 고친다 — 값만 맞추면
    //   15개 컴포넌트의 DOM 이 근거 없이 바뀐다. 그래서 **현재 집합을 그대로 고정**한다:
    //   새 발산은 즉시 RED 이고, 아래 항목이 사라지면(수리) 그 결과로만 이 목록을 줄인다.
    expect(diffs.sort()).toEqual([...KNOWN_DIFFS].sort());
  });
});
