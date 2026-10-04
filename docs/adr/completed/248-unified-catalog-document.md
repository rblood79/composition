# ADR-248: 통합 catalog 문서 모델과 canonical·잔존 spec 제거

## Status

Implemented — 2026-10-05 (최종 기술 검증 완료 및 사용자 커밋·push 지시). Accepted: 2026-09-28.

사용자 요청: catalog에 정의와 프로젝트 모델을 통합하여 canonical을 제거한다. **기존 사용처와 보존할 프로젝트가 없는 개발 단계**라는 사용자 확인을 전제로 한다. 구 데이터 migration·하위 호환 adapter·dual-write는 범위에서 제외한다. 2026-09-28 구현 착수 지시로 Accepted 승격했으며 최종 제품 gate는 2026-10-05 종결했다.

> **리뷰 round 1·2 종결**: [리뷰 기록](../reviews/248.md) round 1 HIGH 6 · MEDIUM 2 · LOW 1 → round 2 수리 검증 HIGH 0. H1/H2/H4는 2026-09-28 사용자 판정으로 확정했고 (아래 표), 본문·breakdown은 그 판정으로 정리했다. 같은 날 사용자 구현 지시로 Accepted 승격했다.

### 2026-10-05 최종 기술 판정

**구현·기술 검증 완료, Implemented.** [최종 종합 근거](../design/248-final-closure.md).
Switch의 disabled 이중 감쇠와 theme accent-subtle/dark border 해석 차이를 수리했다.
현재 G3 state 75/75, child 보충 33/33, Icon 보충 7/7, 원본 base/axis FAIL 0이며,
현재 DOM 색상 16/16과 실제 Compare track 6/6 L3 검증을 통과했다.
기존 G4 저장·교환 및 Publish 성공, G5 paired p95/heap/byte 근거를 유지하고,
이번 production 정적 initial bundle과 G6를 새로 통과했다.
사용자 커밋·push 지시에 따라 최종 제품 수정과 함께 main에 반영하고
Implemented 승격·completed 이동·인덱스 동기화를 수행한다.
아래의 Publish 미완료·section 대기·Switch 실패 기록은 해당 시점 이력이다.

### 2026-10-04 Publish 후속 실행

사용자 “adr 248 남은 작업 착수 시작해” 지시로 H4의 착수 승인 대기를 해제했다.
Publish는 catalog JSON/v2 파일을 읽고 Preview와 같은 shared catalog DOM/runtime을 사용한다.
Builder의 Publish 진입점도 새 파일을 전달한다. `CompositionDocument` 및 canonical resolver·export
adapter와 `packages/specs` 소스는 제거했고 native Frame/Group/Slot의 CSS 입력은 catalog로 통합했다.
아래 Context·초기 H4 제약·2026-10-03 기록은 결정 당시의 상태다.

[후속 검증 기록](../evidence/248-publish-followup.md)에 코드 제거와 실제 브라우저 결과를 기록했다.
기존 G3의 Icon 7·child 33 UNVERIFIED, axis 6·child 1 NOT_RUN은 이번 Publish 검증으로 닫히지 않는다.
Status는 **Accepted**를 유지하며 전체 Implemented 판정은 남긴다. 기존 G5 승인 기준은 변경하지 않았다.

### 2026-10-04 G3 잔여 실행

[보충 검증](../evidence/248-g3-remaining.md): 동결 HEAD의 구 앱을 복원하고 입력을 고정해 Icon 7/7,
child 장면 30/33을 확인했다. 새 검사에서 발견한 Canvas Icon 내부 정렬을 수리했다.
child 3건은 구/신 차이 판정 대기이며, 원래 무작위 Icon의 입력 누락과 계약 밖 입력의 NOT_RUN을
소급 PASS 처리하지 않았다. Accepted 유지.

### 2026-10-05 G5 후속 재측정

[현재 제품 재측정](../evidence/248-g5-followup.md): paired p95 **36/36**, retained heap **9/9**,
저장 byte **5/5**, 정적 initial bundle **2/2 PASS**. 5k·CPU 4배속 편집 540.39→42.74ms,
저장 656.67→45.08ms. Preview 실제 부팅 JS 636,473B는 별도 기록하며 기존 정적 initial
승인 기준과 예산을 유지한다. G3의 3건 판정 대기는 이 결과로 닫히지 않는다.

### 2026-10-05 section 종결·G3 재검증 판정

**Accepted 유지.** [최종 판정과 이력/보충 검증 관계](../design/248-g3-section-closure.md).
GridListSection·ListBoxSection은 확인된 보충 fixture의 geometry 차이만 분류했다.
MenuSection은 구 결함 면제 대신 현재 제품의 variant 기본값·자식 전달·RAC item 연결을
수리해 L3 different 0, 실제 열림/닫힘을 확인했다. child 보충 **33/33 PASS**.

원본 base 63 PASS/1 UNVERIFIED, axis 374 PASS/6 UNVERIFIED/6 NOT_RUN,
state **69 PASS/6 FAIL**이다. Switch 6건은 시작 HEAD에서도 같은 L3 수치로 실패한다.
기존 state 75/75 PASS는 당시 이력으로 보존하며 현재 gate를 대신하지 않는다.
Icon 원본 7·child 원본 33의 미검증 행은 소급 변경하지 않고 별도 보충 검증으로 연결한다.

### 2026-10-05 Switch L3 후속 수리

[원인·검증](../design/248-switch-l3-repair.md): 별도 indicator 노드의 y=4와 구 부모 원점 y=0의
paint 대응 관계를 G3에서 복원했다. 제품 위치는 현재 DOM과 일치하므로 바꾸지 않았다.
Switch 6/6 및 state **75/75 PASS**, base/axis/child 보충 FAIL 0.
Track 색상을 고의 변경한 probe는 6/6 FAIL로 paint gate 보존을 확인했다.
이전 69 PASS/6 FAIL은 수리 전 이력이며 현재 차단 사유에서 해제한다.
원본 미검증 처분은 유지하고, 현재 DOM paint의 색조 차이는 별도 관찰로 기록했다.

### Live Exercise

2026-10-05 headed Chrome/Playwright로 실제 Builder Desktop Compare Mode에서 세 section을
생성하고, Preview Menu의 Section·Item 1/2 열림·Escape 닫힘·focus 복귀·항목 클릭 닫힘·reload
후 재실행을 확인했다. Canvas의 검은 primary 트리거도 확인했다.
[상세·범위·잔여 경고](../design/248-g3-section-closure.md#live-exercise). 사용자 직접 confirm은 아니다.

## Context

현재 Builder에는 서로 다른 책임의 정본이 있다. `CompositionDocument`는 저작 문서·runtime mutation·저장의 정본이고, `componentCatalog`는 컴포넌트 등록, `COMPONENT_RULES_TABLE`은 기본 시각 규칙, `PrimitiveBinding`은 실행 연결을 담당한다. 이는 당초 의도된 분리다. 다만 reusable definition이 canonical 원본 ID를 참조하고 native frame/Slot이 metadata-only로 남아, 새 정의를 추가하거나 편집 경로를 바꿀 때 여러 표현·해석기를 따라가야 한다.

사용자는 개발 단계에서 이 경계를 재설계할 수 있으므로 **정의와 인스턴스를 같은 typed catalog graph, 같은 변경 API, 같은 직렬화 계약으로 통합**하는 방안을 요청했다. canonical을 다른 이름으로 감싸는 facade나 잔존 spec 세 개만 옮기는 정리로 목표를 축소하지 않는다.

### 현재 코드 근거

| 근거                                                                                                                        | 현재 책임과 교체할 경계                                                   |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [catalog entry 타입](../../../packages/shared/src/catalog/types.ts) `ComponentCatalogEntry`                                 | reusable→canonical 원본 ID; native는 binding/cutover가 없는 metadata-only |
| [document 타입](../../../packages/shared/src/types/composition-document.types.ts) `CompositionDocument`                     | children·themes·tokens·componentRules·events와 저작 배치                  |
| [canonical store](../../../apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts) `useCanonicalDocumentStore` | 프로젝트별 문서 및 mutation                                               |
| [mutation runner](../../../apps/builder/src/adapters/canonical/canonicalMutationRunner.ts)                                  | 문서 변경→파생 index→history→persist 순서                                 |
| [ref 해석](../../../apps/builder/src/adapters/canonical/canonicalRefResolution.ts)                                          | nested ref·자손 경로·override·slot                                        |
| [Skia 입력](../../../apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts)                                   | spec/catalog gate, native spec fallback                                   |
| [증분 저장](../../../apps/builder/src/lib/db/indexedDB/incrementalDocuments.ts) `splitDocument`/`joinDocument`              | canonical tree를 head/parts로 분해·복원                                   |
| [IDB data store](../../../apps/builder/src/lib/db/indexedDB/adapter.ts) `collections`/`api_endpoints`/`variables`           | ADR-131 Phase 8의 별도 data SSOT — **본 ADR 범위 밖, 유지**               |
| [publish](../../../apps/publish/src/App.tsx)                                                                                | `CompositionDocument` payload 요구 — **본 ADR에서 수정하지 않음**         |

Frame/Group/Slot은 [ADR-912](../completed/912-rac-pencil-rebuild-cutover.md) 당시 의도적으로 보존했다. 영구 잔존이라는 과거 범위 결정을 이번 교체의 불가능 근거로 삼지 않는다. 실제로 Group/Slot rule 항목은 이미 테이블에 있으나 spec의 전체 동작을 표현하지 않으며, Slot의 minHeight와 placeholder 등은 별도 spec에 남아 있다.

### SSOT domain과 전제

- **D1**: RAC가 DOM·접근성·상호작용을 계속 소유한다. catalog는 binding과 허용 props를 선언한다.
- **D2**: Spectrum 참조와 custom 계약을 definition의 props/edit schema로 표현한다. 선언 위치 변경으로 public 동작을 임의 변경하지 않는다.
- **D3**: 기본 visual/layout rule은 **코드 catalog 라이브러리**(`COMPONENT_RULES_TABLE` + theme/tokens)가 계속 SSOT다. 잔존 spec 3개(Frame/Group/Slot)는 이 라이브러리로 옮긴다. 프로젝트는 라이브러리 definition의 override와 사용자 definition만 소유한다. Canvas와 DOM은 대등한 소비자다.
- 문서·history·저장 모델 교체는 D1 권한을 침범하지 않는다. 실행 코드는 binding ID로 연결한다.
- 본 ADR이 base 모델이며 Frame/Group/Slot 이전은 포함된 응용이다. ADR-116/122의 storage/runtime schema와는 교체 관계, ADR-142/912의 등록·시각 계층과는 통합 관계, ADR-131의 data store와는 직교(참조만)다.

### 사용자 판정 (2026-09-28)

| 결정 | 기존 근거                                                                                                                                                                | 확정 내용                                                                                                             | 확인 기록                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| H1   | [ADR-131 Phase 8](../completed/131-events-data-actions-first-class-collections.md), `composition-document.types.ts:1276-1281`, IDB `collections/variables/api_endpoints` | 별도 data SSOT 유지. graph는 collection/field/api endpoint/project variable **ID 참조**와 page/node 상태 정의만 담당  | AskUserQuestion "별도 data SSOT 유지"          |
| H2   | D3 catalog + theme/tokens 정본                                                                                                                                           | 대안 E — 라이브러리 read-only 참조 + 프로젝트 override/사용자 definition. 프로젝트별 라이브러리 snapshot(대안 B) 기각 | AskUserQuestion "라이브러리 참조 + override"   |
| H4   | publish 링크 전용·빌더 안정화 뒤 착수 방침, `.agent/task-state.json`의 Preview/Compare 제한                                                                              | 기존 방침 유지. Builder(Preview 포함) 전환까지가 본 ADR 실행 범위, Publish 전환은 후속. Implemented는 Publish 전환 뒤 | AskUserQuestion "기존 방침 유지, Publish 후속" |

Publish 후속의 의미: `apps/publish`와 그것만 쓰는 shared canonical 타입은 본 ADR 실행 중 수정·삭제하지 않는다. Preview iframe/Compare 자동 검증은 하지 않고 Preview DOM 경로는 unit + 사용자 확인으로 검증한다. Builder import graph의 canonical 0과 저장소 전체 canonical 0을 따로 측정하며, 후자는 Publish 후속 착수 승인 뒤에 닫는다.

### Hard constraints

| ID  | 계약                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HC1 | Builder 전환 완료 시 Builder import graph(편집·Canvas·Preview·저장·export)의 `CompositionDocument`/`CanonicalNode` 모델·canonical store/resolver·구 형식 reader·영구 adapter·dual-write **0**. 이름 alias만 바꾸는 작업은 불합격. `apps/publish` 전용 잔존은 Publish 후속 범위 |
| HC2 | durable 저작 정의(사용자 definition·라이브러리 definition override)·인스턴스·페이지·테마·토큰·page/node 상태 정의·이벤트는 단일 typed graph와 단일 transaction API로 관리. 라이브러리는 같은 ID 공간에서 읽는 read-only 코드 데이터. 파생 view는 쓰기 원본이 아님              |
| HC3 | 구 프로젝트 migration **0**. 사용자 전제상 보존 대상 **0개**, 기존 사용처 **0개**, 구 포맷 재직렬화 **0건**. 개발 DB 초기화·새 fixture 생성으로 전환                                                                                                                           |
| HC4 | ID/ownership/ref/slot 불변식, transaction 실패 원자성, Undo/Redo, 새 포맷 저장·refresh, Preview(unit + 사용자 확인)를 검증. 기존 데이터 미보존을 기능 삭제 근거로 사용하지 않음                                                                                                |
| HC5 | Frame/Group/Slot까지 spec 기반 컴포넌트 정의 **0**. `packages/specs` 공용 실행 기능은 이동·재사용 후 패키지 의존 제거. JSON에 실행 함수나 eval을 저장하지 않음                                                                                                                 |
| HC6 | 동일 fixture의 Canvas/DOM geometry 오차 ≤1 CSS px, 비텍스트 pixel diff 비율 ≤0.001. 성능은 동일 조건 paired p95 ≤ baseline ×1.10 +2ms, save/load +10ms; heap ≤1.20배; 저장 byte는 breakdown §6.2의 고정비·가변비 식                                                            |
| HC7 | Preview iframe 격리와 origin 검증, publish의 Builder authoring import 0, 기존 AI 권한 검증 유지. runtime cache/selection/drag는 persistent entries에 매 프레임 기록하지 않음. collections·api_endpoints·project variables의 기존 저장·history 책임 불변                        |

HC6의 Canvas–DOM 비텍스트 픽셀 판정은 [ADR-198 L3](../completed/198-d3-renderer-pixel-parity-gate.md)의 cross-rasterizer 비교를 따른다. 정규화한 동일 영역에 `pixelmatch` threshold `0.1`을 적용하고 영역별 `maxDiffRatio`(비텍스트 `0.001`)와 `maxByte` 상한을 함께 기록하며, 두 상한을 모두 초과할 때 차단한다. 원시 RGB 차이는 진단값이고 same-rasterizer exact 검증과 구분한다. 3px 모서리 band(L3e)는 별도 영역으로 떼어 **기록만 하고 완료 조건에서 뺀다** (사용자 결정 2026-09-29 — 승인된 band 예산이 없어 모든 type 이 UNVERIFIED 에 머물던 상태를 끝낸다). geometry ≤1 CSS px · Canvas↔DOM 계약 · 비텍스트 L3 판정식은 그대로이고, L3e 차이는 얇은 상자의 도색 누락을 찾는 진단값으로 type 별로 함께 읽는다. old/new geometry 차이는 사용자가 노드 종류별로 승인한 규칙 (2026-09-30 — 결정 반영 · 구 Canvas 결함 · Preview 결함 추종 · 양쪽 이탈, `apps/builder/tests/adr248-g3/approvedDifferences.ts`) 에 맞을 때만 통과로 본다: 소유 컴포넌트 × 노드 종류 × 달라진 축이 규칙과 맞고 Canvas↔DOM 다리가 새 쪽을 중재해야 하며, 승인된 짝 상자 안의 비텍스트 차이만 그 차이로 귀속한다. Preview 결함 추종 통과는 Phase 4 에서 제품과 함께 고칠 목록이다. [Slot 9건 국소 재측정](../design/248-phase3-g3-g5-evidence.md)만으로 G3를 PASS로 승격하지 않는다.

현재 CSSGenerator는 variant·delegation의 child selector·externalStyles·rootSelectors emit을 지원한다. 라이브러리 CSS는 지금처럼 빌드 시 생성하고, 프로젝트 override·사용자 definition CSS는 같은 emitter 코어를 Builder lazy worker에서 실행한다. 새 definition을 구 `ComponentSpec`으로 조립하는 adapter를 최종 경로로 남기지 않는다.

초기 심볼 검색은 관련 526개 소스 파일(테스트 포함)을 찾았다. 이는 영향 조사 출발점이고 작업량 확정치가 아니다. 새 모델이 더 빠르거나 단순해졌다는 실측은 아직 없다. baseline·필드별 매핑·기능 fixture를 G0에서 freeze한다.

### 외부 설계 근거

2026-09-28 공식 문서 확인:

- [tldraw Store](https://tldraw.dev/sdk-features/store): ID와 type을 가진 record, schema 검증·변경 추적, document/session scope 분리의 사례다. 통합 record graph와 일시 상태 경계의 참고이며 SDK 도입이나 기존 migration 채택을 뜻하지 않는다.
- [Redux: Normalizing State Shape](https://redux.js.org/usage/structuring-reducers/normalizing-state-shape): ID 기반 참조와 순서 배열로 중첩 데이터 갱신을 다루는 근거다. normalized graph가 자동으로 빠르다는 결론은 도출하지 않으며 구독·인덱스 비용은 측정한다.
- [React Aria Quality](https://react-aria.adobe.com/quality): 접근성·국제화·상호작용은 실행 라이브러리의 책임이다. catalog에 그 알고리즘을 다시 선언·구현하는 대안의 비용을 판단하는 근거다.

## Alternatives Considered

### 대안 A: 잔존 spec만 catalog로 이전, canonical 유지

Frame/Group/Slot의 시각 정의를 옮기고 기존 문서 모델을 유지한다. 현재 구조에 가장 작은 변경이며 D3 예외를 줄이지만 정의·인스턴스 모델 통합과 canonical 제거는 달성하지 않는다.

### 대안 B: 프로젝트별 라이브러리 snapshot을 담는 typed catalog graph

컴포넌트 정의(기본 라이브러리 전체 포함)와 배치 인스턴스·페이지·테마·저작 데이터를 프로젝트마다 한 `entries` 테이블에 저장한다. 새 프로젝트는 versioned seed로 라이브러리 한 벌을 복사하고, 이후 프로젝트 소유 definition이 정본이다. RAC/Skia/Rust/네트워크 실행은 binding ID가 가리키는 코드에 둔다.

### 대안 C: 코드까지 테이블에 담는 범용 실행 DSL

접근성·렌더링·레이아웃·이벤트 실행 알고리즘까지 데이터 DSL로 기술하고 interpreter가 수행한다. 가장 문자적인 “모든 구현을 테이블 하나에” 해석이다. RAC와 엔진을 대체하는 언어·실행기를 새로 검증해야 한다.

### 대안 D: 현재 canonical tree에 catalog를 내장하고 이름만 통일

`CompositionDocument`에 definition registry를 붙이고 public facade를 catalog로 바꾼다. 단계적 도입은 쉽지만 tree/store/ref resolver와 별도 타입·변환 계층이 계속 남는다. 내부 저장 정본의 이름만 바꾸면 HC1을 충족하지 못한다.

### 대안 E: 라이브러리 참조 + 프로젝트 override의 통합 graph

기본 definition/template/visual rule은 코드 catalog 라이브러리의 read-only ID로 참조한다. 프로젝트는 인스턴스·사용자 definition·라이브러리 definition override만 저장한다. resolver는 같은 typed ID 공간에서 library entry와 project entry를 읽고 명시 override 순서를 적용한다. library는 고정된 상수 데이터이고 프로젝트 graph만 writable이며 canonical 모델은 제거한다. “단일 graph”는 단일 논리 모델·조회/변경 계약을 뜻하고 immutable library 전체를 매 프로젝트에 저장한다는 뜻은 아니다.

같은 schema/contract 범위의 catalog 수정은 기존 프로젝트와 fixture에도 적용된다. schema version과 library contract version은 구분한다. 충돌하는 구조 변경은 지원 버전 검사로 실패시키고, override가 가리키던 template ID를 자동 재해석하거나 조용히 버리지 않는다.

## Risk per Alternative

마이그레이션 축은 **구 데이터 변환 비용이 아니라 코드 전환·새 fixture·배포 및 롤백 비용**이다.

| 대안 |   기술   |  성능  | 유지보수 | 마이그레이션/전환 | 핵심 위험                                                                                                |
| ---- | :------: | :----: | :------: | :---------------: | -------------------------------------------------------------------------------------------------------- |
| A    |   LOW    |  LOW   |  MEDIUM  |        LOW        | 기술 위험은 작지만 사용자 목표 불충족                                                                    |
| B    |   HIGH   |  HIGH  |   HIGH   |       HIGH        | 프로젝트마다 라이브러리 저장(시각 rule만 215,282 B), catalog 수정이 기존 프로젝트에 미도달, D3 SSOT 이동 |
| C    | CRITICAL |  HIGH  | CRITICAL |       HIGH        | 접근성·렌더링 범용 언어와 interpreter를 개발·유지해야 함                                                 |
| D    |  MEDIUM  | MEDIUM |   HIGH   |      MEDIUM       | facade 아래 이중 모델이 남고 canonical 제거를 증명할 수 없음                                             |
| E    |   HIGH   | MEDIUM |  MEDIUM  |       HIGH        | immutable library와 project override의 경로·버전 해석, nested instance/slot/history 재구현, 소비자 전환  |

## Risk Threshold Check

1. A는 HIGH 없이 가능하지만 HC1/HC2를 충족하지 않는다. C의 CRITICAL을 회피하기 위해 실행 코드를 재사용하는 B·E와 facade 방식 D를 비교에 포함했다.
2. D는 구현 위험을 낮추지만 목표를 충족하지 못한다. B의 저장·SSOT 이동 위험을 회피하는 E를 round 1에서 추가했다. E는 **독립 harness에서 검증하고 전 소비자가 준비된 시점에 한 번 전환하는 순서**로 전환 위험을 줄인다. Phase 1~3은 기존 제품 entry에서 import하지 않는 새 모듈과 독립 test root를 작성하고, Phase 4에서 Builder의 편집·소비자·저장을 한 번에 전환한다. 두 writable 모델을 연결하는 병행 제품을 만들지 않는다.
3. 두 검토 후에도 E의 ref/override·history·소비자 전환 위험은 HIGH다. 구 데이터 보존 비용 0, 기능/성능 gate와 전환 전 검증으로 이를 수용한다. HIGH가 사라졌다고 판정하지 않는다.
4. 위험을 별도 ADR로 분리할지 검토했다. native spec·history·저장은 같은 모델의 쓰기/읽기 계약으로 함께 검증한다. data store(H1)는 직교라 범위에서 뺐다. Publish(H4)는 같은 payload에 의존하지만 기존 방침에 따라 후속으로 두고, 저장소 전체 제거 gate를 미완료로 남긴다. 범용 DSL이나 신규 렌더 엔진은 포함하지 않는다.

## Decision

> 구현 상세: [248-unified-catalog-document-breakdown.md](../design/248-unified-catalog-document-breakdown.md)

**대안 E를 채택한다** (사용자 판정 2026-09-28). 코드 catalog 라이브러리(등록 metadata·props/edit 계약·visual rule·template·binding 참조)를 read-only로 두고, 프로젝트 graph는 인스턴스·페이지·테마·토큰·page/node 상태 정의·이벤트·사용자 definition·라이브러리 definition override를 담는다. 두 원천은 같은 typed ID 공간과 하나의 resolver로 조회하며, 쓰기는 프로젝트 graph에 대한 단일 transaction API만 허용한다. 이 graph가 Builder의 새 runtime·저장 SSOT이며 Builder의 canonical 구현을 제거한다.

실행기는 별도 코드로 등록하고 데이터에 식별자로 연결한다. 컴포넌트 등록/기본값/시각 정의를 실행 레지스트리에 다시 복제하지 않는다. collections·api_endpoints·project variables는 ADR-131의 별도 data SSOT로 남고 graph는 ID로만 참조한다.

기존 프로젝트는 변환하지 않는다. 새로운 저장 namespace·format marker로 시작하고 구 형식 입력은 명시적으로 거부한다. 새 포맷 자체의 진화는 `schemaVersion`/`libraryContractVersion`/`libraryRevision` 계약으로 다룬다. 새 프로젝트의 저장 안전성·회복과 새 catalog 포맷의 내보내기·가져오기는 새 모델에서 지원한다. 외부 `.pen`(pen.dev) 파일 상호운용은 현재 제품 요구사항이 아니다(사용자 범위 정정 2026-09-29). `apps/publish`는 본 ADR 실행 중 수정하지 않는다.

기각 사유: A는 잔존 spec만 정리하여 요청 목표에 못 미친다. B는 프로젝트마다 라이브러리를 저장해 저장 비용이 크고, catalog 수정이 기존 프로젝트·fixture에 닿지 않아 D3 SSOT가 프로젝트 데이터로 옮겨 간다. C는 RAC·엔진 실행을 다시 구현하는 비용과 위험이 목표에 비해 크다. D는 구 모델을 내장해 이름만 통일하는 결과가 되므로 제거 기준을 충족하지 못한다.

위험 수용 근거는 보존할 데이터가 없고, 새 형식의 생성부터 Builder Preview까지 전 경로를 전환 전에 독립 검증할 수 있다는 점이다. 성능 개선은 채택 전제가 아니라 검증 대상이다.

**목적의 우선순위 (2026-09-30 재확인):** 1차 목적은 저작 SSOT·transaction·ref/override 해석을 단일 경계로 모아 아키텍처를 안정화하는 것이다. 변경 시점의 ID와 영향 관계를 소비자가 이어받으면 전체 문서에서 변경분을 다시 찾는 JS 작업을 줄일 수 있지만, 이는 제품 연결 후 증명할 2차 효과다. JS↔WASM 호출·인코딩 병목 해결을 자동 효과로 주장하지 않는다. 새 dependency engine·cache framework·worker·binary protocol·renderer 교체는 이 결정을 실행하기 위한 선행 조건이 아니다. 세부 증분 소비와 측정 범위는 [breakdown §4.1·§6.2](../design/248-unified-catalog-document-breakdown.md)에 둔다.

## Risks

| ID  | 위험과 코드 경로                                                                                                            | 심각도 | 대응                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------- |
| R1  | nested ref·override·slot 경로의 의미 소실. `canonicalRefResolution.ts`, `resolvers/canonical/index.ts`, `catalogOrigins.ts` |  HIGH  | stable ID 경로, ownership과 reference 분리, G0/G1/G3                                   |
| R2  | mutation/history·DB commit의 원자성 소실. `canonicalMutationRunner.ts`, `historyActions.ts`, `incrementalDocuments.ts`      |  HIGH  | reducer forward/inverse, revision 고정 저장, 실패 주입 G2/G4                           |
| R3  | native spec·CSS·Skia의 값/상태 해석 발산. `buildSpecNodeData.ts`, `Frame.spec.ts`, `Slot.spec.ts`, `CSSGenerator.ts`        |  HIGH  | 단일 visual 계약·emitter와 full component/state fixture G3                             |
| R4  | library/override 해석·구독·definition fan-out 비용, library 버전 변경 시 stale override                                     |  HIGH  | entry selector·역참조 인덱스·delta 저장, 호환성 오류 보고, G1/G5 실측                  |
| R5  | Builder 안에 canonical 또는 두 번째 writable 모델 잔존, graph↔data store 참조 끊김                                          |  HIGH  | 필드/소비자 매핑, Builder import graph 검사, 외부 data ID 참조 검증 G0/G1/G4/G6        |
| R6  | 과거 프로젝트를 요구하는 신규 이해관계자 등장, 새 포맷 rollout 동안 개발 데이터 손실                                        | MEDIUM | 보존 대상 0 전제를 문서화, 새 namespace 사용. 전제 변경 시 실행 전 scope 재결정        |
| R7  | “테이블 통합”을 모든 runtime 값을 지속 저장하거나 실행 함수 문자열을 허용하는 것으로 확대                                   |  HIGH  | durable/session/runtime 분리, binding allowlist와 거부 테스트 G1/G4                    |
| R8  | Builder 전환 뒤 Publish 후속 전까지 Builder→publish 링크가 새 포맷을 열지 못함                                              | MEDIUM | Builder publish 진입점에서 명시 실패 안내, canonical export adapter 도입 금지, G4 확인 |

## Gates

| Gate | 시점           | 통과 조건                                                                                                                                                                               | 실패 시 대안                                             |
| ---- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| G0   | 구현 전        | 현재 persisted field·기능·소비자의 새 책임 매핑 미분류 0, fixture·baseline·삭제 목록 freeze (ADR-243 종결 뒤)                                                                           | 인벤토리/계약 보강; 부재 기능을 조용히 제외하지 않음     |
| G1   | 모델 기반      | ID/ownership/ref/slot/type validator, library/override 해석·버전 검사, 외부 data ID 참조, clone·override·실행 ID 검증; 불법 입력 원자적 거부                                            | schema/reducer 수정, 소비자 전환 보류                    |
| G2   | 편집 경로      | 생성·이동·삭제·reset·detach·override·binding 참조 편집 Undo/Redo 동일성, 실패 시 상태/history/revision 변화 0                                                                           | transaction/history 수리                                 |
| G3   | 렌더 경로      | 전 등록 type/state manifest 및 Frame/Group/Slot Canvas live, Preview DOM unit + 사용자 확인, geometry/pixel HC6, RAC 접근성 동작 보존                                                   | resolver/binding/emitter 수리; spec fallback 재도입 금지 |
| G4   | 저장·교환 경로 | 새 catalog 포맷의 생성→편집→저장→refresh→export/import, IDB·JSON·폴더 저장, 실패·충돌·stale payload 처리; old format reader 0; 후속 전환 뒤 Builder→Publish catalog 파일 전달·렌더 성공 | 해당 새 경계 수리, 제품 전환 보류                        |
| G5   | 통합 후        | HC6 성능·메모리·저장 크기 및 유효 bundle budget, leaf 편집 전체 scan 0; 제품 경로의 변경 감지·projection·layout 준비 결정적 카운트 (§6.2) 확인                                          | index/storage 최적화; 예산 변경은 별도 결정              |
| G6   | 제거·완료      | Builder import graph의 canonical/legacy alias/adapter/spec 정의 0, 공용 specs 의존 이동 완료, TS/build/인접 테스트/live 통과. 저장소 전체 0은 Publish 후속                              | 잔존 소비자 전환 후 재검증, Implemented 보류             |

G4의 Publish 명시 실패는 후속 전환 전의 임시 계약이었다. 2026-10-04 승인된 Publish 전환 뒤에는 catalog 파일 전달·렌더 성공으로 판정하며, 과거 실패 검증 행을 현재 성공 근거로 재사용하지 않는다.

R1→G0/G1/G3, R2→G2/G4, R3→G3, R4→G1/G5, R5→G0/G1/G4/G6, R7→G1/G4, R8→G4로 대응한다. **Phase 0 G0는 [구 앱 기준선](../design/248-baseline/g0-gate.json)에서 PASS, Phase 1 G1은 [독립 모델 근거](../design/248-phase1-g1-evidence.md)에서 PASS, Phase 2 G2는 [독립 runtime 근거](../design/248-phase2-g2-g4-evidence.md)에서 PASS다. Phase 3은 2026-09-30 독립 소비자 검증과 전환 준비를 마치고 커밋·push했다(사용자 완료 판정; [근거와 남은 사례](../design/248-phase3-g3-g5-evidence.md)). 독립 G3 장면은 base 62/64, axis 372/386, state 75/75이며 FileUpload는 Phase 4 수리 대상, Icon 입력 불일치와 child 기준선 부재는 UNVERIFIED로 기록했다. 이는 제품 Builder의 live G3 또는 통합 G4/G5/G6 PASS 판정이 아니다.** 제품 연결 후 같은 cutover 변경 안에서 최종 판정한다. Phase 3 근거와 Phase 4 판정 항목, 5k leaf 계약 중 아직 재지 않은 항목(page layout signature · WASM 갱신 node · 전역 ref 검색 0 단언 · 제품 저장/Preview 송신 직렬화)은 [breakdown §7](../design/248-unified-catalog-document-breakdown.md)에 대조했다.

**Phase 4 제품 판정 (2026-10-03, 단일 cutover — worktree `adr248-4e` 에 누적 후 main 1회 병합)**: G3 실제 Builder live — base 63/64 · axis 374/386 · state 75/75 PASS, FAIL 0 · Preview 결함 추종 0 ([base](../design/248-phase4-g3-live-base.json) · [axis](../design/248-phase4-g3-live-axis.json) · [state](../design/248-phase4-g3-live-state.json) · [child](../design/248-phase4-g3-live-child.json)). 남은 칸은 판정 불가 사유로 기록한다: Icon 7 UNVERIFIED (구 시나리오의 아이콘 이름 미기록), axis NOT_RUN 6 (Popover · TagGroup 의 axis prop 이 계약에 없고 구 앱만 소비), child UNVERIFIED 33 · NOT_RUN 1 (구 child 캡처 부재, geometry · Canvas↔DOM 은 33 통과). G4 live 15/15 ([근거](../design/248-phase4-g4-live.json) — 생성·편집·undo/redo·저장·새로고침, v2 zip·JSON 교환, 구 포맷 명시 거부, 강제 실패·탭 충돌·전환, events/actions mirror store 미생성·data 세 store 보존, publish 진입점 명시 실패, `apps/publish` diff 0; 구 경로 삭제 뒤 재실행 15/15). G5 PASS ([근거](../design/248-phase4-g5-evidence.md) — 5k 제품 경로 카운트, 저장 byte 5/5, 구 `2a5c97099` production 대조 paired p95 36/36, heap 9/9, WebKit 4/4, initial bundle Builder 1,228,752 · Preview 394,104; Preview 부팅 JS 645,249 B 는 사용자 판정 (a) 2026-10-03 으로 ADR-201 정의 (정적 initial) 기준 PASS, 상한 변경 없음). G6 Builder import graph 의 구 모듈 진입 0 (breakdown 4e-13-3 — 삭제 1~3차 승인분). Builder 전환은 이로써 완료이며 Status 는 아래 전이 규칙대로 Accepted 에 머문다.

**범위 정정 (사용자 2026-09-29)**: 외부 `.pen` 교환은 G4 필수 조건과 Phase 3 차단 항목에서 제외한다. G0의 `.pen` 표본 5개·해시·구 앱 교환 결과([pen-interchange.json](../design/248-baseline/pen-interchange.json))는 역사적 기준선으로 보존하고 수정하지 않는다. Phase 3에서 수행한 Pencil 시험(표본 3개 직접 의미 왕복, `sample-descendants.pen`·`sample-imports.pen`의 명시 오류, 유효 descendants·imports fixture 왕복)은 수행 기록으로만 남기며 G4 PASS 근거로 계산하지 않는다. G4는 새 catalog 포맷의 IDB·JSON·폴더 저장, refresh, export/import, 실패·충돌 검증으로 판정한다.

**Gate 판정 시점 (사용자 2026-09-29)**: Phase 3은 새 runtime의 독립 소비자 검증과 전환 준비까지다. Phase 3의 resolver·Canvas·DOM binding은 Phase 4에서 그대로 쓰는 제품 경로 코드이며 시험 전용 binding을 두지 않는다. 제품 Builder save/refresh·publish 진입점·production paired G5·실제 Builder live G3처럼 전환 후에만 측정 가능한 항목은 Phase 4의 단일 cutover 변경 안에서 검증하고, gate 통과 전 배포·완료 판정은 하지 않는다. G3의 범위와 HC6 수치는 완화하지 않으며, 전환 전 근거(Phase 3)와 제품 연결 후 최종 판정(Phase 4)을 구분해 기록한다.

Status 전이: G0~G6 통과(Builder 전환 완료) 뒤에도 Status는 Accepted에 머문다. Implemented는 Publish 후속 전환이 끝나 저장소 전체 canonical 0이 확인된 뒤에 판정한다.

### Live Exercise

Builder 전환 범위 (2026-10-01 ~ 10-03, dev 서버 5175 · 저장된 인증 세션 · headless/headed Chrome, WebKit 1회). 무엇을 실제로 exercise 했는지:

- 대시보드에서 새 프로젝트 생성 → 팔레트 삽입 · Properties/Styles 편집 · 키보드 undo/redo → 자동 저장 → 새로고침 후 같은 문서 (G4 R1, `80a9b8ac2` · 삭제 뒤 `5d9b9f485`).
- 기본 원본 편집 (origin 편집 확인 대화상자 · 인스턴스 fan-out) · 컴포넌트 만들기 · detach · 해체 · slot 선언·채우기 · layout 적용 (page body = 인스턴스) — 4e-4c-2c · 4e-4c-2g · 4e-6-43 · 4e-6-52 · 4e-6-53 행의 live 기록 (breakdown §5.1).
- 전 등록 type 의 G0 시나리오를 공개 명령 API 로 저작해 실제 Canvas 캡처 (live G3 559 장면) · 5k 시드에서 leaf 편집 · 원본 편집 · page 전환 · 저장 카운트 (G5) · WebKit 생성·undo/redo·새로고침 (G5 4/4).
- 구 포맷 프로젝트 열기 거부 · 헤더 Preview 의 publish 진입점 명시 실패 toast (G4 R5 · R9).

Preview iframe 은 사용자 지시로 열지 않았다 (unit + 사용자 확인 범위). Publish 는 후속 범위다.

### 리뷰 수리 이력

| 리뷰 항목 | 반영                                                                                   | 상태               |
| --------- | -------------------------------------------------------------------------------------- | ------------------ |
| H1        | data store 흡수 철회, graph는 ID 참조만                                                | 사용자 판정 · 반영 |
| H2        | 대안 E 채택, B 기각, 새 포맷 schema/library 진화 계약 분리                             | 사용자 판정 · 반영 |
| H3        | 저장 byte 예산을 고정비·가변비로 분리 (library snapshot 0)                             | round 2 확인       |
| H4        | Publish 후속, Builder import graph 제거와 저장소 전체 제거 구분, Implemented는 후속 뒤 | 사용자 판정 · 반영 |
| H5        | main 미연결 새 모듈/test root → 단일 entry 전환; 병행 dirty 및 실패 복귀 규정          | round 2 확인       |
| H6        | 포맷 독립 조작 script + 구 앱 geometry/screenshot oracle freeze                        | round 2 확인       |
| M1        | 라이브러리 CSS는 빌드 시, override/사용자 definition CSS는 Builder lazy worker         | round 2 확인       |
| M2        | self-confirm 철회, 사용자 답변 기록                                                    | 사용자 판정 · 반영 |
| LOW       | ADR-243 종결 반영 commit 뒤 G0/G5 freeze                                               | round 2 확인       |

## Consequences

### Positive

- 정의와 인스턴스가 한 typed ID 공간·resolver·transaction·저장 계약을 사용한다.
- Frame/Group/Slot 예외와 spec/catalog 렌더 분기를 제거할 수 있다.
- D3 SSOT는 코드 catalog에 남아 catalog 수정이 기존 개발 프로젝트·fixture에도 반영된다.
- parent/page/lookup은 파생 인덱스가 되고 저장 원본의 중복을 줄인다.
- 구 데이터 변환·호환 reader·dual-write 유지 비용이 없다.

### Negative

- 문서 모델에 의존하는 Builder·Preview·저장·AI·도구 전반을 바꾸는 큰 작업이다.
- template 참조·override·history의 의미와 library 버전 호환을 새 모델에서 다시 검증해야 한다.
- 새 포맷은 기존 프로젝트 JSON/폴더와 호환되지 않는다. 현재 보존 대상이 없다는 전제에 의존한다.
- Publish 후속 전까지 Builder에서 publish 링크를 쓸 수 없고, shared canonical 타입이 Publish 전용으로 남는다. Implemented도 그때까지 보류된다.
- graph와 data store가 별도 저장·history라 두 쪽을 함께 바꾸는 조작의 원자성은 기존 수준에 머문다.

### 기존 ADR 관계와 완료 시 문서 정합

ADR-116/122의 canonical storage/runtime 형식, ADR-142/912의 canonical reusable 결합 및 잔존 spec 결정은 Builder 전환 완료 시 해당 범위가 대체된다. ADR-131의 data store 경계, ADR-184의 쓰기 순서·history 의무, ADR-198의 시각 검증, ADR-235의 저장 안전성, ADR-246의 측정 원칙은 새 모델에 맞춰 유지한다. 기존 ADR 전체의 다른 결정을 일괄 폐기하지 않는다.

Phase 4 로 Builder 전환은 완료됐다 (2026-10-03). Publish 가 아직 canonical 을 읽으므로 과거 ADR 상태와 저장소 공통 runtime 규칙은 Implemented 판정 때 함께 바꾼다 — Builder 범위의 규칙 문서 (`state-management` · `ssot-hierarchy` 의 Builder 서술) 정리는 후속 항목으로 둔다. 완료 시 부분 대체 범위를 명시하고 `ssot-hierarchy`(잔존 spec 예외 제거)·`state-management`·runtime 계약·README·CHANGELOG를 실제 코드와 맞춘다. 이 문서의 존재만으로 현행 canonical 쓰기 계약의 우회를 허용하지 않는다.
