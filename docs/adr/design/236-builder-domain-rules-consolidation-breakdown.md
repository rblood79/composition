# ADR-236 구현 상세 — 빌더 도메인 규칙 정리 (술어 모듈 · 타입 특성 표 · store 강제)

> 본문: [ADR-236](../completed/236-builder-domain-rules-consolidation.md). 이 문서는 Phase · 파일 경계 · 게이트 절차만 담는다.

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

## 8. Phase 0 결과 (2026-09-24)

G0 PASS. 전문은 로컬 evidence `docs/adr/evidence/236-domain-rules-inventory.md` (커밋 대상 아님). 기준 커밋 `be0b657d2`.

### 8.1 ratchet 시작값

| 항목                                          | 시작값                       | 목표                           |
| --------------------------------------------- | ---------------------------- | ------------------------------ |
| `new Set([` 대문자 상수 (테스트 · bench 제외) | 144 (파생 대상 23)           | 파생 대상 → 0 (Phase 2)        |
| body 타입 직접 비교 (builder)                 | 92행 (lower 49 · 그대로 43)  | 0, 허용 목록 제외 (Phase 1)    |
| body 파일 로컬 헬퍼                           | builder 11 · shared 1        | 0 (Phase 1)                    |
| synthetic id 직접 파싱                        | 8행 / 5파일                  | 0 (Phase 1)                    |
| Components 페이지 판정 헬퍼                   | 4 (+ shared 직접 비교 1)     | 판정 1 + 입력 어댑터 (Phase 1) |
| role 우선순위 함수를 액션 판정에 쓰는 곳      | 1 (`instanceActions.ts:698`) | 0 (Phase 3 — 동작 변경)        |
| store 를 우회하는 구조 쓰기                   | 2 (드래그 · factory 생성)    | Phase 3 가드 목록에 포함       |

144 는 ADR Context 의 125 를 대체한다 (125 는 명령이 기록되지 않았다). 집합 분류: 타입 외 83 · 파생 대상 23 · 렌더 특수 27 · 로컬 정당 11.

### 8.2 §2 · §4 정정

- 로컬 정당으로 재분류: `fieldInlineLayoutMigration.ts:38` `FIELD_FAMILY_TAGS` · `circleLeafInlineSizeMigration.ts:32`. migration 대상은 과거 문서 형태에 고정이라 표에서 파생하지 않는다.
- 렌더 특수로 재분류: `buildSpecNodeData.ts:209` `SHELL_ONLY_CONTAINER_TAGS` · `editorPresentationTextColor.ts:10` · `fullTreeLayout.ts:113` `LABEL_DELEGATION_PARENT_TAGS`. 이름이 효과를 말한다.
- `ORIENTATION_DRIVEN_TAGS` · `LABEL_POSITION_DRIVEN_TAGS` 는 파생 출처가 특성 표가 아니라 D2 prop 스키마다.
- `resolveSubpartOwner` 재구현 5곳: 실측 0. 소유자 판정은 이미 shared 술어 하나이고, 남은 직접 비교는 렌더 분기와 reset 기본값 분기다. Phase 1 표에서 뺀다.
- `isBodyType` 은 대소문자를 무시한다. 대문자 `"Body"` 를 만드는 곳이 shared `export.utils.ts:423` 에 있다. 지금 대소문자를 그대로 비교하는 43행은 교체 때 행마다 입력 경로를 확인한다.
- `elementIndexer.ts:210` 은 `=== "Body"` 라 항상 false 다. 소비처가 0 (`rootsByPage` 를 읽는 곳 없음) 이라 production 영향은 0 이다. Phase 1 에서 이 인덱스가 dead 인지 같이 판정한다.

### 8.3 같은 사실을 다시 적은 집합 (Phase 2 입력)

- textHost: `TEXT_ELEMENT_TAGS` (29) 는 `TEXT_EDITABLE_TAGS` (24) 와 `INPUT_VALUE_EDIT_TAGS` (5) 의 정확한 합집합이다.
- structural: 파생 관계는 다음과 같다.
  - PADDING = STRUCTURAL − {body}
  - FRAME_SLOT = STRUCTURAL − {body, card, cardpreview, container}
  - AI `CONTAINER_TYPES` 는 frame · Slot · Section · Nav 뿐이라 다른 구조 집합과 거의 겹치지 않는다. 멤버십 차이 커밋과 live 가 필요하다.
- image: 두 집합이 대소문자만 다르다.
- buttonChildHost: 두 집합이 같다.
- listOwner: preview 쪽에만 TagGroup 이 더 있다.

### 8.4 강제 지점 불일치 (Phase 3 입력)

| #   | 불일치                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | toggle 의 body 가드가 메뉴 · 바에만 있다. 단축키 (`useGlobalKeyboardShortcuts.ts:230-239`) · agent · store (`instanceActions.ts:844-851`) 에 없다 → body 가 origin 이 될 수 있다 |
| E2  | AI `canonical.reusable` 이 `updateNode` 를 직접 부른다 (`canonicalNodeFields.ts:130-139`). systemOwned 가드 · 영향 확인 · instance 분리를 전부 우회한다                          |
| E3  | systemOwned origin 의 삭제 · 해제가 메뉴 · Layers 에 노출된다. store 결과는 셋으로 갈린다 (삭제 무음 no-op · toggle toast · AI `notDeleted`)                                     |
| E4  | origin 영향 확인이 props 편집에만 있다. 삭제 (자동 분리) · 생성 · 붙여넣기 · 이동 · 드래그에는 없다                                                                              |
| E5  | ungroup 이 frame origin 을 가리지 않는다 (`canvasActions.ts:415,455`). systemOwned frame 이면 자식만 빠지고 빈 origin 이 남는다                                                  |
| E6  | synthetic 자식 명시 가드가 드래그 · 단축키 reorder · AI create 부모에 없다. store 맵에 없어서 우연히 걸러질 뿐이다                                                               |
| E7  | Layers DnD 에 중첩 preflight 가 없다. AI create 는 ref 의 origin 타입을 해석하지 않지만 팔레트는 해석한다                                                                        |
| E8  | store 를 우회하는 쓰기: 드래그 (`useDragBridge.ts:544,951,1036` adapter 직접) · factory 생성 (`factories/utils/elementCreation.ts:146-178` `setState` 직접)                      |
| E9  | group 의 `multiSelectMode` 조건이 메뉴 · 바와 action · agent 에서 다르다 → 메뉴 항목이 no-op 이 될 수 있다                                                                       |
| E10 | body 판정 대소문자가 AI · Layers (그대로) 와 store · canvasActions (`toLowerCase`) 에서 다르다                                                                                   |
| E11 | ListBox template anchor 삭제 금지가 store 에만 있다. 메뉴에는 보이지만 누르면 무음 no-op 이다                                                                                    |
| E12 | Components 페이지 판정이 구조 변경 경로에 0 이다. 보호는 systemOwned 루트 (삭제 · toggle) 하나에 의존한다                                                                        |

Phase 3 `canX` 의 op 목록과 store 가드 목록 (§5) 은 이 표를 입력으로 한다. E8 의 두 경로는 `structuralStoreActionGuard` 목록에 넣는다.

### 8.5 회귀 기준

builder 스위트: 7,309 중 실패 6. 전부 이번 작업 전부터 있던 것이다 (`propertyFieldIcons.static` · `adr113DescendantsGrepGate` · `factoryInlineDirtyBaseline` · `historyActions.static` · `componentCatalog` · `textAxisGate` — 마지막은 worktree 환경 한정). Phase 1 · 2 게이트는 이 실패 집합이 커밋 전후 같은지 본다.

## 9. Phase 1 기록

| 술어              | 상태              | 내용                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isBodyType`      | 완료 (2026-09-25) | shared `domain/predicates.ts` (대소문자 무시). builder · shared 직접 비교 92 + shared 4 → 0, 로컬 헬퍼 12 → 0 (합성 술어 `isFrameBodyElement` 만 남김). ratchet `builder/domain/__tests__/domainPredicateRatchet.static.test.ts` — 직접 비교 재도입 시 RED 확인. publish (`useBodyElement.ts:52`) 는 범위 밖                                          |
| synthetic id      | 완료 (2026-09-25) | shared `domain/syntheticId.ts` — 구분자 · `hasSyntheticIdPath` · `splitSyntheticId` · `getSyntheticAncestorIds` (문자열 형태만). builder 직접 파싱 9행 → 0, `syntheticDescendantLookup` 도 이 원시 함수 위로. 호출처별 projection 제외 조건 (`projection:` · `::page-frame::`) 은 그대로 둔다 — 아래 후속                                             |
| Components 페이지 | 완료 (2026-09-25) | shared `domain/componentsPage.ts` — `isComponentsPage` (pageRole · 시스템 id · slug) + 입력 어댑터 `componentsPageFieldsOfNode` · 소속 판정 `isOnComponentsPage`. 상수 3개 (`COMPONENTS_PAGE_ROLE` · `COMPONENTS_PAGE_SLUG` · `COMPONENTS_SYSTEM_PAGE_ID`) 도 이 파일로. 헬퍼 4 → 1, 허용 목록은 export HTML 인라인 스크립트 (`export.utils.ts`) 하나 |

`isBodyType` 커밋의 동작 차이: 대소문자를 그대로 비교하던 43행이 `"Body"` 도 body 로 본다. 대문자 입력은 export 런타임 모델 안에서만 생기고 (`export.utils.ts:405` 가 `"body"` 로 정규화), `elementIndexer` 의 `rootsByPage` 는 소비처 0 이다. builder 스위트 실패 집합은 커밋 전후 같다 (`adr238Phase3.pickers` · `textAxisGate` — 이 커밋을 뺀 상태에서도 실패). 옛 소스 문자열을 검사하던 static 테스트 2개 (`BuilderCore.static` · `styleReadCanonical.static`) 는 새 형태로 갱신.

synthetic id · Components 페이지 커밋의 동작 차이:

- synthetic id: 0. 각 호출처의 제외 조건을 그대로 옮겼다.
- Components 페이지: role 만 보던 shared 2곳 (`isRuntimePageNode` · preview `App.tsx`) 과 metadata slug 를 정확히 비교하던 builder `repairComponentsPageNode` 탐색이 이제 id · 정규화 slug 도 본다. 차이는 `pageRole` 이 없는 (repair 전) 문서에서만 나고, builder 는 문서를 열 때 repair 한다. builder 스위트 실패 0, shared 는 기존 catalog `Modal` 1건.

Phase 1 후속 — 판정 (2026-09-25, 코드 변경 없음):

- synthetic id 제외 조건 통일 → **하지 않는다.** 제외 조건이 다른 것은 id 네임스페이스가 달라서다. `getEditingSlotMarkerRole` (`editingSemantics.ts`) 은 캔버스 맵에서 경로 조상을 거슬러 올라가는데, 이 맵에는 page-frame 키 (`p::page-frame::inst`) 도 실제로 있다. 정본처럼 page-frame 을 빼면 page-frame 에 투영된 instance 자식의 slot 표식 역할이 `origin` 으로 틀어진다. 구분자는 이제 한 곳 (`syntheticId.ts`) 이 안다.
- `slotHostPolicy` 의 `reusable || systemOwned` → main 에서 이미 `isReusableOrSystemOwned` 로 이름이 분리됐다 (ADR-237). 판정을 그대로 말하는 이름이라 닫는다.
- `typeof x.ref === "string"` 13행 → 대부분 ref 값을 읽는 필드 접근이라 술어 대상이 아니다. 다른 두 곳도 편집 축과 질문이 다르다.
  - `storeBridge.ts:72` `isInstanceNode` 는 해석할 대상이 있는 instance 만 본다 (masterId · ref 가 비지 않아야 함). 편집 축 `isEditingSemanticsInstance` 는 셋 중 하나만 있으면 된다.
  - legacy `getInstanceMasterReference` 는 legacy instance 가드 뒤 호출처 1곳 (`instanceActions.ts:517`) 뿐이라 `getEditingSemanticsOriginId` 와 합치지 않는다.

Phase 1 종결 (G1): 술어 3종 (body · synthetic id · Components 페이지) 의 직접 구현 0 — ratchet 이 지키고 재도입 시 RED 를 확인했다. builder 스위트 실패 0 · type-check 0. instance · origin · systemOwned 술어는 Phase 0 에 이미 한 곳이라 옮길 것이 없었다 (role 우선순위 함수를 액션 판정에 쓰는 `instanceActions.ts:698` 은 동작 변경이라 Phase 3).

Phase 1 판독 (reviewer, 2026-09-25, `18b8928e8` · `f85a6c9bf`): merge 를 막을 이슈 0 → 닫힘. LOW deferred 2:

- `componentsPage.ts` `normalizeSlug` 때문에 앞 `/` 없는 `__components` slug 도 Components 페이지로 잡힌다. 사용자 페이지가 흡수될 수 있다는 가설은 `validateSlug` 가 `_` 를 막아서 재현되지 않는다.
- dev fixture `pathHeavy117Fixture.ts` 의 `type: "Body"` 가 이제 builder 전역에서 body 로 인식된다. 원래보다 일관된 쪽으로 바뀐 것이고 dev 전용이다.

## 10. Phase 2 기록

표: `packages/shared/src/domain/componentTraits.ts` — 타입 한 행에 `container` (`structural` · `collection`) · `families` · `children` · `owners`. 소비처는 `componentTypeSet(family)` · `containerTypeSet(kind)` · `componentContractMap(column)` · `componentOwnerTypes(type)` 로 집합을 얻는다.

파생 대상 23 판정 (Phase 0 이후 main 이 바뀐 곳은 현재 코드 기준):

| 판정                 | 수  | 집합                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 표에서 파생          | 17  | `STRUCTURAL_CONTAINER_TYPES` · `PADDING_CONTAINER_TYPES` (structural − body) · `FRAME_SLOT_HOST_TYPES` (freeContentHost — ADR-240 이 popover · tooltip 추가) · `TEXT_EDITABLE_TAGS` · `TEXT_ELEMENT_TAGS` (textHost ∪ inputValue) · `INPUT_VALUE_EDIT_TAGS` · `BUTTON_CHILD_HOST_TAGS` · `LABEL_EDIT_HOST_TAGS` · `ACTION_TAGS` · `DISABLING_GROUP_TYPES` · `SELECTION_FLAG_ITEM_TYPES` · `STATIC_ITEM_TYPES` · `ITEM_SLOT_COLLECTIONS` · `FORM_INHERITING_FIELD_TAGS` · `DATE_INPUT_PARENT_TAGS` (DateInput 의 `owners`) · `IMAGE_TAGS` · `IMAGE_INTRINSIC_TAGS` |
| D2 스키마에서 파생   | 2   | `ORIENTATION_DRIVEN_TAGS` · `LABEL_POSITION_DRIVEN_TAGS` — binding `props.accepts` ∧ catalog containerVariants                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 이미 파생            | 1   | preview `COLLECTION_HOST_TYPES` — renderer 레지스트리 (`ORPHAN_ITEM_HOST` · `COLLECTION_ONLY_INTERNAL_RENDERERS`) 합성                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 로컬 정당으로 재분류 | 2   | `COMPLEX_COMPONENT_TAGS` — ADR-914 사용자 결정 (2026-06-21) 으로 이 집합 자체가 creation facet 정본이고 `entryUniverseContract.test.ts` 가 양방향 parity 를 지킨다. `SELF_LIST_SLOT_HOST_TYPES` — 인벤토리의 `SELF_LIST_OWNER_TYPES` 는 ADR-237 · 239 가 slot host 규칙 레지스트리로 다시 짰다 (`GROUP_SLOT_HOSTS` · `ROOT_REGION_SLOT_HOST_TYPES` 합성). 남은 리터럴은 slot 정책이다                                                                                                                                                                             |
| Phase 3 으로 이월    | 1   | AI `CONTAINER_TYPES` (frame · Slot · Section · Nav) — structural 과 멤버가 달라 파생하면 AI 동작이 바뀐다. AI 표면의 live 를 Phase 3 에서 어차피 돌리므로 그때 멤버십 차이 커밋으로 다룬다                                                                                                                                                                                                                                                                                                                                                                        |

`nestingRules.ts` 층 2 의 세 표 (`STRICT_COLLECTION_PARENT_TYPES` · `RAC_COLLECTION_CHILD_TYPES` · `RAC_SUBPART_OWNER_TYPES`) 도 표의 `container: "collection"` · `children` · `owners` 열에서 파생한다. 값 배열 순서까지 옛 표와 같다 — 위반 메시지 (`allowed.join` · `owners.join`) 가 이 순서로 나간다.

커밋: `81ef3e588` (편집 · 패널 · preview 13) · `23aa747e3` (skia · layout 4) · `68965dd4b` (nestingRules 3 + DateInput) · `ee41d01ad` (Direction 토글 2).

G2 근거:

- 동등성: `componentTraits.test.ts` 가 옛 리터럴을 기대값으로 둔다 (조합 집합 · nestingRules 세 표 포함). Direction 토글은 기존 `orientationDrivenTags.test.ts` 의 기대값 그대로.
- ratchet: `domainPredicateRatchet.static.test.ts` — 파생한 집합 20 개 · nestingRules 맵 2 개의 리터럴 재선언 0. 재도입 시 RED 를 확인했다.
- skia · layout live (`apps/builder/scripts/adr236-phase2-live.mjs`, headed Playwright · Compare Mode 없음): Form 안 TextField · NumberField + DateField · DatePicker · Image · Avatar 를 팔레트로 추가하고 파생 전 (소비처 3 파일을 이전 판으로) · 후를 비교했다. layout rect 차이 0/8 · Skia 캔버스 픽셀 차이 0 (threshold 0). 감도: 표에서 `Image` 의 image family 를 빼면 픽셀 55,380 개가 달라진다.
- 번들 (production 빌드 · `adr209-bundle-closure.mjs`, initial JS gzip): Builder 1,408,955 · Preview 621,472 — ADR-201 재승인 상한 (1,415,000 / 622,000) 안. 재승인 실측 (`4ad12dbe3`: 1,408,688 / 618,865) 대비 ADR-236 Phase 1 · 2 합계 +267 / +2,607 이다. 표 모듈 단독 minify+gzip 은 1,352 B. Preview 여유는 528 B 뿐이다.
- 스위트: builder 실패 0 · shared 는 기존 catalog `Modal` 1건 · type-check 0.

멤버십 차이 (후속, 동작 변경 전 live 판정 필요): D2 식으로는 Meter · ProgressBar · Slider 도 labelPosition 축 컨테이너다 (accepts + `label-position` variant 보유). 현행 Direction 토글은 이 셋에서 `style.flexDirection` 을 쓴다. 제외 사유 기록이 없어 `LABEL_POSITION_NOT_DRIVEN` 에 현행대로 두었다.

Phase 2 판독 (reviewer, 2026-09-25, `81ef3e588` · `23aa747e3` · `68965dd4b` · `ee41d01ad`): merge 를 막을 이슈 0 → 닫힘. 대조 결과 17 집합 멤버십 · 대소문자 처리 · nestingRules 값 배열 순서가 같다. 바뀐 것은 Set 순회 순서와 맵 키 순서뿐이고 소비처는 전부 `.has` · key lookup 이다. `componentTraits.ts` 는 import 없는 leaf 라 순환 · 초기화 순서 문제가 없다. LOW deferred 2:

- `useElementCreator.ts:239` 의 `componentTypeSet("action")` 이 함수 안에 있어 호출마다 표를 순회한다. 옛 코드도 호출마다 `new Set` 을 만들었고 Card 부모일 때만 실행된다.
- `LABEL_POSITION_NOT_DRIVEN` 의 Meter · ProgressBar · Slider — 위 멤버십 차이 후속과 같은 항목.

Phase 2 종결 (G2): 파생 대상 23 판정 완료 (표 17 · D2 2 · 이미 파생 1 · 재분류 2 · Phase 3 이월 1) + nestingRules 층 2 표 3. 동등성 · ratchet · skia/layout live 0 · 번들 상한 안.

## 11. Phase 3 기록

판정 모듈 2개: `apps/builder/src/builder/domain/canOperate.ts` (노드 × 작업 — delete · copy · duplicate · group · ungroup · detach · toggleOrigin · move · editStyle) 와 `resolveMoveTarget.ts` (생성 · 이동 · 붙여넣기 대상 — policy `reject` | `nearest-ancestor`). 표면은 노출 판정에, 구조 변경 store 액션은 진입부에서 같은 함수를 부른다.

커밋: `37a6ec692` (canOperate) · `4f6378821` (표면) · `e48f332bb` (store 진입부 + ratchet · AI reusable) · `b523edd33` (resolveMoveTarget) · `7448c1dfd` (영향 확인) · `ca98b9c3f` (editStyle · createInstance · G4) · live 하니스 `071fc2cda` · `2ac63ed5f` · 판독 수리 `66af8347d`.

강제 지점 불일치 (§8.4) 판정:

| #   | 결과                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | 닫힘 — 공통 실행기 (단축키 · agent · 패널) · commandMeta · store `toggleComponentOrigin` 이 `canOperate("toggleOrigin")` (body 거부)                                                                                                                                                                                                                                                                                                        |
| E2  | 닫힘 — AI `update_element canonical.reusable` 이 store `toggleComponentOrigin` 경유 (systemOwned 가드 · 영향 확인 · instance 분리)                                                                                                                                                                                                                                                                                                          |
| E3  | 닫힘 — 메뉴 · Layers 에 systemOwned origin 삭제 · 해제가 서지 않고, 표면 밖 호출은 store 가 이유를 토스트로 보인다                                                                                                                                                                                                                                                                                                                          |
| E4  | 부분 — 사용자 동작을 시작하는 표면이 첫 쓰기 전에 가장 가까운 origin 의 영향 확인 (`confirmStructuralOriginImpact`): 캔버스 삭제 · 묶기 · 묶기 해제 · 붙여넣기 · 복제 · Properties/Layers 삭제 · 팔레트 생성 · Layers 이동 · AI 생성/삭제. store 액션 진입부는 묻지 않는다 (판독 HIGH-2). **캔버스 드래그 · 패널 내부 추가 (Table "+" · Button 아이콘 · 항목 역할 · 프리셋 · 컬렉션 항목) · Alt 드래그 복제는 후속** — 종전처럼 묻지 않는다 |
| E5  | 닫힘 — `canOperate("ungroup")` 이 systemOwned frame 거부 (메뉴 · 단축키 · agent)                                                                                                                                                                                                                                                                                                                                                            |
| E6  | 닫힘 — `resolveMoveTarget` · store `addElement` · `addComplexElement` · factory · reorder · 이동 진입부가 synthetic 자식을 부모 · 대상으로 받지 않는다                                                                                                                                                                                                                                                                                      |
| E7  | 닫힘 — AI 생성 · 붙여넣기가 ref 부모를 원본 타입으로 읽고 (팔레트와 같은 해석기), Layers 드롭에 중첩 preflight                                                                                                                                                                                                                                                                                                                              |
| E8  | 닫힘 — factory `addElementsToStore` 에 생성 가드, 드래그 쓰기는 `resolveDragMoveTarget` 뒤에서만 (ratchet 이 쓰기마다 확인)                                                                                                                                                                                                                                                                                                                 |
| E9  | 닫힘 — group · 정렬 · 분배가 `multiSelectMode` 대신 개수로 판정                                                                                                                                                                                                                                                                                                                                                                             |
| E10 | Phase 1 에서 닫힘 (`isBodyType`)                                                                                                                                                                                                                                                                                                                                                                                                            |
| E11 | 닫힘 — ListBox template anchor 에 삭제가 서지 않고 store 는 이유를 보인다                                                                                                                                                                                                                                                                                                                                                                   |
| E12 | 판정 — 새 가드 없음. Components 페이지는 origin 을 편집하는 정상 표면이다. 보호는 systemOwned 루트 (삭제 · 해제 · ungroup) 와 E4 영향 확인 (origin 자손 구조 변경 시 instance 가 있으면 묻는다) 이 맡는다                                                                                                                                                                                                                                   |

그 밖: 위임 sub-part 쓰기 (A-2 잔여) 는 `canOperate("editStyle")` 하나로 — 캔버스 resize · spacing · AI `update_element` styles. `createInstance` 는 role 우선순위 함수 대신 축 술어 (dual 노드 거부 명시, production 호출처 0). ratchet: `structuralStoreActionGuard.static.test.ts` (가드 목록 13 액션 · 우회 쓰기 2 경로 · canonical 변경 래퍼 호출 함수 집합) · `domainPredicateRatchet` (stores 안 role 우선순위 함수 0).

G3 근거:

- 원복 RED: 표면 7 · store 9 · AI reusable 1 · 대상 판정 8 · 영향 확인 3 · editStyle · role 2 — 커밋별 소스 원복 시 해당 테스트 전부 실패, 복원 후 통과.
- live (`adr236-phase3-live.mjs`, headed Playwright · Compare Mode · Preview iframe 없음):
  - A ⌥⌘K 로 body 를 컴포넌트로 — reusable false 유지, 이유 토스트.
  - B Components 페이지 system origin (component-iconbutton) Backspace — 남아 있음, 이유 토스트.
  - C Layers 의 system origin · 상태 변형 행 — 삭제 버튼 0, 우클릭 메뉴에 delete · toggle 없음. 대조군 (팔레트 frame) 은 삭제 버튼 1, 메뉴에 ungroup · toggle · delete.
  - D Layers 에서 Button 을 ListBox 로 끌기 — 부모 그대로 (대조군 frame 드롭은 이동). 끝 상태는 종전과 같아 preflight 의 차이는 원복 RED 가 근거다.
  - E Button instance 선택 후 ⌘C · ⌘V — 붙인 Button 이 instance 부모 frame 으로 옮겨지고 중첩 알림.
  - AI 삭제 도구의 body 판정 · 위임 sub-part resize 는 live 없이 단위 테스트 (AI 는 모델 실행이 필요하고, resize 진입 차단은 `ba47a0ddc` 에서 live 로 확인한 판정을 그대로 옮겼다).
- 스위트: builder 실패 0 · type-check 0.

G4 (`adr236-phase3-perf.mjs`, headed · visibilityState visible · 격리 컨텍스트 · perf-baseline 의 600 요소 mixed fixture — 규모 전용): `canOperate` 호출당 p95 ≈ 0.0003 ms (≤ 0.1). 전체 선택 600 에서 선택 변경당 판정 몫 p95 0.4 ms (≤ 1) · 메뉴 조립 전체 0.6 ms. 대조군은 종전 관문 (`selectableWithoutBody`) 을 같은 데이터로 인라인 실행 — 0.1 ms. 사람이 만든 문서 측정과 `perf:baseline --lane frame` 전후 비교는 돌리지 않았다 — 전체 선택 경로 (~240 ms) 에서 판정 증가분 +0.3 ms 를 직접 쟀다.

후속 (Phase 3 범위 밖으로 기록):

- 캔버스 드래그의 origin 영향 확인 (E4 잔여) — 동기 커밋 경로라 확인 뒤 커밋으로 구조를 바꿔야 한다.
- 패널 내부 구조 쓰기 · Alt 드래그 복제의 origin 영향 확인 (E4 잔여) — 각 표면이 병렬 쓰기 전에 `confirmStructuralOriginImpact` 를 한 번 부르게 한다. FrameSlotSection 의 기존 선행 확인은 header 자신만 본다.
- system 상태 변형 (`<origin>--<state>`) 에 메뉴 `detach-instance` 가 선다 (live C 관찰). 분리하면 state 층이 원본을 잃을 수 있어 삭제 · 해제와 같은 보호 대상인지 판정이 필요하다.
- Phase 2 에서 넘긴 AI `CONTAINER_TYPES` 는 파생하지 않는다 — 구조 컨테이너 표로 바꾸면 Card · Group 등이 AI 컨테이너가 되고 Slot · Nav 가 빠진다. 이것은 판정 일원화가 아니라 AI 계획 어휘의 품질 판단이라 별도로 다룬다.
- Phase 2 의 labelPosition 멤버십 차이 (Meter · ProgressBar · Slider).

Phase 3 판독 (reviewer, 2026-09-25, `b8e1f864b..2ac63ed5f`): HIGH 2 · MEDIUM 1 · LOW 2. 수리 `66af8347d`.

- HIGH-1 (수리) — `resolveMoveTarget` 이 synthetic 대상을 모두 거부해 ADR-240 이름 영역으로의 캔버스 드래그가 막혔다 (드래그 상호작용 맵에는 synthetic 노드가 있고 영역 host 는 정식 drop 대상이다). 영역 host · 영역 안 노드는 통과, 영역 밖 synthetic 만 거부. 원복 RED 1.
- HIGH-2 (수리) — store `addElement` · `removeElement` 진입부의 영향 확인이 조상 origin 까지 보며 대화상자를 기다렸다. 패널 · 묶기 · 드래그 복제는 이 액션을 병렬 · 트랜잭션 안에서 동기 완료를 전제로 부르고, 대화상자 슬롯이 하나라 병렬 요청이 서로 취소했다 (묶기 취소 → 없는 부모로 자식 patch · 묶기 해제는 history 뒤에 묻기 · Table "+" 는 마지막 cell 만 등). store 진입부 확인을 빼고 표면 선행 확인으로 옮겼다 — 빠진 표면은 종전 동작 (묻지 않음) 으로 남아 부분 반영이 생기지 않는다. 원복 RED 3 (canvasActions 2 · elementCreation 1). live `adr236-phase3-repair-live.mjs`: origin 안 Backspace · ⌘G 대화상자 → 취소 시 변화 0 · 확인 시 frame 1 + 두 Text 이동, pageerror 0. Phase 3 live A–E 재실행 결과 동일.
- MEDIUM (수리) — 팔레트 단순 생성이 추가 완료 전에 선택을 옮겼다. 확인을 팔레트 경로 선행으로 옮겨 해소.
- LOW deferred — `elementRemoval` 이 대화상자 await 전 읽은 source 를 뒤에 쓴다 (store 확인을 뺐으므로 await 자체가 없어짐) · `reorderElementWithinParent` / `moveElementToSiblingEdge` 가 store 맵에 없는 id 를 `notFound` 로 무음 거부 (canonical 전용 대상이 닿는 재현 경로 미확인, 가설).

Phase 3 종결 (G3 · G4): 판독 HIGH 2 수리 · 수리 검증 builder 스위트 7,619 PASS · type-check 0 · live 재실행. 실행자 닫힘 선언.

## 12. Phase 4 — 종결 기록 (2026-09-25)

Phase 기록 정본은 §9 ~ 11. 이 절은 Phase 0 ratchet 시작값 (§8.1 · 인벤토리 evidence §4) 에 대한 최종값과 게이트 근거만 모은다.

### 12.1 ratchet 최종값

| 항목                                               | 시작값 (§8.1)              | 최종값                                                                                          | 지키는 테스트                                                            |
| -------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 파생 대상 집합                                     | 23                         | 표 17 · D2 2 · 이미 파생 1 · 재분류 2 · 파생하지 않음 1 (AI `CONTAINER_TYPES`, 사유 §12.5)      | `domainPredicateRatchet` (리터럴 재선언 0 — 집합 20 · nestingRules 맵 2) |
| body 타입 직접 비교                                | 92 (+ shared 4)            | 0                                                                                               | `domainPredicateRatchet`                                                 |
| body 파일 로컬 헬퍼                                | 12                         | 0 (합성 술어 `isFrameBodyElement` 만)                                                           | `domainPredicateRatchet`                                                 |
| synthetic id 직접 파싱                             | 8행 (Phase 1 실측 9)       | 0                                                                                               | `domainPredicateRatchet`                                                 |
| Components 페이지 판정 헬퍼                        | 4                          | 1 + 허용 1 (export HTML 인라인 스크립트)                                                        | `domainPredicateRatchet`                                                 |
| `getEditingSemanticsRole` 을 액션 판정에 쓰는 호출 | 1                          | 0 (stores 안 0)                                                                                 | `domainPredicateRatchet`                                                 |
| `typeof x.ref === "string"` (정본 파일 밖)         | 7 (Phase 1 실측 전체 13행) | 판정 — 대부분 ref 값을 읽는 필드 접근이라 술어 대상 아님 (§9 후속)                              | —                                                                        |
| 구조 변경 store 액션 진입부 가드                   | 공통 가드 없음             | 13 액션이 첫 변경 전에 `canOperate` 계열 호출                                                   | `structuralStoreActionGuard` (AST)                                       |
| store 우회 쓰기                                    | 2                          | 2 경로 모두 쓰기마다 가드 선행 (드래그 `resolveDragMoveTarget` · factory `guardCreationParent`) | `structuralStoreActionGuard`                                             |
| canonical 변경 래퍼를 부르는 stores 함수           | 미집계                     | 11 (가드된 8 · 사유 등재 3 — props 축 2 · layout 삭제 1)                                        | `structuralStoreActionGuard` (새 호출 함수 → 등재 요구)                  |
| 강제 지점 불일치 (§8.4)                            | 12                         | 닫힘 11 · E4 부분 (드래그 · 패널 내부 추가 · Alt 복제 후속) · E12 판정                          | 표면별 · store 단위 테스트                                               |

### 12.2 동등성 · 원복 RED

- Phase 1: 동작 변경 0 을 스위트 실패 집합 전후 동일로 확인 (§8.5). body 대소문자 무시 전환은 대문자 입력이 export 런타임 모델 안에서만 생겨 차이 없음.
- Phase 2: `componentTraits.test.ts` 가 옛 리터럴을 기대값으로 둔다 (조합 집합 · nestingRules 세 표의 값 배열 순서 포함). ratchet 재도입 시 RED. 감도 — 표에서 `Image` 의 image family 를 빼면 Skia 픽셀 55,380 개가 달라진다.
- Phase 3: 원복 RED 표면 7 · store 9 · AI reusable 1 · 대상 판정 8 · 영향 확인 3 · editStyle · role 2, 판독 수리 4 (영역 드래그 1 · 표면 영향 확인 2 · store 가 묻지 않음 1). 커밋별로 소스를 되돌리면 해당 테스트가 실패하고 복원하면 통과.

### 12.3 live

모두 headed Playwright · 실제 builder · 새 프로젝트. Compare Mode · Preview iframe 은 열지 않았다.

| 하니스                            | Phase  | 조작                                                                                 | 결과                                                             |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `adr236-phase2-live.mjs`          | 2      | Form 안 TextField · NumberField · DateField · DatePicker · Image · Avatar, 파생 전후 | layout rect 차이 0/8 · Skia 픽셀 차이 0                          |
| `adr236-phase3-live.mjs` A        | 3      | body 선택 후 ⌥⌘K                                                                     | reusable false 유지 · 이유 토스트                                |
| B                                 | 3      | Components 페이지 system origin Backspace                                            | 남아 있음 · 이유 토스트                                          |
| C                                 | 3      | Layers system origin · 상태 변형 행 우클릭                                           | 삭제 버튼 0 · 메뉴에 delete · toggle 없음 (대조군 frame 은 있음) |
| D                                 | 3      | Layers 에서 Button 을 ListBox 로 끌기                                                | 부모 그대로 (대조군 frame 드롭은 이동)                           |
| E                                 | 3      | Button instance 선택 후 ⌘C · ⌘V                                                      | instance 부모 frame 으로 옮겨 붙이고 중첩 알림                   |
| `adr236-phase3-repair-live.mjs` F | 3 수리 | origin (frame + Text 2, instance 1) 안 Text Backspace → 취소                         | 영향 확인 대화상자 · 남아 있음                                   |
| G                                 | 3 수리 | 같은 두 Text ⌘G → 취소                                                               | 대화상자 · 요소 수 변화 0 · 부모 그대로                          |
| H                                 | 3 수리 | 다시 ⌘G → 확인                                                                       | frame 1 추가 · 두 Text 가 그 안으로 · 새 frame 은 origin 안      |

pageerror 는 모든 실행에서 0. AI 도구 판정과 위임 sub-part resize 는 단위 테스트로 확인했다 (AI 는 모델 실행이 필요하고, resize 진입 차단은 `ba47a0ddc` 에서 live 로 확인한 판정을 옮긴 것이다).

### 12.4 성능 · 번들

- G4 (`adr236-phase3-perf.mjs`, 600 요소 · headed · visible): `canOperate` 호출당 p95 ≈ 0.0003 ms · 전체 선택 600 의 선택 변경당 판정 몫 p95 0.4 ms · 메뉴 조립 0.6 ms (종전 관문 대조군 0.1 ms).
- 번들 (production 빌드 · 별도 worktree `1185387fa` · `adr209-bundle-closure.mjs`, initial JS gzip): Builder 1,411,505 · Preview 621,472 — ADR-201 재승인 상한 (1,415,000 / 622,000) 안. Phase 3 는 builder 만 바꿔 Preview 는 Phase 2 값과 같다.

### 12.5 범위 밖 (R5 — 상시 규칙)

ratchet 이 0 이어도 정리가 끝난 것은 아니다. 아래는 이 ADR 이 옮기지 않았고, 해당 코드를 고치는 커밋이 표로 옮긴다.

| 부류                                | 개수 | 위치 (인벤토리 §1.1)                                                                         |
| ----------------------------------- | ---: | -------------------------------------------------------------------------------------------- |
| 렌더 특수 (layout · skia 이름 분기) |   27 | `buildSpecNodeData.ts` · `layout/engines/*` · `canvasSceneNode.ts` · `specPresetResolver.ts` |
| 로컬 정당                           |   11 | migration 고정 · HTML 태그 · 레지스트리 키 · 기본 props cohort                               |
| AI `CONTAINER_TYPES`                |    1 | 구조 컨테이너 표로 바꾸면 AI 계획 어휘가 바뀐다 — AI 품질 판단으로 별도                      |

Phase 4 판독 (reviewer, 2026-09-25, `f88304c3d`): 이슈 0 → 닫힘. ratchet 수치 (가드 13 · 우회 2 · 래퍼 호출 함수 11) · 상대 링크 · anchor · README 증감 · live report 대조 일치. LOW 3 — `typeof x.ref` 시작값 한정어 누락 · ADR Live Exercise 의 "해제" 가 origin 해제와 instance 분리 둘로 읽힘 (둘 다 문구 수정) · README 열린 개수가 실제 파일 수와 다른 기존 drift (이번 커밋 증감은 일관, 다음 README 정리 때 재집계).

ADR-236 종결: Phase 0–4 · G0–G4, 실행자 닫힘 선언.

## 13. 종결 뒤 후속 — E4 잔여 (2026-09-25)

사용자 지시 "E4 후속 진행". §11 후속 목록의 캔버스 드래그 · 패널 내부 구조 쓰기 · Alt 드래그 복제를 닫는다. 커밋 `c9d79d678`.

- `runAfterStructuralOriginImpact(ids, run)` — 확인이 필요 없으면 같은 틱에 동기로 `run`, 필요하면 확인 뒤 실행. 캔버스 드래그의 동기 트랜잭션 (`runInTransaction`) 을 깨지 않고 확인을 앞에 둔다.
- `structuralMoveImpactIds(moving, targets)` — 이동의 영향 대상은 출발 · 도착 부모다. origin 루트 자리 이동 (Components 페이지 재배열 등) 은 instance 가 그 내용을 그대로 그려 묻지 않는다. Phase 3 의 Layers 이동 · 묶기는 옮기는 요소 자신을 넣어 루트 이동에도 물었다 — 같은 규칙으로 정정.
- 캔버스 드래그: 다중 · 절대배치 재부모화 · flow 이동이 커밋 전에 묻는다. 같은 부모 안 좌표만 바꾸는 이동은 스타일 편집이라 묻지 않는다 (편집 게이트와 같은 축). Alt 드래그 복제는 병렬 추가 전에.
- 패널: FrameSlotSection 7 경로 · Button 아이콘 설정/해제 · 항목 역할 추가 · 자식 항목 · 컬렉션 항목 추가/삭제. 기존 편집 게이트 (origin 자신만) 를 구조 영향 확인 (조상 origin 포함) 으로.
- 범위 밖: 프리셋 적용 (page body 대상 — origin 안에 올 수 없다) · quick connect (반환 계약이 `DataTable` 이라 취소를 넣으려면 호출부 오류 계약을 바꿔야 한다. 바인딩 축).
- ratchet: `structuralStoreActionGuard` — 표면 구조 쓰기 12 파일 × 영향 확인 선행 · 드래그 canonical 이동 행. 원복 RED: 드래그 · FrameSlotSection 8 · ItemSlotRoles 1 · ChildItem 2 · 컬렉션 2 · Button 아이콘 테스트 2.
- live (`adr236-e4-followup-live.mjs`, Components 페이지 Form origin + 홈 instance, 실제 마우스 드래그): 필드 드래그 → 대화상자 → 취소 순서 그대로 · 확인 순서 바뀜 · Form 루트 재배열은 묻지 않고 이동 · Alt 복제는 확인된 origin 이라 바로 +1 · 삭제 대조 대화상자. Phase 3 live A–E · 수리 F–H 재실행 결과 동일. pageerror 0.
- 판독 (reviewer, `c9d79d678`): HIGH 1 · LOW 2. HIGH — 묶기 대상을 부모로 줄이자 안쪽 `updateElement(parent_id)` 의 편집 게이트가 origin 루트마다 병렬로 대화상자를 요청해 서로 취소했다 (일부만 frame 에 · history 는 전부로 기록). 전에는 루트 자신을 구조 게이트에 넣어 캐시로 가려졌다. 수리 `fix(adr-236): 위치만 바꾸는 updateElement …` — 위치 필드만 바꾸는 update 는 편집 게이트를 걸지 않는다. 회귀 테스트 원복 RED · live M (Form · Toolbar 루트 ⌘G → 대화상자 0 · 같은 새 frame). LOW deferred — ratchet `findUnguardedWrites` 가 조상 함수 끝까지 올라가 같은 컴포넌트의 형제 handler guard 가 서로를 덮는다 (파일 단위 원복만 RED, production 재현 없음) · 절대배치 확인 뒤 이동도 좌표 patch 도 없으면 flow 경로로 넘어가지 않음 (delta 0 + 무변화 이동이라 도달 불가). 실행자 닫힘 선언.
- 관찰 (이번 범위 밖, 기존 동작): 홈 페이지의 사용자 frame 을 컴포넌트로 만들면 (`toggleComponentOrigin`) `page_id` 가 null 이 되고 캔버스에서 사라진다 — reusable frame 이 재사용 레이아웃 frame 과 같은 모양이라 page 투영에서 빠지는 것으로 보인다. 원인 확정은 하지 않았다.

## 14. 종결 뒤 후속 — system 상태 변형 분리 (2026-09-25)

§11 후속 "system 상태 변형에 `detach-instance` 가 선다" 판정: 결함 — 차단. `canDetachInstance` 는 `ref` 만 보고 system 상태 변형 (dual 노드 `ref` + `reusable` + `systemOwned`) 을 분리 대상으로 받았다. 분리 스냅샷은 `reusable` 을 지우고 metadata 는 남긴다 → `readStateVariantSelf` 는 `ref` 로 소속을 읽어 null, 상태 층 조회는 id (`<origin>--<state>`) 로 계속 찾아 ADR-230 복제본 경로 (관리 키만) 로 읽는다 — 그 상태가 분리 시점 원본 값으로 굳는다. `isSystemOwnedOrigin` 은 `reusable` 을 요구해 삭제 · 해제 보호가 풀리고, `ensureStateVariantOrigins` 는 같은 id 를 건너뛰며 이관 (`migrateVariantsToOriginInstances`) 도 `variantOf` 가 없어 잡지 않는다 — 영구. `canOperate("detach")` 가 system origin 을 거부 (삭제 · 해제와 같은 사유 `systemOwned`). system origin 안의 ref 자식 (Form field 등) 은 원본 편집 범위라 허용. 테스트 원복 RED 1 · live (`adr236-phase3-live.mjs` C · C2): 변형 행 메뉴에 `detach-instance` 없음 · store 직접 호출도 ref · reusable 유지 (토스트는 B 와 같은 messageKey 라 5분 쿨다운).

## 15. 종결 뒤 후속 — labelPosition 멤버십 (2026-09-25)

§10 멤버십 차이 (Meter · ProgressBar · Slider) 판정: 결함 — 집합에 넣는다. live (`apps/builder/scripts/labelposition-direction-live.mjs`, 대조군 TextField) 에서 결함이 둘 나왔다.

- **ref instance 판정 누락 (13 타입 전부)**: 팔레트는 Components 페이지 origin 의 instance (`type: "ref"`) 를 만든다. `handleFlexDirection` · `LayoutSection` 은 원 `element.type` 으로 판정해 instance 에서 늘 style 경로를 탔다. 패널 표시 (`useResolvedLayoutFields`) 는 origin 타입으로 판정해 TextField 는 Column 표시 · 캔버스 Row · Column 클릭 무반응이었다. 판정을 `resolveStyleSpecType` (패널 style 문맥과 같은 해석) 으로 바꿨다.
- **세 타입 멤버십**: style 경로로 쓴 인라인 `flexDirection` 을 implicitStyles side 분기가 덮어 (`display: flex` · `flexDirection: row` 가 parentStyle 뒤에 온다) side + Column 에서 Canvas row · DOM column (인라인이 `[data-label-position="side"]` 를 이긴다) 으로 갈렸다. `LABEL_POSITION_NOT_DRIVEN` 은 Form 만 남긴다. top 은 grid 라 `useFlexDirectionKeys` 가 display 로 판정해 비활성 block 을 보였다 — 그룹 축 컨테이너는 prop 값으로 표시한다.
- **남은 인라인 정리**: 위 두 경로로 이미 저장된 인라인 `flexDirection` · `display` (flex · block) 는 토글이 prop 과 같은 `updateSelectedProperties` 로 지운다.

근거: 단위 RED 7 → GREEN · live 4 타입 × 6 단계 (top 표시 · Row · Column · 옛 인라인 + side · 그 상태에서 Column · 깨끗한 side) — 수정 뒤 Row → side 한 줄 (label > track > value) · Column → top grid · 인라인 0 · block 비활성 · pageerror 0. 스위트 builder 7,649 통과 (jsdom 종료 시점 unhandled 3 은 `GenericFieldRenderer` · `pageStateHistoryRoundtrip` 단독 재실행 통과) · type-check 0.

남은 것 (범위 밖): 붙여넣기 · AI 가 라벨 위치 컨테이너에 인라인 `flexDirection` 을 쓰면 side 에서 Canvas (row 고정) 와 DOM (인라인) 이 여전히 갈린다. Alignment 토글은 grid 기본 (ProgressBar top) 에 `display: flex` 를 쓴다.


판독 (reviewer, 2026-09-25, `84a7a8d12`): HIGH 0 · MEDIUM 1 수리 → 닫힘. M1 — Direction 그룹에 `disallowEmptySelection` 이 없어 선택된 버튼 재클릭이 `undefined` 를 보낸다. style 경로에서는 무동작이었지만 prop 번역은 column 외를 side · horizontal 로 흡수해 top 이 side 로 뒤집혔다 (이 커밋으로 팔레트 instance 전부가 이 경로에 들어왔다). `handleFlexDirection` 이 block · row · column 외 값을 거른다 — 단위 RED 1 → GREEN · live C2 (Column 재클릭 → 4 타입 모두 top 유지). LOW deferred: instance 안 synthetic 자식 (`<instance>/<path>`) 은 여전히 style 경로 (커밋 전과 같음) · 비-desktop tier override 의 옛 `responsive.styles` 방향은 정리 대상 아님 · 인라인이 방향 두 키뿐이면 빈 `style` override 가 남음 (렌더 무영향) · vertical Slider + side 미확인 · DOM leg 는 CSS 특이도 추론.

## 16. 종결 뒤 후속 — 병렬 조사 4건 (2026-09-25)

§15 의 남은 항목 · AI `CONTAINER_TYPES` 를 조사 에이전트 4개로 동시에 판정했다.

| 항목 | 판정 | 처리 |
| --- | --- | --- |
| AI `CONTAINER_TYPES` | 결함 아님 — Tier 2 제목 `, container` 표기 전용. 부모 허용은 도구가 `resolveMoveTarget` 으로 판정하고 이 집합을 읽지 않는다. structural 에서 파생하면 Nav · Slot 이 빠지고 Card 계열이 붙어 계획 힌트만 바뀐다 | 사유를 `componentCatalog.ts` 주석에 기록 (동작 변경 0) |
| instance 안 자식 (synthetic) 의 Styles 패널 | 결함 — `useElementStyleContext` · Direction 판정이 `map.get(id)` 만 써서 synthetic 에서 조용히 undefined (ADR-229 F15 fallback 이 Properties 에만 들어갔다). 표시는 기본값, 쓰기는 descendants | `readStyleTargetNode` (map → `readSyntheticPanelNode`) 를 세 곳이 공유. 옛 인라인은 descendants 병합이 키 삭제를 잇지 못해 `null` 표식으로 지운다 |
| Alignment · Space · Wrap 이 grid 를 flex 로 | 결함 — 아래 |
| side 에서 Canvas 가 인라인 방향을 덮음 | 결함 — 아래 |

synthetic 근거: 단위 RED 3 → GREEN · live (`labelposition-direction-live.mjs` G — 팔레트 Form 의 `<form>/TextField/Name`): 패널 Column 표시 (종전 block) · Row → `descendants[path].labelPosition = "side"` · Input x 0 → 180 · 옛 patch 인라인 + Column → `style: { display: null, flexDirection: null }` · 다시 세로.

grid 정렬 근거: 세 핸들러 (`handleFlexAlignment` · Space · Wrap) 가 `display: flex` 를 무조건 썼고 패널은 선택 표시만 비웠다. catalog grid 기본은 Meter · ProgressBar · Slider (구조 3칸) 와 leaf 6 (Track · Value · ProgressCircle) — 레이아웃 프리셋의 인라인 grid (body · Slot) 도 같은 경로. `useLayoutAlignmentDisabled` (해석 display grid 또는 catalog 기본 grid) 로 세 그룹 비활성. 라벨 위치 · orientation 컨테이너는 세 핸들러가 display · flexDirection 을 빼고, Alignment 축은 Direction 표시값 (prop 해석) 으로 매핑. 단위 RED 3 → GREEN · live H: 세 타입 점 비활성 · grid 유지 / TextField 점 클릭 → `justifyContent` · `alignItems` 만, 세로 유지. 기각: grid 3×3 → `justifyItems` · `alignItems` 매핑 (ProgressBar DOM `.bar` 가 다시 폭 0) — 사용자 grid 프리셋 한정 후속.

side 인라인 근거: 인라인 display · flexDirection 이 이기는 쪽이 consumer 마다 달랐다 — DOM 은 17 타입 전부 인라인 (root `style` > `[data-label-position="side"]`), Canvas 는 13 타입이 side 에서 variant 로 덮고 (`getSideLabelParentStyle` 의 strip · ProgressBar/Meter/Slider side 객체) 4 타입 (CheckboxGroup · RadioGroup · TagGroup · ColorField) 은 인라인. top 은 양쪽 인라인. strip 의 전제 ("Inspector 가 side 전환 시 인라인을 지우는 경로가 정본") 는 코드에 없었고, 옛 factory 잔재는 hydration `migrateFieldInlineLayout` (field 가족 7) 이 이미 지운다 → Canvas 도 인라인 우선으로 맞췄다 (수정안 a). 입력 경로 차단 (b) 은 경로 누락 시 재발 · 저장분 미해결, DOM 무시 (c) 는 사용자 D3 값 폐기라 기각. 단위 RED 4 (NumberField · ProgressBar · Meter · Slider, 옛 strip 가드 테스트는 반대 기대로 교체) → GREEN · live D (side + 인라인 flex column): 종전 Canvas row → 세로 (y 0 · 24 · 36, DOM 과 같은 center) · 인라인 없는 side 는 그대로 한 줄.

남은 것 (LOW): ColorField 는 catalog base 가 flex-row 라 top 도 row 인데 Direction 은 top → column 으로 표시한다 · 정렬 토글의 grid 3×3 → `justifyItems` 매핑은 사용자 grid 프리셋 한정 후속 · 핸들러가 `inline-flex` 를 `flex` 로 바꿔 쓴다 (현 catalog 에 inline-flex 없음) · AI instance 루트 자식 추가 시 Preview 가 origin 자식을 대체할 가능성 (가설, 미확인).

판독 (reviewer 2, 2026-09-25): 패널 (`dca8b9265` · `3b281b211`) HIGH 0 · MEDIUM 1 수리 — synthetic 표시가 해석 노드를 읽게 되자 Fill 액션의 현재 값 (`getCurrentFills`, canonical 맵만) 이 빈 목록이라 토글 · 추가 · 타입 변경이 fills 를 지웠다 → 해석 노드 (`getSyntheticDescendantLookup`) 를 같이 읽는다. 단위 RED 1 · live I (Form 안 TextField 에 Add fill 2회 → 1 · 2 개). LOW deferred: synthetic reset 버튼 무동작 (종전부터) · `updateSelectedFills` 가 해석 style 을 patch 에 굳힘 (종전부터) · 옛 인라인 방향이 남은 요소의 Alignment 축 (가설) · 세 grid 타입은 side 에서도 정렬 비활성 (의도).

판독 (reviewer 2, 2026-09-25): Canvas side 인라인 (`488ff31e8`) HIGH 0 · MEDIUM 2 수리. M1 — side 에서 래퍼 (SelectTrigger) width 100% 를 빼는 것은 부모 row 전제인데 인라인 column 이 이기면 래퍼가 내용 폭으로 줄었다 (DOM 래퍼는 width 100%) → `isSideRowLayout` (side ∧ 인라인이 flex row) 일 때만 뺀다. M2 — "옛 잔재는 migration 이 지운다" 가 대상 밖 타입에서 거짓: DateField/TimeField (`35347982a`) · DatePicker/DateRangePicker (`4f557528e`) 의 flex column, ProgressBar/Meter (`68c567dd0`) · Slider (`c85d4dc25`) 의 grid + template 이 옛 factory 인라인이었다 (git 이력 확인) → `migrateFieldInlineLayout` 이 **factory 형태일 때만** 지운다. 단위 RED 3 + 7 → GREEN · live J (DatePicker side + 인라인 column: 래퍼 폭 1920 = 전폭, 인라인 없으면 x 180 · 폭 1740). migration 은 plain 노드 대상이라 live 는 생략 (팔레트 요소는 instance 이고 새 factory 는 잔재를 쓰지 않는다). 스위트 builder 7,671 · type-check 0. LOW deferred: side + 인라인 block 에서 자식 재정렬 (입력원 없음) · column 에서 FieldError marginLeft (종전부터) · 새 테스트가 column 자식 주입 일부만 검사.


## 17. LOW 후속 병렬 조사 (2026-09-25)

§15 · §16 의 LOW deferred 를 병렬 조사 6건으로 다시 판정했다 (가설 1 + 반증 1). production 재현이 나온 항목은 수리하고, 나머지는 판정 근거와 함께 남긴다.

- **synthetic 자식 스타일 쓰기 (재현 있음 → 수리)** — store style 쓰기 3종 (`updateSelectedStyle` · `updateSelectedStyles` · `updateSelectedFills`) 이 해석 style 전체를 `descendants[path]` 에 병합했다. 원본 값이 patch 로 굳고 (이후 원본 편집 미반영), 병합이라 키 지우기도 반영되지 않았다. reset 은 그 앞에서 canonical 맵 lookup 이 null 이라 조기 return 했다. → 바뀐 키만 쓰고 빠진 키는 `undefined` 로 patch 에서 지운다 (`toWrittenStyle` · `dropUndefinedPatchKeys`, 원본 복귀). mode C 채운 노드는 그 노드 자체라 삭제. reset 은 해석 노드를 읽고, Fill 초기화는 `updateSelectedFills(null)` 로 patch fills 를 지운다. 단위 RED 5 (store 4 · reset hook 1) · live (`scripts/synthetic-style-write-live.mjs`: Form 안 TextField — Fill 추가 뒤 patch `{fills}` 만 · Fill reset `{}` · paddingTop 24 → patch `{style:{paddingTop:24}}` 높이 80 · Spacing reset → 높이 56). 남는 것: 원본에 값이 있는 키는 reset 뒤에도 dirty (dirty baseline 이 catalog 기준) · fills 외 prop 의 `undefined` 는 종전 의미 유지.
- **Direction · Alignment 표시 축 (재현 있음 → 수리)** — 패널이 라벨 위치를 고정 규칙 (top=column · side=row) 으로 방향에 옮겨, (1) catalog base 가 row 인 ColorField 의 top 을 Column 으로 표시했고 (두 렌더는 row), (2) 스타일 붙여넣기로 인라인 방향이 들어온 라벨 위치 요소에서 정렬 점 축이 뒤바뀌었다 (두 렌더는 인라인을 따른다 — `488ff31e8`). 고정 규칙과 catalog 가 어긋나는 driven 타입은 ColorField 하나 (전수 대조). → `useResolvedLayoutFields` 가 렌더 축을 쓴다: 라벨 위치 컨테이너는 인라인 방향 → catalog base + 변형의 flex 방향 → 고정 규칙 (grid 인 ProgressBar · Meter · Slider top) 순. orientation 컨테이너는 Canvas 가 prop 으로 덮으므로 인라인을 보지 않는다. 단위 RED 2 · live (`scripts/layout-panel-followups-live.mjs` A · B: ColorField top/side 모두 Row · TextField top + 인라인 row 에서 "Top right" → `justifyContent: flex-end` · `alignItems: flex-start`). 남는 것: ColorField 에서 Column 을 눌러도 라벨 위 (row) 라 표시가 바뀌지 않는다 — ColorField 를 세로 배치로 바꾸는 것은 2026-06-23 결정 (factory row 정본) 을 뒤집는 일이라 사용자 판정 대상. **새 발견 (LOW, 미수리)**: Canvas 는 ColorField side 변형 (`align-items: flex-start`) 을 적용하지 않아 Label 이 세로 가운데 (y 5) 에 놓인다. DOM 규칙은 flex-start 이지만 DOM 쪽은 실측하지 않았다 — `implicitStyles` 에 colorfield 분기가 없고 공용 catalog 경로 (`resolveContainerStylesFallback`) 는 props 를 받지 않아 변형을 못 본다.
- **`inline-flex` → `flex` (재현 있음 → 수리)** — §15 LOW 기록의 "현 catalog 에 inline-flex 없음" 은 틀렸다: Button `containerStyles.display: "inline-flex"` (ADR-923 Phase 5) 외 Badge · Breadcrumb 등이 inline-flex 다. block 부모 안 Button 2 개에서 정렬 점을 누르면 `display: flex` 가 써져 그 Button 만 다음 줄로 떨어졌다. → 정렬 · Direction row/column · Space · Wrap 이 해석 display (인라인 → catalog + 변형) 가 inline-flex 면 display 를 쓰지 않는다. 단위 RED 2 · live C (block frame 안 Button 2 개, "Top left" → style 에 display 없음 · 두 Button y 0 · x 0 / 69 유지).
- **비-desktop tier 방향 (재현 있음 → 수리)** — LOW 기록의 "옛 잔재" 경로는 없었다 (tier flexDirection 을 만드는 곳은 Responsive 「+」 메뉴 `setResponsiveStyleOverrideEnabled` 하나, 프리셋 · agent 는 쓰지 않는다). 대신 사용자가 켜는 순간 재현된다: seed 가 `props.style` 만 읽어 driven 요소 (방향 = prop) 는 기본값 row 가 들어가 라벨이 옆으로 갔고, 이후 Direction 토글은 tier 축 없는 prop 을 바꿔 desktop 만 바뀌었다. → driven 요소의 메뉴에서 Direction 을 뺀다 (방향 정본이 prop 인 타입에 tier flexDirection 축을 열지 않는다). 이미 있는 tier 값은 override 행에서 지운다. store 쪽 가드는 두지 않았다 (`resolveStyleSpecType` 이 패널 hook 모듈이라 store 가 import 하면 순환 — 생성 경로는 메뉴 하나). 단위 RED 2 · live D (tablet: TextField 메뉴에 Direction 없음 · frame 은 있음). 관련 가설 (미확인): catalog base 가 column 이고 인라인이 없는 non-driven 타입도 seed 가 row 라 켜는 순간 바뀔 수 있다.
- **Canvas side 보조 주입 (재현 있음 → 수리)** — `488ff31e8` 로 인라인이 side 변형을 이기게 한 뒤에도 side 전제 주입 두 개가 결과 레이아웃을 보지 않았다: (1) ProgressBar · Meter · Slider 자식 재정렬 (label → track → value) 은 DOM `order` 가 block 에서 무효라 인라인 block 이면 순서가 갈렸다, (2) FieldError · Description 의 라벨 폭 들여쓰기 (`marginLeft` 192) 는 row 줄바꿈 전제인데 인라인 column 에서도 붙었다 (DOM 에는 margin 규칙이 없다). 입력원은 스타일 붙여넣기 · AI `update_element` (Direction 의 block 은 driven 에서 비활성). → 재정렬은 flex · grid 일 때만 (`sideReorderApplies`), 들여쓰기는 `isSideRowLayout` 일 때만. 단위 RED 2 · live E (Slider side + block: Label y 0 · 값 y 20 · 막대 y 40 source 순서 · TextField side + column: FieldError x 0 · side row 는 x 192 유지). vertical Slider + side 는 side 고유 발산 없음 — orientation 은 D2 accepts 밖 prop 인데 DOM 렌더러만 RAC 로 넘긴다 (AI 경로 도달 가능성, 미확인, LOW). **새 발견 (LOW, 미수리 · 미확인)**: (a) 인라인 없는 side row 에서 Canvas 는 FieldError 를 wrap 해 다음 줄 x 192 에 두는데, DOM side 규칙에는 wrap · margin 이 없어 FieldError 가 Input 옆 세 번째 flex item 일 수 있다 — Preview 실측 필요 (지금은 Preview 금지) · (b) Slider side + 인라인 block 에서 Canvas Label 이 한 줄을 차지한다 (DOM Label 은 inline-flex 라 값과 한 줄일 수 있다).
- **LOW 유지 (재현 없음)** — 방향 토글 뒤 빈 `style: {}` override (ref style 은 깊은 병합 · dirty · 복사 판정은 키 존재 기준이라 영향 없음) · grid 3×3 → `justifyItems` (결과가 틀리는 게 아니라 기능이 없음; 구현하면 프리셋 grid 의 slot 이 내용 폭으로 줄 위험) · 세 grid 타입이 side 에서도 정렬 비활성 (의도).
- **instance 루트 자식 추가 (가설 → Publish 한정 재현, 보류)** — Canvas (`resolveCanonicalRefTree`) · Preview (`resolveCanonicalDocument`) 는 `[origin 자식, instance 자기 자식]` 으로 합친다. Publish 만 `export.utils.ts` `resolveRenderableNode` 가 `children: node.children ?? master.children` 이라 자기 자식이 하나라도 있으면 origin 자식을 버린다 (tsx 로 `deriveProjectRenderModelFromDocument` 실행해 재현). publish 는 빌더 안정화 뒤 착수 대상이라 수리하지 않는다. 수리안: mode C 대체 (`descendants[path].children`) 가 아니면 `[...master.children, ...node.children]`.

판독 (reviewer 2, 2026-09-26): synthetic 쓰기 (`c0a85e8d2`) HIGH 1 · MEDIUM 1, 패널 · Canvas (`e87d35764` · `ec6ed0a39` · `805db0d1b` · `0c073606f`) HIGH 0 · MEDIUM 1. 수리 `fix(styles-panel): 판독 수리 …`. H1 — `updateAndSave` 가 `fills: null` 을 `undefined` 로 바꿔 mode C 채운 노드 (Slot "+" 항목 · 영역 채움) 의 `patchFillNode` null 삭제 분기가 죽었다 (Fill 초기화 무동작, 커밋 전에는 `[]`) → null 을 그대로 넘기고 mode A 는 `dropUndefinedPatchKeys` 가 null · undefined fills 를 뺀다. M2 — origin 에만 있는 키의 reset 은 patch 가 그대로인데 root 쓰기 · history · 재레이아웃이 매번 실행됐다 → 결과 patch 가 현재와 같으면 쓰지 않는다. M3 — `selectedFlexDisplayPatch` 가 자기 `props.style` 만 읽어 ref instance 의 origin 인라인 inline-flex · tablet tier 값을 못 봤다 → 패널 표시와 같은 해석 (`readResolvedStyleTarget` — origin 깔기 + tier 별 activeBreakpoint) 을 읽는다. 단위 RED 3 (store 2 · action 1, M3 는 원복 RED) · live 회귀 (`synthetic-style-write-live`: reset 뒤 patch 경로째 삭제). LOW deferred: border 축 접기에서 origin longhand 가 남음 (종전부터) · synthetic 비-desktop override 편집이 버려짐 (종전부터) · FillSection reset 이 store 맵을 먼저 읽음 (프리뷰 잔재 가설) · mode C ref 안쪽 경로의 `undefined` 는 복귀 아닌 비우기 · ColorField 는 Direction 으로 top ↔ side 를 못 오간다 (축이 같아 align 만 다름, Properties 로 가능) · driven 요소에 인라인 non-flex display 를 붙여넣으면 고정 규칙 축 표시 (종전과 같음).
