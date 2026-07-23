# ADR-159: Collection 필드 템플릿 바인딩 — `{field}` 보간 + dataTable 단일 소스

## Status

Accepted — 2026-07-24 (리뷰 round 1 2026-07-21 / round 2 2026-07-23 승인 — 전건 fixed, execute-adr 착수 시 승격)

### Phase 진행 로그

- (진행 예정) Phase 0 inventory → P1 shared resolver → P2 Skia projection → P3 DOM → P4 오소링/소스 단일화 → P5 문법 B → P6 종결

## Context

data-bound collection(ListBox/GridList/Table 등)의 행 텍스트는 현재 **고정 필드 휴리스틱**으로만 채워진다: `getItemLabel` 이 `["label","textValue","children","name","title","value"]` 우선순위로 행에서 첫 일치 필드를 뽑는다 (`packages/shared/src/collections/resolveCollectionItems.ts:263-282`). 사용자가 slot 자식 Text 에 `{num}` `{email}` 을 입력해도 — 보간 기계가 코드베이스에 없어 — DOM/Skia 양쪽 모두 이를 무시하고 `name` 을 렌더한다 (2026-07-21 라이브 실측: Users 테이블 num/email 지정 시도 → name 표시. Skia 발산 아님 — 대칭적 미구현):

- Skia projection 은 slot 텍스트를 버리고 `row.label` 단일 필드로 덮는다 (`apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts:1186` ListBox / `:1476` GridList `rowProps children: row.label` — 2026-07-24 리뷰 round 2 재확인, 구 인용 :987-989 는 ADR-154 후속 편집으로 라인 이동). `SlotComposition` 은 role/style 만 운반하고 텍스트를 담지 않는다 (`packages/shared/src/catalog/slotRoles.ts:79-92`).
- DOM 의 필드 지정 수단인 `columnMapping` + Field 자식 모드 (`packages/shared/src/components/ListBox.tsx:442`) 는 slot 별 **단일 컬럼**만 가능하고(다중 필드·literal 혼합 불가), Skia projection 이 소비하지 않으며, 오소링 UI 배선도 없다.
- 임의 컬럼(num/email)은 어떤 경로로도 표시 불가 — 휴리스틱 키 목록에 없기 때문.

동시에 컴포넌트 패널의 데이터 소스 피커는 4종(dataTable/api/variable/route — `apps/builder/src/builder/components/property/PropertyDataBinding.tsx:108-112` `SOURCE_OPTIONS`)을 노출하지만, composition 의 데이터 방향은 **모든 동적·정적 데이터를 RAC/RSP 레퍼런스인 collection 방식으로 처리** — dataTable(=canonical `collections`, ADR-132) 단일이다. api/variable/route 는 사용하지 않는 표면이다.

**ADR-152 경계 (2026-07-21 사용자 confirm — 경계 재획정)**: [ADR-152](152-data-panel-collection-binding-integration.md)(바인딩 통합)는 같은 문제 공간의 **계약 인프라 축**(id 참조 계약 v2 / 읽기 경로 일원화 / publish 직렬화 / store 이중화 정리)을 담당하고, 본 ADR 은 **표시 축**(텍스트 슬롯 템플릿 + 오소링 + dataTable 단일 소스)을 담당한다. 152 의 fieldMap 은 비텍스트 역할(icon/value) 한정으로 축소 개정되고(텍스트 label/description 은 본 ADR 템플릿이 정본), 152 의 API source 유지 전제는 본 ADR 방향으로 개정된다 (152 는 scope 변경으로 재리뷰 대상). 상세 경계: breakdown §1-5.

**ADR-162 소비 관계 (2026-07-24 사용자 confirm — "159 base 의존 재획정")**: [ADR-162](162-gridlist-template-subtree-projection.md)(GridList composed 카드)가 본 ADR 을 base 로 소비한다 — P1 resolver 를 실체화된 임의 템플릿 자식의 string prop 보간에, P4 오소링 패턴을 임의 자식 prop 편집면에 확장 적용. 본 ADR 의 계약·범위 무변 (소비 확장 정보 — P1 API 는 slot 텍스트 특정이 아닌 string 일반이어야 함, §2-2 시그니처 그대로 충족).

**3-Domain 판정**: D1(RAC DOM/동작) 무접촉 — 상호작용·write-back 은 본래 Preview/Publish 의 RAC 소관(빌더 Skia 는 레이아웃·배치·시각 구성만, 메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview` 정합). D3 는 "보간된 샘플 텍스트의 시각 대칭"만 관여(스타일 SSOT 무변). 바인딩 스키마는 canonical 문서 모델 영역(ADR-116/131/132 계보)으로 D2 컴포넌트 props 확장이 아니다. Spec/Generator 확장 아님 — Generator 자식 selector emit 질문 해당 없음.

**Hard Constraints**:

1. **60fps**: 행 보간은 projection/렌더 hot path — slot 당 템플릿 compile 1회(행 루프 밖), 행별 적용은 토큰 수 O(k). Skia 는 샘플 ≤10행(ADR-157), DOM 은 기존 windowing.
2. **D3 시각 대칭**: Skia(샘플 데이터)와 DOM(실데이터)이 **동일 shared resolver** 산출을 렌더 — consumer 별 자체 파싱 0건.
3. **BC**: 템플릿 토큰 없는 기존 문서는 현행 휴리스틱 결과와 bit-동일 (vitest 계약). 저장 문서의 api/variable/route 사용은 dev stage 실측 예상 0건 (Phase 0 inventory 로 수식화 — 0건 확증 시 마이그레이션 불필요).

**Soft Constraints**:

- 일관 인터페이스: collection 패밀리 전체(ListBox/GridList/Table/Select/ComboBox/TagGroup/Menu)가 동일 문법·동일 오소링(ComboBox 피커+자유 입력)을 공유.
- Table 은 array/object 값 필드가 셀 안 다른 컴포넌트(Select/Toggle 등)로 렌더될 수 있음 — 모델이 이 확장을 막지 않아야 함.

## Alternatives Considered

### 대안 그룹 1 — 바인딩 모델/문법 범위

#### 대안 A: 단순 `{field}` 토큰만

- 설명: flat 필드 토큰 + literal 혼합 + 이스케이프. 경로/포맷/컴포넌트 셀 없음.
- 근거: Mustache/Handlebars 의 최소 부분집합 — 업계 표준 문법과 호환 방향.
- 위험: 기술(L — 정규식 토크나이저 수준) / 성능(L — O(k)) / 유지보수(M — object/array 요구가 오면 문법 재설계 위험) / 마이그레이션(L — 신규 가산 기능)

#### 대안 B: A + 경로(`{a.b.c}`) + 포맷(`{d|date}`) + array/object → 컴포넌트 placeholder (read-only)

- 설명: 재귀 BindingNode 를 목표 모델로 두되 text-leaf 부터 구현. array/object 필드는 Skia=정적 컴포넌트 시각+샘플값 배치, DOM=기존 RAC. write-back 없음.
- 근거: Webflow CMS binding / Framer collection field / Pencil 계열 빌더의 필드 바인딩이 모두 "경로+포맷 텍스트 바인딩 → 컴포넌트 바인딩" 2단 구조. columnMapping(`FieldType` 스칼라 7종, `packages/shared/src/types/element.types.ts:45-70`)이 못 담는 array/object 를 모델 차원에서 수용.
- 위험: 기술(M — 경로 해석·placeholder projection) / 성능(L — compile 1회 원칙 동일) / 유지보수(L — 목표 모델이 확장을 흡수) / 마이그레이션(L)

#### 대안 C: B + write-back(interactive 셀) + 교차 컬렉션 lookup

- 설명: 셀 Select/Toggle 변경이 데이터 소스에 기록, foreign-key 조회.
- 근거: Retool/Appsmith 급 데이터 그리드.
- 위험: 기술(H — 데이터 mutation·optimistic·상태 관리 전면) / 성능(M) / 유지보수(H — 저장 계약이 빌더 밖 데이터 계층과 결합) / 마이그레이션(M)

### 대안 그룹 2 — 데이터 소스 표면

#### 대안 D: 오소링 표면만 dataTable 단일화 (runtime 경로 잔존)

- 설명: `SOURCE_OPTIONS` 를 dataTable 단일로 축소, api/variable/route runtime 분기는 비노출 잔존.
- 위험: 기술(L) / 성능(L) / 유지보수(M — dead path 잔존, `feedback-css-not-imported-but-live-dead-trap` 유형) / 마이그레이션(L)

#### 대안 E: 오소링 + runtime + 관리 UI 전체 제거

- 설명: D + `useCollectionData` api/variable/route 분기, `ApiEndpointList`/`VariableList` 물리 제거.
- 위험: 기술(M — 소비처 전수 확증 필요) / 성능(L) / 유지보수(L — 코드 감소) / 마이그레이션(L — dev stage 사용 0건 전제, Phase 0 실측)

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |    M     |      L       |     0      |
| B    |  M   |  L   |    L     |      L       |     0      |
| C    |  H   |  M   |    H     |      M       |     2      |
| D    |  L   |  L   |    M     |      L       |     0      |
| E    |  M   |  L   |    L     |      L       |     0      |

루프 판정: HIGH+ 0개 대안(A/B/D/E)이 존재 — 새 대안 추가 불필요. C 는 HIGH 2로 본 ADR 범위에서 기각.

## Decision

**대안 B(목표 모델) + 구현은 A→B 순 phase** 및 **대안 E(단계적 — 오소링 축소 선행, 물리 제거는 소비처 0 확증 후)** 를 선택한다.

1. **바인딩 primitive = 재귀 BindingNode, 목표 문법 B**: `{field}` 토큰(다중 필드·literal 혼합)이 primitive — 단일 필드 피커로는 `{num} {email}` 같은 조합을 표현할 수 없다. 오소링은 ComboBox(자유 입력 + 컬럼 피커 → 커서 위치 `{key}` 삽입)로 입력·선택을 결합한다.
2. **consumer 분리**: Skia(빌더) = 샘플 데이터 보간·정적 배치만 / DOM(Preview·Publish) = 실데이터 + RAC 동작. 두 consumer 가 `packages/shared` 단일 resolver 를 소비 (D3 대칭 담보). write-back·교차 lookup(대안 C 영역)은 DOM 데이터 계층 소관으로 **후속 ADR**.
3. **데이터 소스 = dataTable 단일**: 모든 동적·정적 데이터는 collection 방식 단일 계보(ADR-132) — 피커는 테이블명 선택만 남긴다.

위험 수용 근거: B 의 기술 M(경로 해석·placeholder projection)은 phase 후행 배치(P5)로 격리 — P1~P4 는 A 수준 위험으로 대칭·BC 를 먼저 증명한다. E 의 기술 M 은 Phase 0 inventory 소비처 0 확증을 물리 제거의 선행 조건으로 걸어 흡수한다.

기각 사유:

- **대안 A 단독 기각**: Table array/object 셀 요구(Context Soft Constraint)가 확정 방향인데 A 는 문법 재설계 없이 수용 불가 — 목표 모델을 B 로 두지 않으면 P5 시점에 문법 BC 파괴.
- **대안 C 기각**: HIGH 2 (기술/유지보수). write-back 은 빌더 렌더 대칭과 독립된 데이터 mutation 문제 — 본 ADR 에 결합하면 P1~P4 의 경량 증명까지 인질이 된다. 후속 ADR 로 분리.
- **대안 D 단독 기각**: dead path 영구 잔존은 "인프라 존재 ≠ 가동 경로" 함정(`feedback-infra-exists-vs-wired-consumption-path`)을 늘린다. 단 물리 제거는 소비처 0 확증 게이트(G4) 뒤에만 — 확증 실패 시 D 상태로 보류하고 residual 기록.

> 구현 상세: [159-collection-field-template-binding-breakdown.md](design/159-collection-field-template-binding-breakdown.md)

## Risks

| ID  | 위험                                                                                                      | 심각도 | 대응                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Skia 샘플 ↔ DOM 실데이터 시각 대칭 발산 (보간 로직 이중화 시)                                             |  HIGH  | 단일 resolver 강제 (G2) + `/cross-check` (G1)                                                                                                                                             |
| R2  | 기존 휴리스틱 의존 문서 회귀 (토큰 없는 문서의 표시 변화)                                                 |  MED   | BC fallback 계약 vitest (G3)                                                                                                                                                              |
| R3  | columnMapping/Field-children 기존 경로와 이중 SSOT (`ListBox.tsx:442`, `CollectionRenderers.tsx:245-268`) |  HIGH  | Phase 0 소비처 판정 → 신규 오소링은 템플릿 단일, columnMapping 은 P5 컴포넌트 셀 계보로만 수렴 (G2). ADR-152 fieldMap 은 비텍스트 역할(icon/value) 한정으로 축소 (경계 재획정 2026-07-21) |
| R4  | api/variable/route 물리 제거 시 잔존 소비처 파손 (`useCollectionData.tsx` dispatch, `services/api/*`)     |  MED   | 소비처 0 grep 확증 후에만 제거 (G4), 실패 시 대안 D 상태 보류                                                                                                                             |
| R5  | projection hot path 성능 저하 (행별 재compile + scene rebuild 별 재compile)                               |  MED   | compile 행 루프 밖 1회 계약 — P2 리뷰에서 위치 확인. rebuild 반복 compile 은 template string 키 캐시(WeakMap/Map by text)로 흡수 — 대형 scroll window(A2 가상화) 대비                     |
| R6  | P5 array/object placeholder projection 범위 확대 (Skia 셀 컴포넌트 시각)                                  |  MED   | Skia 는 정적 배치+샘플값만 (동작 없음 — D1 소관 분리), P5 진입 전 사용자 우선순위 confirm                                                                                                 |

## Gates

| Gate | 시점             | 통과 조건                                                                                                      | 실패 시 대안                                 |
| ---- | ---------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| G1   | P3 종료          | `/cross-check` — ListBox/GridList/Table 샘플 행의 Skia 보간 텍스트 ↔ DOM 동일 템플릿 산출 시각 대칭 + live 1회 | 발산 지점 debugger 위임, phase 종결 보류     |
| G2   | P1·P2·P3 각 커밋 | 보간 로직이 shared 단일 심볼 경유 — consumer 자체 `{...}` 파싱 grep 0건                                        | 해당 커밋 reject, resolver 경유로 재작성     |
| G3   | P1 종료          | 토큰 없는 입력 → `getItemLabel`/`getItemDescription` 휴리스틱 결과와 동일 (vitest)                             | fallback 계약 수정 전 P2 진입 금지           |
| G4   | P4c 진입 전      | api/variable/route 소비처 grep 0건 + 저장 문서 사용 0건 실측                                                   | 물리 제거 보류 (대안 D 상태) + residual 기록 |

## Consequences

### Positive

- 사용자가 이미 시도한 오소링 방식(`{num}` `{email}` slot 텍스트)이 그대로 동작 — 임의 컬럼 표시 가능.
- collection 패밀리 전체가 하나의 문법·하나의 오소링 UI — Table 복합 셀(array/object)까지 같은 primitive 로 확장.
- 데이터 피커가 테이블명 선택 단일로 단순화 — 미사용 표면(api/variable/route) 제거.
- Skia/DOM 이 단일 resolver 를 소비 — 보간 차원의 D3 대칭이 구조적으로 담보.

### Negative

- `SlotComposition` 운반 축 +1 (text) — ADR-148 소비처가 필드를 무시해도 동작하지만 계약 표면 증가.
- columnMapping 텍스트 계보는 legacy 격하 — P5 까지 두 메커니즘이 공존하는 기간 발생.
- P5(경로/포맷/컴포넌트 placeholder) 전까지 object/array 필드는 여전히 표시 불가.
