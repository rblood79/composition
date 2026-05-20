# ADR-142: RAC primitive binding + canonical 문서 기반 컴포넌트 시스템 family 단위 cutover

## Status

In Progress — 2026-05-21 (Phase 0 G0/G1 완료; Phase 1a G2a~G2c proof 완료; Phase 1b G2d 공통 기반 완료; Phase 2 catalog/library slice 완료; G3 catalog inventory + active entry bridge 완료; Phase 3 Button/Separator/Link/Breadcrumbs/ToggleButton/ToggleButtonGroup/Toolbar/TextField/NumberField/SearchField/DateField/TimeField/ColorField/ColorSwatch/ColorSlider/ColorArea/Form/FileTrigger/DropZone/Tooltip/Dialog/Popover/Modal/Toast/Switch/Checkbox/CheckboxGroup/Radio/RadioGroup/Slider/ListBox/GridList/TagGroup/Menu/ComboBox/Select/Tabs/Tree/Table/TableView primitive wrapper boundary slice 완료; Button Icon PropContract parity + Separator/Link/Breadcrumb/ToggleButton/ToggleButtonGroup/Toolbar/TextField/NumberField/SearchField/DateField/TimeField/ColorField/ColorSwatch/ColorSlider/ColorArea/Form/FileTrigger/DropZone/Tooltip/Dialog/Popover/Modal/Toast/Switch/Checkbox/CheckboxGroup/Radio/RadioGroup/Slider/ListBox/GridList/TagGroup/Menu/ComboBox/Select/Tabs/Tree/Table/TableView generic Skia pilot 완료; active primitive Inspector entrypoint 는 specRegistry 보다 `PrimitiveBinding` 을 먼저 소비하도록 전환; Field 는 RAC leaf primitive 가 아닌 helper/DataField surface 로 active primitive 승격 제외; selection family pilot 완료; collections family 는 ListBox/GridList/TagGroup/Menu/ComboBox/Select/Tabs pilot 완료, Tree·Table family 는 Tree/Table/TableView pilot 완료, overlays family 는 DropZone/Tooltip/Dialog/Popover/Modal/Toast pilot 완료, date/color family 는 ColorSwatch/ColorSlider/ColorArea pilot 진행, ADR-132 collection 데이터 binding 전체 전환은 잔여)

## Context

**목표: 검증된 pencil document format 과 검증된 Adobe React Aria Components(RAC)를 Builder(Skia)에서 만나게 한다.** pencil format 은 문서/구조 layer(canonical document — frame/ref/reusable/descendants/slot)이고, RAC 는 D1(DOM/접근성/상호작용) layer 다. 둘 다 각각 검증된 자산이다. ADR-142 는 이 둘을 발명하지 않고 잇는다 — 두 자산이 만나는 지점은 canonical 문서 + `PrimitiveBinding` 이며, 그 결과를 DOM(RAC 가 실제 실행)과 Skia(RAC 의 시각을 generic 렌더러가 재현) 두 경로가 같은 모습으로 소비한다. 새 위험은 두 자산 자체가 아니라 그 둘을 잇는 seam 에 있다(R1).

composition 의 컴포넌트 시스템은 builder 방식 변경, local DB 형식 변경, reusable/origin/instance/slot 모델 보정, CSS 최적화, Preview/Skia 경로 보정이 누적되면서 정본이 여러 개인 상태가 되었다. 컴포넌트 하나를 등록하려면 서로 독립된 6개 목록(Component Panel hard-coded list / Factory creator map / `rendererMap` / `getDefaultProps` map / `BASE_TAG_SPEC_MAP` / builder `TAG_SPEC_MAP`)에 각각 등록해야 한다. 이 목록들이 어긋나면서 등록 누락과 CSS/Skia drift 가 반복된다.

`packages/specs/src/components/*.spec.ts` 124개는 컴포넌트당 정의 파일이다. 이 모델(`ComponentSpec.render.shapes()`)은 시각을 직접 그리는 함수 중심이라, RAC 의 구조(parts/slots/render-prop state, collection children)를 표현하지 못한다. 그 결과 Builder(Skia)와 Preview(DOM)가 같은 컴포넌트를 다르게 그리는 정합 실패가 반복됐다.

이 다중 정본은 두 방향의 전파를 모두 깨뜨린다. ① **렌더 타깃 간** — 컴포넌트 시각을 한 번 고쳐도 Skia 와 Preview 가 별도 경로라 한쪽만 반영되고 drift 한다. ② **컴포넌트 파생·재사용 간** — RAC 에서 Button 의 press/focus 동작은 ToggleButton·MenuItem 이 공유하고, ListBox 는 ComboBox·Select 안에서 재사용된다. 그러나 현재는 컴포넌트마다 spec/CSS/renderer 가 따로라 base 를 고쳐도 파생이 따라오지 않아 전부 개별 수정해야 하고, 여러 곳에서 재사용되는 ListBox 류는 소비처마다 어긋난 상태다.

본 ADR 의 기준은 이렇다. **컴포넌트는 코드 정의 파일이 아니라 canonical 문서다.** Card·Section·아이콘이 붙은 Button 같은 조합 컴포넌트(composed component)는 `reusable: true` 인 frame 노드 — 사용자가 화면을 만들 때 쓰는 그 canonical 문서와 같은 데이터다. 그 인스턴스는 `type: "ref"` 노드다.

코드로 남는 정의는 단 하나다. DOM/접근성/상호작용이 환원 불가능한 leaf RAC primitive 약 35개의 `PrimitiveBinding`. binding 은 "이 primitive 를 `react-aria-components` 어디서 가져오고, canonical props 를 RAC props 로 어떻게 넘기는가"만 선언한다. 색·크기·변형 같은 시각은 binding 에 넣지 않는다.

이 방향은 두 가지를 명시적으로 배제한다.

1. 기존 `ComponentSpec` 을 확장해 RAC 구조를 담는 방식 — `render.shapes()` 모델이 RAC 구조를 표현하지 못해 실패가 반복된다.
2. 컴포넌트당 새 contract 객체(`StarterComponentContract`)를 만드는 방식 — 스키마를 두껍게 해도 "컴포넌트당 손으로 쓰는 정의 파일 + 컴포넌트당 변환기"라는 종류는 `ComponentSpec` 과 같다. 그것은 canonical 문서와 평행한 두 번째 SSOT 가 되어 같은 drift 를 반복한다.

자세한 비교는 Alternatives 참조. 직전 개정안(2026-05-18~05-19)이 2번 방식이었고, 사용자 검토에서 기각됐다.

**이 방향은 새 시스템을 처음부터 짓는 것이 아니다.** composition 은 ADR-111~131(15개 이상)을 거쳐 canonical document 모델을 storage + runtime SSOT 로 이미 전환했다(ADR-116/122). canonical 문서를 화면 트리로 푸는 resolver(`resolveCanonicalDocument()`)와 그 노드 렌더러(`CanonicalNodeRenderer`)는 이미 구현·테스트 통과 상태이고 Preview 도 canonical render 경로를 기본 활성으로 쓴다 — 다만 현 canonical 렌더는 컴포넌트별 `rendererMap` fallback 에 의존하며, 본 ADR 이 요구하는 theme 소비 generic 렌더러 단일화는 아직 아니다. theme/tokens(ADR-110/021), events/actions(ADR-131), collections(ADR-132)도 이미 root collection 이다. 본 ADR 은 그 전환을 마무리한다.

### 3-domain 분류 (ADR-063 정합)

- **D1 DOM/접근성/상호작용**: `react-aria-components`(npm)가 절대 권위이자 runtime primitive 다. `apps/builder` 와 `packages/shared` 의 `catalog:` 의존으로 설치되어 있고, `packages/shared/src/components` 의 57개 파일이 직접 import 한다. composition 은 RAC 동작을 수동 재구현하지 않는다.
- **D2 Props/API**: 조합 컴포넌트는 reusable frame 노드가 선언한 propsSchema 가 SSOT 다. primitive 는 `PrimitiveBinding` 이 받는 props 집합이 SSOT 다. 컴포넌트당 Spec 파일이 아니다.
- **D3 시각/구조**: 시각 SSOT 는 theme/tokens root collection(ADR-110)이다. 구조 SSOT 는 canonical 문서 트리 자체다. 컴포넌트당 `visual` 필드를 두지 않는다. `packages/react-aria-starter/src`(Adobe starter kit 의 vendored snapshot — `.tsx` 컴포넌트 모듈 55개. 그중 54개가 전용 CSS 파일을 가지며 `ProgressCircle` 만 CSS 가 없어, starter/src CSS 는 컴포넌트 54 + `theme`/`utilities` 2 = 총 56이다)는 이 D3 시각/구조를 저작할 때 참조하는 **reference 코드** 다 — runtime import 대상이 아니며(repo 전역 import 0건), `private` 패키지로 `main`/`exports` 가 없다. starter/src 의 token/패턴은 단일 `packages/react-aria-starter/design.md`(Google DESIGN.md section set 을 차용한 중복 제거 token/패턴 reference)로 정규화되며, theme/tokens 저작은 raw starter 가 아니라 Phase 0 에서 검증·확정한 이 단일 문서를 입력으로 한다 — design.md 는 입력 reference 일 뿐 runtime D3 SSOT(theme/tokens root collection)도, 런타임 계약도 아니다. Google DESIGN.md 의 YAML hex-token front matter layer 는 채택하지 않고, starter 의 OKLCH relative-color 모델·light/dark adaptation·forced-colors 경계를 보존한다. theme/tokens root collection 이 runtime 시각 값의 SSOT 이며, composition 시맨틱 변수의 명명 규칙(`--bg-*`/`--fg-*`/`--accent-*` 등)은 `.claude/rules/css-tokens.md` 가 정본이다 — 전자는 값 layer, 후자는 naming layer 로 직교하며 design.md Mapping 확장 표가 이 둘을 잇는다.
- **Document/runtime format**: canonical `CompositionDocument` 가 저장·편집·runtime mutation source 다. 본 ADR 은 이 스키마를 변경하지 않고 그 위에 세운다.

ADR-063 과의 관계: ADR-063 은 D3 시각 SSOT 를 "Spec" 으로 불렀다. 본 ADR 은 그 D3 SSOT 를 컴포넌트당 spec 파일에서 theme/tokens root collection 으로 옮긴다 — ADR-063 이 의도한 "단일 시각 source" 를 그대로 따르되 그 source 의 위치를 명확히 한다. 컴포넌트당 spec 파일을 D3 SSOT 로 둔 ADR-036 의 메커니즘은 본 ADR 로 폐기된다.

### Hard Constraints

1. D1 runtime primitive 은 `react-aria-components`(npm)다. `packages/react-aria-starter/src` 는 D3 시각/구조 참조용 upstream snapshot 이며 runtime import 대상이 아니다. cutover 작업은 starter 원본 파일을 직접 수정하지 않고, 제품 코드가 starter 를 runtime import 하지도 않는다.
2. 새 시스템은 기존 124 `ComponentSpec` / `ReactRenderer` / `CSSGenerator` / `specShapesToSkia` / `render.shapes()` / `rendererMap` 을 참조·확장·migration source 로 쓰지 않는다. legacy boundary 로 격리한다.
3. 컴포넌트당 별도 정의 파일(구 `ComponentSpec`, 또는 컴포넌트당 contract 객체)을 새로 만들지 않는다. 조합 컴포넌트는 canonical reusable 문서다. 코드 정의는 leaf RAC primitive 약 35개의 `PrimitiveBinding` 으로 한정한다.
4. canonical schema(`CompositionDocument`, `CanonicalNode.props`, reusable/ref/descendants/slot)는 변경하지 않는다. 본 ADR 범위 밖이다.
5. D3 시각 SSOT 는 theme/tokens root collection 이다. 컴포넌트당 `visual` 필드 또는 컴포넌트당 시각 정의 파일을 두지 않는다.
6. 조합 컴포넌트의 reusable 문서는 starter + 디자인 의도로부터 새로 저작한다. 깨진 구버전 spec 에서 자동 변환·파생하지 않는다 (사용자 제약, 2026-05-19: "기존 불완전한 spec 을 참조하면 다시 실패한다").
7. Builder/Preview/Publish 의 공식 import surface 는 `packages/shared/src/components` 다. primitive wrapper 는 `react-aria-components` 를 import 한다. `apps/builder` 가 RAC primitive 를 wrapper 없이 직접 import 하거나 starter source path 를 import 하는 것은 inventory/test/tooling allowlist 를 제외하고 금지한다.
8. Preview/Publish 공식 runtime 은 resolved canonical tree 를 단일 render source 로 소비한다. reusable origin / `type:"ref"` instance / root props override / `descendants` 3-mode / `slot` fill 이 렌더 입력 전에 resolve 되어야 하며, fallback 경로가 resolved children 을 잃으면 안 된다.
9. Skia 는 RAC DOM/CSS 를 파싱하지 않는다. generic 렌더러가 resolved canonical tree + theme 를 소비하고, 비-DOM-trivial primitive 는 `PrimitiveBinding` 의 `skiaPrimitive` draw module 로 그린다.
10. cutover 는 전역 단일 스위치가 아니라 family(컴포넌트군) 단위 atomic 으로 수행한다. 공통 기반을 먼저 고정한 뒤 family 순서대로 4경로(Component Panel / Factory / Preview·Publish / Skia)를 동시에 전환한다. family 내부에서 신·구 경로를 섞지 않는다. 실패한 family 는 그 family 만 격리하고 다른 family 진행을 막지 않는다.
11. Tree/Table 은 leaf RAC primitive 의 `PrimitiveBinding`(RAC Tree/Table) + collections 데이터(ADR-132)로 구성한다. 수동 우회 구현으로 full support 를 주장하지 않는다.

### Soft Constraints

- 공통 기반 작업은 기존 시스템 옆에서 병렬로 완성할 수 있다. active cutover 만 family 단위 atomic 으로 수행한다.
- 기존 프로젝트의 legacy component payload 를 즉시 삭제하지 않는다. import/export/cloud/publish 호환 boundary 는 유지하되 active Builder authoring source 에서 제외한다.
- `packages/shared/src/components` public surface 는 유지하되 내부 책임을 RAC primitive wrapper 로 재정의한다.

## Alternatives Considered

### 대안 A: 기존 shared/components 점진 보수

- 설명: 기존 `packages/shared/src/components` 파일을 유지하고 starter 업데이트분을 컴포넌트별로 wrapper/CSS/Spec 에 조금씩 반영한다.
- 근거: import surface 변동이 작고 단기 회귀 위험이 낮다.
- 위험: 기술(MEDIUM) — 기존 rendererMap/factory/CSS/Spec 분기가 계속 남는다. 성능(LOW). 유지보수(HIGH) — 현재 문제의 원인인 다중 정본 + adapter + fallback 혼합 구조가 그대로 유지된다. 마이그레이션(MEDIUM).

### 대안 B: 기존 ComponentSpec(render.shapes) 확장

- 설명: 기존 `ComponentSpec` 에 RAC parts/slots/render-prop/structure 필드를 덧붙여 starter 컴포넌트를 표현한다.
- 근거: 기존 124 spec / `CSSGenerator` / `TAG_SPEC_MAP` 인프라를 재사용한다.
- 위험: 기술(HIGH) — `ReactRenderer` 는 className/dataAttributes/style 만 산출해 RAC component/parts/render-prop state 를 표현할 수 없고, `render.shapes()` 는 시각을 직접 그린다. 성능(LOW). 유지보수(HIGH) — 불완전한 구버전 모델 위에 필드를 누적해 Builder↔Preview 정합 실패가 반복된다. 마이그레이션(MEDIUM) — 실패가 이연될 뿐이다.

### 대안 C: 컴포넌트당 contract 객체 (StarterComponentContract / Spec vNext)

- 설명: 컴포넌트마다 `StarterComponentContract` 정의 객체를 만든다. `source`/`rac`/`canonical`/`structure`/`visual` 입력과 4개 output 변환기(`toRacProps`/`toGeneratedCss`/`toSkiaVisualModel`/`toInspectorFields`). manifest 는 이 contract 들의 registry 다.
- 근거: `render.shapes()` 보다 표현력이 크다. starter 의 parts/slots/render-prop 을 담을 수 있다.
- 위험: 기술(MEDIUM) — 표현력 자체는 충분하다. 성능(LOW). 유지보수(HIGH) — "컴포넌트당 손으로 쓰는 정의 파일 + 컴포넌트당 변환기" 라는 종류가 `ComponentSpec` 과 같다. canonical 문서와 평행한 두 번째 SSOT 가 되어 starter(upstream)와도 canonical 문서(downstream)와도 drift 한다. 4개 output 중 3개(`toGeneratedCss`/`toSkiaVisualModel`/`toInspectorFields`)는 (문서 노드 + theme)의 함수이지 컴포넌트당 계약의 산물이 아니다 — 컴포넌트당으로 두면 124개 × 3 변환기를 손으로 유지해야 한다. 마이그레이션(MEDIUM).
- 비고: 본 ADR 의 직전 개정안(2026-05-18~05-19)이 이 대안이었다. 사용자 검토(2026-05-19)에서 "스키마만 두꺼워진 ComponentSpec — 실패 반복" 으로 기각됐다.

### 대안 D: RAC primitive(`react-aria-components`)를 Builder/Preview 가 직접 import

- 설명: shared wrapper 계층을 최소화하고 `react-aria-components` 를 제품 컴포넌트 곳곳에서 직접 import 한다.
- 근거: upstream RAC 와 가장 가까운, 가장 얇은 코드 경로가 된다.
- 위험: 기술(HIGH) — composition props mapping / canonical payload 정규화 / `toRacProps` 투영을 둘 단일 위치가 사라져 57개 이상 파일에 흩어진다. 성능(LOW). 유지보수(HIGH) — Inspector·Skia 경로 연결점이 분산되고, RAC 버전 업데이트가 제품 코드 곳곳을 직접 흔든다. 마이그레이션(MEDIUM).

### 대안 E: Canonical 문서 SSOT + RAC primitive binding (document 모델)

- 설명: 컴포넌트당 정의 파일을 없앤다. 조합 컴포넌트 = canonical reusable 문서(데이터). 코드 정의 = leaf RAC primitive 약 35개의 `PrimitiveBinding`. 시각 = theme/tokens root collection. 렌더 = resolved canonical tree + theme 를 소비하는 generic 렌더러 1개(DOM backend + Skia backend). 등록은 6개 목록 대신 단일 `componentCatalog`.
- 근거: SSOT 가 진짜 하나(canonical 문서)가 된다. ADR-111~131 의 canonical 전환을 마무리한다. 사용자 제약("깨진 spec 참조 금지")을 가장 깨끗하게 지킨다 — 참조할 컴포넌트당 정의가 아예 없다.
- 위험: 기술(HIGH) — generic 렌더러(DOM+Skia) + Preview resolved-tree 소비가 공통 기반의 핵심이며 제품 규모에서 미검증이다. 다만 resolver 와 DOM 렌더러(`CanonicalNodeRenderer`)는 이미 구현·통과 상태라 처음부터는 아니다. 성능(LOW 잠정) — runtime 컴포넌트 정의 수가 줄고(124 → ~35 binding) 렌더 경로가 단일화된다. 단 generic 렌더러의 per-frame Skia 비용은 미측정이며 Gate G2c 의 worst-case frame budget 측정으로 확정한다(R10). 유지보수(LOW) — 정본이 canonical 문서 하나다. 컴포넌트당 변환기·spec 파일이 없다. 마이그레이션(MEDIUM) — 조합 컴포넌트를 reusable 문서로 새로 저작해야 한다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    H     |      M       |     1      |
| B    |  H   |  L   |    H     |      M       |     2      |
| C    |  M   |  L   |    H     |      M       |     1      |
| D    |  H   |  L   |    H     |      M       |     2      |
| E    |  H   |  L   |    L     |      M       |     1      |

모든 대안이 HIGH 위험을 최소 1개 가진다. 이 문제 공간에는 HIGH 0건 대안이 존재하지 않는다 — 현 상태 유지(다중 정본)는 그 자체로 매일 실현되는 HIGH 유지보수 위험이다. 따라서 adr-writing.md 의 "최대 2회 루프 후에도 HIGH 이상이면 위험 수용 근거 명시" 절차를 적용한다.

대안 A/C 의 HIGH 는 **유지보수** — 다중 정본/두 번째 SSOT 가 남아 drift 가 무한정 재발하는 위험이다. 대안 B/D 의 HIGH 는 **기술 + 유지보수** 둘 다다. 대안 E 의 HIGH 는 **기술** 하나이며, (a) 1회성이고 (b) 공통 기반 단계로 front-load 되어 단일 Gate 로 관리 가능하며 (c) 이미 구현된 canonical resolver/DOM 렌더러로 일부 완화된다. 회복 불가능한 반복 유지보수 HIGH 보다, gate 로 막을 수 있는 1회성 기술 HIGH 를 수용한다.

## Decision

**대안 E: Canonical 문서 SSOT + RAC primitive binding** 을 선택한다.

세부 결정:

1. 컴포넌트당 정의 파일을 폐기한다. 기존 124 `ComponentSpec` 은 새 시스템의 기준이 아니다.
2. 조합 컴포넌트(Card 등)는 `reusable: true` canonical frame 노드로 정의한다 — 코드가 아니라 데이터다. 인스턴스는 `type:"ref"` 노드다.
3. 코드 정의는 leaf RAC primitive(약 35개)의 `PrimitiveBinding` 으로 한정한다. binding 은 `react-aria-components` import 경로 + RAC parts/slots/states/render-props/dataAttributes + canonical props → RAC props 투영(`toRacProps`)만 선언한다. 시각·변형·구조 필드를 두지 않는다.
4. 등록 SSOT 는 단일 `componentCatalog` 다 — primitive entry(→ `PrimitiveBinding`) + reusable entry(→ canonical reusable 문서 id). 기존 6개 목록을 대체한다. Component Panel / Factory 는 이 catalog 만 소비한다.
5. D3 시각 SSOT 는 theme/tokens root collection 이다. 컴포넌트의 변형(variant)은 노드의 `data-*` 속성 + theme 규칙으로 표현한다. 컴포넌트당 시각 정의를 두지 않는다.
6. 렌더는 resolved canonical tree + theme 를 소비하는 generic 렌더러 하나로 한다. traversal 은 하나, backend 는 둘(DOM/CSS, Skia)이다. CSS·Skia draw·Inspector fields 는 컴포넌트당 산출물이 아니라 이 generic 렌더러가 (문서 + theme)에 대해 만드는 산출물이다.
7. Skia backend 는 RAC DOM/CSS 를 파싱하지 않는다. resolved canonical tree + theme 를 그리고, arc/track/indicator 같은 비-DOM-trivial primitive 는 `PrimitiveBinding.skiaPrimitive` draw module 로 그린다.
8. Preview/Publish 는 `resolveCanonicalDocument()` 결과(resolved canonical tree)를 단일 render source 로 삼는다. `CanonicalNodeRenderer` 와 fallback 경로 모두 resolved `node.children` 를 소비해야 한다. legacy `elements[]` 경로는 명시적 격리 후 제거한다.
9. `packages/shared/src/components` 는 약 35개의 thin RAC primitive wrapper 로 재정의한다(`react-aria-components` import + `toRacProps` + generated CSS class). 조합 컴포넌트는 shared 파일을 갖지 않는다 — 문서다. `Frame`/`Slot`/reusable tooling 같은 composition-native 항목은 catalog 에 등록하되 RAC primitive import 없이 둔다.
10. 조합 컴포넌트의 reusable 문서는 starter + 디자인 의도로부터 새로 저작한다. Builder 안에서 만들고 reusable 로 승격하는 흐름을 사용한다. 깨진 구버전 spec 에서 자동 변환하지 않는다.
11. cutover 는 family 단위 atomic 이다. 공통 기반(`PrimitiveBinding` 타입 + generic 렌더러 + Preview resolved-tree 소비 + `componentCatalog` skeleton)을 1회 고정한 뒤, family 순서(primitives·actions → fields → selection → collections → Tree·Table → overlays → date·color → composition-native)대로 4경로를 동시에 전환한다. family 내부 신·구 혼재는 금지한다. 실패 family 는 그 family 만 격리한다.
12. 기존 `ComponentSpec`(124) / `ReactRenderer` / `CSSGenerator` / `render.shapes()` / `specShapesToSkia` / `rendererMap` 은 legacy boundary 로 격리한다. cutover 기간 동안 legacy 문서 import/export 호환 + migration reference 로만 둔다. 새 시스템은 이들을 import 하지 않는다.
13. 파생·재사용은 별도 파생 그래프 없이 정상화된다. 컴포넌트당 정의 파일이 없으므로 base→파생 동기화 대상 자체가 사라진다. (a) **시각 일관성** — Button·ToggleButton·MenuItem 은 같은 theme/tokens 토큰과 `data-*` 규칙을 읽는다. theme 한 곳을 고치면 모두 반영된다. (b) **동작 재사용** — ListBox 는 `PrimitiveBinding` 하나다. ComboBox·Select 는 그 동일 binding 을 합성한다 — ListBox 정의 복제본이 없다. (c) **조합 재사용** — 아이콘이 붙은 Button 같은 조합은 reusable 문서 하나이고, 인스턴스는 `ref` + `descendants` override 다. `descendants` 는 pencil 공식 3-mode(속성 patch / 노드 교체 / children 교체)이며 canonical schema(HC#4)에 이미 존재한다 — origin 문서를 고치면 instance 가 override 하지 않은 속성은 모든 `ref` 에 전파된다.
14. Properties Panel(Inspector)의 편집 필드는 컴포넌트당 정의에서 오지 않는다 — #6 의 Inspector 부분 구체화다. primitive 는 `PrimitiveBinding.props.accepts`(`Record<string, PropContract>`)가, 조합 컴포넌트는 reusable 컴포넌트가 노출한 `propsSchema`(같은 `Record<string, PropContract>`)가 D2 편집 source 다. generic 렌더러는 Inspector field renderer 하나를 두고 선택 노드의 `PropContract` 집합 + theme 로 편집 필드를 generic 하게 만든다 — 컴포넌트당 `properties.sections`/`SpecField` 분기를 두지 않는다. 필드 그룹(Content/Appearance/State 등)은 컴포넌트당 섹션 목록이 아니라 `PropContract` 의 `section` 태그로 표현하고, generic Inspector 가 그 태그로 묶는다. `variant`/`size` 종류 필드의 선택 가능한 값은 컴포넌트당 enum 이 아니라 theme 규칙이 정의한 `data-*` 값 집합(theme/tokens root collection)에서 읽는다. instance(`ref`) 선택 시 Inspector 는 동일 `PropContract` 집합을 root props override 로, `descendants` 3-mode 를 nested override 로 편집한다.

기각 사유:

- **대안 A 기각**: 현재 문제의 원인인 다중 정본과 adapter/fallback 혼합을 유지한다.
- **대안 B 기각**: `render.shapes()` 모델은 RAC 구조를 표현하지 못한다. 불완전한 모델 위에 필드를 덧붙이면 정합 실패가 반복된다.
- **대안 C 기각**: 컴포넌트당 contract 객체는 스키마가 두꺼워도 `ComponentSpec` 과 같은 종류 — canonical 문서와 평행한 두 번째 SSOT 다. drift 가 재발한다. 사용자 검토(2026-05-19)에서 "실패 반복" 으로 기각됐다.
- **대안 D 기각**: `react-aria-components` 를 제품 곳곳에서 직접 import 하면 RAC 버전 업데이트가 제품 코드를 직접 흔들고, composition-specific 계약(props mapping·canonical·Inspector·Skia)을 둘 단일 위치가 사라진다.

> 구현 상세: [142-starter-spec-component-system-cutover-breakdown.md](design/142-starter-spec-component-system-cutover-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |  심각도  | 대응                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | generic 렌더러(DOM+Skia) + Preview resolved-tree 단일 소비가 공통 기반의 핵심이며 제품 규모에서 미검증이다. `resolveCanonicalDocument()`(`apps/builder/src/resolvers/canonical/index.ts`)·`CanonicalNodeRenderer`(`apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`)는 구현·통과 상태이고, Preview `App.tsx` 는 canonical render 경로를 이미 기본 활성(`USE_CANONICAL_RENDER` — `?canonical=0` 일 때만 legacy opt-out)으로 쓴다. 다만 현 canonical 렌더는 컴포넌트별 `rendererMap` fallback 에 의존하며 본 ADR 이 요구하는 theme 소비 generic 렌더러 단일화는 아니다. Skia `buildSpecNodeData.ts` 는 여전히 `render.shapes()` 경로다. 이 generic 렌더러 단일화가 실패하면 모든 family cutover 가 막힌다 | **HIGH** | Gate G2a~G2c(Phase 1a proof gate)로 관리. family cutover 착수 전 Button 수직 슬라이스 + 최소 reusable-origin·ref-instance 렌더 + DOM↔Skia 대칭 + worst-case 부하 frame budget(G2c) 통과 필수. F1~F4 전체 fixture·Inspector 는 G2d                                                                                                                       |
| R2  | 조합 컴포넌트를 reusable 문서로 새로 저작하는 노동. 깨진 spec 에서 자동 변환할 수 없다(HC#6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |   MED    | Builder 안에서 저작 후 reusable 승격 흐름 사용. family 단위로 분할해 한 번에 한 family 만 저작                                                                                                                                                                                                                                                          |
| R3  | generic 렌더러 버그는 family 격리가 안 된다(모든 family 가 렌더러를 공유)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |   MED    | Phase 1a proof gate(G2a~G2c)에서 렌더러 핵심을 kill-switch 검증한 뒤 family loop 진입. cutover 완료 family 의 fixture 전수를 generic 렌더러 변경마다 CI 상시 회귀 실행 — 늦은 family 작업이 일찍 끝난 family 를 깨면 즉시 감지. severity MED 유지: R1(HIGH)이 proof gate 로 pre-G2 베팅을 차단하고 R3 는 post-G2 잔존 운영 위험이라 CI 상시 회귀로 관리 |
| R4  | theme/tokens 가 일부 컴포넌트별 시각(arc/track/indicator 등)을 표현하지 못할 수 있다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |   MED    | 비-DOM-trivial primitive 는 `PrimitiveBinding.skiaPrimitive` draw module + generic CSS escape hatch. Phase 0 inventory 에서 잔여 목록 식별                                                                                                                                                                                                              |
| R5  | 기존 프로젝트의 legacy payload 가 새 렌더러에서 깨진다 — legacy payload 를 가진 기존 프로젝트 전수(100% 노출)가 대상이며, boundary adapter 가 막지 못하면 사용자-가시 영향이 전 프로젝트로 즉시 확산된다. 재직렬화 대상은 0 파일 — adapter 가 legacy payload 를 read-time 에 해석하고 원본 프로젝트 문서를 다시 쓰지 않는다(seed 의 'Y 파일' 축은 read-time 호환 BC 에 N/A)                                                                                                                                                                                                                                                                                                                                           |   MED    | import/export 호환 adapter 를 boundary 에 유지. canonical resolver round-trip fixture 로 검증                                                                                                                                                                                                                                                           |
| R6  | `packages/shared/src/components` public surface 를 유지하면서 내부를 primitive wrapper 로 교체 — import path 는 같지만 의미가 바뀐다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |   MED    | barrel export contract test + component smoke fixture. cutover release note 에 변경 범위 명시                                                                                                                                                                                                                                                           |
| R7  | upstream starter update 때마다 수동 diff 가 커진다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |   LOW    | `packages/react-aria-starter/UPSTREAM.md` 정책 + inventory diff workflow                                                                                                                                                                                                                                                                                |
| R8  | 컴포넌트당 spec 파일을 D3 SSOT 로 둔 ADR-036(및 그 메커니즘을 쓴 spec 스키마 ADR-907/908 · spec D3 응용 ADR-140/141)의 메커니즘이 폐기된다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |   MED    | ADR-142 Implemented 승격 시 ADR-036/907/908/140/141 status 재평가. README ADR 대시보드 동시 갱신                                                                                                                                                                                                                                                        |
| R9  | `PropContract` 가 현 `FieldDef` 11종 union 의 표현력을 전부 흡수하지 못할 수 있다 — 특히 임의 React 컴포넌트를 받는 `CustomField`, 한 prop 변경이 복수 prop 을 갱신하는 `derivedUpdateFn`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |   MED    | 현 `FieldDef` union 을 Phase 0 inventory 에서 `PropContract.kind` 로 전수 매핑. `CustomField` 잔여(ColorArea/Wheel 등)는 그 자체가 primitive 이므로 primitive 합성으로 흡수. 매핑 불가 항목은 inventory 에 명시 후 family 별 처리                                                                                                                       |
| R10 | generic 렌더러(DOM+Skia)가 컴포넌트별 specialized `render.shapes()` 를 매 프레임 generic traversal + theme/`data-*` 해석으로 대체한다. Canvas 60fps(CLAUDE.md 성능 기준)에서 per-frame Skia 렌더 비용이 회귀할 수 있다. 대안 E 의 성능 LOW 평가는 정의 수 감소(124→~35)에 근거했을 뿐 per-frame 비용은 미측정이다                                                                                                                                                                                                                                                                                                                                                                                                     |   MED    | Gate G2c 에서 worst-case 부하(200+ 노드 collection, ref 포함)를 generic 렌더러 Skia backend 로 인터랙션 re-render — (a) 절대 60fps + (b) 현 `render.shapes()` 대비 frame 비용 회귀 한계 양쪽 측정. Button 은 최저부하라 R10 의 비용 축(generic traversal × 노드 수)을 증명 못 한다. 대안 E 의 성능 LOW 는 정의 수 감소가 아니라 이 측정 결과로 확정한다 |

잔존 HIGH 위험: R1 1건 — Gate G2a~G2c(Phase 1a proof gate)와 대응. R9·R10 은 MED — R9 는 Phase 0 inventory 매핑, R10 은 Gate G2c worst-case frame budget 측정으로 관리.

## Gates

공통 기반 Gate(G0 / G1 / G2a~G2d / G3)는 family cutover 착수 전 1회 통과한다. G2a~G2c 는 Phase 1a proof gate(kill-switch — 실패 시 ADR-142 대안 E 재검토), G2d 는 Phase 1b 공통 기반 완성 gate 다. family cutover Gate(G4~G6)는 family 마다 반복 적용하며 한 family 의 4경로를 동시에 검증한다. G7 은 전 family 가 `cutover:"catalog"` 에 도달했을 때 1회 통과한다.

| Gate    | 시점                                            | 통과 조건                                                                                                                                                                                                                                                     | 실패 시 대안                                      |
| ------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| G0      | Phase 0 freeze                                  | starter source 보호 유지. 신규 active component 가 legacy 6개 목록으로 추가되지 않음                                                                                                                                                                          | cutover 착수 보류                                 |
| G1      | Inventory 완료                                  | starter 55 컴포넌트의 primitive/composed 분류표 + 124 `ComponentSpec` 의 legacy 처분 + 6개 registry diff 문서화 + 단일 `design.md` token/패턴 검증·확정                                                                                                       | 누락 항목 먼저 분리                               |
| **G2a** | **Phase 1a — resolved-tree 소비**               | Preview 가 `resolveCanonicalDocument()` 결과를 단일 render source 로 소비. generic 렌더러 DOM backend 가 resolved tree + theme 소비. Button(primitive 노드) + 최소 reusable-origin·ref-instance(composed 노드)가 DOM 렌더 — 렌더러가 두 노드 종류를 모두 처리 | **ADR-142 대안 E 재검토 (kill-switch)**           |
| **G2b** | **Phase 1a — DOM↔Skia 대칭**                    | 위 proof set(Button + ref)이 DOM·Skia 양쪽 동일 시각 결과(`/cross-check`). Skia backend 가 `render.shapes()` 없이 렌더                                                                                                                                        | **ADR-142 대안 E 재검토 (kill-switch)**           |
| **G2c** | **Phase 1a — worst-case frame budget (R1·R10)** | 200+ 노드(ref 포함) collection canonical 문서를 generic 렌더러 Skia backend 로 인터랙션 re-render 시 (a) 절대 60fps + (b) 현 `render.shapes()` 대비 frame 비용 회귀 한계 이내. 측정 환경은 대표 device profile 명시                                           | **ADR-142 대안 E 재검토 (kill-switch)**           |
| G2d     | Phase 1b — 공통 기반 완성                       | `PrimitiveBinding` 타입 확정. generic Inspector field renderer 가 `PropContract` 집합 + theme 로 편집 필드 생성(Button `accepts` 검증). F1~F4 fixture(reusable origin / ref instance / descendants 3-mode / slot fill)가 Preview 에 의도된 visibility 로 렌더 | family cutover 전면 보류                          |
| G3      | Catalog/배선 완료                               | `componentCatalog`(primitive + reusable entry) 구성. Component Panel / Factory 가 catalog 만 소비. registration contract 불변식 C/D/E 통과                                                                                                                    | 배선 보류                                         |
| G4      | family Builder cutover                          | 해당 family 의 Component Panel / Factory 가 catalog 기준으로 동작. manual duplicate registration 없음                                                                                                                                                         | 해당 family legacy 유지                           |
| G5      | family Preview/Publish/Skia 정합                | 해당 family fixture 가 Preview DOM, Skia 양쪽에서 동일 시각 결과(`/cross-check`). reusable/ref/slot 렌더 정상                                                                                                                                                 | 해당 family hidden 또는 legacy fallback           |
| G6      | family Legacy 격리                              | 해당 family 의 active 경로에서 `components/legacy` import + `ComponentSpec`/`ReactRenderer`/`render.shapes` 참조 0건                                                                                                                                          | 해당 family cutover 보류                          |
| G7      | Final verification                              | `pnpm run codex:preflight` 통과. 전 family `cutover:"catalog"` 도달. README/ADR status 동기화. ADR-036/907/908/140/141 status 재평가                                                                                                                          | 실패 family commit revert (다른 family 영향 없음) |

2026-05-20 판정: Phase 1a proof slice 가 G2a/G2b/G2c 를 통과했다. 범위는 Button
1개 primitive binding + reusable-origin/ref-instance 수직 슬라이스이며, family
cutover 또는 generic Inspector 는 포함하지 않는다. G2c 측정은
`canonicalSkiaSymmetry.test.ts` 의 205개 Button ref canonical 문서 fixture 에서
generic Skia traversal `durationMs <= 16.67` / `estimatedFps >= 60` 을 검증한다.

2026-05-20 추가 판정: Phase 1b 공통 기반이 G2d 를 통과했다.
`PrimitiveBinding`/`ComponentCatalogEntry`/`PropContract` 타입을 확정하고,
`outputs/inspectorFields.ts` 가 `PropContract` 집합 + theme lookup 으로 generic
Inspector field section 을 생성한다. `GenericPropertyEditor` 는 Button
primitive binding 이 있을 때 legacy `spec.properties.sections` 보다 이
PropContract 경로를 먼저 소비한다. F1~F4 Preview fixture 는 reusable origin,
ref instance, descendants A/B/C, slot fill, fallback resolved children 보존을
검증한다. 다음 gate 는 Phase 2 G3 (`componentCatalog` + reusable library) 다.

2026-05-20 추가 판정: Phase 2 catalog/library slice 를 land 했다.
`packages/shared/src/catalog/componentCatalog.ts` 가 Button primitive active entry
와 Card/Section reusable legacy seed entry 를 가진다.
`packages/shared/src/catalog/library/` 의 Card/Section reusable canonical 문서는
`x-composition.catalog.propsSchema` extension meta 로 exposed props 를 보존한다.
`componentCatalog.test.ts` 와 registration contract 의 ADR-142 C/D/E 불변식은
primitive binding resolve, reusable document resolve, family atomicity,
legacy active 노출 차단을 검증한다. 단, G3 의 Component Panel / Factory
catalog-only 배선은 아직 완료 판정하지 않는다 — 다음 진입점은 Phase 4 배선이다.

2026-05-20 추가 판정: G3 active-entry Panel/Factory bridge 를 land 했다.
`ComponentList` 는 `cutover:"catalog"` active entry 를 panel item 으로 매핑하고,
같은 type 의 legacy panel definition 을 기존 위치에서 replacement 한다. 현재 active
entry 인 Button 은 catalog `panel` metadata 가 source 다. `useElementCreator` 는
active primitive catalog entry 의 `binding.defaultProps` 를 legacy
`getDefaultProps` 보다 먼저 사용한다. 이어서 기존 Component Panel 7개 카테고리
inventory 를 `packages/shared/src/catalog/panelInventory.ts` 로 이동해
`ComponentList` 가 shared catalog inventory + active catalog replacement 결과만
소비하도록 바꿨다. reusable catalog entry 는 `cutover:"catalog"` 로 전환될 때
`type:"ref"` + `ref/masterId/componentRole:"instance"` payload 로 해석된다. 실제
reusable active flip 은 family cutover gate 에서 수행한다.

2026-05-20 추가 판정: Phase 3 Button primitive wrapper + legacy boundary slice 를
land 했다. `packages/shared/src/components/Button.tsx` 는 inline default projection
대신 catalog `toButtonRacProps()` 를 사용해 canonical props 를 RAC props 로
정규화한다. `packages/shared/src/components/legacy/README.md` 는 legacy 구현을
compatibility fallback 으로 한정하고 active Builder authoring / Panel / Factory /
Preview / Publish runtime import 금지를 명시한다. 이는 Button proof family 의 G6
boundary slice 이며, 약 35개 primitive wrapper 전체 완료 판정은 아니다.

2026-05-20 추가 판정: Button Icon inspector parity 를 catalog contract 경로로
보강했다. `buttonPrimitiveBinding.props.accepts` 는 `iconName` /
`iconPosition` / `iconStrokeWidth` 를 `Icon` section 으로 노출하고,
`toButtonRacProps()` 는 이 canonical props 를 shared Button wrapper 로 투영한다.
`packages/shared/src/components/Button.tsx` 는 RAC Button wrapper 를 유지하면서
Icon child 를 렌더한다. generic Skia Button path 는 같은 `iconName` 을
`icon_path` child 로 렌더하고 `ButtonSpec.render.shapes()` 를 호출하지 않는
fixture 를 가진다. 이는 구 `ButtonSpec.properties` 의 Icon section 으로 되돌아간
것이 아니라 `PrimitiveBinding` PropContract + resolved-tree generic renderer parity
보강이다.

2026-05-20 추가 판정: Separator primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/separator.ts` 와 `toSeparatorRacProps()` 가
Separator canonical props 를 RAC Separator props 로 정규화한다. `componentCatalog`
는 Separator 를 `cutover:"catalog"` active primitive 로 등록한다.
`packages/shared/src/components/Separator.tsx` 는 shared wrapper surface 에서 이
projection 을 소비하고, Preview `CanonicalNodeRenderer` 는 Separator resolved node
를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다. generic Skia
path 는 Separator 를 `line` node 로 생성하고 `SeparatorSpec.render.shapes()` 를
호출하지 않는 fixture 를 가진다. 이는 `primitives/actions` family 의 두 번째 active
primitive pilot 이며, ToggleButton/Link/Icon/Badge 등 family 전체 완료 판정은
아니다.

2026-05-20 추가 판정: Link primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/link.ts` 와 `toLinkRacProps()` 가 Link
canonical props 를 RAC Link props 로 정규화한다. `componentCatalog` 는 Link 를
`cutover:"catalog"` active primitive 로 등록한다. `packages/shared/src/components/Link.tsx`
는 shared wrapper surface 에서 이 projection 을 소비하고, Preview
`CanonicalNodeRenderer` 는 Link resolved node 를 legacy `rendererMap` 보다 primitive
branch 에서 먼저 렌더한다. generic Skia path 는 Link 를 underline text node 로
생성하고 `LinkSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 이는
`primitives/actions` family 의 세 번째 active primitive pilot 이며, family 전체 완료
판정은 아니다.

2026-05-20 추가 판정: ToggleButton primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/toggleButton.ts` 와
`toToggleButtonRacProps()` 가 ToggleButton canonical props 를 RAC ToggleButton props
로 정규화한다. `componentCatalog` 는 ToggleButton 을 `cutover:"catalog"` active
primitive 로 등록한다. `packages/shared/src/components/ToggleButton.tsx` 는 shared
wrapper surface 에서 이 projection 을 소비하고, Preview `CanonicalNodeRenderer` 는
ToggleButton resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저
렌더한다. generic Skia path 는 ToggleButton 을 selected/emphasized 상태를 반영한
button-like container/text node 로 생성하고 `ToggleButtonSpec.render.shapes()` 를
호출하지 않는 fixture 를 가진다. 이는 `primitives/actions` family 의 네 번째 active
primitive pilot 이며, ToggleButtonGroup/Icon/Badge 등 family 잔여 완료 판정은
아니다.

2026-05-20 추가 판정: ToggleButtonGroup primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/toggleButtonGroup.ts` 와
`toToggleButtonGroupRacProps()` 가 ToggleButtonGroup canonical props 를 RAC
ToggleButtonGroup props 로 정규화한다. `componentCatalog` 는 ToggleButtonGroup 을
`cutover:"catalog"` active primitive 로 등록한다. group placement 는
`PrimitiveBinding.placement` child template 으로 고정해 active catalog 생성 시 기본
ToggleButton 자식 2개를 함께 만든다. `packages/shared/src/components/ToggleButtonGroup.tsx`
는 shared wrapper surface 에서 이 projection 을 소비하고, Preview
`CanonicalNodeRenderer` 는 ToggleButtonGroup resolved node 를 legacy `rendererMap`
보다 primitive branch 에서 먼저 렌더하며 child ToggleButton 선택 상태를 RAC
`selectedKeys` 로 투영한다. generic Skia path 는 resolved children 을 재귀 렌더하고
`ToggleButtonGroupSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 이는
`primitives/actions` family 의 다섯 번째 active primitive pilot 이며, Icon/Badge 등
family 잔여 완료 판정은 아니다.

2026-05-20 추가 판정: Toolbar primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/toolbar.ts` 와 `toToolbarRacProps()` 가
Toolbar canonical props 를 RAC Toolbar props 로 정규화한다. `componentCatalog` 는
Toolbar 를 `cutover:"catalog"` active primitive 로 등록한다. toolbar placement 는
`PrimitiveBinding.placement` child template 으로 고정해 active catalog 생성 시
Button/Button/Separator/Button 자식을 함께 만든다.
`packages/shared/src/components/Toolbar.tsx` 는 shared wrapper surface 에서 이
projection 을 소비하고, Preview `CanonicalNodeRenderer` 는 Toolbar resolved node 를
legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더하며 child action
primitives 를 같은 resolved-tree 경로로 재귀 렌더한다. generic Skia path 는 resolved
children 을 재귀 렌더하고 `ToolbarSpec.render.shapes()` 를 호출하지 않는 fixture 를
가진다. 이는 `primitives/actions` family 의 여섯 번째 active primitive pilot 이다.
Icon/Badge 는 RAC runtime primitive 가 아닌 local visual wrapper 이므로 별도 분류
없이는 `PrimitiveRuntimeSource: "react-aria-components"` 로 승격하지 않는다.

2026-05-20 추가 판정: Breadcrumbs primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/breadcrumbs.ts` 와
`toBreadcrumbsRacProps()` 가 Breadcrumbs canonical props 를 RAC Breadcrumbs props 로
정규화한다. subpart `Breadcrumb` 는
`packages/shared/src/catalog/primitives/breadcrumb.ts` 와 `toBreadcrumbRacProps()` 로
non-placeable primitive binding 을 갖는다. `componentCatalog` 는 Breadcrumbs 를
`cutover:"catalog"` active placeable primitive 로, Breadcrumb 을 parent-only
non-placeable primitive 로 등록한다. Breadcrumbs placement 는
`PrimitiveBinding.placement` child template 으로 기본 Breadcrumb 자식 3개를 함께
만든다. `packages/shared/src/components/Breadcrumbs.tsx` 와
`packages/shared/src/components/Breadcrumb.tsx` 는 shared wrapper surface 에서 이
projection 을 소비하고, Preview `CanonicalNodeRenderer` 는 Breadcrumbs/Breadcrumb
resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다.
generic Skia path 는 Breadcrumb subpart 를 text node 로 렌더하고
`BreadcrumbsSpec.render.shapes()` / `BreadcrumbSpec.render.shapes()` 를 호출하지
않는 fixture 를 가진다. 이는 `primitives/actions` family 의 일곱 번째 active
primitive pilot 이다.

2026-05-20 추가 판정: TextField primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/textField.ts` 와 `toTextFieldRacProps()` 가
TextField canonical props 를 RAC TextField/Input/Label props 로 정규화한다.
`componentCatalog` 는 TextField 를 `cutover:"catalog"` active fields primitive 로
등록한다. `packages/shared/src/components/TextField.tsx` 는 shared wrapper surface
에서 이 projection 을 소비하고, Preview `CanonicalNodeRenderer` 는 TextField
resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다.
TextField 의 `type` prop(email/password 등)이 component tag 로 오인되지 않도록
`CanonicalNodeRenderer` 의 component type 복원은 `node.type` 을 canonical props
`type` 보다 우선한다. generic Skia path 는 TextField label/input/value 를
container/text node 로 렌더하고 `TextFieldSpec.render.shapes()` 를 호출하지 않는
fixture 를 가진다. 이는 `fields` family 의 첫 active primitive pilot 이며 family
전체 완료 판정은 아니다.

2026-05-20 추가 판정: NumberField primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/numberField.ts` 와 `toNumberFieldRacProps()` 가
NumberField canonical props 를 RAC NumberField/Input/Label props 로 정규화한다.
`componentCatalog` 는 NumberField 를 `cutover:"catalog"` active fields primitive 로
등록한다. `packages/shared/src/components/NumberField.tsx` 는 shared wrapper surface
에서 이 projection 을 소비하고, Preview `CanonicalNodeRenderer` 는 NumberField
resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다.
generic Skia path 는 NumberField label/input/value 를 container/text node 로
렌더하고 `NumberFieldSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 이는
`fields` family 의 두 번째 active primitive pilot 이며 family 전체 완료 판정은
아니다.

2026-05-20 추가 판정: SearchField primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/searchField.ts` 와 `toSearchFieldRacProps()` 가
SearchField canonical props 를 RAC SearchField/Input/Label props 로 정규화한다.
`componentCatalog` 는 SearchField 를 `cutover:"catalog"` active fields primitive 로
등록한다. `packages/shared/src/components/SearchField.tsx` 는 shared wrapper surface
에서 이 projection 을 소비하고, Preview `CanonicalNodeRenderer` 는 SearchField
resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다.
generic Skia path 는 SearchField label/input/value 와 search icon 을
container/text/icon_path node 로 렌더하고 `SearchFieldSpec.render.shapes()` 를
호출하지 않는 fixture 를 가진다. 이는 `fields` family 의 세 번째 active primitive
pilot 이며 family 전체 완료 판정은 아니다.

2026-05-20 추가 판정: DateField primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/dateField.ts` 와 `toDateFieldRacProps()` 가
DateField canonical props 를 RAC DateField/DateInput/DateSegment props 로
정규화한다. `componentCatalog` 는 DateField 를 `cutover:"catalog"` active fields
primitive 로 등록한다. `packages/shared/src/components/DateField.tsx` 는 shared
wrapper surface 에서 이 projection 을 소비하고, Preview `CanonicalNodeRenderer` 는
DateField resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저
렌더한다. generic Skia path 는 DateField label/input/value 를 container/text node 로
렌더하고 `DateFieldSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 이는
`fields` family 의 네 번째 active primitive pilot 이며 family 전체 완료 판정은
아니다.

2026-05-20 추가 판정: TimeField primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/timeField.ts` 와 `toTimeFieldRacProps()` 가
TimeField canonical props 를 RAC TimeField/DateInput/DateSegment props 로
정규화한다. `componentCatalog` 는 TimeField 를 `cutover:"catalog"` active fields
primitive 로 등록한다. `packages/shared/src/components/TimeField.tsx` 는 shared
wrapper surface 에서 이 projection 을 소비하고, Preview `CanonicalNodeRenderer` 는
TimeField resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저
렌더한다. generic Skia path 는 TimeField label/input/value 를 container/text node 로
렌더하고 `TimeFieldSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 이는
`fields` family 의 다섯 번째 active primitive pilot 이며 family 전체 완료 판정은
아니다.

2026-05-20 추가 판정: ColorField primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/colorField.ts` 와 `toColorFieldRacProps()` 가
ColorField canonical props 를 RAC ColorField/Input/Label props 로 정규화한다.
`componentCatalog` 는 ColorField 를 `cutover:"catalog"` active fields primitive 로
등록한다. `packages/shared/src/components/ColorField.tsx` 는 shared wrapper surface
에서 이 projection 을 소비하고, Preview `CanonicalNodeRenderer` 는 ColorField
resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다.
generic Skia path 는 ColorField label/input/value 와 swatch 를 container/text/box
node 로 렌더하고 `ColorFieldSpec.render.shapes()` 를 호출하지 않는 fixture 를
가진다. 이는 `fields` family 의 여섯 번째 active primitive pilot 이며 family 전체
완료 판정은 아니다.

2026-05-20 추가 판정: Form primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/form.ts` 와 `toFormRacProps()` 가 Form
canonical props 를 RAC Form props 로 정규화한다. `componentCatalog` 는 Form 을
`cutover:"catalog"` active fields primitive 로 등록하고, placement 는
TextField/TextField/Button 자식을 함께 만든다. `packages/shared/src/components/Form.tsx`
는 shared wrapper surface 에서 이 projection 을 소비하고, Preview
`CanonicalNodeRenderer` 는 Form resolved node 를 legacy `rendererMap` 보다 primitive
branch 에서 먼저 렌더하며 자식을 같은 resolved-tree 경로로 재귀 렌더한다. generic
Skia path 는 dedicated `skiaPrimitive` 없이 Form container 와 resolved children 을
렌더하고 `FormSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 이는
`fields` family 의 일곱 번째 active primitive pilot 이며 family 전체 완료 판정은
아니다.

2026-05-20 추가 판정: FileTrigger primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/fileTrigger.ts` 와
`toFileTriggerRacProps()` 가 FileTrigger canonical props 를 RAC FileTrigger props 로
정규화한다. `componentCatalog` 는 FileTrigger 를 `cutover:"catalog"` active fields
primitive 로 등록하고, placement 는 Button trigger 자식을 함께 만든다.
`packages/shared/src/components/FileTrigger.tsx` 는 shared wrapper surface 에서 이
projection 을 소비하고, Preview `CanonicalNodeRenderer` 는 FileTrigger resolved node
를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더하며 trigger child 를
같은 resolved-tree 경로로 재귀 렌더한다. generic Skia path 는 dedicated
`skiaPrimitive` 없이 FileTrigger container 와 Button child 를 렌더하고
`FileTriggerSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 이는
`fields` family 의 여덟 번째 active primitive pilot 이다. `Field` 는
`react-aria-components` leaf primitive 가 아니라 Label/Text/Input/FieldError helper
및 DataField surface 이므로 active primitive 로 승격하지 않는다.

2026-05-20 추가 판정: active primitive Inspector entrypoint 의 legacy specRegistry
우회를 land 했다. `getEditor()` 는 catalog primitive 에 대해
`getPrimitiveBinding(type)` 을 `getPropertyEditorSpec(type)` 보다 먼저 평가하고,
`GenericPropertyEditor` 는 `ComponentSpec` 없이 `componentType` 만으로
`PropContract` 기반 section 을 생성한다. legacy `spec.properties.sections` /
`SpecField` fallback 은 catalog binding 이 없는 legacy component 에만 남긴다. 이는
Button/Separator/Link/Breadcrumbs/ToggleButton/ToggleButtonGroup/Toolbar 및
TextField/NumberField/SearchField/DateField/TimeField/ColorField/Form/FileTrigger active
primitive Inspector 경로의 G6 잔여 blocker 를 제거한다.

2026-05-20 추가 판정: Switch primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/switch.ts` 와 `toSwitchRacProps()` 가 Switch
canonical props 를 RAC Switch props 로 정규화한다. `componentCatalog` 는 Switch 를
`cutover:"catalog"` active selection primitive 로 등록한다.
`packages/shared/src/components/Switch.tsx` 는 shared wrapper surface 에서 이 projection
을 소비하고, Preview `CanonicalNodeRenderer` 는 Switch resolved node 를 legacy
`rendererMap` 보다 primitive branch 에서 먼저 렌더한다. generic Skia path 는 Switch
track/thumb/label 을 container + box/text node 로 렌더하고
`SwitchSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 이는 `selection`
family 의 첫 active primitive pilot 이며, 이후 Checkbox slice 로 확장했다.

2026-05-20 추가 판정: Checkbox primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/checkbox.ts` 와 `toCheckboxRacProps()` 가
Checkbox canonical props 를 RAC Checkbox props 로 정규화한다. `componentCatalog` 는
Checkbox 를 `cutover:"catalog"` active selection primitive 로 등록한다.
`packages/shared/src/components/Checkbox.tsx` 는 TreeItem slot 예외를 유지하면서 catalog
projection 을 shared wrapper surface 에서 소비하고, Preview `CanonicalNodeRenderer` 는
Checkbox resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다.
generic Skia path 는 Checkbox box/indicator/label 을 container + box/text node 로
렌더하고 `CheckboxSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. selection
family 는 이후 Slider slice 로 확장했다.

2026-05-20 추가 판정: Slider primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/slider.ts` 와 `toSliderRacProps()` 가 Slider
canonical props 를 RAC Slider props 로 정규화한다. `componentCatalog` 는 Slider 를
`cutover:"catalog"` active selection primitive 로 등록한다.
`packages/shared/src/components/Slider.tsx` 는 value/range/locale/format projection 을
shared wrapper surface 에서 소비하고, Preview `CanonicalNodeRenderer` 는 Slider
resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다.
generic Skia path 는 Slider label/output/track/fill/thumb 을 container + text/box node
로 렌더하고 `SliderSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 이후
CheckboxGroup slice 로 확장했다.

2026-05-20 추가 판정: CheckboxGroup primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/checkboxGroup.ts` 와
`toCheckboxGroupRacProps()` 가 CheckboxGroup canonical props 를 RAC CheckboxGroup
props 로 정규화한다. `componentCatalog` 는 CheckboxGroup 을 `cutover:"catalog"`
active selection primitive 로 등록하고 Checkbox child template placement 를 제공한다.
`packages/shared/src/components/CheckboxGroup.tsx` 는 label/orientation/size/selection
projection 을 shared wrapper surface 에서 소비하고, Preview `CanonicalNodeRenderer` 는
CheckboxGroup resolved node 와 Checkbox children 을 legacy `rendererMap` 보다 primitive
branch 에서 먼저 렌더한다. generic Skia path 는 CheckboxGroup label + resolved
Checkbox children 을 container + text/box node 로 렌더하고
`CheckboxGroupSpec.render.shapes()` 와 child `CheckboxSpec.render.shapes()` 를 호출하지
않는 fixture 를 가진다. 이후 Radio/RadioGroup slice 로 확장했다.

2026-05-20 추가 판정: Radio/RadioGroup primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/radio.ts` / `radioGroup.ts` 와
`toRadioRacProps()` / `toRadioGroupRacProps()` 가 Radio 계열 canonical props 를
RAC props 로 정규화한다. `componentCatalog` 는 Radio 를 non-placeable active
subpart primitive 로, RadioGroup 을 `cutover:"catalog"` active selection primitive 로
등록하고 Radio child template placement 를 제공한다.
`packages/shared/src/components/Radio.tsx` 와 `RadioGroup.tsx` 는 variant/size/state
projection 을 shared wrapper surface 에서 소비한다. Preview `CanonicalNodeRenderer`
는 RadioGroup resolved node 와 Radio children 을 primitive branch 에서 렌더한다.
단, React Aria `Radio` 는 `RadioGroup` context 가 필요하므로 standalone Radio 는 기존
`rendererMap` fallback 을 유지한다. generic Skia path 는 Radio ring/dot/label 과
RadioGroup label + resolved Radio children 을 container + box/text node 로 렌더하고
`RadioSpec.render.shapes()` / `RadioGroupSpec.render.shapes()` 를 호출하지 않는
fixture 를 가진다. selection family pilot 은 Switch/Checkbox/CheckboxGroup/Radio/
RadioGroup/Slider 로 닫혔고 다음 진입점은 collections family 다.

2026-05-20 추가 판정: ListBox collections primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/listBox.ts` 와 `toListBoxRacProps()` 가
ListBox canonical `items[]` / selection / filtering / virtualization props 를 RAC
ListBox props 로 정규화한다. `componentCatalog` 는 ListBox 를 `cutover:"catalog"`
active collections primitive 로 등록한다. `packages/shared/src/components/ListBox.tsx`
는 catalog projection 과 static `items[]` 렌더를 shared wrapper surface 에서 소비한다.
Preview `CanonicalNodeRenderer` 는 ListBox resolved node 를 legacy `rendererMap` 보다
primitive branch 에서 먼저 렌더한다. generic Skia path 는 ListBox container + item
row/text 를 container + box/text node 로 렌더하고 `ListBoxSpec.render.shapes()` 를
호출하지 않는 fixture 를 가진다. 단, collections family 전체는 아직 닫지 않았다.
2026-05-20 추가 판정: GridList collections primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/gridList.ts` 와 `toGridListRacProps()` 가
GridList canonical `items[]` / layout / selection / filtering props 를 RAC GridList
props 로 정규화한다. `componentCatalog` 는 GridList 를 `cutover:"catalog"` active
collections primitive 로 등록한다. `packages/shared/src/components/GridList.tsx` 는
catalog projection 과 static `items[]` 카드 렌더를 shared wrapper surface 에서 소비한다.
Preview `CanonicalNodeRenderer` 는 GridList resolved node 를 legacy `rendererMap` 보다
primitive branch 에서 먼저 렌더한다. generic Skia path 는 GridList container + card
label/description 을 container + box/text node 로 렌더하고 `GridListSpec.render.shapes()` 를
호출하지 않는 fixture 를 가진다. 단, collections family 전체는 아직 닫지 않았다.
2026-05-20 추가 판정: TagGroup collections primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/tagGroup.ts` 와 `toTagGroupRacProps()` 가
TagGroup canonical `items[]` / label / selection / filtering / remove-state props 를 RAC
TagGroup props 로 정규화한다. `componentCatalog` 는 TagGroup 을 `cutover:"catalog"`
active collections primitive 로 등록한다. `packages/shared/src/components/TagGroup.tsx` 는
catalog projection 과 static `items[]` chip 렌더를 shared wrapper surface 에서 소비한다.
Preview `CanonicalNodeRenderer` 는 TagGroup resolved node 를 legacy `rendererMap` 보다
primitive branch 에서 먼저 렌더한다. generic Skia path 는 TagGroup label + chip
box/text 를 container + box/text node 로 렌더하고 `TagGroupSpec.render.shapes()` 를
호출하지 않는 fixture 를 가진다. 단, collections family 전체는 아직 닫지 않았다.
2026-05-20 추가 판정: Menu collections primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/menu.ts` 와 `toMenuRacProps()` 가 Menu
canonical `items[]` / trigger label / placement / selection props 를 RAC MenuButton
surface 로 정규화한다. `componentCatalog` 는 Menu 를 `cutover:"catalog"` active
collections primitive 로 등록하되, 기존 사용자 패널 위치를 보존하기 위해 panel category 는
`buttons` 로 유지한다. `packages/shared/src/components/Menu.tsx` 는 catalog projection 과
static `items[]` 렌더를 shared wrapper surface 에서 소비한다. Preview
`CanonicalNodeRenderer` 는 Menu resolved node 를 legacy `rendererMap` 보다 primitive
branch 에서 먼저 렌더한다. generic Skia path 는 Menu trigger + popover item row/text 를
container + box/text node 로 렌더하고 `MenuSpec.render.shapes()` 를 호출하지 않는 fixture 를
가진다. 단, collections family 전체는 아직 닫지 않았다.
2026-05-20 추가 판정: ComboBox collections primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/comboBox.ts` 와 `toComboBoxRacProps()` 가
ComboBox canonical `items[]` / label / placeholder / input value / selected key /
state props 를 RAC ComboBox surface 로 정규화한다. `componentCatalog` 는 ComboBox 를
`cutover:"catalog"` active collections primitive 로 등록하되, 기존 사용자 패널 위치를
보존하기 위해 panel category 는 `forms` 로 유지한다.
`packages/shared/src/components/ComboBox.tsx` 는 catalog projection 과 static
`items[]` 렌더를 shared wrapper surface 에서 소비한다. Preview
`CanonicalNodeRenderer` 는 ComboBox resolved node 를 legacy `rendererMap` 보다
primitive branch 에서 먼저 렌더한다. generic Skia path 는 ComboBox label + input +
list item row/text 를 container + box/text/icon node 로 렌더하고
`ComboBoxSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 단, collections
family 전체는 아직 닫지 않았다.
2026-05-20 추가 판정: Select collections primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/select.ts` 와 `toSelectRacProps()` 가 Select
canonical `items[]` / label / placeholder / selected key / placement / state props 를
RAC Select surface 로 정규화한다. `componentCatalog` 는 Select 를
`cutover:"catalog"` active collections primitive 로 등록하되, 기존 사용자 패널 위치를
보존하기 위해 panel category 는 `forms` 로 유지한다.
`packages/shared/src/components/Select.tsx` 는 catalog projection 과 static `items[]`
렌더를 shared wrapper surface 에서 소비한다. Preview `CanonicalNodeRenderer` 는 Select
resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다. generic
Skia path 는 Select label + trigger + list item row/text 를 container + box/text/icon
node 로 렌더하고 `SelectSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다. 단,
collections family 전체는 아직 닫지 않았다.
이후 Tabs slice 로 확장했다.

2026-05-20 추가 판정: Tabs collections primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/tabs.ts` 와 `toTabsRacProps()` 가 Tabs
canonical `items[]` / selected key / density / orientation / indicator props 를 RAC
Tabs surface 로 정규화한다. `componentCatalog` 는 Tabs 를 `cutover:"catalog"`
active collections primitive 로 등록한다. `packages/shared/src/components/Tabs.tsx` 는
catalog projection 과 static `items[]` 렌더를 shared wrapper surface 에서 소비한다.
Preview `CanonicalNodeRenderer` 는 Tabs resolved node 를 legacy `rendererMap` 보다
primitive branch 에서 먼저 렌더한다. generic Skia path 는 tab-list + selected panel 을
container + box/text node 로 렌더하고 `TabsSpec.render.shapes()` 를 호출하지 않는
fixture 를 가진다. collections primitive pilot 은 ListBox/GridList/TagGroup/Menu/
ComboBox/Select/Tabs 로 닫혔다. ADR-132 collection 데이터 binding 전체 전환은 잔여다.

2026-05-20 추가 판정: Tree·Table HIGH family pilot 을 land 했다.
`packages/shared/src/catalog/primitives/tree.ts` / `table.ts` 와 `toTreeRacProps()` /
`toTableRacProps()` 가 Tree hierarchical `items[]`, Table columns/rows, TableView
columns/rows 를 RAC Tree/Table surface 로 정규화한다. `componentCatalog` 는 Tree,
Table, TableView 를 `cutover:"catalog"` active `tree-table` primitive 로 등록한다.
TableView 는 별도 RAC primitive 가 없으므로 runtime exportName 은 RAC `Table` 로 고정하고,
composition tag 는 `TableView` 로 유지한다. `packages/shared/src/components/Tree.tsx` 는
catalog projection 과 static hierarchical `items[]` 렌더를 shared wrapper surface 에서
소비한다. `packages/shared/src/components/Table.tsx` 는 active catalog columns/rows
payload 에서 RAC Table projection 을 먼저 쓰고, 기존 TanStack Table 경로는 legacy data
binding compatibility fallback 으로 남긴다. Preview `CanonicalNodeRenderer` 는
Tree/Table/TableView resolved node 를 legacy `rendererMap` 보다 primitive branch 에서
먼저 렌더한다. generic Skia path 는 Tree rows/disclosure, Table header/rows/cells,
TableView rows/cells 를 container + box/text node 로 렌더하고 `TreeSpec.render.shapes()` /
`TableSpec.render.shapes()` / `TableViewSpec.render.shapes()` 를 호출하지 않는 fixture 를
가진다. ADR-132 collection 데이터 binding 전체 전환은 잔여다.

2026-05-20 추가 판정: DropZone overlays primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/dropZone.ts` 와 `toDropZoneRacProps()` 가
DropZone label/description/size/drop-target/disabled props 를 RAC DropZone surface 로
정규화한다. `componentCatalog` 는 DropZone 을 `cutover:"catalog"` active `overlays`
primitive 로 등록하되, 기존 사용자 패널 위치는 `forms` category 로 보존한다.
`packages/shared/src/components/DropZone.tsx` 는 catalog projection 을 shared wrapper
surface 에서 소비하고, Preview `CanonicalNodeRenderer` 는 DropZone resolved node 를
legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다. generic Skia path 는
DropZone dashed container + upload icon + label/description text 를 container +
icon_path/text node 로 렌더하고 `DropZoneSpec.render.shapes()` 를 호출하지 않는 fixture 를
가진다.

2026-05-20 추가 판정: Tooltip overlays primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/tooltip.ts` 와 `toTooltipRacProps()` 가
Tooltip text/variant/size/placement/offset/flip/arrow props 를 RAC Tooltip surface 로
정규화한다. `componentCatalog` 는 Tooltip 을 `cutover:"catalog"` active `overlays`
primitive 로 등록하고, 패널 위치는 `overlays` category 로 둔다.
`packages/shared/src/components/Tooltip.tsx` 는 기존 TooltipTrigger context 안에서는
RAC Tooltip 을 그대로 소비하고, catalog/Preview 처럼 단독으로 놓인 Tooltip 은
controlled TooltipTrigger anchor 를 붙여 실제 tooltip DOM surface 를 생성한다.
Preview `CanonicalNodeRenderer` 는 Tooltip resolved node 를 legacy `rendererMap`
보다 primitive branch 에서 먼저 렌더한다. generic Skia path 는 Tooltip bubble +
text + optional arrow 를 container/text/line node 로 렌더하고
`TooltipSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다.

2026-05-20 추가 판정: Dialog overlays primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/dialog.ts` 와 `toDialogRacProps()` 가 Dialog
text/size/role/dismissable props 를 RAC Dialog surface 로 정규화한다.
`componentCatalog` 는 Dialog 를 `cutover:"catalog"` active `overlays` primitive 로
등록하고, 패널 위치는 `overlays` category 로 둔다. `packages/shared/src/components/Dialog.tsx`
는 catalog projection 을 shared wrapper surface 에서 소비하고, Preview
`CanonicalNodeRenderer` 는 Dialog resolved node 를 legacy `rendererMap` 보다
primitive branch 에서 먼저 렌더한다. generic Skia path 는 Dialog panel + text 를
container/text node 로 렌더하고 `DialogSpec.render.shapes()` 를 호출하지 않는
fixture 를 가진다.

2026-05-20 추가 판정: Popover overlays primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/popover.ts` 와 `toPopoverRacProps()` 가 Popover
text/variant/size/placement/offset/flip/arrow/open props 를 RAC Popover surface 로
정규화한다. `componentCatalog` 는 Popover 를 `cutover:"catalog"` active `overlays`
primitive 로 등록하고, 패널 위치는 `overlays` category 로 둔다.
`packages/shared/src/components/Popover.tsx` 는 catalog projection 을 shared wrapper
surface 에서 소비하고, catalog/Preview 처럼 단독으로 놓인 Popover 는 controlled
DialogTrigger anchor 를 붙여 실제 popover DOM surface 를 생성한다. Preview
`CanonicalNodeRenderer` 는 Popover resolved node 를 legacy `rendererMap` 보다
primitive branch 에서 먼저 렌더한다. generic Skia path 는 Popover panel + text +
optional arrow 를 container/text/line node 로 렌더하고 `PopoverSpec.render.shapes()`
를 호출하지 않는 fixture 를 가진다.

2026-05-20 추가 판정: Modal overlays primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/modal.ts` 와 `toModalRacProps()` 가 Modal
text/size/focus/open/dismiss props 를 RAC Modal surface 로 정규화한다.
`componentCatalog` 는 Modal 을 `cutover:"catalog"` active `overlays` primitive 로
등록하고, 패널 위치는 `overlays` category 로 둔다. `packages/shared/src/components/Modal.tsx`
는 catalog projection 을 shared wrapper surface 에서 소비하고, catalog/Preview 처럼
단독으로 놓인 Modal 은 controlled DialogTrigger anchor 를 붙여 실제 modal DOM surface 를
생성한다. Preview `CanonicalNodeRenderer` 는 Modal resolved node 를 legacy
`rendererMap` 보다 primitive branch 에서 먼저 렌더한다. generic Skia path 는 Modal
panel + text 를 container/text node 로 렌더하고 `ModalSpec.render.shapes()` 를
호출하지 않는 fixture 를 가진다.

2026-05-20 추가 판정: Toast overlays primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/toast.ts` 와 `toToastRacProps()` 가 Toast
title/description/variant/size/position/timeout props 를 RAC Toast surface 로
정규화한다. `componentCatalog` 는 Toast 를 `cutover:"catalog"` active `overlays`
primitive 로 등록한다. `packages/shared/src/components/Toast.tsx` 는 기존
`ToastProvider`/`useToast` API 를 보존하면서 내부 표시 surface 를 RAC
ToastRegion/Toast 로 전환하고, catalog/Preview 단독 surface 에서는 standalone
queue 로 실제 toast DOM surface 를 생성한다. Preview `CanonicalNodeRenderer` 는
Toast resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다.
generic Skia path 는 Toast icon + title + description 을 container/text node 로
렌더하고 `ToastSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다.

2026-05-20 추가 판정: ColorSwatch date/color primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/colorSwatch.ts` 와 `toColorSwatchRacProps()` 가
ColorSwatch color/variant/size/rounding/selected/disabled props 를 RAC ColorSwatch
surface 로 정규화한다. `componentCatalog` 는 ColorSwatch 를 `cutover:"catalog"`
active `date-color` primitive 로 등록한다. shared `ColorSwatch.tsx` 는 catalog
projection 을 소비하고, Preview `CanonicalNodeRenderer` 는 ColorSwatch resolved node 를
legacy `rendererMap` 보다 primitive branch 에서 먼저 렌더한다. generic Skia path 는
ColorSwatch color fill 을 box node 로 렌더하고 `ColorSwatchSpec.render.shapes()` 를
호출하지 않는 fixture 를 가진다.

2026-05-21 추가 판정: ColorSlider date/color primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/colorSlider.ts` 와 `toColorSliderRacProps()` 가
ColorSlider color/channel/colorSpace/orientation/size/value/disabled props 를 RAC
ColorSlider surface 로 정규화한다. `componentCatalog` 는 ColorSlider 를
`cutover:"catalog"` active `date-color` primitive 로 등록한다. shared
`ColorSlider.tsx` 는 catalog projection 을 소비하고, Preview `CanonicalNodeRenderer` 는
ColorSlider resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저
렌더한다. generic Skia path 는 ColorSlider track/thumb 를 box node 로 렌더하고
`ColorSliderSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다.

2026-05-21 추가 판정: ColorArea date/color primitive catalog pilot 을 land 했다.
`packages/shared/src/catalog/primitives/colorArea.ts` 와 `toColorAreaRacProps()` 가
ColorArea color/xChannel/yChannel/colorSpace/size/xValue/yValue/disabled props 를 RAC
ColorArea surface 로 정규화한다. `componentCatalog` 는 ColorArea 를
`cutover:"catalog"` active `date-color` primitive 로 등록한다. shared
`ColorArea.tsx` 는 catalog projection 을 소비하고, Preview `CanonicalNodeRenderer` 는
ColorArea resolved node 를 legacy `rendererMap` 보다 primitive branch 에서 먼저
렌더한다. generic Skia path 는 ColorArea plane/thumb 를 box node 로 렌더하고
`ColorAreaSpec.render.shapes()` 를 호출하지 않는 fixture 를 가진다.

## Consequences

### Positive

- 정본이 canonical 문서 하나로 통합된다. 6개 등록 목록이 단일 `componentCatalog` 로 대체된다.
- 컴포넌트당 spec 파일과 변환기가 사라진다(124 spec → ~35 binding). 손으로 유지할 정의 표면이 크게 줄어든다.
- 렌더 경로가 generic 렌더러 하나로 단일화된다. `/cross-check` 가 컴포넌트마다가 아니라 렌더러를 한 번 검증한다.
- ADR-111~131 의 canonical 전환을 마무리한다 — Preview 가 reusable/ref/slot 을 실제로 화면에 펼친다.
- `react-aria-components` 업데이트는 binding delta 로, starter snapshot 업데이트는 D3 시각 참조 diff 로 처리할 수 있다.
- 사용자 제약("깨진 spec 참조 금지")이 구조적으로 지켜진다 — 참조할 컴포넌트당 정의가 존재하지 않는다.

### Negative

- 공통 기반(Phase 0~Phase 1b)이 무겁다. Gate 가 아니라 사실상 제품이다 — generic 렌더러 + Preview resolved-tree 가 먼저 동작해야 한다.
- 조합 컴포넌트를 reusable 문서로 새로 저작해야 한다(자동 변환 불가).
- generic 렌더러 버그는 family 격리가 되지 않는다 — G2 단계의 검증 부담이 크다.
- 컴포넌트당 spec 파일을 D3 SSOT 로 둔 ADR-036(및 ADR-907/908/140/141)의 메커니즘이 폐기된다 — ADR-142 Implemented 시 해당 ADR status 재평가가 필요하다.
- 기존 124 `ComponentSpec` / `ReactRenderer` / `render.shapes` 파이프라인은 cutover 기간 동안 legacy 로 공존한다.
- Inspector 편집 필드 생성이 컴포넌트당 `properties.sections` 선언(124 spec 중 83개 보유)에서 generic `PropContract` 기반으로 바뀐다 — 임의 컴포넌트를 받던 `CustomField` 와 `derivedUpdateFn` 류는 generic 화 비용이 있다(R9).
