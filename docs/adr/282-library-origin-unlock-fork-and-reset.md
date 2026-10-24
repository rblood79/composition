# ADR-282: Library page 원본 잠금 해제 — 해제 = 프로젝트 사본 (fork) · 리셋 = 기본 원본 복귀

## Status

Accepted — 2026-10-24 (`/execute-adr 282` + [reviews/282](reviews/282.md) Round 2 pending 0 · HIGH 전부 fixed 로 승격). 이전: Proposed — 2026-10-24 (리뷰 Round 2 HIGH 1 (h4) · Round 1 HIGH 3 설계 반영)

> **Phase 0 ~ 2 완료 (2026-10-24, 미커밋)** — 사용자 결정 3 건 답 (같은 날): 1-a 선택한 ◆ 의 원본 · 2-a override 가 있는 원본 전부 · 3-a 부품 자리도 따른다.
>
> - **Phase 0**: 결정 2 의 「정의 조회 한 곳」 을 graph · stage 의 `library` 자체를 **fork 를 반영한 view** (`document/originFork.ts` `forkedCatalogLibrary`) 로 구현 — `definitions.get` 61 자리 · `templates.get` 23 파일이 별도 분기 없이 사본을 읽는다 (lib 루트를 가정한 cast 1 자리 `resolver.ts` `ruleDefinitionOf` 만 수리). 다른 원본 template 의 `descendantPatches` · `slotFills` 경로는 view 가 `templateMap` 으로 번역. 검증은 transaction 의 staged view 로 (`validateEntryReferences(…, library, ownerOf)`). RED 6 은 G1 · G2 테스트로 옮김.
> - **Phase 1**: contract 48 · override `templateRootId` · `templateMap` (소유 edge · 검증 `INVALID_ORIGIN_TEMPLATE_ROOT`) · `NodeEntry.displayState` (상태 원본 69 template 의 사본 보존 — 기호 복사에 필요해 추가) · `unlockOrigin` · `resetOrigin` · `resetOrigins` (`commands/originFork.ts`) · 사본 노드의 whole binding 규칙 (prop 형 · `propChoices` — R7, Popover `{size}` 가 실제로 걸림) · fork 를 지나는 정의 cycle 검사 · `TEMPLATE_ROOT_FIXED` 를 override 소유 루트에도 · `removeWithReferrers` 가 재주소된 interaction 을 남김. shared 1739 PASS, 원복 RED 5/5 (주소 재작성 · library view · interaction guard · 리셋 역재작성 · 바인딩 규칙).
> - **Phase 2**: Library page 카드 ◆ = 사본 루트 (읽을 때마다 — 리셋 step 의 consumer 가 지워진 루트를 읽지 않게) · 카드 경로 번역 · 헤더 「· unlocked」 · 사본을 직접 그릴 때 원본 기본값 바인딩 (live 에서 「{label}」 로 보임 → 수리) · Canvas 클릭 · 「원본으로 이동」 · `selectAfter` 가 카드의 ◆ record 를 고름 (instance 투영과 구별) · Layers role origin · 삭제 버튼 없음 · Component 절 원본 기본값 칸 · Navigator 행 [리셋] [잠금/해제] · 리셋 확인 대화상자 · History 라벨 3 · i18n. builder 6415 PASS.
> - **사용자 지시 2026-10-24 (결정 1 대체)** — 「아이콘은 lock · lock-open 으로 전환, Library 전체 해제되게」: 행의 잠금은 **Library 편집 모드** (`CatalogWorkspace.setLibraryUnlocked` — 저장하지 않는 세션 상태, 기본 잠금). 해제 = `unlockOrigins` 한 step (모든 `origin-` composite — 상태 변형 제외 — 85 개를 사본으로, 주소 재작성 1 회), 잠금 = `lockOrigins` (사본이 새 사본과 같은 원본은 라이브러리로 돌아가고 — 루트 style 은 override `visual` 로 — 편집한 원본만 사본 유지). 잠금 중 사본 편집은 거부 (`ORIGIN_ROOT_ONLY`). 리셋은 그대로 전부 기본 + 잠금. 해제 확인 대화상자는 없앴다 (모드 전환 · undo 가능 · 잠금이 안 편집한 사본을 걷음).
> - **Phase 3 (사용자 지시 2026-10-25, 미커밋)** — Library · Local page 를 문서의 page 로: 처음 열 때 한 step (History 없음 — runtime `load` step) 으로 `ProjectEntry.componentPageIds` 의 page 에 저장 (Library 1,685 노드 · 문서 7.7 KB → 1.04 MB · 첫 열기 1.76 s), body · 카드 · 줄 · 칸 · 캡션 · ◇ instance = page 노드 (선택 · Layout 편집 · 삭제), ◆ 칸 = `NodeEntry.originOf` + 그리는 자식 (`graph.setViewChildren` — 명령 · stage 는 `graph.commandReader` 로 읽어 그 자식을 보지 않는다), Preview · publish 는 component page 를 뺀다 (`withoutComponentPages`), Local page 는 정의 생성 · 삭제 · 이름 변경을 따라감 (`catalogLocalPageSync`), 사용자에게 보이는 instance 수는 page 의 ◇ 를 빼고 센다 (`projectInstancesOf`). 표시 id 는 `componentPageNodeId` 로 문서 id 문법에 맞춘다. **같은 날 후속 (사용자 「Library 가 왜 1mb」 → 「1 · 2 진행 + body grid 3 × auto」)**: 저장 id = `project:node:cp-<역할>-<hash>` (평균 99 → 29 B — 역할 `card` · `inst` · `theme` · `origin` · `local` 은 id 머리에), body = grid `auto auto auto` · Column 6 frame 제거 (카드 = body 직속, 높이 측정 단계 삭제), 줄 wrapper · 칸 frame 제거 (줄 = grid 하나 — 첫 행 샘플 · 아래 행 캡션, 긴 줄은 나눔) → Library page 1,611 → 1,139 노드 · 867 → 464 KB. [§Phase 3](#phase-3--library--local-page--문서의-page).
> - **남은 것**: G4 (번들 상한 · `gate:perf-ratchet` `counts.doc` — 커밋 뒤, dirty tree 면 ratchet 이 HEAD 를 잰다) · G5 (사용자 5173 확인) → Implemented.

- 사용자 요청: `/create-adr` (2026-10-24) — 같은 날 「navigator - components 탭 library page 는 수정 편집이 되지 않게 되어 있다. 우측에 잠금 ↔ 해제 아이콘 추가하고 해제 후에는 library page 의 origin 을 수정할 수 있게 — 우측 아이콘은 "리셋(초기화) - 해제(잠금)"」.
- 방향을 정한 사용자 답 (2026-10-24, 결정 지점 ④ — 승인 scope 변경):
  - 편집 범위 「**원본 전체 편집**」 — 자식 구조 · 부품 · 레이아웃 · 크기 · fill · breakpoint 까지. 2026-10-14 의 확인 「기본(라이브러리) 원본의 slot 은 코드가 정한 그대로 둔다 — 편집 가능 slot 지정은 사용자 컴포넌트 전용」 과 2026-10-05 의 「원본 편집은 루트 prop · 기본 스타일만」 (`originView.ts` 머리말 「Edits are root only (user decision)」) 을 **사용자가 다시 꺼내 뒤집은 것**이다 (재개 조건 (a) 사용자 재제기 — [premise-decision-points.md](../../.claude/rules/premise-decision-points.md)). 그 두 확인이 든 이유 (RAC 조립 계약 · 전 instance 영향) 는 §Context 의 제약으로 남긴다.
  - 아이콘 자리 「**Library page 행 오른쪽**」 — Components 탭의 Library page 행에 [리셋] [잠금/해제] 두 개, Layout 행의 삭제 아이콘과 같은 자리. 리셋은 이 페이지의 원본 override 전부.
- 선행: [ADR-248](completed/248-unified-catalog-document.md) (정의가 template 을 소유) · [ADR-253](completed/253-base-ui-origin-reuse.md) (기본 원본 재사용 · 원본 override 가 instance 루트에 닿음) · [ADR-279](279-component-origin-on-local-page.md) (프로젝트 컴포넌트의 원본 = 소유 template, Local page 가 그린다 — 이 ADR 이 재사용하는 모양). 후속 응용: 없음 (variant · 라이브러리 공유는 범위 밖 그대로).

## Context

**D3 (시각 스타일) 와 문서 모델.** 기본 원본의 모양 · 구조는 catalog rule (D3) 과 라이브러리 template 이 정한다. 이 ADR 은 **프로젝트가 그 template 의 사본을 소유하고 고치는 길**을 연다 — D1 (RAC 조립 계약) 은 그대로 적용된다 (아래 제약 3).

### 지금의 사실 (2026-10-24 실측, main `131d6d48f`)

- **Library page 는 그려진 뷰다.** Components 탭의 「Library page」 (`COMPONENTS_VIEW`) 는 저장되지 않는 graph view entry 로, 기본 원본 145 개 (`reusableOriginLibrary.ts` — template 노드 483) 를 카드로 그린다 (`componentsPage.ts`). 카드의 ◆ (sample, `originSampleId`) 은 그 원본의 **프로젝트 override** 를 자기 값으로 다시 실어 보여 준다 (`componentsPage.ts:952-960` — `props: override?.defaults`, `visual: override?.visual`).
- **편집은 루트 prop · 기본 스타일만.** ◆ 에 보낸 명령은 `catalogOriginEditCommand` (`apps/builder/src/builder/catalogRuntime/originView.ts:120-165`) 가 가로채 `patchNodeProp` → `setLibraryDefault(scope: "defaults")`, breakpoint 없는 `patchNodeVisual` → `setLibraryDefault(scope: "visual")` 로 바꾼다. **그 밖의 모든 op** (자식 삽입 · 삭제 · 이동 · sizing · layout · breakpoint 층 · fill · 카드의 다른 노드) 은 `CatalogOriginEditError` (`ORIGIN_ROOT_ONLY`) 로 거부된다. 사용자가 「수정 편집이 되지 않는다」 고 본 것이 이것이다.
- **override 가 담을 수 있는 것은 셋뿐.** `DefinitionOverrideEntry { targetId, defaults, visual, stateRules }` (`document/types.ts:720-727`). 검증기는 `defaults` 를 원본 `accepts` 로 거른다 (`validation.ts:1189-1205`, `PROP_NOT_ACCEPTED`) — Button 원본은 `accepts: {}` 라 prop 쓰기는 사실상 없다. 구조 · 부품 · 레이아웃을 기록할 자리가 없다.
- **override 는 instance 루트에 닿는다.** resolver 가 `findOverride(definitionId)` 로 `defaults` · `visual` · `stateRules` 를 template 루트 자신의 값 뒤 · instance 값 앞에 싣는다 (`resolver.ts:1191 · 1234-1238 · 1369`, ADR-253 Phase 1). override 변경은 `collectAffectedIds` 의 `overrideTarget` → `libraryDependents` 로 그 원본의 **모든 instance** 를 무효화한다 (`graph.ts:1410`) — Preview 도 override 가 닿으면 전체 걷기 (`preview/receiver.ts:161`).
- **라이브러리 template 은 `lib:` 접두로 코드에서 읽힌다.** `graph.getDefinition(id)` 는 `lib:` 면 `library.definitions`, 아니면 문서 entry (`graph.ts:469-475`). `library.templates.get(...)` 는 shared 14 파일 + builder 9 파일 = **23 파일**이 직접 호출하고, resolver 는 `startsWith("lib:")` 분기 4 곳에서 lib template 과 문서 노드를 가른다. publish 도 같은 코드 라이브러리를 든다 (문서에는 override 만 실린다).
- **프로젝트 컴포넌트는 이미 「소유 template」 모양이다.** ADR-279 로 `DefinitionEntry.templateRootId` 가 소유 노드를 가리키고 (`createComponent`, `commands/components.ts:317-374`), Local page (`PROJECT_COMPONENTS_VIEW`) 가 그 루트를 ◆ 로 그려 **모든 편집 명령이 그대로 동작**한다 (279 Phase 0 probe 6/6 — 막는 guard 없음). `duplicateDefinition` (`:413-470`) 은 template 서브그래프를 `cloneNodeSubgraph` 로 복사한다 — 「template 사본 만들기」 가 이미 명령으로 있다. `detachInto` (instance → 소유 사본) 도 lib template 을 소유 노드로 물질화한다.
- **잠금 상태 · 리셋 UI 는 없다.** Navigator Components 탭 행 (`CatalogDefinitionsSection.tsx` `DefinitionRowContent`) 의 액션 칸은 Layout 행에만 삭제 버튼이 있고, Library page 행은 비어 있다. 원본 override 를 지우는 명령도 없다 (`setLibraryDefault` 는 키 단위 쓰기만).
- **원본 편집 확인 대화상자**는 있다 — `watchCatalogComponentEdits` (`componentConfirm.ts`) 가 override 를 바꾸는 첫 step 에 「Editing … will affect N instances」 를 묻는다 (`overriddenOrigin`).

### 참조 모델 (사용자 원칙 2026-10-21: pen.dev · Figma · Framer, 셋이 갈리면 사용자 편의)

- **Figma**: 라이브러리 컴포넌트는 받는 파일에서 main 을 편집할 수 없다 — 「Go to main component」 는 라이브러리 파일로 가고, 받는 쪽에서 구조를 바꾸려면 instance 를 **Detach** 해 로컬 노드로 만든다 (2026-10-14 메모리 — 그때 「slot 은 코드가 정한 그대로」 결정의 근거).
- **Framer**: Workspace Library 컴포넌트는 소비 프로젝트에서 수정 불가, **Unlink = 로컬 사본 컴포넌트 생성** (Figma detach 와 달리 컴포넌트가 남는다) · 원본 갱신은 수동 Update (2026-10-21 deep-research, 메모리 `reference-framer-components-model-2026-10`).
- **pen.dev**: design-system 페이지가 reusable 의 ◆ 를 보이고, 사용 페이지는 instance (◇) — 기본 원본 자체를 바꾸는 UI 는 없고 재사용 패턴의 참고만 (사용자 2026-10-06).
- composition 은 라이브러리의 **소유자이자 소비자** (기본 원본이 코드) 라 셋 중 어디도 그대로 맞지 않는다. 사용자가 고른 것은 Framer 의 Unlink 에 가장 가깝다 — 「해제 = 프로젝트가 그 원본의 사본을 갖는다」.

### 제약

1. **hard — 문서 계약**: 새 필드는 `LIBRARY_CONTRACT_VERSION` 47 → 48 로 올리고 변환 코드는 넣지 않는다 (사용자 지시 2026-10-14 — 메모리 `feedback-no-document-migration-code-dev-stage`). 검증기 (`validation.ts`) 가 새 모양을 받아들이고 옛 모양을 거부해야 한다.
2. **hard — 두 consumer 대칭**: 해제한 원본의 사본은 Canvas (Skia) 와 Preview/Publish (DOM) 가 **같은 record** 로 읽어야 한다 — 프로젝트 컴포넌트 template 과 같은 길 (`resolver.ts` `instanceRoot`). 한쪽만 사본을 읽으면 `/cross-check` 가 갈린다.
3. **hard — D1 RAC 조립 계약**: 사본을 고쳐도 RAC 가 요구하는 부품은 지울 수 없어야 한다 — 기존 guard `RAC_REQUIRED_PARTS` · `REQUIRED_PART_NOT_REMOVABLE` · `assertNestable` (`commands/structure.ts:286-317 · 673-678 · 852-858`) 이 소유 노드에 그대로 걸린다. 2026-10-14 확인의 사유 「라이브러리 안쪽 구조는 D1」 은 이 guard 로 지킨다.
4. **hard — 모든 instance 영향**: 해제한 원본의 사본은 그 원본의 **모든 instance** (팔레트로 놓은 것 · 다른 원본 template 안의 부품 instance — Select 안 Button 등) 에 반영된다. 반영되지 않는 길 (사본이 Library page 카드에만 보임) 은 ADR-253 F7 의 결함 재발이라 금지.
5. **soft — 성능**: Button · Label 같은 부품 원본은 instance 가 수천 (22 페이지 CMS 프로젝트). 해제 · 리셋 한 번은 `libraryDependents` 전체 무효화 1 회 — 지금 override 쓰기와 같은 비용 (ADR-265 C1 측정 범위). 편집 중 매 step 은 사본 노드 변경 → `templateIndex` 로 instance 걷기 (프로젝트 컴포넌트 편집과 같다).
6. **soft — 기본 원본 갱신**: 코드 라이브러리가 바뀌면 (contract 올림) 해제한 사본은 따라가지 않는다. Framer 와 같다 (수동 Update). 리셋이 그 길이다.

## Alternatives Considered

### 대안 A: override 에 구조를 더 담기 (`DefinitionOverrideEntry` 확장)

- 설명: override 에 `children` · `layout` · `sizing` · `fills` · `descendantPatches` … 를 더해 `catalogOriginEditCommand` 가 더 많은 op 를 override 쓰기로 바꾼다. Library page 카드는 지금처럼 override 를 ◆ 에 다시 싣는다.
- 평가: 모든 op 종류마다 override 필드 하나 + 변환 하나 + resolver 읽기 하나가 필요하다 (지금 2 종 → 노드 모델 전부). 자식 삭제 · 이동은 template 노드 id 기준의 「구조 델타」 가 되어 ADR-260 이 폐기한 참조 모양으로 돌아간다. `catalogOriginEditCommand` 는 명령 **뒤**에서 op 를 다시 쓰는 층이라 `selectAfter` · `fillSlot` · 주소 재작성 같은 명령 내부 판단과 어긋난다 (2026-10-14 「patch 가 fillSlot 을 덮음」 류 결함의 자리).
- 위험: 기술 **HIGH** (노드 모델을 override 에 재구현) / 성능 LOW / 유지보수 **HIGH** (두 모델 동기) / 마이그레이션 MEDIUM.

### 대안 B: 해제 = 프로젝트 사본 (fork) — 사본이 그 원본의 template 이 된다 ★ 채택

- 설명: 「해제」 는 그 기본 원본의 template 을 **소유 노드로 기호 복사** (template 바인딩 `{label}` 을 값으로 굳히지 않는다 — 결정 8) 하고, 그 원본의 override 에 `templateRootId` (사본 루트) · `templateMap` (lib id → 사본 id) 을 더한다. 같은 transaction 에서 문서의 저장 주소를 그 표로 바꾼다 (결정 9). `graph.getDefinition(libId)` 는 override 에 `templateRootId` 가 있으면 **그 루트로 바꾼 정의**를 돌려주고 명령 · 주소 검증 · resolver 가 모두 이것을 읽는다 — 23 파일의 `library.templates.get` 호출은 이 정의의 `templateRootId` 가 `project:node:` 면 `graph.getEntry` 로 가는 분기 하나 (`templateTypeName` 이 이미 하는 방식, `resolver.ts:580-595`), 코드 라이브러리 안의 lib id 경로는 `templateMap` 으로 번역. Library page 카드는 해제된 원본의 ◆ 를 **Local page 카드처럼** 사본 루트 자신으로 그린다 (`projectComponentOriginCellId` 와 같은 길). 「리셋」 은 주소를 역표로 되돌리고 사본과 override 의 두 필드를 지운다 (= 잠금, 결정 10). 잠금 상태 = override 에 `templateRootId` 없음.
- 평가: 프로젝트 컴포넌트 (ADR-279) 와 같은 모양이라 편집 · Layers · 패널 · Preview 가 이미 있다. 새 명령 2 (`unlockOrigin` · `resetOrigin`) + 정의 조회 한 함수 + 주소 재작성 (해제 · 리셋 양방향) + 기호 복사 (template 바인딩 유지) + 검증 + 카드 그리기 분기. composite 기본값 (`defaults`) 은 override 에 남고 루트 style 만 사본으로 흡수한다 (결정 1).
- 위험: 기술 MEDIUM (정의 조회 한 곳에 분기 — 23 파일이 그 정의를 거치는지 Phase 0 grep) / 성능 LOW (해제 · 리셋 = override 쓰기 1 회와 같은 무효화) / 유지보수 LOW (모양 하나) / 마이그레이션 MEDIUM (contract 48 · 변환 0).

### 대안 C: 해제 = 새 프로젝트 컴포넌트로 복사 (Framer Unlink 그대로)

- 설명: 「해제」 가 그 기본 원본을 복사해 **새 프로젝트 컴포넌트** (Local page 카드) 를 만들고, 팔레트 항목이 그 컴포넌트를 가리키게 한다. 기본 원본 자체는 그대로.
- 평가: 기존 instance 가 따라오지 않는다 — Select 안 Button 부품 · 이미 놓은 Button 은 기본 원본의 instance 로 남아 「원본 하나를 고치면 전체가 바뀐다」 (사용자 원칙 2026-10-06, ADR-253) 가 깨진다. 팔레트 · 부품 자리 (`BASE_PART_ORIGIN_TYPES` · field 의 Label · Input) 의 정의 id 를 바꿔 끼우는 간접 층이 필요하다. 사용자가 원한 자리 (Library page 행의 해제 ↔ 잠금 토글) 와도 어긋난다 — 토글이 아니라 새 카드가 생긴다.
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** (팔레트 · 부품 간접 층) / 마이그레이션 LOW.

### 대안 D: 코드 라이브러리를 프로젝트에 통째로 넣기 (문서가 라이브러리를 소유)

- 설명: 프로젝트 생성 때 145 원본 · 483 template 을 문서 노드로 넣어 전부 소유 노드로 만든다. 잠금은 UI 플래그.
- 평가: 문서가 ~200 KB 커지고 (라이브러리 소스 202 KB), 라이브러리 갱신 (contract 올림) 이 모든 프로젝트 문서 변환이 된다 — 변환 금지 지시와 정면 충돌. publish 번들에도 실린다 (Preview 상한 320,000 B — ADR-201).
- 위험: 기술 MEDIUM / 성능 **HIGH** (문서 · 번들) / 유지보수 **HIGH** / 마이그레이션 **CRITICAL** (변환 없이 불가).

### Risk Threshold Check

| 대안 | HIGH+ 축                                 | 판정                             |
| ---- | ---------------------------------------- | -------------------------------- |
| A    | 기술 H · 유지보수 H                      | 기각                             |
| B    | 없음                                     | **채택**                         |
| C    | 유지보수 H                               | 기각                             |
| D    | 성능 H · 유지보수 H · 마이그레이션 **C** | 기각 (CRITICAL → 대안 B 가 회피) |

루프 1 회 — B 에 HIGH 없음.

## Decision

**대안 B.** 해제 = 그 기본 원본의 template 을 프로젝트 사본으로 fork 해 override 가 가리킨다. 사본은 그 원본의 template 이 되어 모든 instance 가 따라오고, Library page 카드의 ◆ 는 사본 루트라 Local page 처럼 전 범위 편집이 된다. 리셋 = 사본 · override 삭제 = 잠금.

### 결정

1. **잠금 · 해제 · 리셋의 뜻**: 잠금 = override 에 `templateRootId` 없음 (기본). 해제 = `unlockOrigin(definitionId)` 한 step — template **기호 복사** (결정 8) + override `templateRootId` · `templateMap` + 기존 주소 재작성 (결정 9) + override `visual` 을 사본 루트 visual 로 흡수 (같은 style 키 namespace — 흡수하지 않으면 override 가 루트 자신의 값 위에 실려 사본 루트의 같은 키 편집을 가린다, `resolver.ts:1234-1238`). override **`defaults` · `stateRules` 는 그대로 둔다** — `defaults` 는 composite 원본의 `accepts` (Button 의 `label` · `icon`) namespace 이고 사본 루트는 native type (`bindings/Button.binding.ts:56-64` 의 `children`) 이라 옮기면 `PROP_NOT_ACCEPTED` 다 (리뷰 h2). 해제 뒤 composite 기본값은 지금처럼 `setLibraryDefault(scope: "defaults")` 로 편집한다 (Design 패널 Component 절 — 결정 3). 리셋 = `resetOrigin(definitionId)` 한 step — 주소 역재작성 (결정 9) + 사본 서브그래프 삭제 (결정 10) + 그 원본의 **override entry 전체 삭제** (`defaults` · `stateRules` · `visual` · `templateRootId` · `templateMap` — `overrideIds` 에서도 제거). 해제 때는 composite 기본값을 보존하지만 리셋은 「기본 원본 복귀」 라 잠금 상태에서 쓴 루트 기본값 · 상태 스타일까지 지운다 (리뷰 h4 — resolver 는 잠금 여부와 무관하게 `defaults` · `stateRules` 를 싣는다, `resolver.ts:1191-1193 · 1234-1238`). 해제한 적 없이 override 만 있는 원본에도 같은 리셋이 적용된다. 둘 다 History 에 남고 undo 된다.
2. **정의 조회가 사본을 돌려준다 — 명령 · 검증 · resolver 가 같은 정의를 읽는다**: `graph.getDefinition(libId)` 가 해제된 원본이면 `{ ...libraryDefinition, templateRootId: 사본 루트 }` 를 돌려준다 (한 곳). 기본 정의를 **직접** 읽는 자리도 이 함수로 바꾼다 — 주소 검증 `resolution/address.ts:44-47` (`getRoot` 가 `library.definitions.get`) 이 그대로면 resolver 만 사본을 읽고 검증은 기본 루트를 기준으로 삼아 `TEMPLATE_ROOT_MISMATCH` 로 갈린다 (리뷰 h1). lib template 을 직접 읽는 자리 (`library.templates.get` 23 파일) 중 **정의의 `templateRootId` 를 거치는 곳**은 `project:node:` 분기만 더하고, **코드 라이브러리 안**에서 이 원본의 template id 를 드는 자리 (다른 원본 template 노드의 `descendantPatches.templatePath` · `slotFills.childIds` — Select 의 Button 부품 patch) 는 문서가 아니라 고칠 수 없으므로 resolver · 주소 해석이 `templateMap` 으로 번역한다 (결정 9).
3. **Library page 의 해제된 카드**: ◆ 는 사본 루트 자신 (view entry 아님). 상태 · variant instance 들 (◇) 은 지금처럼 그 원본의 instance 라 사본을 따른다. Layers 의 role 은 `origin` (`layerTree.ts:177` — `definitionOfTemplateRoot` 가 override 도 보도록). 사본 루트를 고르면 Design 패널 Component 절이 원본의 `accepts` 칸 (composite 기본값 — override `defaults`, `setLibraryDefault`) 을 보인다 — 해제 전 sample ◆ 의 Property 칸이 하던 일.
4. **범위 · 거부**: 사본 루트의 삭제 · 카드 밖 drop 은 거부 (`TEMPLATE_ROOT_FIXED` 와 같은 길). RAC 필수 부품 삭제는 기존 guard. 해제한 원본의 **accepts · 바인딩 · rule** 은 라이브러리 정의 그대로 (D2 · D3 정본 불변 — 사본은 template 만).
5. **첫 편집 확인**: `watchCatalogComponentEdits` 가 해제 step 자체에 「Unlocking … — edits will affect N instances」 를 묻는다 (지금 override 첫 쓰기와 같은 대화상자). 이후 사본 편집은 묻지 않는다.
6. **Navigator**: Components 탭 Library page 행 오른쪽에 [리셋] [잠금/해제] (사용자 답). 리셋은 **override 가 있는 원본 전부** (해제 여부 무관 — 잠금 상태의 루트 기본값만 쓴 원본 포함) 를 되돌리는 확인 대화상자 (N 개 · instance 수 · 지워질 채움 내용 수). 잠금/해제 토글은 「선택된 원본」 이 없으면 비활성 — 어느 원본을 해제할지는 Canvas 의 ◆ 선택 · Design 패널 Component 절 · 카드 헤더 중 **사용자 결정 1**. 해제된 카드는 헤더에 표식 (Local 카드의 ORIGIN 칩과 같은 어법).
7. **기본 원본 갱신**: 코드 라이브러리가 바뀌어도 해제된 사본은 그대로 (Framer). 리셋이 새 기본을 받는 길. 자동 병합 없음.
8. **기호 복사 (symbolic copy) — detach · `cloneNodeSubgraph` 를 쓰지 않는다 (리뷰 h2)**: 사본은 lib template 노드를 **값 치환 없이** 소유 노드로 옮긴다 — `{label}` · `{icon}` 같은 template 바인딩은 문자열 그대로 남아 instance 마다 resolver 의 `templateBindings` (`resolver.ts:893-908`) 가 자기 값으로 채운다 (instance A 「Save」 · B 「Cancel」 유지). detach 경로 (`materialize.ts:382-396 · 1089-1095`) 는 지금 instance 의 값으로 바인딩을 굳히고, `cloneNodeSubgraph` 는 문서 노드만 읽어 lib 루트에서 `NODE_REQUIRED` 다 (`document/clone.ts:39-42`) — 둘 다 이 목적에 맞지 않는다. 노드 검증은 사본 노드의 prop 값이 `{key}` 바인딩이면 그 key 가 해제된 원본의 `accepts` 에 있는지로 판정한다 (라이브러리 template 검증 `document/library.ts:292 · 347 · 408` 과 같은 규칙 — 소유 노드에는 지금 이 규칙이 없다). 라이브러리 노드의 `descendantPatches` · `slotFills` 는 사본 노드의 `descendantOverrides` (`patch` · `fillSlot`) 로 옮기고 그 주소의 lib id 는 사본 id 로 쓴다. 이미 해제된 다른 원본의 template id 를 지나는 경로는 그 원본의 `templateMap` 으로 번역한다 (해제 순서 무관).
9. **주소 재작성 — 기존 instance 의 편집이 해제 · 리셋을 건너 남는다 (리뷰 h1)**: 해제는 `templateMap: Record<LibraryTemplateId, NodeId>` (복사한 lib 노드 → 사본 노드) 를 override 에 남기고, 같은 transaction 에서 **문서의 모든 저장 주소**의 경로 segment 를 그 표로 바꾼다 — 대상은 ADR-279 Phase 0 의 저장 주소 holder (instance `descendantOverrides` 의 `address` · interaction 소유 주소 · `showWhen` 대상 · 상태 변수 소유자) + 정의 `properties` target (`rewriteAddressesThroughExtracted` 가 다루는 집합 — Phase 0 에서 다시 센다). lib template id 는 라이브러리 전체에서 고유라 segment 단위 치환이 경로 어디서든 맞다 (이 원본 안 · 이 원본을 지나는 다른 원본 instance 의 경로 모두). 리셋은 역표로 되돌린다 — 사본 id 가 역표에 있으면 lib id 로, 해제 뒤 **새로 만든 사본 노드**를 지나는 주소는 결정 10 으로 정리한다.
10. **리셋 때 사라지는 자리의 instance 내용 (리뷰 h3)**: 기본 원본에 있던 자리 (역표에 있음) 의 `fillSlot` · `patch` · `replace` 는 주소만 되돌려 **내용을 유지**한다. 해제 뒤 새로 만든 자리 (역표에 없음) 를 가리키는 override 는 지워지고, 그 `fillSlot.childIds` · `replace.replacementId` 의 서브트리와 그 서브트리에 딸린 interaction · 상태 변수도 **같은 transaction 에서 삭제**한다. 리셋 확인 대화상자는 지워질 채움 내용 수 (instance 수 · 노드 수) 를 보인다. 지금 `removeWithReferrers` (`commands/structure.ts:1120-1144`) 는 탈락한 `replace` 의 서브트리만 지우고 `fillSlot.childIds` 를 남겨 `UNOWNED_NODE` (`graph.ts:962-964`) 가 난다 — 이 helper 에 `fillSlot` 분기를 더한다. 같은 결함이 프로젝트 컴포넌트 template 의 slot 노드 삭제에도 있을 수 있다 (같은 helper) — Phase 0 RED 로 확인하고 있으면 같은 수리로 닫는다. **선행 수리 완료 (2026-10-24 `f8561e0d9`)**: 리뷰 Round 2 가 Local page 의 공개 명령 `removeTargets` 로 재현했고, `removeWithReferrers` 가 탈락한 `fillSlot` 의 채움 서브트리를 지우도록 고쳤다 — 이 ADR 의 리셋은 그 helper 를 그대로 쓴다.

### 기각 사유

- **A**: 노드 모델을 override 에 다시 쓴다 — ADR-260 이 폐기한 「참조 + 델타」 의 재등장. 명령 뒤 op 재작성 층이 이미 결함 자리였다.
- **C**: 기존 instance · 부품 자리가 따라오지 않아 ADR-253 의 목적 (원본 하나 → 전체) 을 깬다. 사용자가 고른 토글 어법과 다르다.
- **D**: 변환 없이 불가 (CRITICAL) · 문서 · 번들 상한.

### 사용자 결정 (2026-10-24 답 — 셋 다 권고안: 1-a · 2-a · 3-a. 같은 날 1 은 「Library 전체 해제」 로 대체 — Status 참조)

1. **해제 입구**: Navigator 행의 토글이 어느 원본을 해제하는가 — (a) Canvas 에서 선택한 ◆ 의 원본 (권고 — Layout 행 삭제가 선택과 무관한 것과 다르지만, 원본 145 중 하나를 고르는 유일한 자리가 선택이다) · (b) 토글을 누르면 원본 고르기 팝업 · (c) 카드 헤더에도 잠금 아이콘 (행 토글은 선택 원본에 적용).
2. **리셋 단위**: 행의 [리셋] 이 (a) override 가 있는 원본 전부 (권고 — 사용자 「리셋(초기화)」 · 확인 대화상자) · (b) 선택 원본만, 전체는 메뉴.
3. **해제된 원본의 팔레트 놓기**: 새로 놓는 instance 도 사본을 따른다 (B 에서 자동). 다른 원본 template 안의 부품 instance (Select 의 Button) 도 따른다 — (a) 그대로 (권고 — 사용자 원칙 「한 세트」) · (b) 부품 자리는 기본 원본 고정.

> 구현 상세: [282-library-origin-unlock-fork-and-reset-breakdown.md](design/282-library-origin-unlock-fork-and-reset-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                 | 심각도 | 대응                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `lib:template:` id 를 **정의를 거치지 않고** 직접 드는 자리 (`descendantPatches` · `slotFills` · Components page slot patch · `s2PropAlignment`) 와 기본 정의를 직접 읽는 검증 (`address.ts:44-47`) 이 사본을 못 본다 — 한 consumer 만 사본을 읽어 Canvas ↔ Preview 가 갈리거나 기존 주소가 `TEMPLATE_ROOT_MISMATCH` |  HIGH  | 결정 2 · 9 — 정의 조회 한 함수 · `templateMap` 번역 · 해제 transaction 의 주소 재작성. Phase 0 inventory 23 파일 + 주소 holder 전수 · G1 「해제 전 작성 → 해제 → 같은 결과」 · parity |
| R2  | 해제한 사본의 RAC 필수 부품을 지워 Preview DOM 이 RAC 오류 (Select 의 trigger Button 없음)                                                                                                                                                                                                                           |  MED   | 기존 guard (`RAC_REQUIRED_PARTS`) 가 소유 노드에 걸림 — Phase 0 probe 로 확인 (삭제 거부 RED → 거부 확인)                                                                             |
| R3  | 리셋이 사본 노드를 가리키던 instance override 주소를 dangling 으로 남기거나, 탈락한 `fillSlot` 의 채움 노드가 소유자를 잃어 `UNOWNED_NODE` 로 리셋 자체가 거부됨                                                                                                                                                     |  HIGH  | 결정 9 · 10 — 기본 자리는 역재작성 (내용 유지) · 새 자리는 override + 채움 서브트리 + 딸린 record 삭제 · `removeWithReferrers` 의 `fillSlot` 분기 → G2                                |
| R4  | 부품 원본 (Button · Label) 해제가 수천 instance 를 매 편집 step 무효화 — 4x throttle 에서 끊김                                                                                                                                                                                                                       |  MED   | 프로젝트 컴포넌트 편집과 같은 걷기 (`templateIndex`) — ADR-265 카운트 ratchet `counts.doc` 로 Phase 3 측정, 상한 초과면 `--raise` 아니라 원인                                         |
| R5  | contract 48 로 「ADR279」 · 사용자 기존 프로젝트가 열리지 않음                                                                                                                                                                                                                                                       |  LOW   | 사용자 지시 (개발 단계 · 변환 0) — README 에 적는다                                                                                                                                   |
| R6  | 코드 라이브러리 갱신이 해제 사본에 닿지 않아 사용자가 「고쳤는데 안 바뀜」 으로 봄                                                                                                                                                                                                                                   |  LOW   | 카드 헤더 표식 + 리셋 안내 문구 (Framer Update 어법)                                                                                                                                  |
| R7  | 기호 복사의 `{key}` 바인딩을 소유 노드 검증이 거부하거나 (bool · enum prop 의 전체 바인딩), detach 류 값 치환이 끼어 instance 별 값이 하나로 굳음                                                                                                                                                                    |  HIGH  | 결정 8 — 사본 노드 검증에 라이브러리 template 의 바인딩 규칙 · G1 「instance 둘 (Save · Cancel) · icon 다름 · 해제 뒤 prop 변경」                                                     |

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 실패 시 대안                                                                                                                   |
| ---- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| G0   | Phase 0 종료        | `library.templates.get` 23 파일 분류표 (정의 경유 / `lib:template:` 직접) 완성 · 직접 자리마다 처리 방침 1 줄 · RED 3 (해제 전 ◆ 자식 삽입 거부 = 지금 동작 · RAC 필수 부품 삭제 거부 · 사본 없는 `templateRootId` 검증 거부)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 직접 자리가 처리 불가면 대안 A 의 부분 (그 자리만 override 필드) 로 돌아가지 않고 **그 편집을 거부 목록에** 둔다 (사용자 보고) |
| G1   | Phase 1 종료 (모델) | shared unit: (a) **해제 전 작성 보존** — instance 의 자식 patch (「Customized」) · slot 채움 · 중첩 원본 경로 (Select 안 Button 의 글자) · interaction 소유 주소를 만든 뒤 해제 → record 같은 값 · 주소 검증 PASS · 저장 → 로드 같은 값 · undo/redo 왕복 (R1). (b) **바인딩 보존** — Button instance 둘 (`label` 「Save」 · 「Cancel」, `icon` 다름) + 기존 override `defaults.label` → 해제 → 두 instance 값 그대로 · 해제 뒤 instance `label` 변경 반영 · override `defaults` 변경 반영 (R7). (c) Select → Button 순 · Button → Select 순 해제가 같은 record. (d) contract 47 문서 거부 · `getDefinition` 이 사본 루트. **parity**: 해제한 Button · Select 의 Canvas ↔ Preview (`/cross-check`, 같은 상태) 차이 0               | parity 차이 → 사본을 안 읽는 consumer 수리 (한쪽 우회 금지)                                                                    |
| G2   | Phase 1 종료 (명령) | 리셋: (a) 기본 자리의 `fillSlot` (자식 서브트리 + 그 안의 interaction · 상태 변수) · `patch` · `replace` → 리셋 → 내용 유지 · 주소가 lib id. (b) 해제 뒤 새로 만든 자리에 `fillSlot` → 리셋 → override · 서브트리 · 딸린 record 삭제, `UNOWNED_NODE` 0 · dangling 0 (R3). (c) 둘 다 undo/redo · 저장 → 로드. (d) `REQUIRED_PART_NOT_REMOVABLE` 유지 (R2). (e) 프로젝트 컴포넌트 template slot 노드 삭제 + `fillSlot` instance — Phase 0 RED 였으면 GREEN. (f) **기본 원본 복귀** — `defaults.label` 「Send」 + hover `stateRules` 를 가진 원본 (해제한 것 · 해제하지 않은 것 각각) → 리셋 → override entry 0 · `overrideIds` 에 없음 · record 가 라이브러리 기본 (label · hover) · undo 로 「Send」 · hover 복귀 · redo (리뷰 h4) | 참조 정리 누락 수리                                                                                                            |
| G3   | Phase 2 종료 (UI)   | live (5175 · Playwright 또는 Chrome MCP): Library page 행 토글 → 확인 대화상자 → 해제 카드 ◆ 에 자식 추가 · 레이아웃 · fill 편집 → page 의 instance · Select 안 Button 부품 반영 → Preview 반영 → 리셋 → 기본 복귀 · History 라벨 2 · ⌘Z                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `/fix`                                                                                                                         |
| G4   | 커밋 뒤 (pre-push)  | `pnpm type-check` · shared · builder 스위트 · 번들 상한 (Builder ≤ 1,390,000 · Preview ≤ 320,000 B) · ratchet `counts.doc` (수동 `pnpm gate:perf-ratchet`, R4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 상한 초과면 원인 수리                                                                                                          |
| G5   | 사용자 Builder 확인 | 5173 에서 사용자가 해제 · 편집 · 반영 · 리셋 확인 → Implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 사용자 지적 → 수리                                                                                                             |

측정 명시 (measurement-validity Q1 ~ Q5): 대상은 사용자 CMS 22 페이지 프로젝트 (합성 아님) + 「ADR282」 새 프로젝트 · 불리 케이스 = Button (부품 · instance 최다) 해제 뒤 편집 step · 대조군 = 같은 문서의 프로젝트 컴포넌트 편집 카운트 · oracle = Preview DOM `getBoundingClientRect` (Canvas 와 독립).

### Live Exercise

(Implemented 승격 시 G5 와 함께 확정 — 아래는 G3 기록)

- **2026-10-24 G3 (Chrome MCP, 5175 dev, 새 프로젝트 「ADR282」 — Button 「Save」 · 「Cancel」 + Select)**: Library page Button ◆ 선택 → 행 잠금 아이콘 → 「Editing Button will affect 2 instances」 → Continue → 카드 「24. BUTTON · UNLOCKED」, ◆ 가 사본 루트 (Component 절 ORIGIN · 원본 기본값 칸). ◆ 에 Badge 자식 · padding 24 · 초록 fill → Library 카드의 variant × state instance 전부 · Toolbar · Menu · NumberField 증감 버튼 (Button 부품 — 결정 3-a) · page 의 Save · Cancel (각자 글자 유지) · Select trigger 에 반영. 새로고침 (저장 → 로드) 뒤 유지. Preview: Save 134×32 · Cancel 146×32 · 초록 · padding 24px (Canvas 135 · 147 × 32). 행 [리셋] → 「Resetting 1 origin … 2 instances」 → Continue → page 가 기본 Button (58 × 30 · Preview 57 × 30) · History 「Reset origin」 · ⌘Z 로 같은 사본 복귀 · ⌘⇧Z 로 리셋. live 에서 결함 3 수리: ◆ 가 「{label}」 · 클릭이 카드 전체 · 「원본으로 이동」 이 빈 선택.
- **잔여 관찰 (LOW, 별도)**: 해제 + Badge 상태에서 Select trigger 높이 Canvas 32 ↔ DOM 30 — trigger 에 자식이 늘었을 때의 상자 높이 차이 (잠금 대조군은 30 ↔ 30). fork 경로가 아니라 trigger 안 추가 내용의 높이 계산이라 `/cross-check` 대상으로 남긴다.

## Phase 3 — Library · Local page = 문서의 page (사용자 지시 2026-10-25)

### Context

- 사용자 지시 (2026-10-25): 「개념이 Pages-home-body, components-library-body 에 매칭되는 개념이 되어야 한다. library-body 의 디자인패널 layout 탭 편집 불가, library-body 내의 선택 안 되는 요소가 많다. ◆ origin, ◇ instance 객체 표기들 layer 트리에 나오지 않는다. pages 탭의 page 요소들처럼 구성이 되어야 한다.」
- 사용자 답 (AskUserQuestion, 같은 날 — 결정 지점 ④ 승인 scope 변경): **프로젝트 문서의 page** (카드 · 제목 · 캡션 = 일반 frame · text 노드) · **Library · Local 둘 다** · **ADR-282 Phase 3** · 크기 실측 (Library 1,685 노드 · 약 890 KB — 빈 프로젝트 7.7 KB 의 ~117 배) 뒤 **처음 열 때 만들기** (프로젝트 생성 때가 아니라 Components 탭에서 처음 열 때 문서에 넣는다).
- 이 지시는 2026-10-05 · 10-14 의 「Components page = 파생 화면 · 저장 안 됨 · 카드 틀은 배치 전용」 (메모리 `project-components-tab-is-one-components-page`) 을 사용자가 다시 꺼내 바꾼 것이다 (재개 조건 (a)). 카드 구성 (Origin ◆ + ◇ · Item 줄) 자체는 유지.
- **지금의 사실**: 두 page 는 `graph.setViewEntry` 의 파생 entry (`componentsPage.ts` — 저장 · export · 색인 · transaction 밖, `graph.ts:479-489`). 그래서 (1) 카드 · 줄 · 칸은 편집 대상이 아니고 (`originView.ts` `pageNodeOf` 가 view entry 에 닿는 op 를 거부 · Canvas pick 이 틀을 건너뜀 — `canvasPick.ts` `resolveCatalogClickRecord`), (2) body 를 골라도 Layout 탭이 쓸 곳이 없다. ◆ 칸의 자식은 잠긴 원본이면 view 표본 (`originSampleId`), 해제 · Local 원본이면 **다른 소유자의 template 루트** (override · 정의 소유) 다 — view entry 라서 소유 검증을 받지 않고 그 루트를 자식으로 든다.
- **hard 제약**: 소유 불변식 (한 노드의 소유자는 하나 — `DUPLICATE_OWNERSHIP`, `graph.ts` `validateStructuralDelta`) — 문서 노드인 칸은 template 루트를 `children` 에 둘 수 없다. 잠긴 기본 원본은 문서 노드가 없다 (코드 template). Preview · publish 는 이 page 를 그리지 않아야 하고 (사용자 page 가 아니다 — 라우트 · Pages 목록 · publish 밖), 890 KB 를 실어 보내지 않아야 한다 (Preview 상한 320,000 B 는 번들이지만 snapshot 도 postMessage 로 간다). contract 는 48 그대로 (48 이 아직 커밋 전이라 같은 번호에 싣는다) · 변환 0 (2026-10-14 정책).

### Alternatives

- **대안 P1 — 칸 = 저장 노드 + 그리는 자식 하나 (view children)** ★ 채택: 카드 · 줄 · 칸 · 캡션 · ◇ instance 는 page 가 소유하는 저장 노드다. ◆ 만 지금처럼 그린다 — Builder 가 ◆ 칸 id 에 「그리는 자식」 (잠긴 원본 = view 표본 · 해제 / Local = template 루트) 을 등록하면 `graph.getEntry(칸)` 이 그것을 `children` 앞에 붙여 돌려주고 (view entry 와 같은 읽기 — 모든 consumer 가 이미 이 모양을 그린다), transaction stage 가 모든 쓰기에서 그 id 를 걸러 낸다 (한 곳). 저장 · export · 색인은 table 만 읽어 그 자식을 보지 않는다. Preview · publish 는 component page 를 통째로 뺀다 (template 은 정의 · override 소유 그대로라 빠져도 instance 가 그려진다).
  - 위험: 기술 MEDIUM (읽기에만 보이는 자식 — 쓰기 · inverse 가 그 id 를 실으면 stage 가 걸러야 한다, 한 곳이라 원복 RED 로 고정) / 성능 MEDIUM (문서 +890 KB — 열어 본 프로젝트만, 저장은 바뀐 entry 만) / 유지보수 LOW (소유 모양 무변경 · 기존 그리기 경로 재사용) / 마이그레이션 LOW (contract 48 그대로 · 변환 0).
- **대안 P2 — ◆ = 저장된 instance + 대상 매핑**: ◆ 를 원본의 instance 노드로 저장하고, 해제 · Local 원본이면 그 instance 투영의 행 · record 대상을 template 노드로 바꿔 편집이 사본에 가게 한다.
  - 위험: 기술 **HIGH** (instance 투영 행은 루트가 접혀 instance 자신이 된다 — `positions.ts` `collapsedRootChildren`; 대상을 바꾸는 층은 대안 A (op 재작성) 와 같은 결함 자리) / 성능 LOW / 유지보수 **HIGH** (positions · record · Layers · pick 에 anchor 분기) / 마이그레이션 LOW.
- **대안 P3 — 원본을 page 가 소유 (ADR-260 참조 모양 복귀)**: 칸이 template 루트를 소유하고 정의 · override 는 참조만.
  - 위험: 기술 **HIGH** (ADR-279 Decision 1 의 소유 모양을 되돌림 · page 가 없을 때 (처음 열기 전) 의 두 모양) / 성능 MEDIUM / 유지보수 **HIGH** (Preview · publish 가 page 안의 template 을 실어야 해 page 를 뺄 수 없다) / 마이그레이션 MEDIUM. ADR-279 가 대안 C 로 기각한 비용 그대로.

| 대안 | HIGH+ 축        | 판정     |
| ---- | --------------- | -------- |
| P1   | 없음            | **채택** |
| P2   | 기술 · 유지보수 | 기각     |
| P3   | 기술 · 유지보수 | 기각     |

### Decision

**P1.** 결정:

11. **component page** — `ProjectEntry.componentPageIds` (project 소유 목록 — `pageIds` 와 별개라 라우트 · Pages 목록 · publish · Preview 가 보지 않는다) 의 page 둘: Library (`project:page:catalog-library`) · Local (`project:page:catalog-local`). body 는 지금 view 루트의 id 그대로 (`ORIGIN_VIEW_NODE` · `PROJECT_ORIGIN_VIEW_NODE`) 라 Components 화면 · 정의 view root · pick 규칙이 그 id 로 page 를 연다.
12. **처음 열 때 만들기** — Components 탭에서 그 page 를 처음 열면 `componentsPage.ts` 가 지금 만드는 entry 를 저장 노드로 바꿔 한 step 에 넣는다 (History 없음 — `executeOnLoad`, 결정 사용자 답). 그 뒤로는 코드 라이브러리가 바뀌어도 page 는 그대로 (사용자 답의 대가 — 리셋 · 다시 만들기는 범위 밖).
13. **◆ 칸** — 저장 노드 (캡션만 소유) + 그리는 자식 하나 (P1). 잠금 · 해제 · 리셋 · Local 컴포넌트 생성 · 삭제는 page 를 건드리지 않고 그리는 자식만 바뀐다. 칸 자체는 frame 이라 Layout 편집이 된다.
14. **page 요소 = page 노드** — 카드 · 줄 · 칸 · 캡션 · body 는 선택 · 이동 · 삭제 · Layout · Style 편집이 된다 (home-body 와 같다). ◇ instance 는 그 원본의 instance (INSTANCE 칩). Layers 는 Pages 와 같은 트리이고 ◆ (원본) · ◇ (instance) 표식이 행에 선다.
15. **Local page** — 정의가 생기거나 사라지면 Local page 의 카드를 맞춘다 (page 가 있을 때만 — 처음 열기 전이면 열 때 만든다).

> 구현 상세: [breakdown §8 Phase 3](design/282-library-origin-unlock-fork-and-reset-breakdown.md#8-phase-3--library--local-page--문서의-page)

### Risks

| ID  | 위험                                                                                                                                     | 심각도 | 대응                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------- |
| R8  | 그리는 자식이 쓰기로 새어 저장됨 — 칸을 고친 명령 · 그 inverse 가 `getEntry` 의 children 을 그대로 실어 `DUPLICATE_OWNERSHIP` · dangling |  HIGH  | stage 의 쓰기 한 곳에서 걸러 냄 · G6 (칸 Layout 편집 · undo · 저장 → 로드에 그리는 자식 0 — 원복 RED)                  |
| R9  | Preview · publish 에 component page 가 실려 snapshot 이 890 KB 커지거나 page 가 라우트로 보임                                            |  HIGH  | export 경계에서 component page 와 그 서브트리를 뺀다 · G6 (Preview snapshot · publish 파일 크기 = page 열기 전과 같음) |
| R10 | 열어 본 프로젝트의 저장 · 열기 비용 (+890 KB)                                                                                            |  MED   | G7 — 저장 · 다시 열기 시간을 page 열기 전후로 잰다 (사용자 CMS 프로젝트)                                               |
| R11 | Local page 의 카드가 정의와 어긋남 (undo 로 정의가 사라졌는데 카드가 남음)                                                               |  MED   | 카드 맞추기를 정의 변경 step 뒤에 · 사라진 정의의 칸은 그리는 자식 0 (빈 칸) · G6                                      |

### Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                                                                                | 실패 시 대안 |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| G6   | Phase 3 모델 · 명령 | unit: component page 만들기 (History 0 · 저장 → 로드 같은 page) · 칸 Layout 편집 → 저장 문서에 그리는 자식 0 · undo/redo · Preview snapshot / publish export 에 component page 0 · 잠금 → 해제 → 리셋 동안 칸의 그리는 자식만 바뀜 · Local 정의 생성 · undo 뒤 카드 맞춤 | 원인 수리    |
| G7   | Phase 3 live        | 5175: Library 첫 열기 → body 선택 · Layout 탭 편집 · 카드 · 제목 선택 · Layers ◆ · ◇ · 해제 편집 · 새로고침 뒤 유지 · Preview 에 Library 없음. 저장 · 다시 열기 시간 기록                                                                                                | `/fix`       |

## Consequences

### Positive

- Library page 의 기본 원본을 Local page 의 프로젝트 컴포넌트와 **같은 모양** 으로 편집한다 — 명령 · Layers · Design 패널 · Preview 가 새 경로 없이 그대로. 「기본 UI 원본 하나를 고치면 전체가 한 세트로」 (2026-10-06 사용자 방향) 가 구조 · 레이아웃까지 넓어진다.
- 잠금이 기본이라 실수로 Button 전체를 바꾸는 일은 해제 + 확인 두 단계 뒤에만 난다.
- `catalogOriginEditCommand` 의 op 재작성 층은 해제 전 ◆ 의 루트 prop · 스타일 편집에만 남는다 (해제 뒤 ◆ 는 소유 노드라 가로채지 않는다).
- `removeWithReferrers` 의 `fillSlot` 분기는 프로젝트 컴포넌트 template 의 slot 노드 삭제에도 같이 적용된다 (결정 10).

### Negative

- contract 48 — 기존 프로젝트 (「ADR279」 등) 는 열리지 않는다 (개발 단계 정책).
- 해제한 사본은 코드 라이브러리 갱신을 받지 않는다 — 리셋으로만.
- `graph.getDefinition` 이 override 를 한 번 더 조회한다 (Map 조회 1) — resolver 핫패스라 Phase 3 카운트로 확인.
- Navigator 행의 토글이 「선택 원본」 에 묶이면 (사용자 결정 1-a) 선택 없는 상태에서는 비활성이다 — 행 액션이 선택에 의존하는 첫 사례.
