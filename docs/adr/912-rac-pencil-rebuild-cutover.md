# ADR-912: RAC core + Pencil format 백지 직행 컴포넌트 아키텍처 (rebuild)

## Status

Proposed — 2026-06-02

> **문서 위상: 유일 착수(rebuild) 실행 설계서**. 본 ADR 은 ADR-911 목표 구조(대안 E)를 **현재 코드를 직접 갈아엎어** 도달하는 실행 설계다. ADR-910(점진 cutover 실행 설계서)과 ADR-911(비실행 목표 참조)을 **둘 다 supersede 하지 않고 유지**한다(사용자 결정 2026-06-02 옵션 B). 세 문서는 같은 대안 E·같은 1차 원리라 목표 구조가 수렴하되 관점·전략이 분리된다 — 910=점진 cutover(legacy 격리 유지) / 911=목표 자체(전환 비참조) / **912=백지 직행(레거시 미보존, 갈아엎기)**.
>
> **execute-adr 라우팅 단일화 (codex review 2026-06-02 결함 1 정정)**: 사용자 옵션 B 결정으로 **착수 대상은 ADR-912 단독**이다. ADR-910 은 더 이상 착수 ADR 이 아니라 **점진 전략의 비교 기록(비착수)** 으로 격하된다 — ADR-910 본문 §Status 와 `docs/adr/README.md` 의 "유일 착수 ADR" 표기는 912 로 이관됐다(같은 커밋에서 정정). ADR-911 은 목표 구조 drift 판정 reference 로 유지한다. 실행자는 ADR-912 만 기준으로 land 한다.

## Context

composition(노코드 웹 빌더)의 컴포넌트 시스템은 ADR-142 가 catalog/binding 신구조를 **추가** 했으나 구 정본(`*.spec.ts` 124 / `render.shapes()` active 호출 59(test/spec 정의 제외) / 6 레지스트리)을 **제거하지 않아**, 신·구 두 정본이 동시에 사는 **dual-SSOT 전환기**에 멈춰 있다. `skiaLegacy:true` collection family 는 한 컴포넌트의 DOM=신경로·Skia=구경로라 — 같은 컴포넌트 안에서 정본이 갈린다. 이것이 ADR-910/911 이 없애려던 drift 의 현재 형태다.

**6중복 등록 문제 (사용자 1순위 목표 2026-06-02)**: 새 컴포넌트 1개를 추가하려면 6개 독립 registry — ComponentFactory `creators`(60) / `rendererMap`(95) / `DEFAULT_PROPS_MAP`(96) / `BASE_TAG_SPEC_MAP`(111) / builder `TAG_SPEC_MAP` / Component Panel list — 에 각각 손으로 등록해야 한다. 이 목록들이 어긋나며 등록 누락 + CSS/Skia drift 가 반복된다. ADR-139 의 `componentRegistrationContract.test.ts` 는 이 6중복을 강제 동기화(누락 시 FAIL)하는 보조 게이트일 뿐 6중복 자체를 없애지 못한다. 사용자 명시: "새 컴포넌트마다 6개 registry 동시 등록 → 누락/drift 반복되는 문제는 해소되길 바란다." 본 ADR 은 6 registry 를 단일 등록 entry 의 파생 view 로 collapse 해 **"1 컴포넌트 = 1 등록"** 을 달성하고, drift 가 발생할 평행 위치를 구조적으로 0 으로 만든다(breakdown ②-5).

**1차 원리 기준선 (사용자 framing 2026-06-02)**: "참고내용이 또다시 결정에 이전 현재 구현 시스템을 답습하게 하는 것 아닌가" + "현재의 구현 방식을 따르지 않아도 된다 — 문제점을 다시 반복하게 될 수가 있다." 따라서 ADR-142 가 만든 현재 구현 자산(`buildCatalogShapes` 의 spec 읽는 seam / `resolveComponentVisual` 의 variant→VisualRule seam / variant·size 를 `binding.accepts` 에 둔 구조)은 **자동 재사용 대상이 아니라** "1차 원리(RAC core + Pencil format + canonical schema + theme/tokens)의 직접 구현인가 vs 전환기 seam 부채인가" 로 재판정한다(breakdown ②). 메모리 [[project-rac-pencil-redesign-converges-adr142]] 가 이 seam 들을 전환기 부채로 명시. 외부 리서치(`docs/explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md`)는 **schema 외부 검증**(openpencil `PenDocument` 의 RefNode/reusable/slot 1:1 정합 = 업계 표준)에만 인용하고, "ADR-142 구현이 맞다"는 구현-레벨 정합 주장은 인용하지 않는다.

사용자 결정(2026-06-02): "기존 방식 레거시로 남기거나 마이그레이션으로 코드를 늘이지 마라. 개발 단계라 얼마든 코드는 갈아엎어도 된다. 완성도가 최우선이다. ADR-912 로 새로 생성해라 — 현재의 구현 방식을 따르지 않아도 된다, 문제점을 다시 반복하게 될 수가 있다." → ADR-910 의 점진 cutover 전략(`cutover` 3-상태 / `skiaLegacy` / family atomic + legacy 격리)은 dual-SSOT 병치를 _유지_ 하는 방향이므로 사용자 지시와 충돌한다. 본 ADR 은 그 병치를 걷어내고 generic 단일 경로만 남긴다.

본 ADR 은 두 검증된 외부 자산을 1차 원리로 삼는다(ADR-910/911 동일).

- **Adobe React Aria Components(RAC) core 방법론** — data/render 분리 + 접근성 hooks + render-prop state + slot 합성. 시각은 100% CSS 토큰(`data-*`).
- **Pencil app/format 방법론** — canonical document = 노드 type + 보편 속성 집합(CSS 처럼, 값만 다름). 컴포넌트화는 데이터에 직접: `reusable:true`(origin) / `{type:"ref"}`(instance) / `descendants`(override) / `slot`(fill).

**외부 교차 검증** (`docs/explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md`, 2026-05-27): openpencil `PenDocument` 가 composition canonical schema 와 RefNode/reusable/slot **1:1 정합** — 3개 독립 외부 프로젝트(Pencil.app / openpencil / open-pencil) 공통 패턴(CanvasKit + flat node + RefNode + reusable+slot)이 업계 표준으로 수렴 중. 이는 대안 E 의 schema 방향(HC#5)의 외부 근거다. fallback 우회(openpencil Paper.js boolean ops)는 `feedback-no-fallback-thinking` 정합으로 **차용하지 않는다**.

**Components page 정합** (사용자 framing 2026-06-02 "현재 구현된 components page 가 reusable 의 요소를 놔두는 곳"): ADR-146 이 land 한 Components system page(`page-components`, Preview/Publish/export 제외)가 reusable origin 의 canonical SSOT 위치로 이미 실재한다. 본 ADR 은 이를 갈아엎지 않고 모든 조합 컴포넌트 origin 의 저장 위치로 확장한다.

### 3-domain 분류 (ADR-063 정합)

- **D1 DOM/접근성/상호작용**: RAC 가 절대 권위. composition 은 prop 투영(`toRacProps`)만, ARIA 수동 작성 0.
- **D2 Props/API**: leaf 는 `PrimitiveBinding.props.accepts`, 조합은 reusable 문서 `propsSchema`(같은 `PropContract`). variant 는 `node.props.variant`(의미값), 컴포넌트당 spec 파일 아님.
- **D3 시각/구조**: 시각 SSOT 는 theme rule(base) ⊕ `node.props.style`(override). 구조 SSOT 는 canonical 문서 트리. 컴포넌트당 `visual` 필드 없음.

### Hard Constraints (ADR-911 계승)

1. **단일 공급원 SSOT**: 한 노드의 편집 가능한 값은 그 노드 하나에서 나온다(의미값=`props`, override=`props.style`). 시각 base 는 theme rule 에서 resolve. Publishing/Preview/Properties Panel/Style Panel/Skia 가 같은 노드 + 같은 theme rule 을 공급원으로 삼는다. **단일 공급원 = 같은 generated source 파생** (출력 형태는 backend 별로 다름): DOM/Preview/Publish 는 `react-aria-{Type}` className + `data-variant`/`data-size`/`data-fill-style` + generated CSS(build-time, RAC 정통 방식) 로 base 시각 적용 / Skia 는 같은 theme rule 을 runtime resolve. 둘이 **같은 정본 table(②-6-A `componentRulesTable.ts`)에서 파생**하면 시각 대칭이 코드로 보장된다(ADR-063 D3: "대칭 = 시각 결과 동일성, 구현 방법 자유").
2. **패널 = 단일 공급원의 두 view**: 편집 진입점 `resolveEditContract(node)` 하나 — 의미 props 계약 ∪ 보편 시각 속성 계약. Properties/Style 은 `section` 필터 두 view. 저장 평면화 불요.
3. **base/override 2층 schema**: base 는 theme rule resolve(노드 미저장), override 는 `node.props.style` 에만. 병합 `props.style[k] ?? rule.resolve(k)`. base/override 는 노드 간(origin ↔ ref.descendants) 분리. reset=`delete props.style[k]`.
4. **Skia 성능**: 60fps 최저선. collection 반복은 Viewport Culling + Virtualization. CanvasKit Paragraph 정확 텍스트.
5. **조합 컴포넌트 = 데이터**: 코드 정의 파일 아니라 `reusable:true` 노드 문서(Components page body 에 저장). 신규 조합 추가 = 코드 변경 0.
6. **RAC 절대 권위 보존**: ARIA/키보드/포커스 RAC 100% 소유. `toRacProps` 투영만.
7. **Skia editor surface 는 projected 하위 노드 접근 가능**: collection 깊은 노드는 projected tree(`template subtree × visible data window`)로 hit-test·drill-in·edit-route. render-space projected id 와 canonical write target 분리.

### Soft Constraints

- 공통 기반(노드 resolve + generic DOM/Skia 렌더러 + 단일 Inspector field renderer + theme resolve)은 family-무관 단일 코드.
- **1차 원리 직결 자산만 토대로 유지** (현재 구현 시스템 아니라 원리 자체): `react-aria-components` / canonical schema(RefNode/reusable/slot/descendants) / theme/tokens / `resolveComponentRule` + `resolveToken` / `toRacProps`(D1 투영) / Components page reusable origin 위치(ADR-146) / ADR-135·136 projected 인프라. **전환기 seam 부채는 재설계** (`buildCatalogShapes` spec seam / `resolveComponentVisual` VisualRule seam / variant·size 의 accepts 혼입 / `cutover`·`skiaLegacy`) — 단순 재사용 금지(현재 구현 답습 회피, breakdown ②-1/②-2). 본 ADR 의 신규 코드 표면은 단일 어댑터 2 + 병합 코어 1 + 편집 계약 1 + state derive 1 + collection projector 1.
- **theme rule base 층 source = `componentRulesTable.ts` 직접 정본 승격** (사용자 방향 2026-06-02, 1A 진입 실측으로 ②-6-A 재채택): 현재 `COMPONENT_RULES_TABLE` 은 `generate-rules.ts` 가 124 spec 의 variants/sizes/fill 을 build-time 변환해 생성한다(`packages/specs/package.json` `build:specs` → `generate:rules`). spec 124 를 삭제하면 이 변환기의 입력이 사라져 base 층(HC#3 의 base)이 정의되지 않는다. **해법은 `componentRulesTable.ts` 자체를 손 편집 정본으로 승격**하는 것이다 — `generate-rules.ts` 가 1회 생성한 결과를 freeze(헤더 "AUTO-GENERATED"→정본 표시, build chain `pnpm generate:rules` step 제거) 하고 이후 그 파일을 직접 편집한다. **재채택 근거(실측)**: 직전 ②-6-D(starter→table 생성기)는 variant→token 매핑을 starter CSS + design structured source 에서 generate 한다고 전제했으나, 1A 진입 실측에서 그 매핑이 두 source 어디에도 없음이 드러났다 — starter `Button.css` 는 단색 버튼(variant 개념 없음)만, `design.md` 는 토큰 번역표(`--text-color`→`--fg`)만 담고, variant 별 fill/text/border TokenRef 는 현재 유일하게 `spec → generate-rules → table` 에만 존재한다. "149KB 손 저작 비현실적" 기각 사유는 _새로 쓰는 게 아니라 생성 결과 freeze 후 직접 편집_ 이므로 해소(저작 부담 0). `packages/design.md` + starter CSS 는 토큰 팔레트 audit 으로만 유지(variant→token 매핑 없음). DOM source swap 은 build script(`generate-css.ts`)가 같은 table 의 variant 색상을 주입(패키지 경계 `specs←shared` 상 `generateCSS` optional source 파라미터 경유 — "CSSGenerator 호출부 불변"은 ②-6-D 전제 문구로 ②-6-A 하에선 호출부 변경 불가피). `generate-rules.ts` 파일은 단계 5 에서 물리 삭제(이미 freeze 된 table 이 base 라 단절 0). `resolveComponentRule` 은 위치·시그니처 무변경(정본 테이블을 read). 상세 전환·대안은 breakdown ②-6.

## Alternatives Considered

> 본 ADR 의 대안 축은 "**현재 dual-SSOT 전환기를 어떤 전략으로 목표 구조(대안 E)에 도달하는가**" 다. 목표 구조 자체의 설계 선택(component-as-code / fat schema / contract 객체 / RAC 직접 / document 모델)은 ADR-910/911 에서 이미 대안 E 로 결정됐다.

### 대안 A: ADR-910 점진 cutover 유지 (legacy 격리 + family atomic)

- 설명: `cutover` 3-상태(legacy/cutting-over/catalog) + `skiaLegacy` 로 family 단위 점진 전환, 구 정본을 family 별로 격리하며 순차 제거.
- 근거: family 격리로 회귀 표면이 family 단위. 회복 가능(`cutover:"legacy"` 유지).
- 위험:
  - 기술: M — 검증된 ADR-142 경로.
  - 성능: M — 전환기 dual-pathway 유지.
  - 유지보수: **H** — 전환 기간 내내 신·구 두 정본 + 게이트 병치가 코드에 상존. `skiaLegacy` 한 컴포넌트 2-경로. 사용자 지시("레거시 남기지 마라")와 충돌, "문제 반복" 위험.
  - 마이그레이션: L — 점진이라 롤백 쉬움.

### 대안 B: 백지 직행 (레거시 미보존, 갈아엎기)

- 설명: 1차 원리(RAC core + Pencil format + canonical schema + theme/tokens)만 기준으로 두고, ADR-910 의 cutover 3-상태/`skiaLegacy`/family atomic + 구 정본(124 spec + 59 render.shapes active 호출 + 6 레지스트리 + buildSpecNodeData 30+ 분기)을 제거하며, ADR-142 전환기 seam 부채(`buildCatalogShapes` spec seam / `resolveComponentVisual` VisualRule seam / variant·size 의 accepts 혼입)도 1차 원리로 재설계해 generic 단일 경로만 남긴다. 6 registry 는 단일 등록 entry 의 파생 view 로 collapse("1 컴포넌트 = 1 등록").
- 근거: 사용자 결정(개발 단계, 완성도 최우선, 레거시 미보존, 현재 구현 답습 금지). dual-SSOT 병치 + 6중복 등록을 구조적으로 소멸. 1차 원리 직결 자산(`react-aria-components` / canonical schema / theme/tokens / Components page / ADR-135·136 projected 인프라)만 토대로 유지(현재 구현 시스템이 아니라 원리 자체).
- 위험:
  - 기술: **H** — generic 공통 기반(resolve + generic DOM/Skia + 단일 어댑터 + projected tree)이 family 격리 없이 전 컴포넌트 동시 영향. 단 Button vertical slice 로 목표 단계 증명 가능.
  - 성능: M — 정의 표면 최소(컴포넌트당 정의 부재). 단 collection projected tree 60fps 미증명.
  - 유지보수: **L** — 컴포넌트당 정의 파일 부재 + 게이트 병치 부재 → drift 할 평행 SSOT 가 구조적으로 0.
  - 마이그레이션: M — 개발 단계라 BC 부담 낮음(IndexedDB drop 가능). 단 롤백은 commit revert 단위.

### 대안 C: contract 객체 + 컴포넌트당 변환기 (재서술)

- 설명: 컴포넌트당 contract 객체 + 변환기를 새 스키마로 재설계.
- 근거: RAC 구조 표현 가능한 깨끗한 재설계.
- 위험:
  - 기술: M.
  - 성능: M.
  - 유지보수: **H** — canonical 문서와 평행한 두 번째 SSOT. ADR-910/911 에서 이미 기각된 대안 C.
  - 마이그레이션: M.

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :---: | :--: | :------: | :----------: | :--------: |
| A    |   M   |  M   |  **H**   |      L       |     1      |
| B    | **H** |  M   |    L     |      M       |     1      |
| C    |   M   |  M   |  **H**   |      M       |     1      |

루프 판정: 모든 대안 HIGH 1개. A/C 의 HIGH(유지보수)는 **구조에 내재한 영구 비용**(전환기 병치 상존 / 평행 SSOT) 인 반면, B 의 HIGH(기술)는 **공통 기반·projected tree 의 미증명 영역**으로 Gate(Button vertical slice + projected fixture)로 증명 가능한 1회성이다. 유지보수 HIGH 를 LOW 로 낮추는 유일 대안이 B 이며, B 의 기술 HIGH 는 증명 게이트로 관리 가능 + 사용자 결정(레거시 미보존)에 정합 → 추가 대안 없이 B 채택.

## Decision

**대안 B: 백지 직행(레거시 미보존, 갈아엎기)** 을 선택한다.

선택 근거(위험 수용):

1. **유지보수 LOW + dual-SSOT 소멸이 본질** — 현재 문제(신·구 두 정본 drift)의 원인은 ADR-142 가 신구조를 추가하고 구 정본을 제거하지 않은 병치다. 대안 B 만 이 병치를 구조적으로 소멸시킨다(컴포넌트당 정의 부재 + 게이트 병치 부재 → drift 할 평행 SSOT 0). 대안 A/C 의 유지보수 HIGH 는 이 문제를 영속화한다.
2. **기술 HIGH 의 증명 가능성** — 대안 B 의 기술 HIGH(generic 공통 기반·collection projected tree)는 Button vertical slice + projected fixture 로 증명 가능한 1회성이며, 구 정본 제거(단계 5)를 generic 발효 검증 후로 미루면 회귀 표면이 단계별로 닫힌다.
3. **사용자 결정 정합** — 개발 단계, 완성도 최우선, 레거시 미보존. 대안 A(점진 cutover, legacy 격리 유지)는 사용자 지시와 정면 충돌한다.

기각 사유:

- **대안 A 기각**: 점진 cutover 는 전환 기간 내내 dual-SSOT + 게이트를 코드에 상존시켜 사용자 지시("레거시 남기지 마라")와 충돌하고 "문제를 다시 반복"한다.
- **대안 C 기각**: 컴포넌트당 contract 객체는 canonical 문서와 평행한 두 번째 SSOT 다(ADR-910/911 기각 계승).

> 구현 상세: [912-rac-pencil-rebuild-cutover-breakdown.md](design/912-rac-pencil-rebuild-cutover-breakdown.md) — 진단 확정 / 갈아엎기 경계(제거·재사용·신규 3분류) / 영역 A(schema+어댑터) / 영역 B(projected tree) / 영역 C(편집계약+state) / HC 1:1 / 구현 순서. 실행 phase 분해 + sub-group 결정은 사용자 confirm 후(adr-writing.md fork checkpoint).

> **ADR-910/911 과의 관계**: 셋은 같은 대안 E·1차 원리라 목표 구조가 수렴한다. 차이는 전략·관점이다 — 910=점진 cutover(legacy 격리 유지), 911=목표 자체(전환 비참조), 912=백지 직행(레거시 미보존). 사용자 결정(옵션 B)으로 910/911 을 supersede 하지 않고 유지하며, 착수는 912 다. 910 은 점진 전략의 비교 기록, 911 은 목표 drift 판정 reference 로 남는다.

## Risks

> 본 섹션은 대안 B 이행 중 관리할 잔존 운영 위험이다. ID 는 breakdown 영역별 설계와 대응하며, ADR-911 R-1~R-4 를 계승한다(목표 구조 미증명 영역).

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                |  심각도  | 대응                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | generic 공통 기반(resolve + generic DOM/Skia + 단일 어댑터 + theme resolve) 1 버그가 family 격리 없이 전 컴포넌트 동시 회귀                                                                                                                                                                                                                                                                         | **HIGH** | Gate G-slice — Button vertical slice 로 공통 기반 증명. 구 정본 제거(단계 5)를 generic 발효 검증 후로 지연. 실패 시 공통 기반 재설계              |
| R-2 | base⊕override 병합이 DOM/Skia 동일 시각 결과를 내는지 미증명. 1A-(c) 실측: 분리 코어 `resolveMergedStyle` + 두 backend 어댑터 `toReactStyle`/`toSkiaStyle` 모두 **shared/catalog** 집중(의존 그래프 shared→specs 라 `toSkiaStyle` 만 `resolveToken`[specs] 추가 import). `buildCatalogShapes`(specs generic 생성기, KEEP)가 이미 산재 13키 ad-hoc 병합 중 → 이를 merged map 소비로 수렴해야 drift 0 | **HIGH** | Gate G-adapter — `/cross-check` 시각 대칭 + reset-to-default round-trip. 두 어댑터가 같은 `resolveMergedStyle` 코어 재사용(병합 로직 복제 0) 검증 |
| R-3 | collection Interactive Projected Tree 가 60fps + 깊은 노드 편집 동시 성립하는지 미증명 — projected id ↔ canonical write target 분리 정합                                                                                                                                                                                                                                                            | **HIGH** | Gate G-projected — 10k row draw/hit ≤ window+overscan + 깊은 노드 클릭/drill-in/edit route + projected id 의 canonical 비유입                     |
| R-4 | Skia 상태 모델(hover/pressed/selected)이 RAC data-attribute parity 로 derive 되는지 미증명                                                                                                                                                                                                                                                                                                          | **HIGH** | Gate G-state — selection fixture 가 Builder Skia ↔ Preview DOM 상태 시각 parity                                                                   |
| R-5 | **조합(composite) 컴포넌트** 를 Components page reusable 문서로 수작업 저작(자동 변환 금지, HC#5). leaf(RAC primitive ~39 binding)는 entry 1개라 해당 없음 — 저작 부담은 조합 컴포넌트(60 creator − leaf)에만. 갈아엎기라 family 격리 없이 일괄 저작 부담                                                                                                                                           |   MED    | Builder 안에서 조합 저작 후 Components page reusable 승격. 단계 5 에서 family 분할 저작                                                           |

잔존 HIGH 위험: R-1 / R-2 / R-3 / R-4 (4건). 모두 목표 구조 미증명 영역이며 각각 증명 Gate 와 1:1 대응한다. 대안 B 는 family 격리(ADR-910)를 포기하므로 R-1 의 전역 영향이 대안 A 보다 크나, Button vertical slice 우선 증명 + 구 정본 제거 지연으로 회귀 표면을 단계별로 닫는다.

## Gates

> 본 ADR 의 Gate 는 **착수 실행 게이트** 다 — 각 단계 land 의 통과 조건. ADR-911 의 proof gate(비실행)와 달리 실패 시 해당 단계 land 를 보류한다.

| Gate        | 시점                             | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 실패 시 대안                                                                              |
| ----------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| G-slice     | 공통 기반 (R-1)                  | Button 노드 `size="md"→"sm"` 편집 1회 → DOM / Skia / Properties Panel / Style Panel / Publish 5곳이 같은 노드 값(`fontSize:14`) + 같은 theme rule base(②-6-A `componentRulesTable.ts` 정본 단일 source 파생)를 즉시 동일 반영 + `/cross-check` 대칭 PASS. 단일 공급원(HC#1·#2) 코드 증명. **성공 조건 = legacy seam 실제 제거 + 같은 source**: Button 경로에서 `resolveComponentVisual` / `render.shapes()` / buildCatalogShapes·CSSGenerator 의 spec 읽기를 **제거하고도**, DOM generated CSS 와 Skia runtime rule 이 같은 generated source 에서 파생되어 5곳 작동. "신규 함수가 작동하지만 legacy seam(spec) 을 fallback 으로 유지" = **실패**(dual-SSOT 재현). **kill criteria**: 깨끗하게 안 나오면 → 전면 확장 금지, ③ 영역 A 설계 재보정. **1차 kill 시점 = 1A common spine 직후(7~10h)** — Button spine 이 지저분하거나 seam 호출 필요 시 1B(consumer wiring)/1C(검증) 진입 전 즉시 재보정(breakdown ⑦). 단계 1 전체 예상 20~28h(보수적 3일) | **kill: 전면 확장 중단 + ③ 공통 기반 설계 재보정** (1A 직후 1차 판단, 단계 2~5 진입 금지) |
| G-adapter   | base⊕override 어댑터 (R-2)       | DOM base = generated CSS + `data-*`(build-time), Skia base = 같은 theme rule runtime resolve — **둘이 같은 정본 table 파생**(②-6-A `componentRulesTable.ts`). `toReactStyle` 은 `props.style` override 전용(DOM 색/size base 는 generated CSS 가 담당, 인라인 색 주입 아님), `toSkiaStyle` 은 같은 rule base ⊕ override runtime 병합. `/cross-check` 시각 대칭 + reset-to-default(`delete props.style[k]` → base 복귀) round-trip. base/override 2층(HC#3) 증명. **성공 조건 = fallback 0 + 같은 source**: `applyInlineBorderOverlay` 류 사후 override 우회 / spec seam fallback 없이, DOM generated CSS 와 Skia runtime rule 이 같은 정본 table 에서 나온다. ("같은 inline object" 가 아니라 "같은 source 파생" 이 성공 기준). **kill criteria**: DOM generated CSS 와 Skia runtime rule 이 같은 source 로 시각 대칭이 안 나오면 → 어댑터/source 책임 분해 재설계                                                                                  | **kill: 전면 확장 중단 + 어댑터/source 책임 분해 재설계** (단계 2~5 진입 금지)            |
| G-state     | Skia 상태 모델 (R-4)             | selection fixture 가 Builder Skia hover/pressed/selected 상태 시각을 Preview DOM `data-*` parity 로 derive(`/cross-check` 상태 시각 대칭)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 상태 모델 재설계                                                                          |
| G-projected | Interactive Projected Tree (R-3) | Skia collection row 내부 Text/Icon 클릭 → deepest projected 노드 선택, 더블클릭 → drill-in/data edit, style edit → template route. 10k row draw/hit ≤ window+overscan(60fps). projected id 가 canonical mutation/IndexedDB 에 0건 유입. HC#4·#7 증명                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 깊은 노드 편집 미달 — 구조 재검토                                                         |

## Consequences

### Positive

- **"1 컴포넌트 = 1 등록" (사용자 1순위 목표 달성)** — 6 registry(Factory 60 / rendererMap 95 / DEFAULT_PROPS_MAP 96 / BASE_TAG_SPEC_MAP 111 / builder TAG_SPEC_MAP / Component Panel)가 단일 등록 entry 의 파생 view 로 collapse 된다. 새 컴포넌트 추가 = leaf entry 1개 또는 reusable 문서 1개. 6 소비처가 손 등록이 아니라 단일 source(`lookupEntry`/`resolveComponentRule`/`resolveEditContract`)에서 파생하므로 **등록 누락/drift 가 발생할 평행 위치가 구조적으로 0**. ADR-139 의 6중복 강제 동기화 게이트가 졸업(제거)된다.
- dual-SSOT 병치가 소멸한다 — 신·구 두 정본 + cutover 게이트가 코드에서 사라지고 단일 generic 경로만 남는다.
- 전환기 seam 부채도 1차 원리로 재설계된다 — `buildCatalogShapes` 의 spec seam·`resolveComponentVisual` VisualRule seam 제거, variant·size 가 accepts 가 아니라 의미 props 로 분리. 현재 구현 답습이 아니라 RAC+Pencil format 직접 구현.
- 정본이 단일 노드(의미값 + `props.style` override) + theme rule 로 통합된다. 조합 컴포넌트는 (이미 실재하는) Components page reusable 문서로 표현된다.
- Properties Panel·Style Panel·DOM·Skia·Publish 가 같은 노드 + 같은 theme rule 을 공급원으로 삼는다(`resolveEditContract` 합집합 view).
- 렌더 경로가 generic 렌더러 하나로 단일화 — `/cross-check` 가 컴포넌트마다가 아니라 렌더러·어댑터를 한 번 검증한다.
- collection 깊은 노드가 Skia editor 에서 직접 편집 가능(Interactive Projected Tree). `skiaLegacy` collection 2-경로가 소멸한다.
- canonical schema 가 외부 3 reference(openpencil 등)와 수렴 — RefNode/reusable/slot 업계 표준 패턴 정합(schema 외부 검증).

### Negative

- generic 공통 기반 버그는 family 격리가 안 된다(R-1) — 대안 A 대비 전역 영향이 크다. Button vertical slice 증명 + 구 정본 제거 지연으로 완화하나 부담 존재.
- **조합(composite) 컴포넌트** 를 Components page reusable 문서로 수작업 저작해야 한다(자동 변환 불가, R-5). leaf(RAC primitive ~39 binding)는 entry 1개로 등록되며 reusable 문서화 대상 아님 — 둘의 경계가 다르다(leaf=entry / 조합=reusable 문서).
- 단일 어댑터(`resolveMergedStyle`)가 무겁다(R-2) — text 측정/특수 shape/spacing/token 해소가 한 곳에 모인다.
- collection projected tree(R-3)와 Skia 상태 모델(R-4)이 가장 미증명된 영역.
- 컴포넌트당 `render.shapes()` Skia source 가 폐기 방향(theme rule 대체) — 단 ADR-907 Layer B/908 fill/909 longhand 는 보존(override layer 유지). ADR-036 status 재평가 필요.
- theme rule base 층의 정본이 spec(전환기 부채, `generate-rules` 경유)에서 `componentRulesTable.ts` 자체(손 편집 정본)로 바뀐다 — `generate-rules.ts` 가 1회 생성한 결과를 freeze 후 직접 편집. 생성기 신뢰성이라는 새 부담 없음(이미 생성된 결과 동결). `design.md` + starter CSS 는 토큰 팔레트 audit 으로만 유지(variant→token 매핑이 거기 없음 — 실측). DOM 경로는 build script(`generate-css`)가 같은 table 의 variant 색상을 주입해 Skia 와 same-source(1A 색상 채널 한정; size/구조 CSS 는 단계 5 까지 spec 이중 입력). spec dual-SSOT 소멸 + base 단일 source 가 이득. ADR-907/908/909 의 fill/spacing/longhand 구조는 정본 테이블의 필드로 직접 표현된다.
