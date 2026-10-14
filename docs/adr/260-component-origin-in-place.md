# ADR-260: Create component — 선택 노드가 그 자리에서 ORIGIN 으로 남는다 (pen.dev · Figma 참조 모델)

## Status

Proposed — 2026-10-14

- 사용자 요청: `/create-adr` (2026-10-14) — 「instance component 를 create component 하게 되면 detach instance 가 하나 더 생성된다. create component 로 생성한 컴포넌트 표시도 design 패널 property-component section 에 표기되었지만 현재 나타나지 않는다」 보고에서 출발. 같은 날 AskUserQuestion 답 — **「선택 노드가 ORIGIN 으로」** (Figma 처럼 만든 노드 자신이 새 컴포넌트의 원본으로 표시 — ORIGIN 칩 · Select instances · Detach component) · **「원본에서만 표시」** (해체 버튼은 원본의 것) · **「ADR 먼저 작성」** (문서 모델 변경이라 바로 구현 · 가벼운 대안 기각).
- 방향을 정한 사용자 원문 (2026-10-14): **「origin - instance, slot 은 pen.dev 와 pigma(Figma) 참조 모델이다」**.
- 이 결정은 ADR-248 breakdown 의 사용자 판정 ② (2026-09-30 — 「template 은 Components 로, 원래 자리엔 인스턴스 (구 "그 자리 origin" 은 definition 의 template 소유와 동시 소유가 되어 불가)」) 를 **뒤집는다**. 그때의 사유는 소유 모델의 제약이었고, 이 ADR 이 그 제약을 푼다 (아래 Decision). 결정 지점 ④ (승인 scope 변경) 의 confirm = 위 사용자 답.
- 사용자가 이미 답한 확인 항목: 해체 (Detach component) 는 원본에서만 — instance 는 Detach instance 하나 (2026-10-14, 같은 날 패널 · Canvas 메뉴 · ⌘⌥K 에 반영, 커밋 전) · 놓은 instance 의 slot 내용은 instance 의 것 (2026-10-14 「slot 호스트 전부」 + 6종 「동일하게」) · 옛 문서 전환 코드 금지 (2026-10-14, 개발 단계) · Components 탭 = Components page 하나 · 기본 원본은 루트만 편집 (2026-10-05 · 10-01).
- **사용자 결정 1 · 2 · 3 — 2026-10-14 답**: (1) 원본 삭제 = **「Figma 대로 instance 유지 + Restore」** · (2) 원본 복제 = **「pen.dev 대로 instance」** (사용자 조건 「현재 시스템에 더 맞다면」 — 실측: `duplicateNodes` · `pasteNodes` 가 모두 `document/clone.ts` `cloneNodeSubgraph` 하나를 지나므로 복제된 원본 루트를 그 정의의 instance 로 바꾸는 자리가 한 곳이고, instance 복제가 instance 인 지금 규칙과 같다 — Figma 식 새 정의는 정의 생성 + 서브트리 복제가 더 든다 → pen.dev 채택) · (3) Components 탭 클릭 = **「page 의 원본으로 이동」**. **결정 4 · 5 — 같은 날 답 「pen.dev / Figma 에 같은 기능이 있다면 그 방식으로」**: (4) Restore 자리 — pen.dev 는 삭제 · 복원을 문서화하지 않았고 Figma 만 「Restore main component」 가 있다 (instance 의 오른쪽 메뉴 · 우측 패널; 문서는 자리를 적지 않는다 — 실동작은 **그 instance 가 있는 page 에 instance 옆**). → Figma 방식: 복원을 요청한 instance 옆 (같은 부모, 그 다음 index — 절대 배치면 instance 자리에서 10 px 띄움, 복제의 `COPY_OFFSET` 과 같다). 삭제 전 자리는 기억하지 않는다 (정의에 자리 필드 0). Phase 0 oracle 표에서 Figma 실물로 자리를 확인하고 다르면 그대로 따른다. (5) 중첩 원본 — Figma 는 main component 안에 main component 를 두지 못한다 (안쪽은 instance), pen.dev 는 「you can create nested components」 로 허용하되 표시는 문서화하지 않았다 → 같은 기능이 있는 pen.dev 방식: 원본 안의 원본을 허용하고, 안쪽 원본 노드는 **자기 정의의 ORIGIN** 으로만 표시 (magenta 상자 · Component 절 = 자기 이름 · Select instances · Detach component). 「바깥 원본의 부품」 안내는 두지 않는다 (pen.dev 의 표식은 노드 하나 기준).
- 범위 밖: 기본 (library) 원본 — Components page 의 표본 · 루트 편집은 그대로 · layout (`usage: "layout"`) — page body 가 instance 가 되는 모델은 그대로 (원본이 page 에 서지 않는다) · 라이브러리 간 공유 (Figma Libraries · pen.dev Libraries) · variant / component property.

## Context

### 도메인

- **문서 모델 (ADR-248 catalog 문서)** — 이 ADR 은 D1 · D2 · D3 어느 것도 바꾸지 않는다. 원본 노드는 지금도 page 의 보통 노드와 같은 type · prop · rule 로 그려지고 (D1 · D2 · D3 무변경), 바뀌는 것은 **정의 (`DefinitionEntry`) 와 그 template 루트 노드 사이의 소유 관계** 와, 그에 따른 명령 · 패널 · Canvas 표식이다.
- 참조 모델 (외부 근거, 2026-10-14 조회):
  - **pen.dev** (`docs.pencil.dev/core-concepts/components`): 「The element is now your component origin, marked with a magenta bounding box when selected」 — 원본은 **캔버스 위의 보통 요소** 다. instance 는 원본의 사본 (캔버스에서 원본을 복사하거나 Components 패널에서 넣는다 — violet 상자). 원본 편집이 instance 에 흐르고, instance 는 fill · size · 글자를 override 한다. 「Go to component」 가 같은 파일의 원본으로 간다. 링크를 끊는 길은 「Detach instance」 하나. 중첩 컴포넌트 지원.
  - **Figma** (`help.figma.com` Create and use components · Detach instances): main component 는 만든 자리의 레이어를 「special component frame」 에 넣은 것 — **캔버스에 남는다**. 「Deleting a main component does not remove instances of that component from your files」 — instance 는 남고 「Restore main component」 로 되살린다. detach 는 「Make the instance a regular frame … Remove the link to the original component」 — instance 하나만. main component 자체를 되돌리는 길은 없다 (만든 직후 undo, 또는 instance 를 떼고 원본을 지운다).
  - 두 모델의 공통: **원본은 캔버스의 노드이고 정의는 그 노드를 가리킨다**. 다른 점: Figma 는 component frame 으로 감싸고 (D1 요소 하나 추가), pen.dev 는 요소 자체가 원본.

### 현재 (실측 2026-10-14, 작업 트리 — Request 1 ~ 4 미커밋 변경 포함)

1. **정의가 template 을 소유한다** — `ownedChildren(definition) = [templateRootId]` (`packages/shared/src/catalog/document/graph.ts:76-80`), 소유 edge 로 색인 (`:138`). 한 노드의 소유자는 하나 (`DUPLICATE_OWNERSHIP`, `graph.ts:544-560`) 라서 page 의 자식이면서 정의의 template 일 수 없다 — 2026-09-30 「그 자리 origin 불가」 의 근거.
2. **`createComponent` 가 노드를 정의 안으로 옮긴다** (`commands/components.ts:176-230`): 정의 `templateRootId = node.id`, 부모 child list 의 그 자리에 새 instance (`placement` 만 승계), `selectAfter: [instance.id]`. 그래서 생성 직후 Design 패널 Component 절은 INSTANCE 칩 · Go to component · Detach instance 이고, ORIGIN 칩 · Select instances · Detach component 는 **정의 편집 view** 에서 template 루트를 골라야 나온다 (`catalogRuntime/componentActions.ts` `catalogComponentState` — `definitionView` 의 `templateRootId === id` 일 때만 `originOf`). 사용자가 본 「생성한 컴포넌트 표시가 나타나지 않는다」 가 이것이다. 같은 날 live 재현 (`apps/builder/scripts/create-component-live.mjs`): Button · ToggleButton 모두 생성 뒤 칩 = INSTANCE, 정의 화면에 들어가 루트를 고르면 ORIGIN.
3. **정의 편집 view** = 정의 하나의 template 을 page 대신 그리는 별도 root (`runtime/compositionRoot.ts:1994-2003` `pageRoots`, `catalogRuntime/workspace.ts:222-262` `showDefinition`). Layers · 팔레트 · 편집 명령이 그 view 의 루트에 붙는다 (`panels/components/CatalogComponentsPanel.tsx:40-62` 는 view 의 `templateRootId` 에 넣는다). Components 탭 「사용자 컴포넌트」 목록 클릭이 이 view 를 연다 (`panels/navigator/catalog/CatalogDefinitionsSection.tsx`).
4. **instance 는 template 을 id 로 읽는다** — resolver 는 `project:node:` template 을 `graph.getEntry` 로 읽어 투영한다 (`resolution/resolver.ts:1500-1505`). 소유자가 누구인지는 보지 않는다. override 주소는 `{instances: [instanceId], templatePath: [templateRootId, …]}` — 역시 소유와 무관.
5. **원본 편집의 instance 전파** 는 소유 사슬로 찾는다 — transaction 검증이 「template 루트의 소유자가 정의면 그 정의의 instance 를 재검증」 (`graph.ts:600-608`), 원본 첫 편집 확인 대화상자 (`catalogRuntime/componentConfirm.ts` `watchCatalogComponentEdits`) 는 `definitionView` 안의 편집만 묻는다.
6. **해체 · 삭제**: `dissolveComponent` (`components.ts:238-262`) 는 instance 전부 detach 뒤 정의 + template 서브트리를 지운다. `deleteLayout` (`commands/project.ts:495-520`) 도 같다. page 에서 노드를 지우면 (`removeTargets`) 소유 서브트리가 간다 — 지금 원본은 page 에 없으니 「원본 삭제」 라는 경우가 없다.
7. **정의 순환**: `DEFINITION_CYCLE` 은 template 루트에서 children 을 걸어 `project:definition:` instance 를 만나면 그 정의를 방문한다 (`graph.ts:1070-1092`) — template 의 소유자가 아니라 **id 로** 걷는다. `OWNERSHIP_CYCLE` (`:574-589`) 은 소유 사슬.
8. **알려진 결함** (ADR-259 Phase 2 기록, 2026-10-13): `createComponent` 가 노드를 template 으로 옮길 때 template 루트의 `fillSlot` 을 버린다 — 2026-10-14 「slot 내용 = instance 의 것」 뒤로는 놓은 모든 원본 instance 가 루트 `fillSlot` 을 가지므로 **ToggleButtonGroup · Card · Tabs 를 컴포넌트로 만들면 항목이 사라지는** 범위가 됐다.
9. **표식**: Canvas 크롬 · Layers 점 · 패널 칩의 역할은 `catalogComponentRole` 하나가 정한다 (ORIGIN = 정의 view 의 루트 또는 Components page 의 표본, INSTANCE = 정의의 instance 또는 그 안의 원본 instance 행). pen.dev 규약 (magenta solid / violet dot, 메모리 `pencil-component-visual-markers`) 을 이미 따른다.
10. **문서 수**: 저장소 fixture · 사용자 로컬 프로젝트에 `project:definition:` 컴포넌트 수는 Phase 0 이 센다 (개발 단계 — 전환 코드는 넣지 않는다, 2026-10-14 지시). 옛 문서의 「정의 소유 template」 은 그대로 유효한 모양으로 남아야 한다 (아래 Decision 의 두 모양).

### 제약

- **Hard**: 한 노드 소유자 하나 (`DUPLICATE_OWNERSHIP` · `UNOWNED_NODE` · `OWNERSHIP_CYCLE`) 와 정의 순환 금지 (`DEFINITION_CYCLE`) 는 그대로 — 바꾸는 것은 「정의 → template 루트」 edge 의 **종류** 다. 무작위 명령 500 단계 하니스 (ADR-248 4b G2) 가 그대로 통과해야 한다.
- **Hard**: 옛 문서 무변경 — 정의가 template 을 소유하는 문서 (지금까지 만든 모든 사용자 컴포넌트 · 모든 layout) 는 로드 · 편집 · 저장이 그대로다. 전환 코드 0.
- **Hard**: D3 대칭 — 원본은 page 의 보통 노드라 Canvas · Preview 가 지금 경로로 같은 결과를 낸다. Skia 전용 표식 금지 (선택 크롬은 Builder 전용 UI 라 대상 아님).
- **Hard**: pre-push perf ratchet (ADR-246) · initial 번들 상한 (Builder ≤ 1,421,000 / Preview ≤ 623,000 B gzip, 만료 2026-10-25).
- **Soft**: 사용자 흐름 = pen.dev · Figma 와 같은 결과 — 「Create component」 뒤 **같은 노드가 그 자리에서 ORIGIN**, Components 탭에 이름이 오르고, Components 탭 · 팔레트에서 넣는 것이 instance, 「Go to component」 는 page 의 원본으로.

### 생성기 질문 (반복 패턴 #2)

해당 없음 — rule · CSS · 템플릿 변경 0. `LIBRARY_CONTRACT_VERSION` (41) 유지.

## Alternatives Considered

### 대안 A: 지금 모델 유지 + 표시만 — 생성 직후 정의 편집 view 를 열고 원본 루트를 선택한다

- 설명: 문서 무변경. Create component 가 `showDefinition(new)` + 루트 선택까지 한다 — ORIGIN 칩 · Select instances · Detach component 가 바로 보인다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 MEDIUM (사용자 모델 ≠ 참조 모델 — 원본은 여전히 page 에 없고 「그 자리」 에는 instance 가 선다; 「Go to component」 가 page 를 떠난다) / 마이그레이션 LOW.
- 사용자 답 (2026-10-14): **기각** — 「가벼운 대안」 을 고르지 않고 「ADR 먼저」.

### 대안 B: 원본이 page 에 남고 정의는 참조한다 — 「정의 → template 루트」 edge 를 소유에서 참조로 (pen.dev 모델)

- 설명: `createComponent` 가 노드를 **옮기지 않는다** — 정의만 만들어 `templateRootId = node.id` 로 가리키고, 노드는 page 부모의 자식으로 남는다 (`selectAfter: [node.id]`). 정의가 `templateRootId` 를 소유하는지는 정의의 필드 하나 (`originOnPage: true` — 아래 Decision) 가 정한다: 없으면 지금처럼 소유 (옛 문서 · layout · 「숨은 template」), 있으면 참조 (`ownedChildren` 에서 빠지고 `ref` edge 로 색인 → 역색인 「template 루트 → 정의」). instance 는 지금처럼 id 로 template 을 읽는다 (현재 4). 원본 편집의 전파는 역색인으로 (현재 5 보강). 정의 순환은 지금 걷기 그대로 (현재 7). 원본 삭제 · 복제 · 이동 · page 삭제는 아래 사용자 결정.
- 근거: pen.dev 그대로 (요소 자체가 원본, D1 요소 추가 0). Figma 의 「main component 는 캔버스에 남는다 · 지우면 instance 는 남는다 · Restore」 와도 맞는다. resolver · override 주소 · 검증의 대부분이 소유자를 보지 않아 바뀌는 곳이 적다 (Phase 0 inventory: `kind === "definition"` 판정 53 파일 중 소유 사슬을 타는 곳만).
- 위험: 기술 **HIGH** (소유 불변식과 전파 경로 — `graph.ts` 소유 검증 · 역색인 · `compositionRoot` 영향 root 산정 · `componentConfirm` 의 「정의 view 안」 판정 · `topLevel` · `locate` 같은 소유 사슬 보행이 정의를 만나는 가정) / 성능 LOW (역색인 Map 하나 · 원본 편집 시 instance 재해석은 지금과 같은 수) / 유지보수 MEDIUM (정의의 두 모양 — 소유 template 과 참조 원본 — 이 공존, 소비자가 둘 다 읽어야 한다) / 마이그레이션 LOW (옛 문서 = 소유 모양 그대로, 전환 0).

### 대안 C: Figma 모양 — 원본을 `Component` 감싸기 노드 (type 신설) 에 넣어 page 에 둔다

- 설명: 선택 노드를 새 type `Component` 의 frame 으로 감싸고 (Figma 의 special component frame) 정의가 그 frame 을 가리킨다. 감싸기 노드가 ORIGIN 표식 · 이름 · Select instances 를 가진다.
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** (type 하나 신설 — binding · rule · 팔레트 · Layers · nesting 전부; Preview 에 D1 요소 하나가 더 생긴다 (Figma 는 디자인 도구라 DOM 이 없다) — 빌더 = RAC 수준 조립 원칙 (2026-10-07) 과 어긋난다; 원본을 감싼 frame 과 instance 루트의 상자가 달라 D3 대칭 비교가 한 겹 어긋난다) / 마이그레이션 LOW.

### 대안 D: 원본을 자동 생성 「Components」 page 로 옮기고 그 page 에서 ORIGIN

- 설명: Figma 사용자의 흔한 수작업 (컴포넌트 page) 을 자동화 — Create component 가 전용 page 에 원본을 옮기고 그 자리엔 instance. 정의는 그 page 의 노드를 참조 (B 와 같은 edge 변경이 필요).
- 위험: 기술 **HIGH** (B 의 모델 변경이 그대로 필요한데 「그 자리」 요구도 못 지킨다) / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 LOW. 사용자 요구 (「그 자리에서 ORIGIN」) 와 어긋난다.

### Risk Threshold Check

| 대안 | HIGH+                            | 판정                                                         |
| ---- | -------------------------------- | ------------------------------------------------------------ |
| A    | 없음                             | 기각 — 사용자 답 (참조 모델 아님)                            |
| B    | 기술 HIGH                        | **채택** — HIGH 는 소유 불변식 하나로 모이고 G1 · G2 가 잰다 |
| C    | 유지보수 HIGH                    | 기각 — D1 요소 추가 · type 신설                              |
| D    | 기술 HIGH (B 포함) + 요구 불일치 | 기각                                                         |

루프 1회: B 의 기술 HIGH 를 피하는 새 대안은 A (모델 무변경) 뿐이고 사용자가 기각했다. B 의 HIGH 는 「소유 edge 종류 하나」 로 범위가 좁고, 기존 무작위 명령 하니스 · 검증기가 그대로 집행한다 — 수용 (아래 Risks · Gates).

## Decision

**대안 B 채택** — 사용자 컴포넌트의 원본은 page 의 노드로 남고, 정의는 그 노드를 **참조** 한다.

1. **정의의 두 모양** — `DefinitionEntry` 에 선택 필드 `originOnPage?: true` 를 더한다.
   - 없음 (지금 모든 문서 · layout · 아래 「숨은 template」): 정의가 `templateRootId` 를 **소유** 한다 — 지금과 같다. 정의 편집 view 로 연다.
   - `true`: 정의는 `templateRootId` 를 **참조** 한다 — 그 노드는 page 쪽 부모가 소유하는 보통 노드다. `ownedChildren(definition)` 에서 빠지고 `referencedIds` 로 색인되며, 그래프가 역색인 「template 루트 → 정의」 를 가진다 (`definitionOfTemplateRoot`). 정의 편집 view 는 열지 않는다 — 「Go to component」 = 원본이 있는 page 로 가서 원본을 선택 (Components page 의 기본 원본과 같은 길, `showDefinition` 의 library 분기와 대칭).
   - 검증: `originOnPage` 정의의 `templateRootId` 는 **page 사슬 아래의 노드** 여야 한다 (소유 사슬의 top 이 page — 다른 정의의 template 안도 허용: 중첩 컴포넌트, pen.dev · Figma 와 같다). 정의 순환은 지금 걷기 (`DEFINITION_CYCLE`) 가 그대로 막는다 — 원본 서브트리 안에 자기 instance 를 넣는 명령은 거부. `topLevel` · `locate` 등 소유 사슬 보행은 바뀌지 않는다 (참조 edge 는 사슬이 아니다).
2. **`createComponent`** — 노드를 옮기지 않는다. 정의 (`originOnPage: true`, `templateRootId = node.id`) 를 만들고 `project.definitionIds` 에 더한다. `selectAfter: [node.id]`. 노드의 `fillSlot` · 자식 · placement 는 손대지 않으므로 현재 8 의 결함 범위에서 벗어난다 (소유 모양의 `createComponent` 경로는 남지 않는다 — layout 은 `createLayout` 별도).
3. **표식 · 패널** — `catalogComponentRole` / `catalogComponentState`: `originOnPage` 정의의 `templateRootId` 노드 = ORIGIN (page 위에서, 정의 view 없이). 그 서브트리 안의 노드는 보통 노드 (원본의 부품). Component 절 ORIGIN = 이름 · Select instances (◇ N) · **Detach component** (2026-10-14 반영: 해체는 원본에서만); INSTANCE = Go to component · Detach instance · Create component. Canvas 크롬 · Layers 점은 같은 판정을 쓴다 (pen.dev 색 규약 유지).
4. **원본 편집** — `originOnPage` 원본 서브트리 안의 편집은 instance 전부에 흐른다 (역색인으로 영향 instance 를 재해석 · 재검증). 첫 편집 확인 대화상자 (`watchCatalogComponentEdits`) 는 「정의 view 안」 대신 「원본 서브트리 안」 을 본다 — instance N 개 영향.
5. **해체 (Detach component)** — instance 전부 detach, 정의 삭제, **원본 노드는 그 자리에 보통 노드로 남는다** (지금은 template 서브트리를 지웠다 — 원본이 page 에 있으니 지우면 사용자 작업이 사라진다). 「Create component ↔ Detach component」 가 같은 노드에서 왕복한다 (pen.dev ⌘⌥K 토글과 같다).
6. **원본 삭제** (`removeTargets` 가 원본 또는 그 조상을 지울 때, page 삭제 포함) — Figma 대로 **instance 는 남는다** (사용자 결정 1, 2026-10-14): 정의가 `originOnPage` 를 벗고 서브트리의 소유를 넘겨받아 「숨은 template」 (소유 모양) 이 된다. instance 의 Component 절에 「Restore origin」 이 나와 원본을 page 로 되돌린다 — **그 instance 옆** (같은 부모의 다음 index, 절대 배치면 10 px 띄움; 사용자 결정 4 — Figma 방식). 정의는 삭제 전 자리를 기억하지 않는다. undo 는 한 step.
7. **detach instance** · **instance 넣기** (Components 탭 · 팔레트 · AI) · override · slot 채움 — 무변경 (template 을 id 로 읽는 경로 그대로).
8. **복제 · 복사 · 이동** — 원본 노드의 이동 (같은 page 안 · 다른 page 로) 은 참조가 따라간다 (id 불변). 복제 (⌘D) · 복사-붙여넣기 (다른 page · 다른 탭 포함) 에서 **원본 루트의 사본은 그 정의의 instance** 가 된다 (사용자 결정 2 — pen.dev 「copy the component origin on the canvas to create an instance」; `cloneNodeSubgraph` 가 `originOnPage` 루트를 만나면 서브트리 대신 instance 노드 하나를 낸다 — 복사한 frame 안에 든 원본도 같다). 다른 프로젝트로의 붙여넣기 (정의가 없는 곳) 는 보통 사본.
9. **중첩 원본** (사용자 결정 5 — pen.dev 방식) — 원본 서브트리 안에 다른 정의의 원본을 둘 수 있다 (instance 도). 안쪽 원본 노드의 역할은 자기 정의의 ORIGIN 뿐 — Canvas · Layers · Component 절 모두 노드 하나 기준으로 판정한다 (R6 의 답). 바깥 원본의 instance 는 안쪽 원본을 **template 자리** 로 투영한다 (지금 instance 안 instance 와 같다 — 그 자리를 고르면 INSTANCE 표시만, detach · ID 없음).
10. **layout** 은 소유 모양 그대로 (`createLayout` · `applyLayout` · `deleteLayout` 무변경) — page body 가 instance 가 되는 모델은 이 ADR 밖.

기각 사유 — A: 참조 모델이 아니다 (사용자 답). C: D1 요소 추가 · type 신설 — RAC 수준 조립 원칙 위반. D: 「그 자리」 요구 불일치에 B 의 모델 변경까지 든다.

위험 수용 근거: B 의 HIGH 는 소유 edge 의 종류 하나에 모인다. 기존 검증기 (`DUPLICATE_OWNERSHIP` · `UNOWNED_NODE` · `OWNERSHIP_CYCLE` · `DEFINITION_CYCLE`) 와 무작위 명령 하니스가 그대로 돌고, 참조 모양의 정의는 새 필드로만 생기므로 옛 문서는 한 줄도 바뀌지 않는다.

> 구현 상세: [260-component-origin-in-place-breakdown.md](design/260-component-origin-in-place-breakdown.md)

### 사용자 결정 N건 (execute-adr 가 닿을 때 묻는다)

1. ~~원본 삭제~~ — **답 (2026-10-14): (a)** Figma 대로 instance 유지 + 숨은 template + 「Restore origin」 (Decision 6).
2. ~~원본 복제 · 복사-붙여넣기~~ — **답 (2026-10-14): (a)** pen.dev 대로 instance (Decision 8).
3. ~~Components 탭의 사용자 컴포넌트 클릭~~ — **답 (2026-10-14): (a)** 원본이 있는 page 로 가서 원본 선택. 정의 편집 view 는 layout · 숨은 template 전용으로 남는다 (R4 해소 방향).
4. ~~Restore origin 의 자리~~ — **답 (2026-10-14): Figma 방식** — 복원을 요청한 instance 옆 (Decision 6). Phase 0 에서 Figma 실물 자리 확인.
5. ~~원본 안의 원본~~ — **답 (2026-10-14): pen.dev 방식** — 허용, 안쪽 원본은 자기 정의의 ORIGIN 으로만 (Decision 9).

(5건 모두 답했다 — execute-adr 가 새로 물을 항목 없음. Phase 0 oracle 대조에서 Figma 실동작이 위 기록과 다르면 그때 1회 보고.)

## Risks

| ID  | 위험                                                                                                                                                                                    | 심각도 | 대응                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 소유 불변식 — 참조 모양의 정의가 소유 edge 를 내지 않게 하는 분기가 한 곳이라도 빠지면 `DUPLICATE_OWNERSHIP` 로 모든 Create component 가 거부되거나, 반대로 원본 삭제 뒤 `UNOWNED_NODE` |  HIGH  | G1 — `graph.ts` `ownedChildren` · `edgesOf` · 소유 검증 · `clone.ts` · `transaction.ts` `ownedChildIds` 전수 + 무작위 명령 500 단계 하니스에 Create · 해체 · 원본 삭제 · 복제 · 이동을 더해 통과 |
| R2  | 원본 편집의 전파 누락 — 소유 사슬로 정의를 찾던 곳 (`graph.ts:600-608` 재검증 · `compositionRoot` 영향 root · `componentConfirm`) 이 참조 모양을 못 보면 instance 가 옛 모양으로 남는다 |  HIGH  | G2 — 원본의 prop · style · 구조 (자식 추가 · slot 채움) 편집 뒤 instance 전부 재해석 (unit · 원복 RED) + live                                                                                    |
| R3  | 정의의 두 모양 공존 — 소비자가 한 모양만 읽으면 옛 문서 (소유 template) 또는 새 문서 (참조 원본) 한쪽이 깨진다                                                                          |  MED   | Phase 0 inventory 가 `templateRootId` · `kind === "definition"` 읽는 곳 (34 · 53 파일) 을 두 모양으로 분류, 테스트는 두 모양을 모두 돈다 (fixture 문서 + 새 문서)                                |
| R4  | 정의 편집 view 의 역할 축소 — 참조 원본은 view 를 쓰지 않는데 Components 탭 · 팔레트 · Layers 가 view 를 전제한 경로를 가진다                                                           |  MED   | 사용자 결정 3 뒤 Phase 3 에서 진입점을 정리, view 는 layout · 숨은 template 전용으로 남긴다                                                                                                      |
| R5  | 원본 삭제 · 복제의 동작이 pen.dev 와 Figma 에서 다르다 (복제 = instance vs 새 컴포넌트) | LOW | 2026-10-14 사용자 결정 1 (Figma — 삭제) · 2 (pen.dev — 복제) 로 고정, Decision 6 · 8 |
| R6  | `catalogComponentRole` 이 page 위 원본을 ORIGIN 으로 내면서 그 서브트리의 instance 판정 (ToggleButton 행 등) 과 섞인다 — 안쪽 노드가 바깥 원본의 부품인지 자기 instance 인지 | LOW | 역할 판정은 노드 하나 기준 (정의의 `templateRootId` 와 같을 때만 ORIGIN) — 사용자 결정 5 (pen.dev 방식) 로 고정, Decision 9 |
| R7  | 옛 문서 전환 금지 — 소유 모양 정의의 instance 에 「Restore origin」 이 보이면 옛 문서의 모든 사용자 컴포넌트가 「삭제된 원본」 처럼 보인다 | MED | Restore 는 **참조 모양이었다가 원본이 삭제된 정의** 에만 — 정의에 `originOnPage: false` 류 표식 하나 (삭제로 벗은 정의 ≠ 처음부터 소유 모양). 옛 문서의 소유 template 은 지금처럼 정의 편집 view 로 연다 |

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 실패 시 대안                                                                   |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| G0   | Phase 0 종료        | inventory — `templateRootId` 읽는 34 파일 · `kind === "definition"` 판정 53 파일을 「소유 사슬을 탄다 / id 로 읽는다」 로 분류한 표 · 저장소 fixture 와 로컬 프로젝트의 `project:definition:` 컴포넌트 수 · pen.dev · Figma 동작 대조표 (만들기 · 편집 전파 · detach · 해체 · 삭제 · 복제 · 이동 · 중첩) 가 breakdown 에 있다                                                                                                                                                         | 분류가 끝나지 않은 파일이 있으면 Phase 1 진입 금지                             |
| G1   | Phase 1 종료        | 참조 모양 정의로 소유 검증 4종 (`DUPLICATE_OWNERSHIP` · `UNOWNED_NODE` · `OWNERSHIP_CYCLE` · `DEFINITION_CYCLE`) 이 바른 경우를 통과하고 그른 경우를 거부한다 (unit) · 무작위 명령 하니스 (4b G2 형식) 에 Create · 해체 · 원본 삭제 · 복제 · 이동 · 자기 instance 넣기를 더해 500 단계 전체 검증기 대조 · 전체 undo 통과 · 옛 fixture 문서 로드 · 재저장 바이트 동일                                                                                                                  | 불변식 위반 1건이면 Phase 2 진입 금지 — 모델을 고친다 (명령 쪽 우회 금지)      |
| G2   | Phase 2 종료        | 원본의 prop · visual · 구조 편집 (자식 추가 · slot 채움 · 행 삭제) 뒤 instance 전부의 resolved 가 따라온다 (unit · 역색인 원복 RED) · Create → 같은 노드 ORIGIN · 해체 → 원본은 보통 노드로 남고 instance 는 detach (RED) · 원본 삭제 → instance 유지 + 숨은 template + Restore 로 instance 옆 복귀 (결정 1 · 4) · 원본 안 원본 = 자기 ORIGIN, 바깥 instance 에서는 template 자리 (결정 5) · 원본 ⌘D · 붙여넣기 → instance (결정 2, 복사한 frame 안의 원본 포함) · 각 명령 undo 한 step                                                                                                                                                                      | 전파 누락 1건이면 Phase 3 진입 금지                                            |
| G3   | Phase 3 종료 (live) | headed Playwright (`apps/builder/scripts/`, 저장된 인증 세션) — Button · ToggleButtonGroup · Card 각각: Create 뒤 Design 패널 = ORIGIN 칩 · Select instances · Detach component (Detach instance 0) · Components 탭에 이름 · 탭 클릭 = page 의 원본 선택 (결정 3) · 팔레트에서 넣은 것 = INSTANCE (detach 하나) · 원본 ⌘D = INSTANCE · 원본 글자 편집 → instance 글자 변경 · Go to component = page 의 원본 선택 · 해체 뒤 원본 그대로 · 새로고침 뒤 동일 · page error 0 · ToggleButtonGroup 의 항목 (`fillSlot`) 이 생성 뒤에도 그대로 (현재 8 해소) | 실패 항목 수리 후 재실행, HIGH 0 이면 실행자가 닫힘 선언 (review-loop-closure) |
| G4   | push 전             | `pnpm gate:perf-ratchet` A 등급 초과 0 · initial 번들 상한 안 · type-check · shared · builder 스위트 전체 통과 (기존 실패 `resolveContainerStylesFallback` 제외)                                                                                                                                                                                                                                                                                                                      | 초과 항목 원인 수리 또는 사용자 판정                                           |
| G5   | Implemented 승격 전 | 사용자가 Builder 에서 Create component → ORIGIN 확인 (「확인했어」) · CHANGELOG · `state-management.md` (정의의 두 모양 · 역색인) · 메모리 `project-origin-instance-slot-reference-pen-figma` 갱신                                                                                                                                                                                                                                                                                    | 확인 전 Accepted 유지                                                          |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- Create component 의 결과가 pen.dev · Figma 와 같다 — 만든 노드가 그 자리에서 ORIGIN, Design 패널 Component 절에 바로 표시된다 (사용자 보고 해소).
- 원본 편집이 page 위에서 일어난다 — 정의 편집 view 를 열지 않고 문맥 (주변 레이아웃 · 데이터) 안에서 고친다.
- 해체가 원본을 지우지 않는다 — Create ↔ Detach component 왕복.
- `createComponent` 가 노드를 옮기지 않아 `fillSlot` 유실 결함 (현재 8) 이 범위에서 사라진다.

### Negative

- 정의의 모양이 둘 (소유 template · 참조 원본) — 소비자가 둘 다 읽어야 하고 (R3), layout · 옛 문서 · 삭제된 원본은 계속 소유 모양이다.
- 원본이 page 의 보통 노드라 실수로 지우거나 옮기기 쉽다 — 삭제 시 instance 유지 + Restore (사용자 결정 1) 로 막는다.
- 2026-09-30 판정 ② 를 뒤집는다 — ADR-248 breakdown 에 뒤집은 기록을 남긴다 (사유: 소유 모델 제약을 이 ADR 이 푼다).
- Phase 0 inventory 에 34 + 53 파일 분류가 든다 (추정 — 실측이 1.5 배를 넘으면 사후 보고).
