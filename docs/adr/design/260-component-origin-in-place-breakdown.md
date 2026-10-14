# ADR-260 design breakdown — 원본이 page 에 남는 컴포넌트

> 본문: [../260-component-origin-in-place.md](../260-component-origin-in-place.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 는 로컬 전용이라 실측 결론은 여기에 둔다.

## 0. 전제 lock-in (fork 4 질문 — 분리가 아니라 ADR-248 판정 ② 의 개정)

1. base / 응용: 이 ADR 은 ADR-248 문서 모델 (base) 의 **소유 edge 한 종류** 를 바꾸는 응용이다. ADR-248 은 Implemented 라 fork 가 아니라 후속 ADR 이다.
2. schema: `DefinitionEntry.originOnPage?: true` (선택 필드) 하나 추가. 옛 문서는 필드가 없어 소유 모양 그대로 — 직교.
3. 선행 전제 reverse 검증: 2026-09-30 판정 ② 「그 자리 origin 불가」 의 근거는 「정의의 template 소유와 동시 소유」 였다. 그 근거는 소유 edge 가 하나뿐일 때만 성립한다 — 참조 edge 를 두면 소멸. 사용자 confirm = 2026-10-14 「선택 노드가 ORIGIN 으로」 + 「ADR 먼저 작성」.
4. 판독: Codex 1차는 Phase 0 inventory 뒤 (사용자 요청 시 `/review-adr 260`).

## 1. Phase 0 — inventory · oracle (G0)

- `templateRootId` 를 읽는 34 파일 (2026-10-14 grep, 테스트 제외) 과 `kind === "definition"` 판정 53 파일을 세 묶음으로 분류한다: **(a)** id 로 template 을 읽는다 (resolver · positions · address · fieldSource · materialize · itemInsert · rowTemplate · slots · textBinding — 바뀌지 않는다) · **(b)** 소유 사슬로 정의를 만난다 (`graph.ts` 소유 검증 · 재검증 트리거 `:600-608` · `transaction.ts` `ownedChildIds` · `clone.ts` · `structure.ts` `topLevel` · `locate` · `removeWithReferrers` · `compositionRoot` 영향 root · `componentConfirm` · `workspace.ts` `ownerOfRecord`) · **(c)** 정의 편집 view 를 전제한다 (`compositionRoot.ts` `pageRoots` · `workspace.showDefinition` · `CatalogComponentsPanel` · `CatalogDefinitionsSection` · `CatalogDefinitionBar` · `layerTree.ts` · `componentActions.ts` · `canvasMenu.ts` · `shortcuts.ts` · `actionBar.ts`).
- 문서 수: 저장소 fixture (`document/fixture.ts` · `__tests__`) 와 로컬 프로젝트 (IndexedDB) 의 `project:definition:` 컴포넌트 · layout 수.
- oracle 대조표 (pen.dev docs · Figma help, 2026-10-14 조회 — 본문 Context): 만들기 (둘 다 그 자리) · 편집 전파 (둘 다 흐름, override 유지) · detach (instance 하나) · 해체 (pen.dev ⌘⌥K 토글 / Figma 없음 — undo 또는 instance 떼고 원본 삭제) · 원본 삭제 (Figma instance 유지 + Restore / pen.dev 미문서) · 복제 (pen.dev instance / Figma 새 컴포넌트) · 이동 (둘 다 자유) · 중첩 (둘 다 지원).
- 사용자 결정 5건 모두 2026-10-14 답 (본문 Status). oracle 표에 Figma 「Restore main component」 의 실제 자리 (instance 옆 — 문서 미명시) 를 실물로 확인해 적는다 — 다르면 1회 보고.

## 2. Phase 1 — 문서 모델 (G1)

| 파일                                                | 변경                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/catalog/document/types.ts`     | `DefinitionEntry.originOnPage?: boolean` — `true` 참조 원본 · `false` 참조였다가 원본이 삭제된 숨은 template (Restore 대상) · 없음 = 옛 문서 · layout 의 소유 template (Restore 없음, R7). 자리 기억 필드 없음 (결정 4)                                                                                                                                                                                             |
| `document/validation.ts`                            | 필드 허용 (`exact`) · `originOnPage` 는 `usage !== "layout"` · `templateRootId` 필수                                                                                                                                                                                                                              |
| `document/graph.ts`                                 | `ownedChildren(definition)` — `originOnPage` 면 `[]`; `referencedIds(definition)` 에 `templateRootId`; 역색인 `definitionOfTemplateRoot(nodeId)`; 소유 검증에 「`originOnPage` 정의의 루트는 소유 사슬 top 이 page」 추가; 재검증 트리거 (`:600-608`) 를 소유자 대신 역색인으로; `DEFINITION_CYCLE` 걷기는 그대로 |
| `document/clone.ts` · `transactions/transaction.ts` | `ownedChildIds` · 복제가 참조 edge 를 소유로 취급하지 않는지 확인 (변경 0 예상 — 테스트로 고정)                                                                                                                                                                                                                   |
| `document/fixture.ts` · `__tests__`                 | 두 모양 fixture (소유 template · 참조 원본) · 무작위 명령 하니스 (ADR-248 4b G2 형식) 에 Create · 해체 · 원본 삭제 · 복제 · 이동 · 자기 instance 넣기 추가                                                                                                                                                        |

- RED: `ownedChildren` 분기 원복 → `DUPLICATE_OWNERSHIP`; 역색인 원복 → 원본 편집 뒤 instance 재검증 누락.

## 3. Phase 2 — 명령 (G2)

| 파일                                        | 변경                                                                                                                                                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands/components.ts` `createComponent`  | 노드 무이동 — 정의 (`originOnPage: true`) 만 생성, `selectAfter: [node.id]`. 거부: 노드가 page 사슬 밖 (정의 view 의 template 안) · 노드 안에 자기 instance (순환 — 생성 시점엔 불가)                                  |
| `dissolveComponent`                         | instance 전부 detach → 정의 삭제 → **원본 노드 유지** (참조 모양) / 소유 모양은 지금대로 template 삭제                                                                                                                 |
| `commands/structure.ts` `removeTargets`     | 지우는 서브트리에 `originOnPage` 원본이 있으면 (결정 1) 정의가 `originOnPage` 를 벗고 서브트리를 소유 — 한 step 안에서 소유 이전 · `originOnPage: false` · `project.definitionIds` 유지 |
| 새 명령 `restoreOrigin`                     | 숨은 template (`originOnPage: false`) 을 page 로 — 정의가 소유를 놓고 `originOnPage: true` 복귀, 자리 = 요청한 instance 의 같은 부모 · 다음 index (절대 배치면 `COPY_OFFSET`) — 결정 4 Figma 방식                                                                                                             |
| `commands/structure.ts` 복제 · `pasteNodes` | (결정 2) `document/clone.ts` `cloneNodeSubgraph` 가 `originOnPage` 루트를 만나면 instance 노드 하나로 — `duplicateNodes` · `pasteNodes` 공통. 정의가 없는 대상 (다른 프로젝트) 은 보통 사본                                                                                                                                                               |
| `commands/project.ts`                       | page 삭제 시 안의 원본 → `removeTargets` 와 같은 길. layout 명령 무변경                                                                                                                                                |
| `runtime/compositionRoot.ts`                | 영향 root 산정 — 원본 서브트리 편집 → 역색인으로 instance 가 있는 root 를 더한다 (소유 사슬로 정의를 찾던 분기와 나란히)                                                                                               |

- RED: 역색인 분기 원복 → 원본 prop 편집 뒤 instance resolved 불변 (phase4e 류 unit) · 해체 원복 → 원본 삭제됨.

## 4. Phase 3 — Builder (G3)

| 파일                                                                           | 변경                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalogRuntime/componentActions.ts`                                           | `catalogComponentRole` / `State`: 역색인으로 page 위 원본 = ORIGIN (정의 view 무관). `originOf.instanceIds` 그대로. 숨은 template 의 instance 에 `restorable` |
| `panels/properties/catalog/CatalogComponentSection.tsx`                        | ORIGIN 칩 (page 위) · Restore origin 버튼 (restorable 일 때) · Go to component = `showDefinition` 대신 page 이동 + 선택 (참조 모양)                           |
| `catalogRuntime/workspace.ts` `showDefinition`                                 | 참조 모양 정의 → page 열기 + 원본 선택 + reveal (library 원본 분기와 같은 길); 소유 모양 → 지금 view                                                          |
| `catalogRuntime/componentConfirm.ts`                                           | 「원본 서브트리 안의 편집」 판정 (역색인) 으로 impact 대화상자                                                                                                |
| `catalogRuntime/canvasMenu.ts` · `shortcuts.ts` · `actionBar.ts`               | ⌘⌥K: 보통 노드 → Create, page 위 원본 → Detach component (해체) — pen.dev 토글. instance → Create (2026-10-14 반영 유지)                                      |
| `panels/navigator/catalog/CatalogDefinitionsSection.tsx`                       | 사용자 컴포넌트 클릭 = page 의 원본으로 이동 + 선택 (결정 3) — 숨은 template (삭제된 원본) 은 정의 view                                                                                                                          |
| `panels/components/CatalogComponentsPanel.tsx` · `catalogRuntime/layerTree.ts` | 정의 view 전제 분기는 소유 모양에만. Layers 의 원본 행 점 = ORIGIN                                                                                            |
| live `apps/builder/scripts/adr260-origin-in-place-live.mjs`                    | G3 시나리오 (Button · ToggleButtonGroup · Card) — 새로고침 · undo 포함                                                                                        |

## 5. Phase 4 — 마감 (G4 · G5)

- ratchet · 번들 · 스위트 전체. CHANGELOG · `.claude/rules/state-management.md` (정의의 두 모양 · 역색인 · 삭제 시 소유 이전) · 메모리 갱신 · ADR-248 breakdown 판정 ② 에 「2026-10-14 ADR-260 으로 개정」 한 줄.
- Implemented 승격 = 사용자 확인 (G5).

## 6. 기록

- 2026-10-14 사용자 결정 1 ~ 5 답 (삭제 = Figma instance 유지 + Restore · 복제 = pen.dev instance · 탭 클릭 = page 원본 · Restore 자리 = Figma instance 옆 · 중첩 원본 = pen.dev 허용 · 자기 ORIGIN).
- 2026-10-14 Proposed. 같은 날 선행 반영 (커밋 전): 해체 버튼은 원본에서만 (패널 · Canvas 메뉴 · ⌘⌥K) — `phase4e8Chrome` · `phase4eCanvasMenu` · `phase4eShortcuts` 갱신, live `create-component-live.mjs`.
