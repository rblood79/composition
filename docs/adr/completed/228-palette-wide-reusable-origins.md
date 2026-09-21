# ADR-228: 팔레트 전 항목 reusable origin — Components 페이지 = origin 전집 + 테마 한 세트

## Status

Implemented — 2026-09-21 (Proposed 09-21 → [reviews/228.md](../reviews/228.md) round 1 HIGH 1 · MEDIUM 2 전부 fixed → round 2 pending 0 → 사용자 `/execute-adr 228` (09-21, 착수 = 승인) → Phase 0~~4 / G0~~G4 같은 날 종결. 구현 커밋: Phase 0·1 `25866715f` · Phase 2~4 (편집·렌더 대칭 · Components 페이지 grid · 비용) 후속 커밋)

설계 요청: 사용자 (2026-09-21) — "컴포넌트 패널의 컴포넌트들이 모두 Components 페이지에 origin 으로 존재해야 하고, 패널에서 선택해 쓰는 것은 instance 가 되어야 한다. IconButton 이 현재 그렇게 되어 있다. 그러면 theme 와 components 가 Components 페이지에서 한 세트가 된다." ADR-148 이 "전면 reusable entry 등록" 을 confirm 받았으나 (2026-07-07) Phase 1~4 는 5 항목 + collection item slot 에서 끝났다 — 이 ADR 은 그 "전면" 을 팔레트의 RAC 컴포넌트 전 항목으로 완결한다. 착수 전 결정 3 (새 ADR · RAC 컴포넌트만 · 기존 plain 노드 공존) 은 사용자 AskUserQuestion confirm (2026-09-21).

## Context

**SSOT 3-domain 관계**: **D3 의 조합 축** (ADR-142 "조합 = canonical reusable 문서" · ADR-912 HC#5 "조합 = 데이터") 의 적용 범위 확장. D1 (RAC DOM) 무관 — instance 는 origin 의 RAC primitive 를 그대로 실체화한다. D2 는 **읽기만** — origin 의 propsSchema 를 PropContract 에서 파생하되 kind/값은 바꾸지 않는다. canonical 타입 변경 0 — `type:"ref"` · origin · `metadata.propsSchema` 전부 148 의 모양.

### 문제

팔레트 66 항목 중 reusable origin 을 갖는 것은 5 (F1). 나머지 61 은 factory 가 plain 노드를 만들므로 (a) Components 페이지는 "일부 조합의 origin 보관소" 에 머물러 사용자가 "우리 프로젝트의 Button 은 이렇게 생겼다" 를 한 곳에서 정하고 볼 수 없고, (b) 테마 (ADR-227) 가 값을 바꿔도 그 결과를 컴포넌트 전집으로 확인할 표면이 없으며, (c) 같은 Button 을 두 번 놓으면 서로 무관한 노드 둘이라 한쪽을 고쳐도 다른 쪽이 안 따라온다. 148 의 메커니즘 (등록 · seed · ref 생성 · 편집 계약 · 두 leg 실체화) 은 전부 있고 (F2~~F7), 부족한 것은 **범위** 와 **seed 생산 방식** (손 모듈 136~~278 줄 × 57 은 불가) 이다.

### 코드 사실 (2026-09-21, main `81d96353f`)

요약 — 전문은 breakdown §2 (F1~F10, 경로:라인).

- 팔레트 66 · reusable 5 (`paletteItems.ts:186-288` · `componentCatalog.ts:1177-1210`). 추가 경로는 origin id 가 있으면 `type:"ref"` 만 만든다 (`useElementCreator.ts:242-263`).
- 등록 = `reusableEntry()` + 동명 primitive `placeable:false` (`componentCatalog.ts:62-76`). seed = 손 모듈 → `REUSABLE_ORIGIN_ENSURERS`, 불변식 테스트가 entry ↔ ensurer 강제 (`reusableCompositeOrigins.ts:40-50` · `componentRegistrationContract.test.ts:289`).
- 편집 = origin `metadata.propsSchema` → `resolveEditContract` · passthrough 축 존재 (`iconButtonTemplateOrigins.ts:16-34`). 렌더 = Skia/DOM 모두 `resolveCanonicalRefTree` (`canvasSceneNode.ts:1144`).
- Components 페이지 = `page-components` 시스템 페이지, runtime audience 제외 (`systemComponentsPage.ts` · `export.utils.ts:224-236`).

### Hard constraints

- **사용자 체감 무변화**: instance 를 선택했을 때 Properties/Styles 패널 필드 · 캔버스 편집 · drag · 복제 가 plain 노드와 같아야 한다 — "instance 인지 모르게". 신규 InspectorFieldKind 0.
- **두 leg 대칭**: ref instance 와 같은 props 의 plain 노드가 Skia · DOM 에서 픽셀 Δ 0 (ADR-198 하니스 instance arm).
- **BC**: 기존 문서의 plain 노드는 그대로 유효 (사용자 결정 ③) — migration 0, 문서 열면 origin 이 Components body 에 멱등 시드될 뿐. 롤백 = entry kind 원복 (origin 노드는 남아도 무해).
- **성능**: 600 요소 ref 100% 문서 scene build·선택·편집 p95가 ref 0% 대비 +1ms 이내. 문서 증가는 신규 origin root와 descendants·필요 shell·schema 보강의 실제 Δnode/Δbyte로 측정하고 재hydration 추가 증가는 0이어야 한다.
- **등록 단일성**: "1 컴포넌트 = 1 등록" (148 HC#2) — 손 seed 모듈을 57 개 만들지 않는다. `PALETTE_ORDER` 무변경.
- **D2 경계**: catalog binding 파일·PropContract kind/값 무변경. componentCatalog의 reusable/primitive 등록을 조정하면서 기존 panel 메타와 creationVariants를 보존한다.

### Soft constraints

- 내용/레이아웃 primitive 8 (Text · Icon · Separator · Skeleton · Image · frame · Section · Slot) 은 origin 화하지 않는다 (사용자 결정 ②, Figma 와 같다).
- 148 Phase 3 판정 (Toast 보류 · IllustratedMessage 부적격) 승계.
- ADR-227 과 직교 — 어느 쪽이 먼저여도 된다. 둘 다 있으면 Components 페이지가 "origin 전집 × 활성 테마" 표면.

## Alternatives Considered

### 대안 A: 손 seed 확장 — 기존 5종 외 대상별 모듈 추가

- 설명: 항목마다 `ensure*TemplateOrigins` 모듈 + `reusableEntry` 추가.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 현 집합 기준 신규 52종을 항목별 150~~280줄로 작성하면 약 7,800~~14,560줄의 seed가 늘어난다. factory 기본값과의 중복 및 계약 변경 추적 비용 발생) / 마이그레이션(L)

### 대안 B: catalog 파생 generic origin — leaf 는 노드 하나, 자식 구조형은 factory 기본 자식 이동

- 설명: buildCatalogOrigin은 기존 factory 기본값 합성(catalog + builder-local overlay)과 passthrough propsSchema를 사용한다. 자식 구조형은 기존 순수 factory definition의 root props/children을 재사용하고, 기존 5 특수 ensurer는 유지한다. 생성 initialProps는 origin에 굽지 않고 instance override로 기록한다.
- 근거: Figma 의 컴포넌트 = 노드 + 프로퍼티 정의; Framer 의 code component = 하나의 정의 + 인스턴스 props. composition 은 catalog 가 이미 "정의" 를 갖고 있어 origin 은 그 투영이면 된다 (ADR-912 HC#5 "조합 = 데이터" 의 leaf 판).
- 위험: 기술(**H** — ref 생성 시 creationVariants/initialProps 유실 → G1/G2) / 성능(**M** — 전 배치 ref 실체화 비용 → G4) / 유지보수(M — factory default/자식 구조 재사용 경계 → G0/G1) / 마이그레이션(L — plain 공존, 기존 origin 편집 보존)

### 대안 C: 팔레트 66 전부 + 기존 plain 노드 1회 migration

- 설명: Text/Image/frame 까지 origin, 로드 시 plain → ref 변환.
- 위험: 기술(M) / 성능(M) / 유지보수(M — 텍스트 한 줄도 instance) / 마이그레이션(**H** — 문서 100% · 자식 있는 노드의 역변환 규칙 · 롤백 불가에 가깝다)

### 대안 D: 현행 유지 + Components 페이지에 catalog 견본만 시드 (ADR-227 초안의 Decision 4)

- 설명: 등록은 5 그대로, 페이지에 leaf 견본 노드만 표시.
- 위험: 기술(L) / 성능(L) / 유지보수(**M** — 아무도 ref 하지 않는 "origin" 이 생겨 reusable 어법을 흐린다 · "고치면 따라온다" 가 없어 요구 (c) 미충족) / 마이그레이션(L)

### Risk Threshold Check

| 대안 | HIGH+          | 판정                                             |
| ---- | -------------- | ------------------------------------------------ |
| A    | 유지보수 H     | 기각 — seed 이중화                               |
| B    | 기술 H         | 채택 — G1/G2 생성·상속 계약 선통과, G4 비용 측정 |
| C    | 마이그레이션 H | 기각 — 사용자 결정 ②③ 과 상충                    |
| D    | 없음 (M 1)     | 기각 — 요구 미충족 (227 초안 철회)               |

루프 판정: D에 HIGH는 없지만 origin 편집 전파 요구를 충족하지 못한다. B의 기술 HIGH는 생성 입력 보존 및 실제 origin 상속 gate로 관리한다. 별도 ADR 분리는 등록→seed→생성 계약을 끊으므로 같은 범위 안에서 수리한다.

## Decision

**대안 B 채택.**

1. **Decision 1 — 범위**: 고유 palette type 66에서 내용/레이아웃 primitive 8 및 IllustratedMessage 1을 제외한 **57 type(E)**를 대상으로 한다. Toast는 원래 팔레트 밖이다. E→고유 origin R 및 creationVariants로 펼친 palette entry V는 Phase 0에서 확정하며, gate는 이 집합을 사용한다.
2. **Decision 2 — seed**: origin은 기존 factory의 catalog+builder-local 기본값 합성과 passthrough schema로 파생한다. 자식 구조형은 root props와 children definition 모두 재사용한다. 기존 동일 origin과 사용자 편집을 보존하며 손 seed 모듈을 항목별로 추가하지 않는다.
3. **Decision 3 — instance 계약**: type:ref로 배치하되 기존 creationVariants와 명시 initialProps를 보존하도록 생성 경로를 보강한다. instance에는 명시 생성 patch만 저장하고 공통 기본값은 origin을 상속한다. 실제 편집·렌더·drag·복제는 plain과 동등하게 검증하며 기존 plain은 공존한다.
4. **Decision 4 — 표면**: Components body에 origin 집합 R을 카테고리 순 grid로 배치한다. systemOwned root는 삭제 불가·이동 가능하며 기존 사용자/template origin도 보존한다. 페이지 전체 root/descendant 수를 57로 제한하지 않는다. ADR-227은 이 페이지를 테마 표면으로 읽는다.

위험 수용 근거: 생성값 소실 HIGH는 G1/G2의 V 전수 생성·persist·상속 검증으로, default drift는 G1 factory 동치로, 성능은 G4 총 frame 비용으로 관리한다. canonical 타입과 D2 의미를 유지한다. catalog entry를 되돌리면 신규 생성은 복귀하지만 이미 만든 ref의 origin과 resolve는 보존해야 한다.

기각 사유: **A** — seed 만 줄 단위로 catalog 와 이중화되어 PropContract 변경마다 57 곳 drift. **C** — 사용자 결정 ②③ 과 상충, 역변환 규칙이 HIGH. **D** — "고치면 따라온다" 가 없어 theme + components 가 한 세트가 되지 않는다; 227 초안의 Decision 4 는 이 ADR 이 대체한다.

> 구현 상세: [228-palette-wide-reusable-origins-breakdown.md](../design/228-palette-wide-reusable-origins-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                   | 심각도 | 대응                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------- |
| R1  | ref 생성이 Chart 종류별 initialProps/creationVariants를 버리거나 공통 기본값을 고정해 상속을 막음                                      |  HIGH  | **G1/G2** V 전수 생성·저장·reload·origin 공통 속성 변경·Undo/Redo, 명시 patch만 instance 소유                           |
| R2  | ref 100% 실체화 비용 — `resolveCanonicalRefTree` 가 모든 노드에 걸려 scene build · 선택 fanout 이 늘어난다 (`canvasSceneNode.ts:1144`) |  MED   | **G4** 600 요소 ref 0% vs 100% p95 +1 ms 이내 · 초과 시 leaf ref 의 resolve 캐시 (hash = origin rev)                    |
| R3  | 두 leg drift — ref 실체화 경로에서 leaf origin (자식 0) 이 Skia/DOM 한쪽에서만 다르게 처리 (메모리 divergence family)                  |  MED   | **G2** cross-check instance arm 픽셀 Δ 0                                                                                |
| R4  | PropContract default만으로 seed를 만들면 builder-local 텍스트/링크/자식 root props가 소실                                              |  MED   | 기존 factory 기본값·definition 재사용, **G1** 초기 유효 props/subtree 동치                                              |
| R5  | eligible type·palette entry·origin root·총노드 수 혼동으로 누락/중복 seed와 거짓 비용 gate                                             |  MED   | **G0** E/V/R 확정, **G1/G3** R 전수, **G4** 문서별 신규 root/descendant/byte 및 멱등 Δ0                                 |
| R6  | plain/instance 공존 혼란 — 같은 Button 인데 하나는 origin 을 따라오고 하나는 안 따라온다                                               |  MED   | 헤더 pill · Layers 에 instance 표식 (148 기존 `ref` 표시) · **G3** live 공존 시나리오 · 유보 §6 "instance 로 변환" 액션 |

잔존 HIGH R1은 G1/G2로 관리한다. 구현 gate는 아직 미측정이다.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                          | 실패 시 대안                      |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| G0   | Phase 0      | P/X/E/V/R 확정, factory/default/initialProps 소비자 및 파일 inventory, 600요소 ref 0% baseline, 예상 문서 Δnode/Δbyte                                              | 동일 ADR inventory 보강           |
| G1   | Phase 1      | V 전수 ref/명시 initialProps 일치, R 전수 origin 존재, factory 기본값/자식 동치, reload 멱등, 기존 plain/사용자 origin 보존, entry 원복 RED                        | 생성·seed 경로 수리               |
| G2   | Phase 2      | V 전수 ref/plain 필드·픽셀 대칭, Chart 모든 진입점 생성→저장→reload→origin 공통 속성 변경→Undo/Redo, 명시 chartType 유지·비override 상속, 실제 구조/편집/drag/복제 | 생성 patch·편집/resolve 경로 수리 |
| G3   | Phase 3 live | R 전수 표시·origin 변경 전파/Undo·plain 무변화·root 삭제 금지·기존 origin 사용자 편집/배치 보존                                                                    | 페이지/origin 보존 경로 수리      |
| G4   | Phase 4      | 600요소 ref 100% p95 ≤ baseline+1ms, 문서별 신규 root/descendants/schema/shell Δnode·Δbyte 대조, 재hydration Δ0, AI initialProps/상속                              | 비용 원인 분리·cache 후 재측정    |

측정 조건 (measurement-validity §1): Q1 600 요소 문서는 perf-baseline 합성 seed — **규모 전용**, 분포 지표 인용 금지 · Q2 불리 케이스 = ref 100% 문서에서 가시 집합이 바뀌는 스크롤 + 다중 선택 + 편집 (실체화가 매 프레임 걸리는 조작) · Q3 대조군 = 같은 세션 · 같은 seed 의 ref 0% arm (entry kind 원복) · Q4 소비 경로 = 팔레트 → `useElementCreator` → `type:"ref"` 를 live 로 (grep 아님) · Q5 oracle = ADR-198 하니스 (실 브라우저 픽셀 · Preview computed style) — dual-run 자기 확인 아님. 기록 항목: visibilityState visible · headed · 1440×900 · 처녀 힙 · DPR.

### Gate 결과 (2026-09-21, main `25866715f` + Phase 2~4 working tree · 1440×900 · 120 Hz · DPR 1 · visible · headed Chrome)

| Gate | 결과                           | 근거 (local `docs/adr/evidence/228-palette-wide-reusable-origins/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | PASS                           | breakdown §8 — P 66 · X 9 · E 57 = 손 seed 5 + catalog 파생 52 · V 63 (Chart 7) · R 57 (신규 root 50 + template 재사용 2) · 600 요소 ref 0% baseline (`g0-buttons-ref0.log`) · 예상 Δnode 185 (`catalogOrigins.test.ts` G0 집합 검사 6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| G1   | PASS                           | `catalogOrigins.test.ts` 16 — R 전수 시드 · reusableId 규약 · complex 39 subtree = `createElementsFromDefinition` 결과 (type 순서·props, UUID 정규화) · leaf 11 = 팔레트 합성 (로드 migration 뒤) · 재hydration 직렬화 Δ0 · 사용자 편집 보존 · entry 원복 RED. live G1-a/b/c 12/12 (아래)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| G2   | PASS                           | `adr228-instance-parity-live.mjs` **57/57 (round 3)** — V manifest 56 pair: generic 50 에서 Chart 를 팔레트 진입점 7 (chartType 별 initialProps patch) 로 펼침. type 마다 ref instance ↔ origin subtree 복제 plain 을 **한 arm 씩 같은 자리**에 두고: Skia layout rect 열 (root + 자손 DFS) 동일 · **Skia 캔버스 실픽셀 pixelmatch diff 0** (상단 100px 크롬 제외) · Preview DOM 스크린샷 pixelmatch **diff 0** + computed style digest 동일 (51 pair) · overlay/trigger 전용 5 (Menu · FileTrigger · Modal · Popover · Tooltip) 는 두 arm 모두 DOM 미출력 → Skia rect + 픽셀 두 leg (`round3-instance-parity-findings.json`; round 2 의 51/51 은 `g2-instance-parity-findings.json`). 편집·전파·복제·Undo/Redo 는 live G2-a~e 9/9, **Chart 7 진입점 생성 → origin 변경 → 7 instance 전파 · chartType 보존 → Undo/Redo → persist → reload** 는 live m4 11/11. 손 seed 5 는 ADR-148 template binding origin (plain 대응 없음) — 이 하니스 밖                                                                                                                                                                                                                                                   |
| G3   | PASS                           | live G3-a/b 3/3 — systemOwned origin root `removeElement` 거부 · origin 편집 IndexedDB persist · reload 후 origin 편집 · body 순서 · 요소 수 Δ0 · instance override 보존. **round 3 h2**: 사용자가 Components body 의 origin 순서를 바꿔도 (`moveElementToSiblingEdge`) 재hydration 이 되돌리지 않는다 — `ensureTemplateOrigins` 제자리 보정 (`catalogOrigins.test.ts` +1 원복 RED · live h2 2/2). Components body grid 흐름 (`systemComponentsPage.test.ts` 2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| G4   | PASS (scene.build · zoom 유보) | **round 2 (119 Hz)**: headed 3회 평균 p95 (ref 0% → 100%) select 24.9 → 25.2 (+0.3) · edit 10.43 → 10.57 (+0.1) · page-switch 20.7 → 20.8 (+0.1) ≤ +1 ms (`g4b-*`). zoom 32.5 → 37.0 (+4.5) 유보. **round 3 (같은 날 50 Hz 세션 · Q2 불리 조건 · `scene.build` 직접 계측 · `g4e-*` 3회 평균 p95)**: pan (가시 집합 변경 스크롤) gap +0.4 · render.frame 0 / select gap +1.1 (20 ms 양자화) / edit gap +1.9 · **scene.build 3.43 → 3.97 (+0.5)** · render.frame +0.6 / **multi-select-edit** (20개 선택 유지 + 편집) gap +16.2 · **scene.build 4.0 → 5.2 (+1.2)** · render.frame +0.6 / page-switch gap −6.9 / zoom gap +2.3 · render.frame 0. 패널 (Navigator·Properties) 을 닫은 대조 (`g4g-*`) 에서 multi-select-edit gap −2.7 · scene.build +2.5 — **+16 은 DOM 패널이 선택 instance 20개를 그리는 비용, 캔버스 축 (render.frame · record.content) 은 전 class ≤ +0.7**. scene.build 만 +0.5~+2.5 로 「+1 ms」 를 다중 선택 편집에서 넘는다 → 유보 (§Consequences). Skia bridge 의 master 선형 탐색 (프로파일 1.9%) 은 map 조회로 수리. Δnode 185 · Δbyte 37,952 (`catalogOrigins.test.ts` G4) · 재hydration Δ0 · AI initialProps 패치 `useElementCreator.reusableInstanceProps.test.ts` 5 |

### Live Exercise

- **2026-09-21 · headed Playwright (`apps/builder/scripts/adr228-reusable-origins-live.mjs`) · 실제 빌더 (dev 5173 · 격리 새 프로젝트 · 실입력 팔레트 클릭 · 패널 입력 · ⌘D · Compare Mode Preview iframe) · 24/24 · page error 0 · native dialog 0** — 사용자 참관 없음 (Chrome MCP 탭이 `visibilityState: hidden` 이라 부트 95% 정지 — 메모리 `reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`; 같은 탭에서 store/IndexedDB 판독만 병행). 기록 `g1-g3-live-findings.json`.
  - G1-a Components body 에 root 61 (R 57 + item template 4) · elements 236. G1-b 팔레트 「Button/Text Field/Select/Badge/Table」 → `type:"ref"` · `ref: component-<type>` · `props {}` · 사용자 페이지. 「bar chart」 → `{chartType:"bar", showGrid:true}` (origin 과 다른 키 + chartType). G1-c Preview DOM 에 Button/TextField/Select 실체화 (`react-aria-Button` 68×30 · TextField 1920×56 · Select) · Skia rect 69×30.
  - G2-a Button instance 선택 → Properties 에 Variant (Primary/Accent/…) · Size · Fill Style (primitive accepts) · Content › Text 입력 "Buy now" → instance props `{children:"Buy now"}` 하나 · Preview 반영. G2-b origin `variant: accent` (EditingSemantics 영향 대화상자 「Continue」) → Preview `data-variant="accent"` · "Buy now" 유지 · 복귀. G2-c ⌘D → 두 번째 instance (props 동일) · Undo 1 · Redo 2. G2-d 같은 props 의 plain Button — Skia 81×30 = 81×30 · Preview 80×30 = 80×30 · variant 동일. G2-e Chart origin `style.width` 320→480 → instance Skia 480 · instance props 는 `{chartType:"bar", showGrid:true}` 그대로 · Undo 320 · Redo 480.
  - G3-a `removeElement("component-badge")` → 요소 수 244 → 244 · 존재. G3-b origin `children:"Edited origin"` → `document_parts` `node:component-badge` persist → reload → 편집 보존 · body 순서 동일 · 244 · Button instance `{children:"Buy now"}` 보존.
- **2026-09-21 · headed Playwright (`apps/builder/scripts/adr228-instance-parity-live.mjs`) · 51/51** — 위 G2 행. 하니스 함정: Compare Mode 의 CSS pane 위에 헤더 (48px) · rail 이 떠 있어 stage 컨테이너 (paddingTop 140 · paddingLeft 100) 로 피하고, 두 arm 을 같은 자리에서 찍기 위해 다른 arm 을 iframe DOM 에서 `visibility:hidden; position:absolute` (display:none 은 Recharts 가 remount 로 보고 애니메이션을 다시 돈다) · 연속 두 캡처가 동일할 때까지 settle · plain arm 은 legacy view 의 origin 필드 (`componentRole:"master"`) 를 옮기지 않는다.
- **2026-09-21 round 3 (codex 완료 검증 HIGH 2 · MEDIUM 3 → `docs/adr/reviews/228.md` §Round 3 수리 검증) · headed Playwright · origins live 38/38 · parity 57/57 · page error 0** (`round3-origins-live-findings.json` · `round3-instance-parity-findings.json`).
  - h1 Button instance 를 **선택한 채** 팔레트 Button 클릭 → 둘째 instance 의 parent = body (Button 안 Button 0). h2 `component-badge` 를 body 맨 뒤로 → IndexedDB 마지막 child → reload → 순서 동일. m4 Chart 7 진입점 (area/bar/line/pie/radar/radial/scatter) 생성 → origin `style.width` 320→440 → 7 instance 440 · chartType 7 보존 → Undo 7×320 · Redo 7×440 → persist → reload 후 chartType 7 보존. parity 56 pair 는 위 G2 행.
- **live 가 드러낸 결함 3 (수리 포함)**: ① Chart instance 의 `chartType` 이 첫 origin 편집/Undo 뒤 사라짐 — canonical 이 ref override 를 master 와 diff 해 같은 값을 지운다 (`diffRefPropsAgainstMaster`) → `chartType` 명시 보존 (`canonicalMutations.test.ts` 신규 1). ② Breadcrumbs instance 가 Skia 폭 0 — scene 층 projection gate 가 raw instance props (`{}`) 를 읽어 `items` 0 → scene node 에 origin props merge (`canvasSceneNode.test.ts` 신규 2, 원복 RED). ③ page-switch p95 +4.1 ms — `resolveCanonicalRefTree` 가 instance 마다 노드 전체를 선형 탐색 (O(n²)) → id map 조회 + origin memo (G4 재측정 +0.1).

## Consequences

### Positive

- Components 페이지가 "이 프로젝트의 컴포넌트 전집" 이 된다 — origin 을 고치면 instance 가 따라오고, 테마 (227) 를 바꾸면 전집이 같이 바뀐다. theme + components 한 세트.
- 등록·seed·편집·렌더는 148 기반을 확장하고 factory 기본값 합성과 정의를 재사용한다. PropContract 변경은 schema repair를 통해 기존 origin에도 반영한다.
- 팔레트·AI·초기 문서는 같은 ensurer, 명시 생성 입력이 있는 경로는 같은 initialProps patch 계약을 사용한다.

### Negative

- 새 배치는 전부 ref — scene 실체화 한 단계가 모든 노드에 붙는다 (G4 로 상한). **잔여 (유보, LOW)**: 600 instance 문서의 zoom p95 가 +4.5 ms (32.5 → 37.0, headed 3회). 프로파일은 두 arm 이 같은 모양이고 `skiaNodeContentEquals` (resolved instance 는 매 resolve 마다 새 객체라 identity 빠른 길이 안 걸린다) 만 3.1% vs 2.1% — 가설 = resolved 노드 memo (origin rev × instance props identity). production 재현 시나리오 (사용자 체감) 는 없다 — 재개 조건: 실문서 zoom 체감 저하.
- **잔여 (유보, LOW — round 3)**: (a) `scene.build` (canonical → scene model, ref 실체화 포함) 가 600 instance 문서에서 +0.5 (편집) ~ +2.5 (다중 선택 편집 · 패널 닫음) ms — instance 당 merge 3회 (scene 층 ADR-228 merge · `resolveCanonicalRefTree` · Skia bridge). 수리 후보 = 세 merge 를 한 지점으로 · resolved instance identity 캐시 (zoom 유보와 같은 가설). 사용자 체감 프레임 (render.frame) 은 ≤ +0.7. (b) Navigator·Properties 가 열린 채 instance 20개를 선택하고 편집하면 callback gap +16 ms (160 ms 의 React dev 편집 longtask 위) — DOM 패널이 선택 instance 를 그리는 비용, 캔버스 밖.
- **명시 initialProps 계약의 정확한 문구 (round 3 m3, LOW deferred)**: instance 가 소유하는 명시 patch = 호출자 initialProps 중 **origin 유효값과 다른 키** (+ `chartType` 은 항상). origin 과 같은 값은 미override 와 구별되지 않고 origin 편집을 따라간다 — canonical ref 소유권 모델 (ADR-148 `diffRefPropsAgainstMaster`, Properties 편집이 병합 props 를 싣는다) 의 결과. "같은 값이라도 명시면 소유" 가 필요하면 ref 노드에 명시 키 집합을 두는 스키마 확장 (별도 ADR).
- plain/instance 공존 기간의 혼란 (R6) — 표식과 유보 액션으로 관리.
- catalog 등록 sweep 외에도 creationVariants/initialProps 보존과 factory definition 재사용이 필요하다. 기존 5종을 제외한 신규 reusable 등록은 현재 집합 기준 52종이며 신규 origin root 수는 문서별로 다르다.

## References

- [ADR-148](148-reusable-slot-system-unification.md) — base: 등록 단일화 · propsSchema · slot · IconButton 수직 슬라이스
- [ADR-142](142-starter-spec-component-system-cutover.md) · [ADR-912](912-rac-pencil-rebuild-cutover.md) — 조합 = canonical reusable 문서 / 조합 = 데이터 (HC#5)
- [ADR-227](../227-multi-theme-token-set-collection.md) — 직교 · Components 페이지를 테마 표면으로 읽는다
- [ADR-198](198-d3-renderer-pixel-parity-gate.md) — G2 instance arm
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) §1 D3 · D2 읽기 전용
- 외부: Figma components (main component + instance overrides) · Framer code components (definition + instance props)

## 리뷰 보완 (2026-09-21)

[round 1 리뷰](../reviews/228.md)의 H1/M2/M3를 반영했다 (설계 수리 → round 2 pending 0). 구현 결과 G0~~G4 는 위 Gate 결과 표 · breakdown §8~~§9.
