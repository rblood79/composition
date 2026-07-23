# ADR-159 구현 상세: Collection 필드 템플릿 바인딩 + dataTable 단일 소스

> 본 문서는 [ADR-159](../159-collection-field-template-binding.md)의 구현 분해다. 결정 근거·대안·위험은 ADR 본문이 정본이며, 여기는 phase·파일 경계·계약만 다룬다.

## §1. 전제 lock-in (fork checkpoint 대체 — 신규 주제 ADR)

본 ADR 은 기존 ADR 의 분리/fork 가 아닌 신규 주제다. 다만 인접 ADR 과의 경계를 1줄씩 고정한다:

1. **ADR-157 (표시 정책) 과 직교**: 157 은 "몇 행을 보여주나"(sample+hatch), 본 ADR 은 "행 안에 무엇을 채우나"(필드 텍스트). 소비 지점(`appendListBoxRowProjection`)이 겹치지만 결정은 독립.
2. **ADR-132 (collections 진입점) 의 후속 응용**: `useCollectionData` 단일 경유 계약을 그대로 소비. 진입점 재설계 없음.
3. **ADR-148 (slot 구성) 의 확장**: `SlotComposition` 이 운반하는 축을 구성·스타일에서 **+텍스트 템플릿**으로 1필드 확장. 구성 SSOT(=origin 문서 자식) 원칙 불변.
4. **의존 방향**: 본 ADR 이 base(바인딩 primitive), Table 컴포넌트 셀 write-back/교차 lookup 은 응용(후속 ADR). 역전 없음.
5. **ADR-152 (바인딩 통합) 와 경계 재획정 — 2026-07-21 사용자 confirm (AskUserQuestion "경계 재획정 — 둘 다 유지")**: 152 = 계약 인프라 축(id 참조 계약 v2 / 읽기 경로 일원화 / publish 직렬화 / store 이중화 정리), 본 ADR = 표시 축(텍스트 슬롯 `{field}` 템플릿 + 오소링 ComboBox + dataTable 단일 소스). 152 의 fieldMap 은 비텍스트 역할(icon/value) 한정으로 축소 개정 — label/description 텍스트 표시는 본 ADR 템플릿이 정본. 152 의 API source 유지 전제(구 Phase 6 publish 직접 fetch)는 본 ADR dataTable 단일 방향으로 개정. 두 ADR 이 `PropertyDataBinding.tsx` 를 공유 수정하므로 본 ADR P4b(소스 단일화)가 선행하면 152 Phase 2 는 그 축소된 표면 위에서 진행.
6. **ADR-162 (GridList composed 카드) 의 base — 2026-07-24 사용자 confirm ("159 base 의존 재획정")**: 162 가 본 ADR P1 resolver(임의 템플릿 자식 string prop 보간) + P4 오소링 패턴(임의 자식 prop 편집면)을 소비한다. 본 ADR 계약 무변 — P1 구현 시 slot 텍스트 특정 가정을 넣지 말 것 (§2-2 시그니처의 string 일반성 유지). 162 Phase 2 는 본 ADR P1, 162 Phase 5 는 본 ADR P4 Implemented 가 선행 조건.

## §2. 계약 정의

### 2-1. 템플릿 문법 (목표 = 문법 B, Phase 1 구현 = A 부분집합)

| 요소         | 문법                                | 예시                 | Phase |
| ------------ | ----------------------------------- | -------------------- | :---: |
| 필드 토큰    | `{fieldKey}`                        | `{num}`, `{email}`   |  P1   |
| literal 혼합 | 텍스트 + 토큰                       | `No.{num} — {email}` |  P1   |
| 이스케이프   | `{{` → literal `{`                  | `{{num}}` → `{num}`  |  P1   |
| 미지 필드    | 빈 문자열 치환 (throw 금지)         | `{nope}` → `""`      |  P1   |
| 경로 접근    | `{a.b.c}` / `{arr[0].x}`            | `{address.city}`     |  P5   |
| 포맷         | `{field\|fmt}` (date/number 최소셋) | `{createdAt\|date}`  |  P5   |

- 토큰 판정: `{` `}` 로 감싼 식별자(`[A-Za-z_$][\w$.\[\]]*`). 매칭 실패 조각은 literal 보존.
- **BC fallback 계약 (G3)**: slot 텍스트에 토큰이 하나도 없으면 → 기존 `getItemLabel`/`getItemDescription` 휴리스틱 결과 그대로 (`resolveCollectionItems.ts:263-286`). 템플릿 존재 시에만 보간이 이긴다.

### 2-2. 단일 resolver (G2)

- 위치: `packages/shared/src/collections/fieldTemplate.ts` (신규)
- 심볼: `compileFieldTemplate(text): CompiledTemplate | null`(토큰 0개면 null) / `interpolateFieldTemplate(compiled, rowItem): string`
- 소비처는 **이 두 심볼만** import. consumer 내 자체 `{...}` 파싱 0건 (grep gate).
- 성능: slot 당 compile 1회(행 루프 밖), 행별 interpolate 는 토큰 수 O(k). Skia 는 샘플 ≤10행(ADR-157), DOM 은 기존 windowing.

### 2-3. SlotComposition 텍스트 운반 (ADR-148 확장)

- `SlotChildConfig` 에 `text?: string` 추가 (`packages/shared/src/catalog/slotRoles.ts:79-85` — 2026-07-24 라인 재확인) — `resolveSlotComposition` 이 slot 자식 `props.text ?? props.children`(string 한정) 캡처.
- `readSlotComposition` 방어 판독에 동일 필드 통과.
- 소비처(BC): 기존 소비처는 `text` 를 몰라도 동작 불변 (optional 필드).

### 2-3-1. 템플릿 소스 precedence + 커버리지 (P1 리뷰 발견 — 명세 lock-in)

라이브 seed 실측: 하나의 origin ListBoxItem 이 **item 자체 `props.children`**(예 `{name}`) + **slot 자식 Text `props.text`**(label=`{num}` / description=`{email}`)를 **동시 보유**한다. "어느 소스가 label 텍스트인가"를 확정하지 않으면 소스 분열 버그(`feedback-merged-style-map-kills-override-detection` 유형) 재발한다.

**precedence 계약 (P2 구현 준수)**:

1. slot 구성(`_slots`)이 존재하고 해당 role(label/description)에 slot 자식 `text` 가 있으면 → 그 slot 자식 text 가 **template 정본**. item 자체 `props.children`/`textValue` 는 **superseded**(무시).
   - 근거: 사용자가 slot Text 에 `{num}` 을 넣은 의도가 정본. item 자체 children 은 seed 기본값(레거시 축).
2. slot 구성이 없거나(null) 해당 role slot 자식이 없으면 → **item 자체 `props.children`/`textValue`** 를 template 소스로 사용(flat/legacy 저작 커버). 여기에도 토큰이 없으면 → §2-1 BC fallback(휴리스틱).
3. **커버리지 명시**: 보간은 (1) slot-child text + (2) item-level children/textValue **양쪽** 을 대상으로 한다. slot 경유만 배선하면 flat item(`props.children:"{num}"`, slot 없음)이 보간 누락된다 — 이 케이스 P2 vitest 에 포함.

precedence 판정은 shared 헬퍼 1곳(`resolveRowTemplateSource(slotComposition, role, itemProps)`)에 집약 — Skia projection 과 DOM 렌더가 동일 판정 공유(G2 대칭).

### 2-4. BindingNode 재귀 모델 (목표 모델 — P5+/후속 ADR 수용 형태)

```
BindingNode = {
  source: path              // {field} · {a.b.c} — P1/P5
  renderForm: text | component
  template?, format?        // text leaf — P1/P5
  component?, itemTemplate? // array/object → 컴포넌트 placeholder(Skia)/RAC(DOM) — P5+
  direction?, writeTarget?  // read-write — 후속 ADR (본 ADR 범위 밖)
}
```

Phase 1~4 는 이 모델의 text-leaf 부분만 구현하되, 문법·자료구조가 상위 확장을 막지 않는지 P1 리뷰에서 확인.

## §3. Phase 분해

### Phase 0 — inventory (커밋 1) — ✅ Implemented 2026-07-24

- [x] `dataBinding.source` 값별 소비처 전수 grep: `"api"` / `"variable"` / `"route"` — `useCollectionData.tsx` dispatch, `PropertyDataBinding.tsx`, `ApiEndpointList.tsx`, `VariableList.tsx`, `services/api/*` (§5-1)
- [x] `columnMapping` 소비처 전수 grep (`ListBox.tsx:442` Field 모드, `CollectionRenderers.tsx:245-268`, Select/RadioGroup/ToggleButtonGroup) — 본 ADR 과의 관계 판정 기록 (§5-2: 텍스트 계보 legacy 격하 / P5 컴포넌트 셀 계보 수렴)
- [x] 기존 저장 문서의 api/variable/route 사용 실측 (§5-3: 로컬 IndexedDB 0건 확증, Supabase 전체는 RLS 로 G4 재실측 이연)
- 산출: 본 문서 §5 에 inventory 표 추가 ✅

### Phase 1 — shared resolver + BC 계약 (커밋 1~2)

- [ ] `packages/shared/src/collections/fieldTemplate.ts` 신규 (compile/interpolate + 이스케이프/미지 필드)
- [ ] `resolveCollectionItems.ts` 통합점: `toItemProjectionRow` 는 불변(휴리스틱 유지) — 보간은 소비 측 오버레이 (row.item 보존됨)
- [ ] vitest: 문법 표 전 케이스 + BC fallback (토큰 없음 → 휴리스틱 동일) + 이스케이프 + 미지 필드
- [ ] **slot 단위 독립 fallback** vitest (LOW 발견): label 슬롯 template 없음 → children=휴리스틱, description 슬롯 template 있음 → description=보간 — **혼합 상태**가 role 별 독립으로 판정되는지 (한 slot 의 template 유무가 다른 slot 판정에 영향 없음)
- Gate: G2 (단일 심볼), G3 (BC — slot 단위 독립 포함)

### Phase 2 — Skia projection 배선 (커밋 1)

- [ ] `resolveSlotComposition` 텍스트 캡처 (§2-3)
- [ ] `appendListBoxRowProjection` (`canvasSceneNode.ts:987-989`): label/description 슬롯 템플릿 존재 시 `interpolate(compiled, row.item)` 로 `children`/`description`/`textValue` 대체, 없으면 기존 `row.label` — GridList/Table(셀 텍스트) 프로젝터 동일 적용
- [ ] compile 은 행 루프 밖 1회 (projection 함수 선두)
- [ ] vitest: projection 산출 rowProps 검증 (템플릿 유/무 × 필드 유/무)
- live: builder 에서 Users(num/email/name) ListBox 가 `{num}`/`{email}` 표시 — Chrome MCP 확인

### Phase 3 — DOM/Preview 배선 (커밋 1)

- [ ] `ListBox.tsx` / `GridList.tsx` / `Table.tsx` 데이터 경로 행 렌더에서 동일 resolver 소비 (slot 텍스트 템플릿 → row.item 보간; 템플릿 없으면 기존 `item.label`)
- [ ] Preview 실데이터로 확인 (runtime store 경유 — builder store 아님)
- Gate: G1 — `/cross-check` 샘플 시각 대칭 (Skia 샘플 텍스트 형태 ↔ DOM 동일 템플릿 산출)

### Phase 4 — 오소링 UI + dataTable 단일 소스 (커밋 2)

- [ ] **4a 필드 피커**: slot Text 편집 UI 에 ComboBox(자유 입력 + 바인딩된 collection 컬럼 목록 드롭다운). 피커 선택 → 커서 위치 `{key}` 삽입. 컬럼 목록 = owner 의 dataBinding collection 컬럼 (`readTableColumns` 계보)
- [ ] **4b 소스 단일화**: `PropertyDataBinding.tsx` `SOURCE_OPTIONS`(108-112) → dataTable 단일. 소스 선택 UI 제거, collection(테이블명) ComboBox 만 노출. `DataBindingValue.source` 는 `"dataTable"` 고정 기록
- [ ] **4c 잔존 경로 정리** (Phase 0 소비처 0 확증 시에만, 별도 커밋): `useCollectionData` api/variable/route 분기 + `ApiEndpointList`/`VariableList` 관리 UI 제거. 확증 실패 시 residual 로 기록 후 보류
- Gate: G4

### Phase 5 — 문법 B 확장 (경로 + 포맷 + array/object 컴포넌트 placeholder) (커밋 2+)

- [ ] `{a.b.c}` / `{arr[0]}` 경로 해석 (resolver 내부만 — 소비처 무변)
- [ ] 포맷 최소셋 (`date`/`number`) — 확장 지점 명시
- [ ] array/object 필드 → Table 셀 컴포넌트 placeholder: Skia = 정적 컴포넌트 시각 + 샘플값 배치만, DOM = 기존 RAC (Select/Toggle/TagGroup) + columnMapping 계보 재사용. **write-back/교차 lookup 은 본 phase 도 범위 밖** (후속 ADR)
- 진입 조건: Phase 1~4 Implemented + 사용자 우선순위 확인

### Phase 6 — 종결

- [ ] `/cross-check` 최종 + live behavior 종합 1회 (ADR-144 게이트)
- [ ] Status Implemented + closure 5단계 (README/CHANGELOG)

## §4. 파일 변경 요약

| 파일                                                                   | Phase | 변경                                               |
| ---------------------------------------------------------------------- | :---: | -------------------------------------------------- |
| `packages/shared/src/collections/fieldTemplate.ts`                     |  P1   | 신규 — compile/interpolate                         |
| `packages/shared/src/catalog/slotRoles.ts`                             |  P2   | `SlotChildConfig.text` 추가                        |
| `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`   |  P2   | projection 행 텍스트 보간 (ListBox/GridList/Table) |
| `packages/shared/src/components/{ListBox,GridList,Table}.tsx`          |  P3   | DOM 행 렌더 보간                                   |
| `apps/builder/src/builder/components/property/PropertyDataBinding.tsx` |  P4   | SOURCE_OPTIONS → dataTable 단일                    |
| slot Text 편집 UI (P0 inventory 로 특정)                               |  P4   | 필드 피커 ComboBox                                 |
| `packages/shared/src/hooks/useCollectionData.tsx` 외                   |  P4c  | 조건부 — api/variable/route 경로 제거              |

## §5. Phase 0 inventory 결과 (2026-07-24 실측)

### 5-1. `dataBinding.source` = api/variable/route 소비처 전수

| 분류               | 위치                                                                  | 내용                                                    | 판정                                                                     |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| 오소링 UI          | `PropertyDataBinding.tsx:78,108-112,147-159,327-421`                  | `SOURCE_OPTIONS` 4종 + source 별 편집 분기              | **P4b 축소 대상**                                                        |
| runtime (builder)  | `apps/builder/src/builder/hooks/useCollectionData.ts:326,401,421,507` | `source==="api"` dispatch                               | P4c 제거 후보                                                            |
| runtime (shared)   | `packages/shared/src/hooks/useCollectionData.tsx:331,411,436,522`     | 동일 (shared 이중화 사본)                               | P4c 제거 후보                                                            |
| preview            | `apps/builder/src/preview/hooks/useDataSource.ts:435-473`             | dataTable/api/variable/route 4-way dispatch             | P4c 제거 후보                                                            |
| renderer           | `TableRenderer.tsx:96,241` / `DataTableComponent.tsx:28`              | legacy api 판정 분기                                    | P4c 제거 후보                                                            |
| **factory 기본값** | `apps/builder/src/builder/factories/definitions/DataComponents.ts:42` | DataTable factory 가 `source:"api"` + MOCK_DATA 로 생성 | **P4b 에서 dataTable 기본 전환 필수** (신규 api 기록의 현행 유일 생성원) |
| AI tool            | `apps/builder/src/services/ai/tools/createElement.ts:79`              | `source:"api"` 생성                                     | P4b 동시 전환                                                            |
| 관리 UI            | `panels/datatable/components/{ApiEndpointList,VariableList}.tsx`      | api endpoint / variable 목록 관리                       | P4c 제거 후보                                                            |
| Skia 시각화        | `workspace/canvas/skia/workflowEdges.ts:247,312,330-331`              | binding source 시각화 sourceType                        | P4c 동시 정리                                                            |
| services/api       | `apps/builder/src/services/api/{ErrorHandler,index,mocks}`            | MOCK_DATA fetch 계층                                    | P4c 판정 (mocks 는 dataTable seed 로 전용 가능)                          |
| 무관 (동명 축)     | `eventEngine.ts:1074` / `eventTypes.ts:294` / `BuilderCore.tsx:858`   | 이벤트 payload `"response"\|"variable"\|"static"`       | 본 ADR 무관 — 제거 금지                                                  |
| 무관 (동명 축)     | `inspector/types.ts:80,93` / `element.types.ts:38`                    | inspector/DataSource 별개 타입 축                       | 본 ADR 무관 — 제거 금지                                                  |

### 5-2. `columnMapping` 소비처 전수 — 판정: 텍스트 계보 legacy 격하, P5 컴포넌트 셀 계보로만 수렴

| 분류          | 위치                                                                                                             | 판정                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Field 렌더    | `ListBox.tsx:442,514` / `CollectionRenderers.tsx:245-268,281,287,403`                                            | 텍스트 표시 축은 본 ADR 템플릿이 정본 (신규 배선 금지) |
| 컴포넌트 통과 | `{GridList,Tabs,Breadcrumbs,ComboBox,Menu,Table,CheckboxGroup,TagGroup,RadioGroup,Select,ToggleButtonGroup}.tsx` | props 통과 — P5 컴포넌트 셀 계보 재사용 후보           |
| 타입          | `element.types.ts`(FieldType) / `unified.types.ts` / `composition-document.types.ts` / `inspector/types.ts`      | 유지 (P5 스칼라 셀 계보)                               |
| 오소링        | `ListBoxItemEditor.tsx:35` / `listBoxTemplateOrigins.ts` / `SelectionComponents.ts`                              | legacy 안내 유지 — 신규 오소링은 템플릿 단일 (R3)      |
| 추론/문서     | `columnTypeInference.ts` / `templateBinding.ts:11` / `Table.binding.ts`                                          | 유지                                                   |

### 5-3. 저장 문서 api/variable/route 사용 실측

| 대상                                                          | 방법                                              | 결과                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 로컬 IndexedDB `documents`(1) + `documents_backup`(10), 278KB | 전 store JSON 스캔 (`"dataBinding"` / `"source"`) | **dataBinding 자체 0건 → api/variable/route 0건 확증**                                     |
| Supabase 전체 프로젝트                                        | REST anon 조회                                    | RLS 차단 — 세션 credential 추출은 부적절하여 미실측. **G4 (P4c 진입 전) 재실측 의무 유지** |

BC 수식화: 측정 가능 범위 사용 0건 — 단 factory 기본값(5-1)이 `source:"api"` 를 계속 생성하므로 P4b 기본값 전환이 선행돼야 "신규 유입 0" 이 성립.
