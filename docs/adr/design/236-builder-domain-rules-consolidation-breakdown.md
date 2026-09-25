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
