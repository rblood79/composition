# ADR-282 design breakdown — Library page 원본 잠금 해제 (fork) · 리셋

> 본문: [../282-library-origin-unlock-fork-and-reset.md](../282-library-origin-unlock-fork-and-reset.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 는 로컬 전용이라 실측 결론은 여기에 둔다.

## 0. 전제 lock-in (분리 아님 — ADR-279 모양의 적용)

1. **base / 응용**: [ADR-248](../completed/248-unified-catalog-document.md) (정의가 template 을 소유) → [ADR-279](../279-component-origin-on-local-page.md) (프로젝트 컴포넌트 = 소유 template, Local page 가 그린다) 가 base. 이 ADR 은 그 모양을 **기본 원본의 override** 에 적용하는 응용 — 의존 방향 248 → 279 → 282. [ADR-253](../completed/253-base-ui-origin-reuse.md) 의 「override 가 instance 루트에 닿는다」 는 그대로 쓴다.
2. **schema**: `DefinitionOverrideEntry` 에 `templateRootId?: NodeId` · `templateMap?: Record<LibraryTemplateId, NodeId>` 두 필드 추가 (둘은 같이 있거나 같이 없다). `LIBRARY_CONTRACT_VERSION` 47 → 48, 변환 0. 해제 때 override `visual` 은 사본 루트 visual 로 흡수해 비우고, `defaults` · `stateRules` 는 그대로 (본문 결정 1 — composite `accepts` namespace).
3. **선행 전제 reverse 검증**: ADR-279 가 소유 template 을 택한 사유 (참조 모양의 결함 · Local page 편집) 는 라이브러리 원본 사본에도 같다 — 사본은 소유 노드라 279 Phase 0 probe (편집 7 조작 통과) 가 그대로 적용된다. 2026-10-14 · 10-05 의 「루트만」 확인은 사용자가 2026-10-24 뒤집었다 (본문 Status).
4. **판독**: 사용자가 요청할 때 `/review-adr 282`.

## 1. Phase 0 — inventory · probe · RED (G0)

### 1a. `library.templates.get` 호출 23 파일 분류 (2026-10-24 grep, 분류는 Phase 0 에서 채운다)

| 파일                                                                                                                                                                                                                                          | 정의 경유 (`definition.templateRootId`) | `lib:template:` 직접 (patch · slotFill · path) | 처리 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------: | :--------------------------------------------: | ---- |
| shared: `runtime/compositionRoot.ts` · `document/graph.ts` · `document/s2PropAlignment.ts` · `resolution/{templateOwners,fieldSource,address,positions,resolver}.ts` · `commands/{project,structure,context,materialize,collections,swap}.ts` |                    ?                    |                       ?                        |      |
| builder: `catalogRuntime/{rowTemplate,insertParent,componentsPage,layerTree,textBinding,slots,itemInsert,dataBindingCommand}.ts` · `panels/properties/catalog/CatalogComponentSection.tsx`                                                    |                    ?                    |                       ?                        |      |

- 정의 경유 자리: `graph.getDefinition` 이 사본 루트를 돌려주면 `templateTypeName` (`resolver.ts:580-595`) 처럼 `startsWith("lib:")` 분기만 더한다.
- 직접 자리: 문서의 저장 주소 (instance `descendantOverrides` · interaction 소유 주소 · `showWhen` · 상태 변수 소유자 · 정의 `properties` target) 는 해제 transaction 에서 `templateMap` 으로 segment 를 바꾼다 (본문 결정 9 — `cloneNodeSubgraph` 의 map 은 복사한 서브그래프 안만 바꾸므로 외부 instance 주소를 보장하지 않는다, 리뷰 h1). 코드 라이브러리 template 노드 안의 `descendantPatches.templatePath` · `slotFills.childIds` (다른 원본이 이 원본의 id 를 드는 자리) 는 고칠 수 없어 resolver · `address.ts` 가 `templateMap` 으로 번역한다. 이 원본 자신의 lib 노드에 있던 `descendantPatches` · `slotFills` 는 기호 복사 때 사본 노드의 `descendantOverrides` 로 옮긴다.
- resolver 의 `startsWith("lib:")` 4 곳 (`:567 · :582 · :594 · :1650`) 은 전부 「정의 → templateRootId → template 조회」 라 분기 대상.

### 1b. probe · RED 6

fixture: 새 프로젝트 + page 에 Button instance 2 + Select instance 1 (안에 Button 부품).

1. **RED-1 (지금 동작 기록)**: `COMPONENTS_VIEW` 의 Button ◆ 에 `insertNodes` (Icon) → `CatalogOriginEditError`. 해제 뒤 같은 명령 → 성공 · instance 2 + Select 의 Button 에 Icon 자식 (record) 이 보임.
2. **RED-2**: 해제한 Select 사본에서 trigger Button 삭제 → `REQUIRED_PART_NOT_REMOVABLE` (R2 — 기존 guard 가 소유 노드에 걸리는지).
3. **RED-3**: override `templateRootId` 가 없는 노드 · lib id · 다른 정의의 루트를 가리키면 검증기 거부 (`DANGLING_DEFINITION` 류 새 코드 `INVALID_ORIGIN_TEMPLATE_ROOT`).
4. **RED-4 (리뷰 h1 반례)**: Button instance 의 Text 자식에 `patch` 「Customized」 + Select instance 안 Button 글자 patch (중첩 경로) + interaction 하나 → 루트 조회만 사본으로 바꾸면 「Customized」 → 「Save」 · 주소 검증 `TEMPLATE_ROOT_MISMATCH`. 결정 9 뒤 같은 fixture 가 값 · 검증 · 저장/로드 모두 유지.
5. **RED-5 (리뷰 h2 반례)**: instance 둘 `label` 「Save」 · 「Cancel」 + override `defaults.label` 「Send」 → (a) native 사본 루트에 `label` 흡수 = `PROP_NOT_ACCEPTED` · (b) detach 결과 재사용 = 「Save」 · 「Save」. 결정 1 · 8 뒤 두 instance 값 그대로.
6. **RED-6 (리뷰 h3 반례 — 프로젝트 컴포넌트 경로는 `f8561e0d9` 로 선행 수리 · 회귀 테스트 `adr279OriginOnLocalPage.test.ts`)**: 소유 template 자리에 `fillSlot` 을 둔 instance + 그 자리 삭제를 `removeWithReferrers` 로 → `UNOWNED_NODE`. 같은 반례를 **프로젝트 컴포넌트** (ADR-279 Local page) 의 slot 노드 삭제로도 돌린다 — 지금 production 에서 재현되면 이 ADR 과 별개로 먼저 수리 대상 (Phase 1 의 같은 helper 수리로 닫는다).

리뷰 Round 1 의 실행 probe (`.agent/runs/2026-10-24-review-adr282/probe.ts` — 로컬 전용) 가 RED-4 · 5 · 6 의 반례 입력이다. Phase 0 은 그 입력을 저장소 테스트로 옮긴다.

### 1c. 영향 instance 수 (G3 live 의 N 확인용)

- 사용자 CMS 22 페이지 프로젝트에서 Button · Label 원본의 instance 수 (`graph.instancesOf` + 부품 자리) 를 적는다 — 해제 확인 대화상자의 N 과 같아야 한다.

## 2. Phase 1 — 모델 · 명령 (G1 · G2)

| 변경                                                                                                                                                                                                                                                                                                                                                                                                                           | 파일                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `DefinitionOverrideEntry.templateRootId?` · `templateMap?` · contract 48                                                                                                                                                                                                                                                                                                                                                       | `packages/shared/src/catalog/document/types.ts`                                                                              |
| 검증: 루트가 소유 노드 · `ownerOf(root)` = override · `templateMap` 값이 사본 서브트리 노드 · 두 필드 같이 있음 · 사본 노드 prop 의 `{key}` 바인딩은 해제된 원본 `accepts` 의 key (`library.ts:292 · 347 · 408` 규칙) · 옛 contract 거부                                                                                                                                                                                       | `document/validation.ts` · `document/graph.ts` (노드 prop 검증 `:1221 · 1260`)                                               |
| `getDefinition(libId)` 가 해제 override 의 루트로 바꾼 정의 · `ownerOf` · `definitionOfTemplateRoot` 가 override 도                                                                                                                                                                                                                                                                                                            | `document/graph.ts` (`overrideTarget` 역색인 재사용)                                                                         |
| `unlockOrigin({ definitionId, newId })` — 기호 복사 (lib template → 소유 노드, 바인딩 문자열 유지 · 이 원본 lib 노드의 `descendantPatches` · `slotFills` → 사본 `descendantOverrides` · 다른 해제 원본 id 는 그 `templateMap` 으로) + override `templateRootId` · `templateMap` + 문서 저장 주소 재작성 + override `visual` 흡수. detach (`materialize.ts:382-396 · 1089-1095`) · `cloneNodeSubgraph` 는 쓰지 않는다 (리뷰 h2) | `commands/components.ts` (옆에 `setLibraryDefault`) · 주소 재작성은 `rewriteAddressesThroughExtracted` 의 holder 걷기 재사용 |
| `resetOrigin({ definitionId })` — 역표 주소 재작성 (기본 자리 내용 유지) → 새 자리 override + `fillSlot.childIds` · `replace` 서브트리 + 딸린 interaction · 상태 변수 삭제 → 사본 서브트리 삭제 → **override entry 전체 삭제** (`defaults` · `stateRules` 포함 · `overrideIds` 정리 — 리뷰 h4) · `resetOrigins()` = override 가 있는 원본 전부 (해제 여부 무관)                                                                | `commands/components.ts` · `commands/structure.ts` (`removeWithReferrers` `:1120-1144` 에 `fillSlot` 분기 — 리뷰 h3)         |
| `lib:` 분기 — 정의 경유 자리에 `project:node:` 루트 허용                                                                                                                                                                                                                                                                                                                                                                       | §1a 표의 「정의 경유」 파일                                                                                                  |
| 사본 루트 삭제 · 카드 밖 drop 거부                                                                                                                                                                                                                                                                                                                                                                                             | `commands/context.ts` (`TEMPLATE_ROOT_FIXED` — owner 가 override 일 때도)                                                    |
| History 라벨 「Unlock origin」 · 「Reset origin」 · 「Reset origins」                                                                                                                                                                                                                                                                                                                                                          | `apps/builder/src/builder/panels/history/catalogHistoryLabels.ts` · i18n                                                     |

테스트: `packages/shared/src/catalog/commands/__tests__/components.test.ts` (unlock · reset · undo/redo · 저장/로드) · `document/__tests__/validation` (RED-3 · 바인딩 규칙) · `resolution/__tests__/resolver` (instance 둘의 바인딩 값 · 부품 자리 · 해제 순서 두 가지) · `commands/__tests__/structure` (`fillSlot` 서브트리 정리 — 프로젝트 컴포넌트 slot 노드 삭제 포함) · builder `__tests__/adr282LibraryOriginUnlock.test.ts` (Components page 카드 · Layers role · Component 절 기본값 칸). 본문 G1 (a ~ d) · G2 (a ~ e) 항목이 테스트 이름과 1:1.

## 3. Phase 2 — Builder (G3)

| 변경                                                                                                                                                                                        | 파일                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 해제된 카드의 ◆ = 사본 루트 자신 (view entry 대신 `projectComponentOriginCellId` 와 같은 셀) · 헤더 표식 (잠금 해제 아이콘)                                                                 | `apps/builder/src/builder/catalogRuntime/componentsPage.ts`                                                                                                                |
| `catalogOriginEditCommand` — 해제된 원본의 노드는 가로채지 않음 (소유 노드라 `isViewEntry` 아님 — 확인만)                                                                                   | `catalogRuntime/originView.ts`                                                                                                                                             |
| Layers role `origin` · 삭제 버튼 없음 (사본 루트)                                                                                                                                           | `catalogRuntime/layerTree.ts`                                                                                                                                              |
| 첫 편집 확인 → 해제 step 에 「Unlocking … affects N instances」                                                                                                                             | `catalogRuntime/componentConfirm.ts`                                                                                                                                       |
| Navigator Components 탭 Library page 행 액션 [리셋] [잠금/해제] — 사용자 결정 1 · 2 · 리셋 확인 대화상자에 지워질 채움 내용 수 (본문 결정 10)                                               | `panels/navigator/catalog/CatalogDefinitionsSection.tsx` (`DefinitionRowContent`) · `config/actionIcons.ts` (`lock` · `unlock` · `reset` — 2 surface 이상이면 등재) · i18n |
| Design 패널 Component 절: 해제된 원본의 ◆ (사본 루트) 에 원본 `accepts` 칸 (override `defaults` — `setLibraryDefault`) + 「Reset to library default」 (사용자 결정 2-b 면 여기가 단일 리셋) | `panels/properties/catalog/CatalogComponentSection.tsx`                                                                                                                    |
| CHANGELOG · `.claude/rules/state-management.md` 한 줄 (원본 사본) · `catalog-subparts.md` 머리말                                                                                            | docs                                                                                                                                                                       |

live 시나리오 (G3, 5175 Playwright 또는 Chrome MCP): 1 Library page 열기 → Button 카드 ◆ 선택 → 행 토글 → 확인 → 2 ◆ 에 Icon 자식 추가 · padding · fill → 3 page 의 Button instance 2 · Select 의 Button 부품에 반영 (Canvas) → 4 Preview 반영 (`/cross-check` 같은 상태) → 5 History 「Unlock origin」 · 「Insert」 … · ⌘Z 로 사본 편집 되돌림 → 6 행 [리셋] → 확인 → 기본 복귀 · instance 복귀 → 7 새로고침 뒤 유지 (저장).

## 4. Phase 3 — 측정 · 문서 (G4 · G5)

- `pnpm gate:perf-ratchet` (수동) — `counts.doc` · select 부류: Button 해제 뒤 편집 step 카운트가 프로젝트 컴포넌트 편집과 같은 자리수 (R4). 4x throttle 하니스는 사용자 CMS dump 로.
- 번들: `adr201-bundle-gate.mjs`.
- 문서: 본문 `### Live Exercise` · README · CHANGELOG · 규칙 줄.

## 5. 사용자 결정 (본문 §Decision 과 같다 — execute-adr 가 닿을 때)

1. 해제 입구 (a 선택 ◆ 의 원본 / b 팝업 / c 카드 헤더 + 행).
2. 리셋 단위 (a override 가 있는 원본 전부 + 확인 / b 선택만, 전체는 메뉴).
3. 부품 자리 반영 (a 따른다 / b 기본 고정).

## 6. 추정 규모

shared 8 ~ 12 파일 (types · validation · graph · commands 3 · resolver 분기 · 테스트) + builder 8 ~ 10 (componentsPage · originView · layerTree · componentConfirm · Navigator 행 · Component 절 · actionIcons · i18n · history 라벨 · 테스트) + docs 4. 약 25 파일. Phase 0 inventory 가 1.5x 넘으면 사후 보고 (adr-writing M3).
