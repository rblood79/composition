# ADR-228: 팔레트 전 항목 reusable origin — Components 페이지 = origin 전집 + 테마 한 세트

## Status

Proposed — 2026-09-21

설계 요청: 사용자 (2026-09-21) — "컴포넌트 패널의 컴포넌트들이 모두 Components 페이지에 origin 으로 존재해야 하고, 패널에서 선택해 쓰는 것은 instance 가 되어야 한다. IconButton 이 현재 그렇게 되어 있다. 그러면 theme 와 components 가 Components 페이지에서 한 세트가 된다." ADR-148 이 "전면 reusable entry 등록" 을 confirm 받았으나 (2026-07-07) Phase 1~4 는 5 항목 + collection item slot 에서 끝났다 — 이 ADR 은 그 "전면" 을 팔레트의 RAC 컴포넌트 전 항목으로 완결한다. 착수 전 결정 3 (새 ADR · RAC 컴포넌트만 · 기존 plain 노드 공존) 은 사용자 AskUserQuestion confirm (2026-09-21).

## Context

**SSOT 3-domain 관계**: **D3 의 조합 축** (ADR-142 "조합 = canonical reusable 문서" · ADR-912 HC#5 "조합 = 데이터") 의 적용 범위 확장. D1 (RAC DOM) 무관 — instance 는 origin 의 RAC primitive 를 그대로 실체화한다. D2 는 **읽기만** — origin 의 propsSchema 를 PropContract 에서 파생하되 kind/값은 바꾸지 않는다. canonical 타입 변경 0 — `type:"ref"` · origin · `metadata.propsSchema` 전부 148 의 모양.

### 문제

팔레트 66 항목 중 reusable origin 을 갖는 것은 5 (F1). 나머지 61 은 factory 가 plain 노드를 만들므로 (a) Components 페이지는 "일부 조합의 origin 보관소" 에 머물러 사용자가 "우리 프로젝트의 Button 은 이렇게 생겼다" 를 한 곳에서 정하고 볼 수 없고, (b) 테마 (ADR-227) 가 값을 바꿔도 그 결과를 컴포넌트 전집으로 확인할 표면이 없으며, (c) 같은 Button 을 두 번 놓으면 서로 무관한 노드 둘이라 한쪽을 고쳐도 다른 쪽이 안 따라온다. 148 의 메커니즘 (등록 · seed · ref 생성 · 편집 계약 · 두 leg 실체화) 은 전부 있고 (F2~~F7), 부족한 것은 **범위** 와 **seed 생산 방식** (손 모듈 136~~278 줄 × 58 은 불가) 이다.

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
- **성능**: 모든 새 배치가 ref 가 되므로 600 요소 ref 100% 문서에서 scene build · 선택 · 편집 p95 가 ref 0% 대비 +1 ms 이내 (perf-baseline frame lane). 문서 크기 증가 = origin 58 노드.
- **등록 단일성**: "1 컴포넌트 = 1 등록" (148 HC#2) — 손 seed 모듈을 58 개 만들지 않는다. `PALETTE_ORDER` 무변경.
- **D2 경계**: catalog binding 파일 · PropContract kind/값 무변경. 바뀌는 catalog 파일은 `componentCatalog.ts` 의 entry `kind`/`placeable` 뿐.

### Soft constraints

- 내용/레이아웃 primitive 8 (Text · Icon · Separator · Skeleton · Image · frame · Section · Slot) 은 origin 화하지 않는다 (사용자 결정 ②, Figma 와 같다).
- 148 Phase 3 판정 (Toast 보류 · IllustratedMessage 부적격) 승계.
- ADR-227 과 직교 — 어느 쪽이 먼저여도 된다. 둘 다 있으면 Components 페이지가 "origin 전집 × 활성 테마" 표면.

## Alternatives Considered

### 대안 A: 손 seed 확장 — 148 방식 그대로 58 모듈

- 설명: 항목마다 `ensure*TemplateOrigins` 모듈 + `reusableEntry` 추가.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 58 × 150~280 줄 = 만 줄 안팎의 seed 코드가 catalog 기본값과 이중화 (drift 가족), PropContract 가 바뀌면 58 곳 수정) / 마이그레이션(L)

### 대안 B: catalog 파생 generic origin — leaf 는 노드 하나, 자식 구조형은 factory 기본 자식 이동

- 설명: `buildCatalogOrigin(entry)` 가 PropContract 기본값 + passthrough propsSchema 로 origin 을 만든다. 손 seed 는 기존 5 + 자식 구조형 (factory `createDefaultChildren` 을 seed 가 재사용) 만. ENSURERS 는 "손 seed 있으면 그것, 없으면 파생" 한 함수로.
- 근거: Figma 의 컴포넌트 = 노드 + 프로퍼티 정의; Framer 의 code component = 하나의 정의 + 인스턴스 props. composition 은 catalog 가 이미 "정의" 를 갖고 있어 origin 은 그 투영이면 된다 (ADR-912 HC#5 "조합 = 데이터" 의 leaf 판).
- 위험: 기술(**M** — passthrough 전체 schema 를 `resolveEditContract` 가 plain 노드와 같은 필드 목록으로 내야 한다 (F6 축 일반화) → G2) / 성능(**M** — 전 배치 ref 화의 실체화 비용 미측정 → G4) / 유지보수(L — seed 는 catalog 를 따라간다) / 마이그레이션(L — plain 공존)

### 대안 C: 팔레트 66 전부 + 기존 plain 노드 1회 migration

- 설명: Text/Image/frame 까지 origin, 로드 시 plain → ref 변환.
- 위험: 기술(M) / 성능(M) / 유지보수(M — 텍스트 한 줄도 instance) / 마이그레이션(**H** — 문서 100% · 자식 있는 노드의 역변환 규칙 · 롤백 불가에 가깝다)

### 대안 D: 현행 유지 + Components 페이지에 catalog 견본만 시드 (ADR-227 초안의 Decision 4)

- 설명: 등록은 5 그대로, 페이지에 leaf 견본 노드만 표시.
- 위험: 기술(L) / 성능(L) / 유지보수(**M** — 아무도 ref 하지 않는 "origin" 이 생겨 reusable 어법을 흐린다 · "고치면 따라온다" 가 없어 요구 (c) 미충족) / 마이그레이션(L)

### Risk Threshold Check

| 대안 | HIGH+          | 판정                               |
| ---- | -------------- | ---------------------------------- |
| A    | 유지보수 H     | 기각 — seed 이중화                 |
| B    | 없음 (M 2)     | **채택** — G2 · G4 로 관리         |
| C    | 마이그레이션 H | 기각 — 사용자 결정 ②③ 과 상충      |
| D    | 없음 (M 1)     | 기각 — 요구 미충족 (227 초안 철회) |

루프 판정: 채택 대안 HIGH 0 → 추가 루프 불필요.

## Decision

**대안 B 채택.**

1. **Decision 1 — 범위**: 팔레트 66 중 RAC 컴포넌트 58 (Phase 0 에서 binding 유무로 확정) 을 `kind:"reusable"` 로 등록, 동명 primitive 는 `placeable:false` 공존. 내용/레이아웃 primitive 8 제외. Toast 보류 · IllustratedMessage 제외 (148 승계).
2. **Decision 2 — seed**: origin 은 catalog 에서 파생 (`buildCatalogOrigin`) — leaf 는 노드 하나 (PropContract 기본값 + 전 prop passthrough propsSchema), 자식 구조형은 factory 기본 자식을 origin 으로 이동. 손 seed 모듈 신규 0. `REUSABLE_ORIGIN_ENSURERS` 는 "손 seed ∪ 파생" 한 함수.
3. **Decision 3 — instance 계약**: 팔레트 추가 = `type:"ref"` (148 경로 그대로). 편집 · 렌더 · 패널은 plain 노드와 동일하게 보인다. 기존 plain 노드는 공존 (migration 0).
4. **Decision 4 — 표면**: Components 페이지 body 에 origin 58 을 카테고리 순 grid 로 배치 (systemOwned · 삭제 불가 · 이동 가능). origin 편집 → instance 전파 (148). ADR-227 의 테마 표면은 이 페이지다 — 227 Decision 4 는 별도 섹션을 만들지 않고 이 결과를 읽는다.

위험 수용 근거: 잔존 M 2 는 "plain 과 같은 필드 목록" (G2, 정적 대조 가능) 과 "ref 100% 프레임" (G4, perf-baseline 으로 수치 대조) 으로 닫힌다. canonical 타입 · PropContract · PALETTE_ORDER 무변경이라 롤백은 catalog entry kind 원복 하나.

기각 사유: **A** — seed 만 줄 단위로 catalog 와 이중화되어 PropContract 변경마다 58 곳 drift. **C** — 사용자 결정 ②③ 과 상충, 역변환 규칙이 HIGH. **D** — "고치면 따라온다" 가 없어 theme + components 가 한 세트가 되지 않는다; 227 초안의 Decision 4 는 이 ADR 이 대체한다.

> 구현 상세: [228-palette-wide-reusable-origins-breakdown.md](design/228-palette-wide-reusable-origins-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                       | 심각도 | 대응                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------- |
| R1  | 편집 계약 이탈 — passthrough 전체 schema 가 plain 노드의 Properties/Styles 필드 목록과 다르게 나온다 (`resolveEditContract.ts:320` · `inspectorFields.ts`) |  MED   | **G2** 팔레트 전수 필드 목록 정적 대조 (plain vs instance) · 차이 0                                                     |
| R2  | ref 100% 실체화 비용 — `resolveCanonicalRefTree` 가 모든 노드에 걸려 scene build · 선택 fanout 이 늘어난다 (`canvasSceneNode.ts:1144`)                     |  MED   | **G4** 600 요소 ref 0% vs 100% p95 +1 ms 이내 · 초과 시 leaf ref 의 resolve 캐시 (hash = origin rev)                    |
| R3  | 두 leg drift — ref 실체화 경로에서 leaf origin (자식 0) 이 Skia/DOM 한쪽에서만 다르게 처리 (메모리 divergence family)                                      |  MED   | **G2** cross-check instance arm 픽셀 Δ 0                                                                                |
| R4  | 등록 sweep 이 `componentCatalog.ts` 58 entry 를 건드린다 — D2 경계 착시 (task-state 중단 기준 "catalog binding 파일 일괄 수정")                            |  LOW   | 변경은 entry `kind`/`placeable` 만 · binding 파일 0 · Phase 1 diff 로 실증                                              |
| R5  | origin 시드가 기존 문서 열 때마다 Components body 에 58 노드를 넣는다 — hydration 비용 · 문서 크기                                                         |  LOW   | 멱등 (있으면 skip) · **G4** 문서 크기 Δ = origin 노드만                                                                 |
| R6  | plain/instance 공존 혼란 — 같은 Button 인데 하나는 origin 을 따라오고 하나는 안 따라온다                                                                   |  MED   | 헤더 pill · Layers 에 instance 표식 (148 기존 `ref` 표시) · **G3** live 공존 시나리오 · 유보 §6 "instance 로 변환" 액션 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                  | 실패 시 대안                                         |
| ---- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| G0   | Phase 0      | F1~F10 재실측 · 58 항목 3 군 분류표 · ref 0% baseline (600 요소) · 파일 20 대비 1.5× 이내                                                                                  | inventory 보강 (M3)                                  |
| G1   | Phase 1      | 팔레트 58 추가 → 전부 `type:"ref"` · origin 58 이 Components body 에 1개씩 · 새로고침 유지 · 기존 fixture plain 노드 무변화 · 원복 RED (entry 1 primitive 로 → plain 생성) | 군별 sweep 축소 (leaf 먼저)                          |
| G2   | Phase 2      | 팔레트 전수 — instance vs plain: Properties/Styles 필드 목록 정적 차이 0 · Skia/DOM 픽셀 Δ 0 (198 하니스 instance arm)                                                     | 차이 나는 항목은 primitive 유지로 되돌리고 원인 기록 |
| G3   | Phase 3 live | Components 페이지 origin 58 표시 · origin variant 변경 → 그 type 의 instance 전부 반영 · Undo · plain 노드는 무변화 · origin 삭제 불가                                     | 페이지 배치를 pagePositions 기반으로 되돌림          |
| G4   | Phase 4      | 600 요소 ref 100% 문서 scene build · 선택 · 편집 p95 ≤ baseline +1 ms · 문서 크기 Δ = origin 노드 · AI/초기 문서 경로가 같은 ensurer                                       | leaf ref resolve 캐시 도입 후 재측정                 |

측정 조건 (measurement-validity §1): Q1 600 요소 문서는 perf-baseline 합성 seed — **규모 전용**, 분포 지표 인용 금지 · Q2 불리 케이스 = ref 100% 문서에서 가시 집합이 바뀌는 스크롤 + 다중 선택 + 편집 (실체화가 매 프레임 걸리는 조작) · Q3 대조군 = 같은 세션 · 같은 seed 의 ref 0% arm (entry kind 원복) · Q4 소비 경로 = 팔레트 → `useElementCreator` → `type:"ref"` 를 live 로 (grep 아님) · Q5 oracle = ADR-198 하니스 (실 브라우저 픽셀 · Preview computed style) — dual-run 자기 확인 아님. 기록 항목: visibilityState visible · headed · 1440×900 · 처녀 힙 · DPR.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- Components 페이지가 "이 프로젝트의 컴포넌트 전집" 이 된다 — origin 을 고치면 instance 가 따라오고, 테마 (227) 를 바꾸면 전집이 같이 바뀐다. theme + components 한 세트.
- 등록 · seed · 편집 · 렌더가 전부 148 경로라 새 메커니즘 0 — 손 seed 대신 catalog 파생이라 PropContract 변경이 자동 반영.
- 팔레트 · AI · 초기 문서가 같은 ensurer 를 쓴다.

### Negative

- 새 배치는 전부 ref — scene 실체화 한 단계가 모든 노드에 붙는다 (G4 로 상한).
- plain/instance 공존 기간의 혼란 (R6) — 표식과 유보 액션으로 관리.
- `componentCatalog.ts` entry 58 diff (kind/placeable) — 한 커밋으로 묶는다.

## References

- [ADR-148](completed/148-reusable-slot-system-unification.md) — base: 등록 단일화 · propsSchema · slot · IconButton 수직 슬라이스
- [ADR-142](completed/142-starter-spec-component-system-cutover.md) · [ADR-912](completed/912-rac-pencil-rebuild-cutover.md) — 조합 = canonical reusable 문서 / 조합 = 데이터 (HC#5)
- [ADR-227](227-multi-theme-token-set-collection.md) — 직교 · Components 페이지를 테마 표면으로 읽는다
- [ADR-198](completed/198-d3-renderer-pixel-parity-gate.md) — G2 instance arm
- [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md) §1 D3 · D2 읽기 전용
- 외부: Figma components (main component + instance overrides) · Framer code components (definition + instance props)
