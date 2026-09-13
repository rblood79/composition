## Runtime SSOT — Canonical Document (ADR-116 + ADR-122 Implemented)

ADR-111 (frame schema) / ADR-112 (editing semantics) / ADR-113 (tag→type rename) 반영 후, ADR-116 이 `CompositionDocument` 를 storage SSOT 로 전환했고 (Implemented 2026-05-02), ADR-118/119/120/121 이 legacy mirror persistence 를 제거했으며, ADR-122 가 runtime mirror 제거를 완결했다 (Implemented 2026-05-09). 잔존 mirror helper는 `frameMirror` 등 runtime에 필요한 격리 경계만 허용한다. 프로젝트 JSON 가져오기/내보내기는 canonical document를 직접 사용하며 legacy `Element[]` 역변환 경계는 2026-09-03 제거됐다 — 상세: [docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md](../../../../docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md).

### 9 ADR 체인 도착지점

**"Pencil 호환 Canonical Document 가 단일 SSOT 로 Builder runtime 전체를 구동, legacy `Element[]` / `order_num` / hybrid mirror 는 cloud / export/import boundary 로만 격리"**

### Runtime layer 규칙 (ADR-122 Implemented — 현행 상태)

| Layer                | 현행                                                                  | 금지                                                        |
| -------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Mutation             | canonical document patch primary                                      | legacy `Element[]` reverse projection write-back            |
| Store read           | canonical selectors / canonical node lookup / resolved canonical tree | mutable `elementsMap`/`childrenMap` authoritative read      |
| Skia                 | canonical scene snapshot 또는 resolved canonical tree input           | render 직전 `canonicalDocumentToElements()` full projection |
| Preview              | `UPDATE_CANONICAL_DOCUMENT` active channel                            | `UPDATE_ELEMENTS` 의존                                      |
| LayerTree/Properties | canonical node/path/alias view model                                  | legacy `Element` shape 를 primary read model                |
| Boundary             | canonical JSON import/export + 필요한 compat adapter                  | canonical document를 legacy `Element[]`로 역변환            |

**핵심 불변식 4건** (2026-08-18 `.agents` 사본에서 이관 — 심링크 단일화 시 유일 실질 고유분):

1. **ref/layout_id 직접 read 금지**: Builder runtime/history helper 에서 `RefNode.descendants` / legacy `layout_id` 직접 읽기 금지. ref override traversal 은 `canonicalElementsView` helper boundary, frame ownership lookup 은 `frameMirror` boundary 로 격리.
2. **History full-snapshot prune**: History/Undo 가 full snapshot 으로 canonical document 를 동기화할 때 omitted runtime node 를 `db.documents` 에 남기지 않는다. page/layout shell 과 structural `body` 는 보존하되, incoming snapshot 에 없는 legacy-exportable runtime node 는 full-replace 과정에서 prune.
3. **page-shell bridge 보존**: page-shell bridge 는 새 page/body shell append 를 보존해야 하며, page/origin 삭제 후 stale canonical-derived snapshot 으로 deleted node 를 되살리면 안 된다 (`stores/history/historyActions.ts` page shell bridge 경로).
4. **Preview/Compare Mode 렌더 기준**: Preview/Compare Mode active channel 은 canonical `CompositionDocument` presence 기준으로 렌더. Compare Mode 의 렌더 분기가 canonical sync 를 막거나, Preview 가 legacy `elements[]` length 0 만 보고 빈 화면을 렌더하면 안 된다 (`workspace/Workspace.tsx` Compare Mode).

### Pencil terminology — 단일 표준 (ADR-111)

| 명칭          | 의미                                                  | 위치                                                                 |
| ------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `frame`       | `type: "frame"` 노드 (컨테이너 + 재사용 단위)         | `packages/shared/src/types/composition-document.types.ts::FrameNode` |
| `ref`         | `type: "ref"` 인스턴스 노드                           | 동일::RefNode                                                        |
| `reusable`    | `true` 면 재사용 원본                                 | 동일::CanonicalNode                                                  |
| `slot`        | `false \| string[]` — 추천 reusable component ID 배열 | 동일::FrameNode.slot                                                 |
| `descendants` | override 맵 (3-mode: patch / replacement / children)  | 동일::RefNode.descendants                                            |
| `clip`        | overflow:hidden 매핑                                  | 동일::FrameNode.clip                                                 |

### Composition extension — 직교 layer

Pencil schema 에 없는 Composition 고유 영역 (`x-composition.events` / `actions` / `dataBinding` / `editor`) 은 canonical core 와 직교. ADR-116 §Decision 명시: "Pencil primitive schema 그대로 채택하지 않아야 React Aria/Spectrum + Spec component model 보존".

#### Selection Consumer Contract (ADR-137)

- Page-bound mutation은 deferred inspector selection/display data에서 pageId를
  캡처하지 않는다.
- Selection 경로는 commit 시점 `readImmediateSelectionSnapshot()`으로 만든
  `ImmediateSelectionSnapshot`과 `apply*FromSelection(snapshot, ...)` 진입점을
  사용한다.
- Projection body / frame editing context처럼 명시 page context가 정당한 경로만
  `apply*Explicit({ pageId, contextReason, ... })`를 사용한다.
- Deferred `element.page_id`와 live `currentPageId`가 mismatch인 stale window에서는
  page-bound controls를 hide/disable한다.
