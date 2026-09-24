# ADR-236 구현 상세 — 빌더 도메인 규칙 정리 (술어 모듈 · 타입 특성 표 · store 강제)

> 본문: [ADR-236](../236-builder-domain-rules-consolidation.md). 이 문서는 Phase · 파일 경계 · 게이트 절차만 담는다.

## 1. 전제 기록

| 항목           | 내용                                                                                                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 분류           | 단일 ADR (fork 아님). 선행 A · B 묶음 (`/fix` 7건, 2026-09-23~24) 은 이 ADR 의 문제 정의를 실측한 수리이고, 이 ADR 은 그 수리가 표면마다 따로 필요했던 구조를 없앤다                                                                                                                          |
| 특성 표 위치   | `packages/shared` 의 별도 domain 표 — catalog (D3) 에 넣지 않는다. **사용자 확정 2026-09-24** ("위치는 shared로 확정", review round 1 뒤)                                                                                                                                                     |
| ADR 범위       | 한 ADR 에 Phase 1 (술어) → Phase 2 (특성 표) → Phase 3 (store 강제). 강제가 표를 읽도록 데이터를 먼저 둔다                                                                                                                                                                                    |
| 선행 ADR 관계  | ADR-234 (Implemented 09-23) 가 만든 dual 노드 (`ref` + `reusable`) 는 Phase 1 술어의 입력이다 — 234 의 모델을 바꾸지 않는다. ADR-184 러너 계약과 기존 경로 allowlist (이관 비스코프) 는 바꾸지 않는다 — Phase 3 강제 지점은 러너가 아니라 구조 변경 store 액션의 진입부다 (review round 1 H1) |
| 범위 밖 (상시) | layout · skia 의 렌더 특수 분기 (타입 이름 분기의 약 60%) 는 일괄 이관하지 않는다. 그 코드를 고치는 커밋이 해당 분기를 표로 옮긴다                                                                                                                                                            |

## 2. Phase 0 — 인벤토리 고정 (G0)

동작 변경 0. 산출물은 `docs/adr/evidence/236-domain-rules-inventory.md` 하나.

1. 타입 집합 전수 — `new Set([` 로 선언한 대문자 상수 125개 (`apps/builder/src`, 테스트 제외, 2026-09-24 실측) 를 세 부류로 나눈다.
   - **파생 대상**: 같은 사실을 다시 적은 집합. 필드 패밀리 · 텍스트 호스트 · 컬렉션 호스트 · 구조 컨테이너 · 목록 owner · 항목 타입 · 그룹 disabled 전파.
   - **렌더 특수 (상시 규칙)**: layout · skia 의 측정 · 그리기 분기. 이 ADR 에서 옮기지 않는다.
   - **로컬 정당**: 한 모듈의 구현 세부 (예: `TEXT_INPUT_TAGS` 는 DOM 태그 이름).
2. 술어 재구현 전수 — body 판정 (타입 비교 78행) · instance · origin · synthetic id 파싱 · Components 페이지 · systemOwned · origin 참조 해소 · sub-part 소유자. 위치 · 대소문자 처리 · AND/OR 차이를 행마다 적는다.
3. 강제 지점 전수 — 구조 변경 (이동 · 생성 · 삭제 · 그룹 · 붙여넣기 · 컴포넌트 토글) 을 부르는 UI 표면 (캔버스 메뉴 · 액션 바 · 단축키 · Layers · 팔레트 · AI 도구) × 가드 유무 표.
4. 이 표의 개수가 Phase 1 · 2 ratchet 의 시작값이다.

추정 대비 실측 차이는 이 문서 보강으로 흡수한다 (새 ADR 사유 아님).

## 3. Phase 1 — 술어 모듈 (G1)

동작 변경 0 (리팩터). 커밋 단위: 술어 1종 = 커밋 1.

| 술어                                   | 거처                                                               | 비고                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isBodyType(type)`                     | `@composition/shared` (순수 타입 판정)                             | 대소문자 규약을 하나로. 파일 로컬 헬퍼 8+ (`pageFrameBinding.ts:206,210` · `projectPageFrameTree.ts:49` · `frameElementScope.ts:33` · `dropTargetResolver.ts:228` · `resolvePageWithFrame.ts:65` · `elementIndexer.ts:210` · `multiElementCopy.ts:53`) 와 직접 비교 78행을 흡수. preview · publish 도 읽는다 |
| `parseSyntheticId(id)` / `isSynthetic` | `stores/canonical/syntheticDescendantLookup.ts` (이미 있음)        | `editingSemantics.ts:146` · `rendererInput.ts:295` 의 직접 파싱을 흡수                                                                                                                                                                                                                                       |
| `isInstance` / `isOrigin`              | `adapters/canonical/editingSemantics.ts` (이미 있음, 축 술어)      | role 우선순위 함수 `getEditingSemanticsRole` 는 표시용으로만 남긴다 (B-1)                                                                                                                                                                                                                                    |
| `isSystemOwnedOrigin`                  | 같은 파일 (B-2 에서 추가)                                          | template origin 파일들의 `systemOwned` 직접 읽기는 생성 쪽이라 제외                                                                                                                                                                                                                                          |
| `isComponentsPage(page)`               | `@composition/shared` 또는 `builder/pages/systemComponentsPage.ts` | 직접 비교는 0 — 입력 형태별 헬퍼 3개 (`isComponentsPageMirror` · `isComponentsPageNode` · shared `isComponentsPageMetadata`, 호출 21) 를 판정 하나 + 입력 어댑터로 합친다                                                                                                                                    |
| `resolveOriginRef(node)`               | `editingSemantics.ts`                                              | `getEditingSemanticsOriginId` 로 합친다                                                                                                                                                                                                                                                                      |
| `resolveSubpartOwner`                  | shared `resolveDelegatedSubpartOwnerType` (이미 있음)              | 재구현 5곳을 호출로 바꾼다                                                                                                                                                                                                                                                                                   |

- ratchet: `domainPredicateRatchet.static.test.ts` — 술어별로 "직접 구현" 패턴 (예: `type === "body"` · `.split("/")` on id · `pageRole === "components"`) 의 파일 · 행 수를 Phase 0 값 이하로 고정하고, Phase 1 이 끝나면 0 (허용 목록 제외) 으로 내린다.
- 회귀: 패키지 스위트 실패 집합이 Phase 전후 같다 (기존 실패 목록은 evidence 에 기록).

## 4. Phase 2 — 타입 특성 표 (G2)

동작 변경 0 이 목표. 멤버십 차이가 나오면 그 차이만 별도 커밋 + live.

- 거처: `packages/shared/src/domain/componentTraits.ts` (새 폴더). `nestingRules.ts` 는 자리를 유지하고 겹치는 집합 (`STRICT_COLLECTION_PARENT_TYPES` · `RAC_COLLECTION_CHILD_TYPES` · `RAC_SUBPART_OWNER_TYPES`) 을 표에서 파생한다.
- 항목 (타입 → 특성):
  - `container`: `"structural" | "collection" | "self-composed" | "leaf"`
  - `children`: 자식 계약 (Tabs → TabList · TabPanel 등, RAC 구성 관찰값 — D1 을 정의하지 않고 적는다)
  - `families`: `field` · `textHost` · `collectionHost` · `listOwner` · `selectionItem` · `disablingGroup`
  - `editing`: 삭제 · 그룹 · 복제 자격
- 범위 기준 (ADR §범위 기준): 집합이 멤버십만 말하면 선언 위치 (skia · layout · presentation 포함) 와 무관하게 파생하고, 그 집합을 쓰는 렌더 분기 코드는 건드리지 않는다. 측정 · 크기 · shape 값을 정하는 분기는 상시 규칙.
- skia · layout 소비처 (`buildSpecNodeData.ts` · layout engines) 의 파생 커밋은 동등성 테스트 + 해당 컴포넌트 Skia 픽셀 · layout rect 무변경 확인 (팔레트 추가 하니스, Compare Mode 없음) 을 같이 둔다.
- 파생 대상 (Phase 0 표에서 확정): 필드 패밀리 집합 (`fieldInlineLayoutMigration.ts:38` `FIELD_FAMILY_TAGS` · `buildSpecNodeData.ts:339` `FORM_INHERITING_FIELD_TAGS` 외) · 텍스트 호스트 (`useCanvasElementSelectionHandlers.ts:52` · `useTextEdit.ts:84` · `hierarchicalSelection.ts:65` · `editorPresentationTextColor.ts:10` 외) · 컬렉션 · 목록 (`CanonicalNodeRenderer.tsx:170,192` · `FrameSlotSection.tsx:86` · `canonicalRefResolution.ts:1203,1358`) · 구조 컨테이너 (`dropTargetResolver.ts:132` · `componentCatalog.ts:57` (AI) · `buildSpecNodeData.ts:209` · `editorPresentationSpacingCapability.ts:199`).
- 동등성 게이트: 파생 집합마다 "옛 집합 == 파생 집합" 테스트를 파생 커밋과 같이 넣는다. 옛 리터럴은 테스트 안 기대값으로만 남기고, 다음 커밋에서 기대값을 표 스냅샷으로 바꾼다.
- 번들: shared 추가분이 Builder · Preview initial 에 들어간다 — ADR-201 상한 (Builder ≤ 1,328,315 · Preview ≤ 601,346, 만료 2026-10-17; 만료 뒤에는 그때 정본) 안.

## 5. Phase 3 — store 액션 진입부 강제 (G3 · G4)

동작 변경 있음. 표면마다 판정이 달라지는 것을 없애는 것이 목적이다.

1. `canX(op, targets) → { ok, reason }` — `delete` · `duplicate` · `group` · `ungroup` · `detach` · `toggleOrigin` · `move` · `editStyle`. 같은 술어 · 표만 읽는다. 메뉴 · 액션 바 · 단축키 (`commandMeta`) · Layers · AI 도구가 이 함수로 노출과 실행을 판정한다.
2. mutation 쪽 가드 — **구조 변경 store 액션의 진입부**에서 같은 `canX` 를 한 번 더 부른다 (UI 를 거치지 않는 호출 — AI · 붙여넣기 · 단축키 — 도 막힌다). 거부 시 토스트 (`messageKey`). 러너로 옮기지 않는다: 대상 액션 (`removeElement` · `moveElementToContainer` · `addElement` 계열 · `groupSelection`/ungroup · `toggleComponentOrigin` · `detachInstance` · `updateElementProps` · `updateElement` · `batchUpdateElementProps` · inspector `updateAndSave`) 대부분이 ADR-184 기존 경로 allowlist (`canonicalMutationRunner.static.test.ts:40`) 라 러너 가드가 닿지 않는다.
   - ratchet: `structuralStoreActionGuard.static.test.ts` — 구조 변경 액션 목록 (Phase 0 강제 지점 표에서 고정) 의 각 액션 본문 앞부분이 `canX` (또는 편집 게이트 `confirmOriginImpactForIds`) 를 부르는지 AST 로 확인. 목록 밖 새 액션이 canonical wrapper 를 부르면 목록 등재를 요구한다 (R7).
3. `resolveMoveTarget(op, policy)` — 이동 · 생성 대상 결정 하나. 현재 `resolveCanonicalMutationTarget.ts` · `useDragBridge.ts` · `canonicalMutations.ts` · Layers `validation.ts` · 팔레트 · 붙여넣기 · AI 가 각자 정한다. policy = `reject` | `nearest-ancestor`. 표면별 기본 policy 는 Phase 0 표의 현행 동작을 그대로 옮긴다 (새 동작 도입 아님).
4. 위임 sub-part 쓰기 가드 — 캔버스 resize · spacing 드래그 · AI 가 무시될 인라인 style 을 쓰지 않게 `editStyle` 판정을 지난다 (A-2 잔여).
5. 영향 게이트 (B-4 `confirmOriginImpactForIds`) 는 같은 진입부 규약에 넣는다 — `canX("editStyle")` 뒤에 부른다. 이동 트랜잭션 좌표 patch 예외 (`skipOriginImpactGate`) 는 이동 액션 진입부가 이동 자체를 게이트할 때 없앤다.

- 원복 RED: 가드마다 "가드 제거 → 해당 표면 테스트 RED" 1행.
- live (Skia · store 만, Compare Mode · Preview iframe 은 열지 않는다): Layers 로 ListBox 안에 Button 끌기 · Components 원본 분리 · 상태 변형 삭제 · instance 안 요소 메뉴 · 단축키 삭제 · 위임 Label resize · AI 삭제 도구 body 판정 · 붙여넣기 대상 (instance 안 선택 · 중첩 위반 부모).
- 성능 (G4): `canX` 에 perf 라벨 (`performance.measure`) 을 달아 **호출당 p95 ≤ 0.1 ms · 선택 변경당 합 ≤ 1 ms** 를 직접 잰다 (선택 600 문서 + 사람이 만든 문서 1개 · 대조군 = 변경 전 빌드 같은 조작 · 조건 기록: visibilityState visible · headed). `pnpm perf:baseline -- --lane frame` 전체 선택 · 편집 lane 은 변경 전 대비 run 편차 안인지만 확인한다 (전체 240 ms 대 경로에서 1 ms 차는 편차에 묻힌다).

## 6. Phase 4 — 종결

- evidence 한 절 (Phase 별 ratchet 값 · 동등성 · 원복 RED · live 표) · CHANGELOG · README 상태 갱신.
- 판독 루프는 phase 당 판독 1 + 수리 검증 1 (`.claude/rules/review-loop-closure.md`).

## 7. 파일 경계 요약

| Phase | 새 파일                                                         | 주로 바뀌는 곳                                                                                                                                                                                                                                                               |
| ----- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `docs/adr/evidence/236-domain-rules-inventory.md`               | —                                                                                                                                                                                                                                                                            |
| 1     | `domainPredicateRatchet.static.test.ts`                         | `editingSemantics.ts` · `syntheticDescendantLookup.ts` · 술어 재구현 파일들 · shared 술어                                                                                                                                                                                    |
| 2     | `packages/shared/src/domain/componentTraits.ts` + 동등성 테스트 | 파생 대상 집합 선언 파일 · `nestingRules.ts`                                                                                                                                                                                                                                 |
| 3     | `builder/domain/canOperate.ts` · `resolveMoveTarget.ts`         | `canvasContextMenuProviders.ts` · `actionBarPolicy` · `commandMeta` · Layers · AI 도구 · 구조 변경 store 액션 진입부 (`elements.ts` · `elementRemoval.ts` · `instanceActions.ts` · `elementUpdate.ts` · `inspectorActions.ts`) · `structuralStoreActionGuard.static.test.ts` |
