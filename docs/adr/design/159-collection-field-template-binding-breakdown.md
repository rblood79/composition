# ADR-159 구현 상세: Collection 필드 템플릿 바인딩 + dataTable 단일 소스

> 본 문서는 [ADR-159](../completed/159-collection-field-template-binding.md)의 구현 분해다. 결정 근거·대안·위험은 ADR 본문이 정본이며, 여기는 phase·파일 경계·계약만 다룬다.

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

### Phase 1 — shared resolver + BC 계약 (커밋 1~2) — ✅ Implemented 2026-07-24

- [x] `packages/shared/src/collections/fieldTemplate.ts` 신규 (compile/interpolate + 이스케이프/미지 필드 + R5 compile 캐시 Map by text)
- [x] `resolveCollectionItems.ts` 통합점: `toItemProjectionRow` 는 불변(휴리스틱 유지) — 보간은 소비 측 오버레이 (row.item 보존됨, 변경 0)
- [x] vitest: 문법 표 전 케이스 + BC fallback (토큰 없음 → 휴리스틱 동일) + 이스케이프 + 미지 필드 (`fieldTemplate.test.ts` 15 케이스)
- [x] **slot 단위 독립 fallback** vitest (LOW 발견): label/description 혼합 상태 role 별 독립 판정 lock-in
- Gate: G2 ✅ (단일 심볼 — consumer 자체 brace 파싱 grep 0건), G3 ✅ (BC — slot 단위 독립 포함)
- 명세 보정 1건: compile null 판정은 "토큰 0 **그리고 이스케이프 0**" — 이스케이프만 있는 `{{num}}` 은 §2-1 예시(`{num}` 표기 의도)대로 non-null 처리 (§2-2 문구와 §2-1 예시의 충돌을 §2-1 우선으로 해소)

### Phase 2 — Skia projection 배선 (커밋 1) — ✅ Implemented 2026-07-24

- [x] `resolveSlotComposition` 텍스트 캡처 (§2-3) — `SlotChildConfig.text` (`props.text ?? props.children`, string 한정). `readSlotComposition` 은 config passthrough 라 무변경 통과
- [x] `appendListBoxRowProjection`: label/description 슬롯 템플릿 존재 시 `interpolate(compiled, templateItem)` 로 `children`/`description`/`textValue` 대체, 없으면 기존 `row.label` — GridList 동일 적용. **Table 은 P2 비적용 판정**: 셀은 `col.id` 직접 필드 매핑이라 템플릿 소스(슬롯/anchor 텍스트) 자체가 부재 — 셀 템플릿은 오소링 표면이 생기는 P4/P5 에서 (§5-2 columnMapping 계보)
- [x] precedence 헬퍼 `resolveRowTemplateSource` + 보간 record `buildCollectionRowTemplateItem` (shared, §2-3-1)
- [x] compile 은 행 루프 밖 1회 (projection 함수 선두, R5 캐시 병용)
- [x] vitest: projection 산출 rowProps 검증 6 케이스 (`canvasSceneNode.test.ts` — slot 템플릿 / literal BC / seed 가상 필드 / flat item-level / 소스 전무 / GridList)
- [x] live: master(GridListItem/Default) label slot text `{label}` → `#{label}` 편집 → Home GridList 인스턴스 Skia 카드 `#Desert Sunset`/`#Mountain Sunrise` 행별 보간 확인 → undo 원복 (Chrome MCP). CSS/DOM 무# 유지 = P3 전 비대칭 (G1 은 P3 게이트)
- **명세 보정 2 (가상 필드)**: 보간 record 는 raw `row.item` + projected 산출 4필드(label/description/icon/value) overlay — 시스템 seed slot text 가 이미 `{label}`/`{description}` 이라 raw item 만 보간하면 해당 필드 없는 데이터(num/email/name)에서 seed 행이 빈 문자열로 회귀(R2 위반). 가상 필드는 raw 동일 키 존재 시 휴리스틱이 그 값을 그대로 골라 무손실

### Phase 3 — DOM/Preview 배선 (커밋 1) — ✅ Implemented 2026-07-24

- [x] DOM 소비 지점 실측 정정: 템플릿 소비는 `components/*.tsx` 가 아니라 **renderer 층** (`SelectionRenderers.tsx`) — 기존 ad-hoc `resolveTemplateText` (자체 `{...}` regex, G2 위반 선재) 를 shared resolver 로 **교체**. slot text 미소비/literal 그대로 표시 문제가 이 파서의 결함이었음
- [x] `renderListBox` Path 1(템플릿 모드)·Path 2(items canonical) + `renderGridList` Path 1(구 literal props.label 반복 표시)·Path 2 — `compileRowTemplateFor`(shared precedence) + `interpolateCollectionRowTemplate`(가상 필드) 소비, compile 행 루프 밖 1회
- [x] `ListBox.tsx` / `GridList.tsx` 내부 기본·가상화 렌더 — `rowTemplateSources` optional prop (renderer 가 precedence 판정한 소스 전달) 로 bare-ref data-bound 인스턴스 커버. Table 은 P2 판정 동형 (템플릿 소스 부재 — 셀은 col.id 직접 매핑)
- [x] vitest 5 (`collectionRowTemplateAdr159.test.tsx` — slot precedence / flat item-level / literal→휴리스틱 G3 / seed 가상 필드 BC / GridList 보간)
- [x] live: builder compare split 양 패널 — master `{label}`→`#{label}` 편집 시 **CSS(DOM) 패널 `#Desert Sunset/#Hiking Trail/#Mountain Sunrise` ↔ Skia Home 패널 동일 `#…` 보간** 동시 확인 후 undo 원복. 새로고침 후 콘솔 에러 0
- Gate: G1 ✅ (게이트 정의 검증 그대로 — 샘플 행 Skia 보간 텍스트 ↔ DOM 동일 템플릿 산출 시각 대칭 + live 1회), G2 ✅ (ad-hoc 파서 제거 후 grep 0건 — 잔존 유일 히트 `useDataSource.ts:199` 는 API URL `{{param}}` 치환으로 행 텍스트 축 무관, P4c 제거 후보 경로)
- 잔존 기록: origin 이 slot 자식 없이 item-level 템플릿만 가진 bare-ref 인스턴스는 DOM renderer 가 origin props 에 접근 불가 (provider 는 slot 구성만 주입) — Skia 만 보간. seed origin 은 항상 slot text 보유라 실사용 노출 없음 (P4 오소링 도입 시 재평가)

### Phase 4 — 오소링 UI + dataTable 단일 소스 (커밋 2) — ✅ 4a/4b Implemented 2026-07-24 (4c 보류)

- [x] **4a 필드 피커**: `PropertyFieldTemplateInput`(자유 입력 + Braces 버튼 → collection 컬럼 Menu) 신규 — 피커 선택 시 커서 위치 `{key}` 삽입 + 즉시 commit. 컬럼 목록 = `useOwnerCollectionColumns`(조상 dataBinding/items 소유자 → 없으면 reusable master 조상의 소비자 인스턴스 역추적: direct ref + container-slot 2-hop). **live 경로는 `GenericFieldRenderer`(PropertiesPanel Properties view)** — CatalogInspectorFields 단독 배선으로는 미노출 (회귀 테스트 `GenericFieldRenderer.test.tsx` 4건). 라이브 회귀 1건 수정: master 가 페이지 body 에 중첩되면 체인 최상단 단독 reusable 판정이 실패 → 걷는 중 만난 reusable 조상 전수로 역추적 (`useOwnerCollectionColumns.test.ts` 8건)
- [x] **4b 소스 단일화**: `PropertyDataBinding.tsx` SOURCE_OPTIONS/소스 Select/route 입력 제거 — 컬렉션 피커 단일, 신규 기록 `source:"dataTable"` 고정 (api/variable/route 는 read 호환 잔존 + legacy 안내문). DataTable factory 기본 api binding 제거, AI create_element 의 api binding 생성 제거
- [ ] **4c 잔존 경로 정리** — **residual 확정 (사용자 confirm 2026-07-24 "P4c 는 residual 로 두고 P6 진행")**: 로컬 IndexedDB 는 api/variable/route 저장 문서 0건 확증했으나 Supabase 전체 프로젝트는 RLS 로 전수 실측 불가 (§5-3). `useCollectionData` api/variable/route 분기 + `ApiEndpointList`/`VariableList` 관리 UI 는 대안 D 상태로 잔존 (Decision 에 예정된 보류 경로 — 신규 유입은 P4b 로 0). 재개 조건: G4 재실측 후 별도 커밋 — ADR Implemented 와 독립
- Gate: G4 — 4c 진입 조건 미충족으로 4c 만 보류 (4a/4b 는 G4 무관)
- live 검증 (2026-07-24): Components 페이지 master GridListItem slot Text(`{role}`) 선택 → 피커 버튼 노출 → Menu 에 Users collection 10 필드 정확 노출 → `{num}` 선택 → `{role}{num}` 삽입+commit → Home 인스턴스 10행 전부 보간 반영 ("시스템 아키텍트1"…"QA 엔지니어10") → 원상 복구. GridList 인스턴스 Data 섹션 = 컬렉션 단일 피커 (소스 4종 UI 소멸). 콘솔 에러 0

### Phase 5 — 문법 B 확장 (경로 + 포맷 + array/object 컴포넌트 placeholder) (커밋 2) — ✅ Implemented 2026-07-24

- [x] `{a.b.c}` / `{arr[0].x}` 경로 해석 — resolver 내부만 (`fieldTemplate.ts` compile 시 `parseFieldPath` 1회 + interpolate traversal), 소비처 API 무변. **BC: flat key 정확 일치 항상 우선** — record 에 리터럴 dotted key 존재 시 P1 semantics 그대로, miss 일 때만 traversal (신규 가산). 가상 필드(label 등) 충돌 없음
- [x] 포맷 최소셋 `{field|date}`(ISO 접두는 TZ 시프트 없이 date part, 그 외 Date parse → `YYYY-MM-DD`) / `{field|number}`(en-US 천단위 — Skia↔DOM 대칭 위해 런타임 locale 비의존). **확장 지점 명시**: `FIELD_TEMPLATE_FORMATTERS` registry — formatter null 반환 = 미포맷 fallback (throw 금지), 미지 포맷 이름도 fallback. `{x|}` 불완전 포맷은 토큰 아님(literal 보존). vitest 9건 추가 (fieldTemplate 24)
- [x] array/object 필드 → Table 셀 컴포넌트 placeholder: 분류 단일 소스 `cellValue.ts::classifyTableCellDisplay` (G2 대칭) — **array → TagGroup 칩** (cap 3 + `+N` overflow; Skia = `appendTableRowProjection` 이 cell 을 flex 컨테이너로 emit + Tag 자식 노드(appendTagRowProjection 선례 동형, projection 메타는 cell 과 동일 table-cell) / DOM = `Table.tsx::renderTableCellValue` 가 read-only RAC TagGroup 렌더, JSON.stringify 3중복 셀 콜백 단일화), **object → 휴리스틱 label 텍스트** (구 "[object Object]"/JSON 노출 제거). `TableProjectionRow.rawCells` 추가(string `cells` 축은 BC 불변). **Select/Toggle placeholder 는 구현 축소 — §2-4 BindingNode component 축 확장 지점으로 이연** (read-only 빌더에서 object 의 정직한 최소 placeholder = label 텍스트; write-back 후속 ADR 과 함께 재평가). scalar 경로는 양쪽 다 기존과 bit-동일 (DOM boolean 미문자열화 passthrough 포함)
- write-back/교차 lookup 은 범위 밖 유지 (후속 ADR)
- 진입 조건 충족 기록: P1~P4(4a/4b) Implemented + 사용자 우선순위 confirm ("P5 진행해", 2026-07-24)
- live 검증 (2026-07-24): 경로+포맷 — master slot Text `{role}` → `{createdAt|date}` 편집 → Home 인스턴스 10행 전부 실데이터 날짜 `YYYY-MM-DD` 보간 확인 후 원상 복구 (경로/포맷 모두 동일 compile/interpolate live 배선 경유). **Table 셀 placeholder 는 live 노출면 0 실측** — 현 프로젝트 요소 50개 중 Table-typed 0 / array·object 셀 데이터 0 (store 전수 스캔), 팔레트 drop 도 빈 캔버스 거부로 scratch 산출 불가 → 칩/label 시각은 vitest 로 확증 (Skia scene-node 단언 1건 + DOM 정적 markup 6건). **잔존**: live 데이터로 array/object 셀이 생기는 시점(Table 사용 프로젝트 또는 P4c/후속 ADR)에 실화면 1회 재확인 — 미산출 입력 차원 한계 명시 ([[feedback-dual-run-diff-zero-blind-to-uncovered-input-dimension]] 유형)

### Phase 6 — 종결 — ✅ 2026-07-24

- [x] `/cross-check` 최종 + live behavior 종합 1회 (ADR-144 게이트): dist FRESH(.spec-rebuild-pending 없음 + dist 존재) / G2 grep 0건 / 컴포넌트 시각값(variants·sizes·토큰) 무변경 ADR 이라 5-레이어 이슈 0. live — fresh reload 콘솔 에러 0, CSS 패널 ↔ Skia 캔버스 카드 렌더 대칭(토큰 없는 텍스트의 G3 휴리스틱 경로), 보간 live 증적은 P4({num} 삽입 → 10행)·P5({createdAt|date} → 10행) 세션 내 2회
- [x] Status Implemented + closure 5단계 (README 카운트 169→170 / 미구현·진행 14→13, completed/ 이동 + 링크 정합화 5파일, CHANGELOG 엔트리). P4c 는 residual (§3 P4 — ADR Implemented 와 독립, G4 재실측 후 재개)

## §4. 파일 변경 요약

| 파일                                                                   | Phase | 변경                                                         |
| ---------------------------------------------------------------------- | :---: | ------------------------------------------------------------ |
| `packages/shared/src/collections/fieldTemplate.ts`                     |  P1   | 신규 — compile/interpolate                                   |
| `packages/shared/src/catalog/slotRoles.ts`                             |  P2   | `SlotChildConfig.text` 추가                                  |
| `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`   |  P2   | projection 행 텍스트 보간 (ListBox/GridList/Table)           |
| `packages/shared/src/components/{ListBox,GridList,Table}.tsx`          |  P3   | DOM 행 렌더 보간                                             |
| `apps/builder/src/builder/components/property/PropertyDataBinding.tsx` |  P4   | SOURCE_OPTIONS → dataTable 단일                              |
| `PropertyFieldTemplateInput.tsx` + `useOwnerCollectionColumns.ts` 신규 |  P4   | 필드 피커 (GenericFieldRenderer/CatalogInspectorFields 배선) |
| `packages/shared/src/hooks/useCollectionData.tsx` 외                   |  P4c  | 조건부 — api/variable/route 경로 제거                        |

## §5. Phase 0 inventory 결과 (2026-07-24 실측)

### 5-1. `dataBinding.source` = api/variable/route 소비처 전수

| 분류               | 위치                                                                  | 내용                                                    | 판정                                                                     |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| 오소링 UI          | `PropertyDataBinding.tsx:78,108-112,147-159,327-421`                  | `SOURCE_OPTIONS` 4종 + source 별 편집 분기              | **P4b 축소 대상**                                                        |
| runtime (builder)  | `apps/builder/src/builder/hooks/useCollectionData.ts:326,401,421,507` | `source==="api"` dispatch                               | P4c 제거 후보                                                            |
| runtime (shared)   | `packages/shared/src/hooks/useCollectionData.tsx:331,411,436,522`     | 동일 (shared 이중화 사본)                               | P4c 제거 후보                                                            |
| preview            | ~~`apps/builder/src/preview/hooks/useDataSource.ts:435-473`~~ 삭제됨  | dataTable/api/variable/route 4-way dispatch             | **제거 완료 (2026-07-24)** — dead module(소비처 0건) 실측 → G4 무관      |
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
