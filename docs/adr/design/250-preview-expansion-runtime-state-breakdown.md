# ADR-250 breakdown — Preview 의 펼침 조작을 Preview 실행 상태로

> 본문: [ADR-250](../250-preview-expansion-runtime-state.md). 대안 B 기준 (2026-10-03 사용자 판정). §5 는 기각된 대안 A 의 참고 기록.

## 1. 분리 점검 (fork 4 질문)

1. **base / 응용**: ADR-248 (catalog 문서 · Preview 복제본 · 쓰기 경계) 이 base, ADR-250 (Preview 상호작용의 문서 반영 정책) 이 응용. 250 → 248 의존.
2. **schema 직교성**: 새 스키마 0. `isExpanded` · `expandedKeys` 는 ADR-248 문서에 이미 있는 필드 — 250 은 그 필드를 누가 쓰는지만 정한다.
3. **선행 전제 검증**: ADR-248 의 「Preview 는 읽기 전용 복제본」 은 대안 B 에서 그대로 유지, 대안 A 에서만 좁게 깨진다. 248 의 다른 전제는 승계하지 않는다.
4. **분리 confirm**: 사용자 「별도로 열어」 (2026-10-03).

## 2. Phase 0 — 현재 동작 고정 (G0)

- `catalogPreviewSession.test.tsx` 에 RED 기록 2건:
  - Tree: `expandedKeys: []` 인 Tree 에서 chevron 클릭 → 자식 TreeItem 이 나타나지 않음.
  - Disclosure: Preview 에서 머리글 클릭 → Builder graph 변경 0 (이건 현재도 GREEN — B 의 불변식으로 유지).
- 확인할 것: RAC `Tree` 가 비제어 (`defaultExpandedKeys`) 일 때 접힌 항목의 자식을 스스로 숨기는가 — 숨긴다면 DOM leg 의 `ownsDescendant` 접힘 판정은 없어도 된다 (설치된 `node_modules/react-aria-components` 소스로 판정, D1).

## 3. Phase 1 — Preview Tree 펼침 · 상태 공유 (G1 · G2)

| 파일                                                                        | 변경                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/catalogRuntime/delegatedDom.tsx`                  | Tree DOM leg: 문서 `expandedKeys` 를 초기값으로, 펼침 상태는 Preview 가 소유 (비제어 + 문서 값이 바뀌면 key 로 다시 마운트 — Disclosure 와 같은 규칙). `ownsDescendant` 의 접힘 판정은 Phase 0 결과에 따라 Preview 상태를 읽거나 제거 |
| `apps/builder/src/preview/catalog/catalogPreviewInteractions.ts`            | 규칙 실행의 `isExpanded` / `expandedKeys` override 와 사용자 클릭이 같은 상태를 보도록 — override 가 있으면 그것이 초기값, 클릭은 override 를 갱신 (R4)                                                                               |
| `apps/builder/src/builder/catalogRuntime/presence.ts`                       | **변경 0** — Canvas 는 문서 선언값 (R3)                                                                                                                                                                                               |
| `apps/builder/src/builder/workspace/canvas/catalog/CatalogPreviewFrame.tsx` | **변경 0** — Builder 메시지 경로 추가 없음                                                                                                                                                                                            |

테스트 (unit, 원복 RED):

- Tree 펼침 · 접힘이 Preview 에서 동작하고 자식 항목이 나타난다.
- Preview 조작 전후 Builder graph 변경 0 · Preview → Builder 메시지 0.
- Properties 로 `isExpanded` / `expandedKeys` 를 바꾸면 Preview 가 그 값으로 돌아간다 (R2).
- 규칙 `expand` 실행 뒤 클릭으로 접으면 접힌다 (같은 상태, R4).
- ADR-248 browser parity 12/12 유지 (Canvas 무변경 확인).

## 4. 완료 (G3)

- 사용자 확인: Compare Mode 에서 Disclosure · Tree 조작 — 모델은 Preview 를 열지 않는다.
- CHANGELOG: 「Preview 에서 Tree 펼침 동작 복원 · Preview 조작은 문서에 남지 않음 (Properties Expanded 로 선언)」.
- README 상태 갱신, `### Live Exercise` 에 사용자 확인 기록.

## 5. 대안 A 로 판정될 경우 (참고)

- 새 메시지 `CATALOG_PROPS { identity, sourceId, props }` (allowlist `isExpanded` · `expandedKeys`) — Preview 는 사용자 클릭 (RAC `onExpandedChange`) 에서만 보낸다. 규칙 실행 override 는 보내지 않는다.
- Builder: `CatalogPreviewFrame` 수신 (`CATALOG_SELECT` 와 같은 origin · source 검사) → `workspace.itemOfRecord(identity)` → `setFields({ targets: [item.target], props })` (label 「Preview 펼침」) → history · 저장 → delta 가 Preview 로 돌아옴.
- 추가 위험: 연속 클릭의 undo 기록 누적 (같은 record 연속 조작 병합 검토) · 인스턴스 안 노드는 descendant override 로 기록됨.

## 6. 실행 기록 (2026-10-03)

**G0 · G1 · G2 PASS** — `apps/builder/src/preview/catalog/__tests__/catalogPreviewExpansion.test.tsx` 5건. 구현 3파일을 HEAD 로 되돌리면 4건 RED (Tree 2 · 규칙 1 · 그룹 1), 복원 후 `cmp` 일치. 단독 Disclosure 1건은 기존 동작 유지 확인용 (원래 통과).

| 무엇                      | 어떻게                                                                                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 실행 값 하나              | `CatalogPreviewInteractions.setRuntimeProps` — 규칙의 capability 와 컴포넌트 자신의 상태 변경 (사용자 펼침) 이 같은 record 실행 prop 을 쓴다. DOM runtime 계약 `CatalogDomRuntime.setRuntimeProps` 로 delegated DOM 에 전달                     |
| 선언값 복귀 (R2)          | 실행 값을 쓸 때 그 prop 의 문서 값을 기억하고, 문서 값이 달라지면 실행 값을 버린다 (`overrideOf`). `style` 은 제외 (계산 style 위에 얹는 별도 채널)                                                                                              |
| Tree                      | `expandedKeys` = 실행 값 ⊕ 선언값 (제어), `onExpandedChange` → 실행 값. 규칙 `expand` 의 문자열 key 를 한 항목 목록으로 읽음 (`treeKeys`)                                                                                                        |
| Disclosure (단독)         | Preview 에서는 제어 (`isExpanded` + `onExpandedChange` → 실행 값) — 다시 마운트하지 않으므로 focus 유지. 정적 렌더는 기존 비제어                                                                                                                  |
| DisclosureGroup           | 자식 Disclosure 의 실행 값 ⊕ 선언값으로 `expandedKeys` 를 제어, 변경은 자식마다 실행 `isExpanded`. 자식의 record · 실행 값이 바뀌면 그룹이 다시 그려진다 (`watchesChildren` — 전에는 자식 선언 변경을 아예 못 따름)                              |
| Canvas · Builder 메시지   | 변경 0 (`presence.ts` · `CatalogPreviewFrame.tsx` 무변경)                                                                                                                                                                                        |

검사: builder unit 4537 pass · ADR-248 browser parity 14/14 · `pnpm type-check` PASS. 남은 것: G3 사용자 확인 (Compare Mode — 모델은 Preview 를 열지 않음).
