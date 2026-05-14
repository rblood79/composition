# ADR-135: Page-Frame Projection Interaction Boundary

## Status

Proposed — 2026-05-14

> **plan-only land**: 본문 + design breakdown + README 등록까지만 수행한다. Phase 0-6 실행 작업과 코드 변경은 사용자 plan review 후 별 step으로 진행한다.

## Context

Frame을 Page에 적용한 상태에서 Skia 캔버스의 선택/slot fill/drag-drop 동작이 불특정하게 깨진다. 확인된 증상은 다음 두 축이다.

1. Frame 적용 Page에서 element가 간헐적으로 선택되지 않는다.
2. Frames 탭에서 추가한 Frame의 Slot들이 Page 적용/해제 반복 또는 Frame 적용 Page 내 이동/동작 후 사라지거나 엉뚱한 Slot으로 이동한다.

코드 조사 결과, 이 문제는 단일 UI 버그가 아니라 **render ID 공간**과 **canonical mutation/persistence ID 공간**이 섞인 구조적 경계 부재다.

### 확인된 코드 사실

- Skia render pipeline은 `rendererInput.renderNodesMap` / `rendererInput.childrenMap`으로 그리고, render command의 `boundsMap`을 SpatialIndex에 등록한다.
- Builder pointer selection / context menu / drag bridge는 `skiaRendererInput.sceneNodesMap` / `sceneChildrenByParent`를 interaction read model로 사용한다.
- Frame 적용 Page에서는 `resolvePageWithFrame`이 `pageId::page-frame::frameElementId` 형태의 projected render ID를 만들고, page-owned element를 projected Slot 아래로 reparent한다.
- 따라서 Skia 화면에는 projected render tree가 존재하지만, selection/hit-test 후보 해석은 canonical scene tree를 참조하여 후보를 누락하거나 잘못된 ancestor로 해석할 수 있다.
- `pageFrameBinding.ts`는 frame unapply 시 `RefNode.descendants`의 slot path들을 평탄화하고, 재apply 시 direct children을 `descendants.content.children`에 일괄 저장한다. `header` / `footer` / custom Slot path roundtrip이 손실될 수 있다.
- Drag/drop mutation은 `finalTarget.containerId`를 `moveElementCanonicalPrimary(elementId, targetParentId, insertionIndex)`로 그대로 전달한다. interaction read model을 render-space로 교정할 경우, projected Slot ID가 canonical mutation target으로 유입될 위험이 있다.

### Hard Constraints

1. **render ID는 canonical document에 저장 금지** — `::page-frame::`가 포함된 ID는 `CompositionDocument` / IndexedDB `documents` / history canonical event payload에 들어가면 안 된다.
2. **selection은 rendered visual truth를 기준으로 판정** — Skia가 그린 element와 hit-test candidate의 ID 공간이 동일해야 한다.
3. **mutation은 canonical target만 사용** — drag/drop/create/update/delete는 `CanonicalNode.children[]` 또는 `RefNode.descendants[descendantPath].children` 중 하나로 정규화된 target에만 commit한다.
4. **Page Frame apply/remove roundtrip은 Slot path 무손실** — `header` / `content` / `footer` / custom Slot의 descendant path와 children 순서가 apply → remove → apply 후 보존되어야 한다.
5. **refresh hydration 후 동일 동작** — 새로고침이 문제를 고치는 효과가 아니라, refresh 전후 render/selection/mutation state가 동일해야 한다.
6. **Canvas 60fps 유지** — interaction resolver는 pointer hot path에서 O(1) map lookup 중심이어야 하며, canonical document full traversal을 pointer move마다 수행하면 안 된다.
7. **Preview/Publish schema 영향 없음** — projected render ID는 Builder Skia interaction boundary 전용이며, export/publish payload에는 projection metadata가 유출되지 않아야 한다.

### Soft Constraints

- 기존 canonical `CompositionDocument` SSOT 원칙(ADR-116/122/127/130)을 유지한다.
- 기존 `resolvePageWithFrame`의 page/frame render synthesis 책임은 유지하되, mutation boundary 책임을 분리한다.
- 기존 browser repro가 간헐적이므로, 회귀 방지는 static test + unit fixture + browser smoke를 조합한다.

## Alternatives Considered

### 대안 A: interaction map만 renderNodesMap으로 교체

- 설명: `BuilderCanvas`의 `interactiveElementsMapRef` / `interactiveChildrenMapRef`를 `sceneNodesMap`에서 `renderNodesMap` / `childrenMap`으로 바꾼다.
- 근거: 선택 불가 증상의 직접 원인은 hit-test candidate가 render ID인데 lookup map이 scene ID라는 불일치다.
- 위험:
  - 기술: **HIGH** — selection은 개선되지만 drag/drop mutation이 projected Slot ID를 canonical parent로 사용할 수 있다.
  - 성능: **LOW** — map 교체만으로 pointer hot path 비용 증가가 거의 없다.
  - 유지보수: **HIGH** — render-space와 canonical-space 분리 규칙이 문서/타입/API로 고정되지 않아 같은 split-brain 재발 가능성이 높다.
  - 마이그레이션: **MEDIUM** — 기존 static test가 scene map 사용을 전제할 수 있어 일부 테스트 갱신 필요.

### 대안 B: projected ID를 canonical ID처럼 저장 가능하게 확장

- 설명: `pageId::page-frame::slotId` 형태를 canonical tree에서도 유효한 node ID로 인정하고, move/update/delete가 projected ID를 직접 다루도록 확장한다.
- 근거: render/hit/mutation ID 공간을 단일화하면 변환 계층이 줄어든다.
- 위험:
  - 기술: **CRITICAL** — projected ID는 page/frame binding에서 파생되는 ephemeral ID다. frame source 변경, page binding 변경, refresh hydration, export/import에서 안정 canonical identity로 쓸 수 없다.
  - 성능: **MEDIUM** — projected ID를 canonical graph에 병합하면 scene/model rebuild와 history payload가 커진다.
  - 유지보수: **HIGH** — canonical document가 render projection detail에 오염된다.
  - 마이그레이션: **HIGH** — 기존 documents/history/export payload cleanup 또는 migration guard가 필요해진다.

### 대안 C: render-space interaction + canonical target resolver + Slot roundtrip 보존 (선택)

- 설명: Skia interaction은 render-space map으로 수행한다. selection/mutation 직전에 render target을 canonical operation target으로 변환하는 resolver를 둔다. Page Frame apply/remove는 `RefNode.descendants` slot path를 무손실 보존한다.
- 근거: 화면과 hit-test의 visual truth를 맞추면서도 canonical document SSOT와 persistence contract를 보존한다. selection 불가와 Slot 사라짐을 같은 경계 규칙으로 닫을 수 있다.
- 위험:
  - 기술: **MEDIUM** — projection metadata와 target resolver를 새로 도입해야 한다.
  - 성능: **MEDIUM** — pointer hot path에 resolver가 추가되므로 metadata O(1) lookup 구조가 필요하다.
  - 유지보수: **MEDIUM** — render target / canonical target 두 타입을 계속 관리해야 한다.
  - 마이그레이션: **LOW** — projected ID를 DB에 저장하지 않으므로 기존 project data migration은 불필요하다. 개발 단계의 stale fixture만 정리하면 된다.

### 대안 D: Page Frame binding 기능을 일시적으로 disable

- 설명: Frame 적용 Page의 projected Slot fill과 drag/drop을 비활성화하고, Frame 적용/해제만 유지한다.
- 근거: 사용자 가시 회귀를 빠르게 차단할 수 있다.
- 위험:
  - 기술: **MEDIUM** — crash/데이터 손실은 줄지만 핵심 기능을 잃는다.
  - 성능: **LOW** — 기능 축소이므로 성능 위험은 낮다.
  - 유지보수: **HIGH** — disable guard가 장기화되면 실제 root cause가 남는다.
  - 마이그레이션: **MEDIUM** — 이미 생성된 frame-bound page state와 UX 안내 처리가 필요하다.

### Risk Threshold Check

| 대안                                         | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| -------------------------------------------- | :--: | :--: | :------: | :----------: | :--------: |
| A: interaction map만 교체                    |  H   |  L   |    H     |      M       |     2      |
| B: projected ID를 canonical ID로 승격        |  C   |  M   |    H     |      H       |     3      |
| C: render-space interaction + resolver 선택  |  M   |  M   |    M     |      L       |     0      |
| D: Page Frame binding 기능 일시 disable      |  M   |  L   |    H     |      M       |     1      |

루프 판정: HIGH 0개 대안 C가 존재한다. CRITICAL 위험이 있는 대안 B는 기각한다. 추가 대안 불필요.

## Decision

**대안 C: render-space interaction + canonical target resolver + Slot roundtrip 보존**을 선택한다.

### 선택 근거

1. Skia가 실제로 그린 render tree와 hit-test candidate ID 공간을 일치시켜 선택 불가를 직접 해결한다.
2. canonical mutation 직전에 render target을 canonical operation target으로 변환해 projected ID가 저장소에 유입되는 것을 구조적으로 차단한다.
3. `RefNode.descendants` slot path roundtrip을 보존해 apply/remove 반복 시 Slot content가 `content`로 평탄화되는 문제를 닫는다.
4. static test, unit fixture, browser smoke를 모두 걸 수 있어 재현이 어려운 간헐 버그를 계약 기반으로 방어한다.

### 기각 사유

- **대안 A 기각**: 선택 불가만 줄이고 mutation/persistence 오염 위험을 남긴다.
- **대안 B 기각**: render projection detail을 canonical document identity로 승격하는 구조이며 CRITICAL 위험이다.
- **대안 D 기각**: root cause fix가 아니라 기능 축소다. 단, Phase 실행 중 데이터 손실 위험이 확인되면 임시 feature guard fallback으로만 고려한다.

### Sub-decisions

- **D1**: `sceneNodesMap`은 canonical scene inspection 용도, `renderNodesMap`은 Skia render/interaction visual truth 용도로 명명 분리한다.
- **D2**: `CanvasSceneNode.projection` metadata를 도입해 projected render node가 source frame element, page, slot, descendant path를 추적할 수 있게 한다.
- **D3**: selection/context menu는 `resolveCanvasInteractionTarget(hitIds, interactionModel)`을 통해 render target을 selectable target으로 정규화한다.
- **D4**: drag/drop은 `moveElementToCanonicalTarget({ elementId, target })` 형태의 typed mutation target을 사용한다. projected Slot drop은 `ref-descendants` target으로 변환한다.
- **D5**: `pageFrameBinding` apply/remove는 descendant path별 children을 보존한다. unapply 시 Slot mirror metadata를 남기고, reapply 시 frame Slot registry로 path를 복원한다.
- **D6**: mutation boundary에는 dev assert를 둔다. `::page-frame::` ID가 canonical mutation target/document/history로 들어가면 실패시킨다.
- **D7**: browser smoke는 refresh 전후 selection/slot visibility/drag-drop 결과를 IndexedDB `documents`와 Skia 화면 양쪽에서 확인한다.

> 구현 상세: [135-page-frame-projection-interaction-boundary-breakdown.md](design/135-page-frame-projection-interaction-boundary-breakdown.md)

## Risks

| ID | 위험 | 심각도 | 대응 |
| --- | --- | :---: | --- |
| R1 | resolver가 pointer hot path에서 canonical traversal을 수행해 FPS가 떨어질 수 있음 | MED | projection metadata를 render input 생성 시 미리 구성하고 pointer path는 map lookup만 수행 |
| R2 | projected Slot drop target을 descendant path로 잘못 변환해 다른 Slot에 저장 | MED | Slot name/path registry fixture + multi-slot roundtrip test |
| R3 | 기존 sceneNodesMap 기반 context menu/static test와 충돌 | MED | scene inspection과 interaction visual truth를 테스트 이름/fixture로 분리 |
| R4 | pageFrameBinding roundtrip 보존 로직이 legacy slot mirror와 canonical descendants 양쪽을 모두 다뤄 복잡도 증가 | MED | boundary helper를 `pageFrameProjectionTarget.ts`로 격리하고 exhaustive fixture 작성 |
| R5 | 기존 dirty/stale project fixture에 이미 projected ID가 저장된 경우 hydration이 깨질 수 있음 | LOW | 개발 단계라 runtime migration 대신 audit/repair dev helper와 test fixture cleanup으로 처리 |
| R6 | Frame source Slot rename 시 descendant path remap 정책이 불명확 | MED | Phase 4에서 Slot source identity 우선, name fallback, unmatched fallback policy를 Gate로 고정 |
| R7 | helper guard UX가 projected Slot hit와 page-owned element hit를 혼동 | MED | `CanvasInteractionTarget` union으로 `select` / `slot-guard` / `none` 분리 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점 | 통과 조건 | 실패 시 대안 |
| ---- | ---- | --------- | ------------ |
| G1 | Phase 1 완료 | interaction read model이 render-space를 사용하고, static test가 scene map 회귀를 차단 | Phase 1 범위에서 selection-only patch 중단 후 resolver 설계 재검토 |
| G2 | Phase 2 완료 | projected Slot / page-owned child hit가 `CanvasInteractionTarget`으로 안정 변환되고 synthetic ID가 selection state에 저장되지 않음 | target union 재설계 |
| G3 | Phase 3 완료 | drag/drop mutation target에 `::page-frame::` ID 0건, projected Slot drop이 `RefNode.descendants[path].children`로 commit | mutation API를 node children / ref descendants 두 entry로 더 분리 |
| G4 | Phase 4 완료 | apply → remove → apply 후 header/content/footer/custom Slot children과 order 보존 | pageFrameBinding rollback + Slot mirror policy 재검토 |
| G5 | Phase 5 완료 | unit/static/targeted Vitest 전원 PASS + dev assert negative fixture FAIL 확인 | scope 재분리 또는 disable fallback 검토 |
| G6 | Phase 6 완료 | authenticated browser smoke에서 selection, slot visibility, drag/drop, refresh hydration PASS + console/page/http error 0 | 구현 보류, failing path를 별도 ADR/phase로 분리 |

## Consequences

### Positive

- Skia 화면에 보이는 node와 hit-test/selection이 같은 visual truth를 공유한다.
- render projection detail이 canonical document와 IndexedDB에 유입되지 않는다.
- Page Frame apply/remove 반복이 Slot descendants를 보존한다.
- 간헐 증상을 browser refresh로 우회하지 않고, refresh 전후 동일성으로 검증할 수 있다.

### Negative

- render target과 canonical target 사이의 변환 계층이 새로 생긴다.
- projected node metadata와 Slot path registry를 유지해야 한다.
- drag/drop mutation 테스트가 기존 same-parent reorder보다 복잡해진다.

### Neutral

- Preview/Publish payload는 변경하지 않는다.
- 기존 canonical `children[]` order SSOT는 유지한다.
- 기존 project DB migration은 만들지 않는다. 개발 단계 stale fixture는 audit/cleanup 대상으로만 다룬다.
