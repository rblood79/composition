# ADR-148 구현 상세 — Reusable·Slot 시스템 단일화

> 본 문서는 [ADR-148](../148-reusable-slot-system-unification.md) 의 구현 상세(Phase, 파일 경계,
> Gate 매핑, 체크리스트)다. 결정/위험/대안은 ADR 본문, **아키텍처 상세(스키마 계약·인덱스
> 구조·propsSchema·렌더 계약)는 [REUSABLE_SLOT_DESIGN.md](../../reference/components/REUSABLE_SLOT_DESIGN.md)
> §1~§5** 를 정본으로 참조한다. 실측 근거: [audits/2026-07-07-reusable-slot-landscape.md](../../reference/audits/2026-07-07-reusable-slot-landscape.md).

## §1. Fork checkpoint lock-in (adr-writing.md 4질문) + 통합 동기 분류

| 질문                       | 판정                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base/응용 분류             | **base = ADR-142** (조합=canonical reusable 문서, Implemented 2026-06-02) + **ADR-912 R-5** (조합=데이터 proof, Implemented 2026-06-18). **ADR-148 = 응용 실행 설계** — base 가 확정한 모델의 등록 단일화 + slot 일반화 + D2 계약 실현.           |
| schema 직교성              | canonical schema 필드 변경 0 (ADR-142 HC#4 승계). 신규 표현은 catalog entry(등록 layer)·`metadata.slotRole`·origin extension 메타 propsSchema(위치는 ADR 본문 Decision 4 — x-composition vs metadata, Phase 2 확정)에만 — canonical core 와 직교. |
| 선행 ADR 전제 reverse 검증 | ADR-147 의 전제를 자동 승계하지 않음 — 2026-07-07 landscape 실측으로 **stale 3건 확인 후 정정 승계** (본 ADR Context §승계 표). ADR-146(Implemented) → 147 → 148 방향 자연, reverse 없음.                                                         |
| codex 3차 미루지 말 것     | 전제·관점은 fork 시점(본 문서) lock-in. codex review 는 본문 정합 layer 로만 사용.                                                                                                                                                                |

**통합 동기 분류** (차단 메모리 `feedback-adr-consolidation-burden-not-essence` 2질문 통과 기록):

1. 동기 = **(b) "가시 효과 큰 영역(reusable 시스템 완성)을 ADR 1개로 닫기"** — (a) 부담 절약 아님.
2. 자연 그루핑(직교성 분석): 등록 구조 ↔ origin 문서 ↔ propsSchema ↔ slot 자식은 상호 결합
   (entry 가 origin 을 가리키고, origin 이 slot 자식과 propsSchema 를 담고, 생성·편집·렌더가
   그 체인을 소비) — 단일 결합 영역. 직교 영역(ADR-910/911 아키텍처 전환 기록, ADR-915 prop
   parity 잔여, rendererMap #4 축)은 **통합하지 않음**.

**폐기 범위 사용자 confirm (2026-07-08)**: ADR-147 만 Superseded by ADR-148 (권장안 채택).
ADR-144/920 은 이미 Superseded, ADR-910/911 은 "비착수 비교 기록/비실행 목표 참조" 위상
명시 문서라 존속 (`feedback-target-vs-execution-adr-separation` — 목표 drift 판정 reference).

**2차 confirm (2026-07-08)**: ADR-138 (Implemented) · ADR-144 (기 Superseded) 는 본 ADR 흡수로
기록 정리 — 138 = fork UX 변경 0 승계 + 등록 축 Phase 1 대체 (`completed/` 이동), 144 = 145→146→147
계보 경유 Phase 4 흡수. ADR-133 (events) 은 도메인 직교라 흡수 불가 — Deprecated 후 개별 재설계 대상.

## §2. ADR-147 승계 실측 (코드 반영 완료분 — live 검증 미실행, 2026-07-17 정정)

> **2026-07-17 정정**: 아래 표의 "반영 완료" 는 **코드 커밋 완료**를 뜻하며 동작 보증이 아니다.
> 147 Phase 7 live 검증은 미실행 상태로 본 ADR Phase 0 에 흡수됐고, 사용자 재제기 + 코드 실측으로
> **slot 조합 자식이 소비처 0 인 미배선 구조**임이 확인됐다 (§2-1). Phase 0 은 검증-only 가 아니라
> **승계 정정(배선) + 검증** phase 다 (ADR 본문 R8/G1).

| 코드 반영 완료 (커밋)                   | 내용                                                                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `f12808623` (2026-05-29)                | Phase 1~5 — origin 조합 자식(slotRole icon/label/description) + CSS `[slot]` + Preview `<Text slot>` emit(Path2 description 수정) + getItemIcon columnMapping + ListBoxItemEditor slot 재작성 |
| `a7d2b9299` / `66e979930` / `4e1f43f03` | layout 편집 + 이중 렌더 수정 / RAC 정합 + height drift / height 계산 정리                                                                                                                     |
| `53da62b6a` → `d139a445b` (ADR-912)     | Skia 경로가 spec render.shapes → catalog rule + `listbox_item` escape 로 대체, ListBox spec 물리 삭제 — **147 본문 stale 의 원천**                                                            |

### §2-1. slot 자식 미배선 실측 (2026-07-17)

`slotRole` 소비처 전수 grep 결과 **정의부 + Skia scene 제외 판정 2곳뿐** — origin 문서의
Icon/Label/Description slot 자식을 읽어 렌더·편집에 반영하는 소비자가 0곳이다. RAC `<Text slot>`
emit·CSS `[slot]`·`listbox_item` escape 는 모두 동작하지만 데이터원이 slot 자식이 아니라 flat props 다:

| 층          | 좌표                                                                       | 실제 데이터원                                            | slot 자식 소비                                             |
| ----------- | -------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Skia escape | `packages/specs/src/renderers/skiaPrimitives.ts:514` (`listbox_item`)      | flat props (`children`/`textValue`/`description`/`icon`) | ❌ — scene 에서 제외만 됨 (`canvasSceneNode.ts:1789-1796`) |
| DOM emit    | `packages/shared/src/renderers/SelectionRenderers.tsx:65`                  | template props / items[] / row 데이터 flat 문자열        | ❌ — `<Text slot>` 구조만 RAC 대응, 원천은 flat            |
| projection  | `canvasSceneNode.ts:609-662` (`appendListBoxRowProjection`)                | 데이터 row + origin 루트 `props.style`                   | ❌ — slot 자식의 구성·스타일 미소비                        |
| 편집기      | `apps/builder/src/builder/panels/properties/editors/ListBoxItemEditor.tsx` | flat props (`label`/`description`/`icon`) 직접 편집      | ❌ — slot 자식 조준 편집 없음                              |

부수 확인: `canvasSceneNode.ts:1789` 의 제외 사유 주석("render.shapes 가 단일 렌더러로 그리므로")은
ADR-912 가 물리 삭제한 spec render.shapes 를 여전히 참조하는 stale 주석 — Phase 0 에서 동시 정리.
ADR-147 이 주석으로 선언한 "자식은 authoring 구조 + slot 스타일 SSOT" 중 **스타일 SSOT 역할도 미배선**
(projection 은 origin 루트 style 만 merge). 결과: origin slot 자식을 수정해도 화면 변화 0 — 사용자
보고("slot 개념만 적용")와 일치.

## §3. Phase 분해

> 각 Phase 는 독립 검증·revert 단위. Phase 3/4 는 재판정 게이트 **선통과 조건부** — 부적격
> 컴포넌트는 개별 보류 (전체 phase 차단 아님).

### Phase 0 — ADR-147 승계 정정 (slot 자식 배선 + slot 정본 확정) — **Implemented 2026-07-17**

> **2026-07-17 확장**: §2-1 실측(slot 자식 소비처 0)에 따라 검증-only 에서 **정정 phase** 로
> 확장 (본문 R8/G1). 후속 phase (특히 2/4)는 본 phase 의 배선 결과 위에서만 진행.
>
> **Implemented 2026-07-17 (G1 통과)**: `_slots` 주입 계약(shared `slotRoles.ts` `SlotComposition`)
> 으로 배선 — projection(row + owner + ListBoxItem 자기 구성) → Skia escape / DOM emit / layout
> 높이 소비. anchor-less 표준 shape 의 DOM 축은 Preview App 이 문서에서 구성을 1회 계산해
> `renderContext.listBoxTemplateSlotComposition` 으로 주입(builder `resolveListBoxTemplateOriginId`
> 해석과 대칭). 편집기는 slot 조합 문서에서 내용 설정 시 제거된 slot 자식을 자동 재생성
> (`listBoxItemSlotChildActions.ts`). live 왕복 exercise 는 ADR 본문 진행 로그 참조.

- **slot 자식 배선 정정** (§2-1 좌표 4개 층): Decision 3("slot 구성의 SSOT = origin 문서의
  자식 구성")을 구현이 충족하도록 소비 경로를 정합한다. 최소 범위 —
  1. projection·렌더(DOM emit / Skia escape)가 slot 자식의 **구성(slot 존재 여부·순서)과
     스타일**을 소비 (현재는 origin 루트 `props.style` 만 merge — slot 자식 style 무시).
  2. 편집기(`ListBoxItemEditor`)의 label/description/icon 편집이 slot 자식과 정합
     (flat props 단독 기록 유지 시 slot 자식과 양방향 동기, 아니면 slot 자식 조준 편집).
  3. `canvasSceneNode.ts:1789` 제외 판정의 stale 주석(삭제된 spec render.shapes 참조) 정리.
  - flat props(`children`/`textValue`/`description`/`icon`)는 **데이터(row/템플릿 바인딩) 경로로
    존속** — 구성·스타일 축만 slot 자식 정본으로 이관 (ADR-147 의 "flat props 는 데이터 경로 BC"
    의도 승계).
- **배선이 불가/과잉으로 판정되면** 역할 격하(= slot 자식 제거 + flat props 정본 재선언) 경로로
  전환하되, 이는 Decision 3 명제 수정이므로 **사용자 재확정 필수** (G1 실패 시 대안 — 자율 전환 금지).
- `LISTBOX_ITEM_SLOT_ROLES`/`getListBoxItemSlotRole` (listBoxTemplateOrigins.ts:23-41) →
  shared `packages/shared/src/catalog/slotRoles.ts` 로 re-home + 공용 vocabulary
  (설계도 §2-1) 도입. builder 측은 re-export 소비.
- `/cross-check` ListBoxItem 3축 + live behavior 1회 (147 이 대기하던 Phase 7 검증 흡수) —
  live 항목에 **origin slot 자식 편집 → instance 시각 반영 왕복** 포함 (미배선 재발 감지 항목).
- Gate G1.

### Phase 1 — 등록 전환 (전면 reusable entry)

- `componentCatalog.ts`: `reusableEntry()` 헬퍼 + **Toolbar/Form reusable entry 2건** +
  동명 primitive entry `panel.placeable:false` 2건 + 인덱스 2원화
  (`CATALOG_BY_TYPE` = kind≠reusable / `REUSABLE_BY_TYPE` 신설 + `getReusableEntry`/`getReusableOriginId`).
- 파생 대체 3건: `reusableCompositeOrigins.ts` 맵 → catalog 파생 re-export +
  `REUSABLE_ORIGIN_ENSURERS`(reusableId→ensurer) / `useElementCreator.ts:158` 조회 교체 /
  `entryUniverse.ts:259` facet 판정 교체 (양방향 정합 주석 동시 갱신).
- `paletteItems.ts`: REUSABLE_BY_TYPE 폴백 (PALETTE_ORDER 무변경 — 스냅샷 test 로 확증).
- `componentRegistrationContract.test.ts` 불변식 4종 추가: ① reusable entry 마다 ensurer 존재
  ② 동명 primitive placeable=false ③ reusableId 형식 `component-<kebab>` ④ placeable
  reusable entry 는 PALETTE_ORDER 포함.
- **shared catalog 전역 type 유일성 test 개정** (round 2 지적 2026-07-14):
  `packages/shared/src/catalog/__tests__/componentCatalog.test.ts:32-35` 의
  `it("type 중복 없음")` (`new Set(types).size === types.length`) 이 동명 type 2-entry
  (Toolbar/Form primitive+reusable) 와 정면 충돌 → **(kind, type) 복합 유일성** 으로 개정
  (동일 kind 내 type 중복 없음 + 동명 type 은 placeable 단일성 test 로 커버). G2 통과 조건에 포함.
- Gate G2.

### Phase 2 — IconButton 첫 신규 reusable 수직 슬라이스

- catalog entry(`kind:"reusable"`, type:"IconButton" — 명명은 RSP 관례 대조 후 확정) +
  `iconButtonTemplateOrigins.ts` origin seed (Button > Icon(slotRole:icon, optional) +
  Text(slotRole:label), 템플릿 바인딩 `{icon}`/`{label}`) + origin extension 메타 propsSchema
  (label/icon/variant/size — PropContract 재사용, 신규 InspectorFieldKind 0).
- **propsSchema 저장 위치 확정 선행** (ADR 본문 Decision 4): `x-composition` 채택 시
  `CompositionExtension` 확장 필요(`packages/shared/src/types/composition-document.types.ts:899-930`
  — ADR-131 이 축소 방향으로 판정한 namespace 라 정합 정당화 동반), `metadata.propsSchema`
  채택 시 타입 변경 0 (CanonicalNode Extensibility hook, 동 파일 :630).
- **propsSchema 첫 소비**: Inspector `resolveEditContract` 에 ref instance 분기 —
  origin propsSchema → generic 편집 필드. 편집 기록: root props override(1차) /
  `descendants` patch(자식 조준). fork UX 는 ADR-138 승계 (변경 0).
- propsSchema ↔ 템플릿 바인딩 키 1:1 정적 검증 test (origin 순회 → `{키}` 추출 대조).
- palette 노출 (PALETTE_ORDER + ICON_MAP 1항목).
- Gate G3.

### Phase 3 — factory-대체군 확대 (조건부)

- 대상: Toast / InlineAlert / IllustratedMessage (heading+description 2-slot 동형 3종) →
  Card 4-region (propagation title→Header 등을 템플릿 바인딩+propsSchema 로 대체).
- **각 컴포넌트별 DELEGATING/어댑터 재판정 선행** (renderToast·INTERNAL_RENDERERS 가 origin
  자식 재귀로 환원 가능한지 — ADR-912 R-5 적격 기준). 부적격 → 해당 컴포넌트만 보류.
- kill criteria (Toolbar 선례): factory definition fallback 0 + live parity.
- Gate G4 (컴포넌트별 반복).

### Phase 4 — collection item slot 이식 (조건부)

- GridListItem(label/description) → Menu item(icon/label/shortcut/description — itemSchema
  8키 정합). ADR-147 모델 복제: origin 조합 자식 + slotRole + projection 주입.
- **ADR-150 A2/A3 표면 공유 조정** (round 2 지적 2026-07-14): projection 주입 경로
  (`canvasSceneNode.ts:13,1791` slotRole 소비)가 ADR-150 A2(window 전환, appendXxxRowProjection
  광범위 수정)/A3(drill-in — row 내부 slot 자식이 바로 대상)와 동일 표면. **후행 착수 측이
  선행 측의 land 상태를 Phase 진입 시 재실측**하고, 본 Phase 진입 시점에 150 A2/A3 이 반영돼
  있으면 G4 를 window/hit tree 위에서 재검증한다 (역순이면 150 G-A2/G-A3 이 본 Phase 결과 위에서 검증).
- Gate G4 동형.

## §4. Gate ↔ Risk 매핑

| Gate | 시점              | 통과 조건                                                                                                                                                                                               | 대응 Risk |
| ---- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| G1   | Phase 0           | **slot 자식 배선 정정 완료** (§2-1 4개 층 + stale 주석 정리) + cross-check ListBoxItem 3축 PASS + live 1회(slot 자식 편집→시각 반영 왕복 포함) + slotRoles shared re-home 후 type-check baseline 무증가 | R5, R8    |
| G2   | Phase 1           | 기존 R-5 테스트 green + registrationContract 신규 불변식 4종 PASS + palette 스냅샷 무변 + live palette-add(Toolbar/Form) → ref instance + origin resolve 확인                                           | R1, R6    |
| G3   | Phase 2           | Inspector 편집(label/icon/variant/size) → instance 반영 + origin 수정 전파 + 키 1:1 test + cross-check IconButton                                                                                       | R2        |
| G4   | Phase 3/4 각 대상 | 재판정 게이트 선통과 + factory fallback 0 + live parity + cross-check                                                                                                                                   | R3, R4    |
| G5   | closure           | ADR-147 Superseded 정합(체인 링크) + README/CHANGELOG 동기 + type-check baseline 무증가. **live behavior 게이트**: 실제 builder 에서 palette-add → 편집 → origin 전파 1회 exercise 명시                 | 전체      |

## §5. 파일 좌표 (Phase 0~2 기준 — Phase 3/4 는 대상 확정 시 추가)

설계도 §10 과 동일 — 신규: `packages/shared/src/catalog/slotRoles.ts`,
`apps/builder/src/builder/components/iconbutton/iconButtonTemplateOrigins.ts`. 수정:
`componentCatalog.ts` / `reusableCompositeOrigins.ts` / `useElementCreator.ts:158` /
`entryUniverse.ts:259` / `paletteItems.ts` / `packages/shared/src/catalog/resolvers/resolveEditContract.ts:253` /
(x-composition 채택 시) `packages/shared/src/types/composition-document.types.ts` `CompositionExtension` 확장 /
`componentRegistrationContract.test.ts` / `listBoxTemplateOrigins.ts`(상수 re-home).

Phase 0 배선 정정 (2026-07-17 추가 — §2-1 좌표): `packages/specs/src/renderers/skiaPrimitives.ts:514`
(listbox_item escape) / `packages/shared/src/renderers/SelectionRenderers.tsx:65` (slot emit) /
`apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts:609-662,1789-1796` (projection +
scene 제외 stale 주석) / `apps/builder/src/builder/panels/properties/editors/ListBoxItemEditor.tsx`
(slot 자식 정합 편집).

## §6. 검증 체크리스트

- [x] Phase 0: slot 자식 배선 정정 (§2-1 4개 층 + stale 주석) + cross-check 3축 + live 1회(slot 자식 편집 왕복 포함) + shared re-home — **2026-07-17 완료** (G1 통과, ADR 본문 진행 로그)
- [ ] Phase 1: registrationContract 불변식 4종 + palette 스냅샷 무변 + live palette-add
- [ ] Phase 2: propsSchema 편집 왕복 + 키 1:1 test + origin 전파 live 확인
- [ ] Phase 3/4: 대상별 재판정 기록 + kill criteria
- [ ] 전 Phase: type-check baseline 무증가, `pnpm build:specs` 무관(spec 비접촉) 확인
- [ ] closure: ADR-147/README/CHANGELOG 동기 (Implemented 승격 시 CHANGELOG 트리거)
