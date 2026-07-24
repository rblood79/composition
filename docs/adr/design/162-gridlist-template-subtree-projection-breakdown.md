# ADR-162 구현 상세: GridList 카드 템플릿 임의 자식 실체화 + row-data 동적 매핑

> 본문: [162-gridlist-template-subtree-projection.md](../162-gridlist-template-subtree-projection.md)

## 1. 전제 lock-in (adr-writing.md fork checkpoint 4 질문)

1. **base/응용 분류**: 본 ADR 은 **응용(구조 축)** — base 는 3개: [ADR-159](../completed/159-collection-field-template-binding.md)(`{field}` 보간 기계·오소링·dataTable 단일화), ADR-148(slot 구성 SSOT = origin 문서), ADR-161(GridList ref-composite). **2026-07-24 사용자 confirm (AskUserQuestion "159 base 의존 재획정")**: 보간·오소링은 159 소관을 소비하고, 본 ADR 은 구조 축(서브트리 실체화 + 카드 높이 실측 + escape gate)만 소유한다. 보간 엔진 제2 구현 금지 (159 grep gate: 소비처는 `compileFieldTemplate`/`interpolateFieldTemplate` 2심볼만 import).
2. **schema 직교성**: 신규 canonical schema 필드 없음 — composed 판정은 origin 자식 구성에서 파생, 바인딩 표현은 159 의 `{field}` 문법 그대로. 직교 위반 없음.
3. **선행 ADR 전제 reverse 검증**: ADR-148 Decision 3("구성 SSOT = origin 문서의 자식 구성") 방향 유지 — 반전 아님, 적용 범위 확대. ADR-159 의 consumer 분리(Skia=샘플 정적 배치 / DOM=실데이터+RAC 동작)도 그대로 승계.
4. **codex 1차 진입 전 위 3 질문 통과** — 본 문서 §1 lock-in 으로 충족.

**선행 의존 (진입 조건)**: Phase 2 진입 전 ADR-159 P1(shared resolver `fieldTemplate.ts`) Implemented 필수. Phase 5 진입 전 ADR-159 P4(오소링 ComboBox + dataTable 단일화) Implemented 필수.

## 2. 현행 병목 (Phase 0 조사 결과, 2026-07-24 라이브 실측)

- 사용자가 `component-gridlist-item-default` 에 Image 추가 → 자식 = [Image(무 slotRole), Text(description), Text(label)].
- `resolveSlotComposition`(packages/shared/src/catalog/slotRoles.ts:162)이 **인식된 slotRole 만 추출** → Image 드롭.
- 카드 렌더러 양측이 label/description 고정 재구성:
  - Skia: `gridlist_card` escape (packages/specs/src/renderers/skiaPrimitives.ts:468 `stackEntries: Array<"label"|"description">`, replace 모드 :3122)
  - DOM: `renderGridListItemSlotContent` (packages/shared/src/renderers/SelectionRenderers.tsx:162)
- projection(`appendGridListRowProjection`, canvasSceneNode.ts:1333)은 카드를 flat 합성 노드(label/description 문자열)로만 생성 — 서브트리 미실체화.
- **재사용 자산 (본 ADR 이 소비)**:
  - 보간: ADR-159 P1 `packages/shared/src/collections/fieldTemplate.ts` (`compileFieldTemplate`/`interpolateFieldTemplate`) — 예약/임의 필드·literal 혼합·미지 필드 정책 전부 159 정의를 따름
  - raw 데이터 행: `CollectionProjectionRow.item` (packages/shared/src/collections/resolveCollectionItems.ts:156)
  - ref 서브트리 실체화: `resolveCanonicalRefTree` (ADR-161)
  - instance root props 치환: `templateBinding.ts` propsSchema gate (ADR-148 P2 — 변경 없이 공존)

## 3. Composed 판정 (BC gate)

```
템플릿 origin(component-gridlist slot[0])의 자식 중
비-slot 자식(getSlotRole(child) === null)이 1개 이상 존재
  → composed 모드 (본 ADR 신규 경로)
전부 slot 자식(label/description/icon) 또는 자식 0
  → legacy slot 모드 (현행 escape/renderGridListItemSlotContent 무변경)
```

- 판정 함수는 shared 단일 심볼(`isComposedCollectionTemplate(children)`)로 두고 Skia projection / DOM renderer / layout 3 소비처가 공유 (Layer D 대칭 원칙).
- 기존 문서는 전부 slot-only → **BC 영향 0% (opt-in)**. 비-slot 자식을 추가하는 순간부터 composed.

## 4. 치환 적용 계약 (159 소비 — 순서만 본 ADR 이 규정)

- composed 카드 실체화 시 각 템플릿 자식의 **string prop** 에 159 resolver 적용: `compileFieldTemplate(prop)` (행 루프 밖 1회) → `interpolateFieldTemplate(compiled, row.item)` (행별). 문법·예약 키·미지 필드 정책은 159 정본 — 본 ADR 은 재정의하지 않는다.
- **치환 순서 계약**: ① propsSchema 템플릿 바인딩(instance root props — ADR-148 기존, `_resolvedFrom` 재귀 중단 규칙 유지, schema 키 한정) → ② 159 row-data 보간(카드 실체화 시점, 행별). ①은 schema 키 한정이라 row 필드와 충돌 없음. 토큰 없는 prop 은 원형 (compile null → 무비용 skip).
- 바인딩 가능 prop 판정(어느 prop 에 보간을 적용하나)은 §Phase 5 허용표와 동일 상수 공유.

## 5. Phase 분해

### Phase 0 — Inventory freeze (LOW)

- composed 판정 소비처 전수 grep 고정: projection / DOM renderer / layout §1.55c / rowMetric / 패널.
- 기존 gridlist 테스트 목록 고정 (spacing/dataBound/escape) — slot 모드 회귀 gate 기준선.
- ADR-159 P1 산출물(fieldTemplate 심볼 시그니처) 확인 — 미구현이면 본 ADR Phase 2 이후 보류.

### Phase 1 — composed 판정 primitive (LOW)

- `packages/shared/src/catalog/slotRoles.ts` 인접: `isComposedCollectionTemplate`.
- 단위 테스트: slot-only/혼합/자식 0/비정형 shape 판정.

### Phase 2 — Skia projection composed 모드 (HIGH) — 선행: 159 P1

- `appendGridListRowProjection`(canvasSceneNode.ts): composed 시 카드 노드를 box shell 컨테이너로 두고, 템플릿 서브트리를 행별 scene 자식으로 실체화 (ID: `${projectionId}::${templateChildId}`), string prop 에 159 보간 적용. slot-only 는 현행 경로 그대로.
- projected 자식 노드는 기존 traversal/layout 엔진 경로로 측정·렌더 (rows-group 은 이미 엔진 실측 — 신규 자식도 동일).
- `gridlist_card` escape: composed 카드에는 미적용(카드 = 일반 컨테이너 box), slot-only 에만 replace 유지.
- **interaction 계약 (리뷰 round 1 MED#2)**: 실체화 자식 scene 노드에 `projection.kind: "gridlist-card-child"`(신규) 부여 + `resolveCanvasInteractionTarget.ts` owner-redirect OR 목록·`ProjectionLike` union **동시 갱신** (:143 주석 계약 — 클릭 시 owner GridList 선택). render-space 경계 준수: projected 자식 ID 는 canonical mutation/영속 유입 금지 (canvas-rendering.md §9). 미등록 시 클릭 무반응(:127 `kind:"none"`) 또는 projected ID selection 유입.

### Phase 3 — DOM composed 모드 (HIGH) — 선행: 159 P1

- `renderGridList`(SelectionRenderers.tsx): composed 시 행별로 템플릿 서브트리 렌더(`context.renderElement` 재귀 + 보간된 props) — RAC `GridListItem` 자식으로 배치, `textValue` 는 row.label 유지.
- preview App.tsx `templateSlotCompositions.gridList` 채널에 composed 서브트리 전달 (기존 provider 채널 확장) — anchor-less ref 인스턴스에서 childrenByParent 로 origin 자식 접근 불가 문제 재사용 해결.

### Phase 4 — 카드 높이/가상화 실측 전환 (HIGH — 최대 위험)

- composed 모드: §1.55c(utils.ts) formula/`resolveCollectionRowMetric`(ADR-160) 대신 **대표 카드(템플릿 서브트리) 측정 높이** 사용. 템플릿 균일 → 행 높이 균일 가정(1차 범위, 행별 가변 높이는 후속).
- **측정 메커니즘 (리뷰 round 1 MED#1 — 타이밍 순환 정정)**: "scene 실체화 후 엔진 실측 주입" 은 불가 — scene build 는 layout **전**이라 엔진 산출이 없다 (현행 주입값도 `windowResolution.rowHeight` = formula, canvasSceneNode.ts:1380-1391). 대신 **단일 순수 측정 resolver `resolveComposedCardMetric(templateChildren)`** 를 신설한다: 엔진 후행 결과에 의존하지 않는 순수 함수(텍스트 측정 + 스택 합산 — `resolveCollectionRowMetric` 의 subtree 일반화)로, scene 주입(`_projectedRowsContentHeight`)·§1.55c·window stride 3소비처가 **공동 호출** (ADR-160 SSOT 원칙 동형). 엔진 실측과의 일치는 산출 후 G3 parity test 가 검증 (resolver 출력 = 엔진 실측 = DOM 실측).
- window stride(ADR-150 A2 `rowHeight`)도 동일 resolver 산출 소비 — 이원화 금지.
- spacing test 신설: composed 카드 높이 = 서브트리 엔진 실측 = DOM 실측 (parity oracle).

### Phase 5 — Content-Data 패널: 임의 자식 prop 오소링 확장 (MED) — 선행: 159 P4

- 159 P4 오소링(ComboBox 자유 입력 + 컬럼 피커 → `{key}` 삽입)을 **임의 템플릿 자식의 바인딩 가능 prop** 으로 확장: GridList 패널 Data 섹션에 템플릿 서브트리의 leaf prop 목록 (type별 허용표: Text.text/children, Image.src/alt, Button.children, Badge.children …) 을 나열하고 각각 159 오소링 입력을 부착 → origin 자식 props 에 `{컬럼}` 기록.
- 신규 UI 패턴 발명 금지 — 159 P4 컴포넌트 재사용. 저장 위치 = **origin 문서** (모든 인스턴스 공유 — ADR-148 Decision 3 정합). 인스턴스별 상이 매핑은 본 ADR 범위 외 (Consequences 에 기록).
- 컬럼 후보 = dataBinding 소스(dataTable 단일 — 159 P4b 이후)의 첫 행 키 (columnTypeInference 재사용).

### Phase 6 — cross-check + live 검증 + closure (MED)

- `/cross-check` gridlist (slot 모드 + composed 모드 각 1회).
- live: Image+Button 추가 → 인스턴스 카드 반영 + 패널 컬럼 매핑 → 행별 값 확인 (Chrome MCP).
- CHANGELOG + ADR closure 5단계.

## 6. 파일 변경 요약 (추정)

| 영역             | 파일                                                                                                                           | Phase |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----- |
| composed 판정    | packages/shared/src/catalog/slotRoles.ts(인접 신규 심볼)                                                                       | 1     |
| Skia projection  | apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts                                                             | 2     |
| interaction      | apps/builder/src/builder/workspace/canvas/interaction/resolveCanvasInteractionTarget.ts (kind OR + ProjectionLike union)       | 2     |
| 높이 resolver    | packages/specs/src/renderers/utils/collectionItemMetrics.ts (`resolveComposedCardMetric` 신설)                                 | 4     |
| Skia escape gate | packages/specs/src/renderers/skiaPrimitives.ts                                                                                 | 2     |
| DOM renderer     | packages/shared/src/renderers/SelectionRenderers.tsx                                                                           | 3     |
| preview 채널     | apps/builder/src/preview/App.tsx, types/index.ts                                                                               | 3     |
| layout/높이      | apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts, packages/specs/src/renderers/utils/collectionItemMetrics.ts | 4     |
| 패널             | apps/builder/src/builder/panels/properties/… (GridList Data 섹션 — 159 P4 컴포넌트 재사용), columnTypeInference                | 5     |
| 테스트           | composed 판정/spacing/escape/renderer contract (보간 자체 테스트는 159 소관)                                                   | 1–4   |

## 7. 테스트 전략

- Phase 1: composed 판정 단위 테스트 (RED 먼저). 보간 순서·문법 테스트는 159 소관 — 본 ADR 은 "치환 순서 계약 (§4)" 통합 테스트 1건만 (propsSchema 선행 + row 보간 후행).
- Phase 2/3: composed 판정 시 slot-only 경로 무변경 정적 가드 (기존 테스트 전량 GREEN 유지가 gate).
- Phase 4: composed 카드 높이 parity 테스트 (엔진 실측 = rowHeight resolver 출력).
- Phase 6: live behavior — 무엇을 exercise 했는지 커밋 검증 블록에 명시 (CLAUDE.md 완료 기준).

## 8. 명시적 범위 외 (후속)

- ListBox/Menu 로의 composed 모드 확산 (GridList proof 후 별도 phase 또는 별도 ADR).
- 행별 가변 카드 높이 (템플릿 균일 가정 해제).
- 인스턴스별 상이 컬럼 매핑 (origin 공유 매핑만 1차 지원).
- Button 등 인터랙티브 자식의 행 컨텍스트 이벤트 (row item 을 이벤트 payload 로 전달) — 이벤트 런타임(ADR-149 Wave 2 backlog)과 교차 지점.
- array/object 필드의 컴포넌트 placeholder — ADR-159 P5 소관 (본 ADR 은 실체화된 자식이 그 placeholder 를 담을 그릇만 제공).
