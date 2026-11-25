---
name: fix
description: Composition 버그의 원인을 추적하고 수정·회귀 검증할 때 사용.
argument-hint: [버그 설명]
---

# 버그 수정

재현과 계측으로 실제 원인을 좁히고, 요청 범위의 수정과 회귀 검증까지 완료합니다.
가설과 확인된 사실을 구분합니다. 임시 표시 보정이나 캐시 리셋으로 원인을 숨기지 않습니다.
착수 영역에 메모리 「착수 전 필독 (함정)」 항목이 있으면 그 함정이 재현되는 입력으로 먼저 지나갑니다.

## 코드 수정 전 — 가설 표와 경로 목록

재현한 뒤, 코드를 고치기 전에 아래 두 가지를 응답에 적습니다. 사용자 확인을 기다리지 않습니다 — 가설 판별은 계측으로 합니다 (질문은 CLAUDE.md §전제·관점 의 4개 결정 지점에서만).

1. **원인 가설 표**: 가설마다 「설명하는 증상 · 설명하지 못하는 증상 · 가를 계측 하나」. 가설이 하나뿐이면 반대 방향 가설을 하나 더 세웁니다. 남은 가설이 계측으로 하나가 된 뒤에 고칩니다.
2. **덮을 경로 목록**: 수정이 지나야 할 실행 경로와 경계 입력을 나열합니다 — Canvas (Skia) · Preview · Publish 중 어느 쪽인지, 편집 · Undo/Redo · 페이지 전환 · 새로고침 (저장 뒤 다시 읽기), 시작 offset · 빈 목록 · 터치 기기 크기처럼 값의 경계. 각 경로에 회귀 테스트 또는 live 확인 중 무엇을 둘지 적습니다.

Why: 인사이트 리포트 (2026-08-11 ~ 11-15, 158 세션) 의 마찰 1위가 첫 수정의 결함 (23) · 잘못된 접근 (21) 이었다 — 가상 목록이 시작 offset 을 무시해 행을 과다 렌더, 첫 Canvas 수정이 엔진 layout 입력 경로를 놓침, 글꼴 불일치가 여러 번 방향 전환. 원인 둘을 먼저 확정한 세션 (UI scale 이중 zoom · S2 press 효과) 은 한 번에 닫혔다.

도메인별 진단 시작점:

- 상태·Undo·페이지 전환: 문서를 바꾸는 길은 `CatalogCommand` → `workspace.execute` 하나이고
  history 의도 (`skip` 사유 넷) 와 `NodeEntry.children` 순서가 정본입니다.
  [상태 관리](../../rules/state-management.md)를 참조합니다.
- 레이아웃: `operationAffectsLayout` · `PAINT_ONLY_VISUAL_KEYS` (제외 방식) → `compositionRoot.plan` →
  `styleOf` → `PersistentLayoutTree` 증분 순서를 [레이아웃 규칙](../../rules/layout-engine.md)에 대조합니다.
  상자를 바꾸는 키가 paint-only 목록에 있으면 재계산이 빠집니다.
- Canvas: [렌더링 규칙](../../rules/canvas-rendering.md)의 초기화·캐시·컬링 경계와 owner 값으로
  칠하는 자식의 dirty 확장.
- Preview: `CatalogPreviewFrame` 의 origin 검증과 `PREVIEW_READY` 버퍼링, `CATALOG_DELTA` /
  `CATALOG_SNAPSHOT` 소비 (`packages/shared/src/catalog/preview/protocol.ts`).

검증은 실패 트리거를 고정하는 인접 테스트와 실제 사용자 동작에 맞춥니다. 원복 RED 는
타입별 실제 diff 행으로 기록합니다 (묶음 요약은 판독에서 근거 없음으로 잡힙니다).
시각 변경은 `cross-check`, Builder 흐름은 사용 가능한 브라우저로 확인합니다.
같은 원인이 다른 경로에도 있는지 검색하되 무관한 리팩토링으로 확장하지 않습니다.
성능 상한은 해당 ADR의 현재 승인·만료 기록을 사용합니다.

원인이 도메인 병인 (한 규칙 파일이 다루는 경계의 결함) 이면 그 `.claude/rules/` 파일에 실측
「Why」 한 줄을 남깁니다 — 규칙 파일의 Why 가 병인의 정본입니다. 그 규칙 파일이 크기 상한
(`pnpm docs:rule-size`) 에 닿았으면 Why 는 skill reference 에 쓰고 규칙에는 그것을 가리키는
한 줄만 둡니다. 규칙에 맞지 않는 함정은 메모리에 기록합니다.

메모리에 **같은 기제**의 함정이 이번 기록까지 3건이면 흩어 두지 않고 올립니다 — 해당 규칙 파일이나
skill reference 에 「먼저 확인할 순서」 한 절로 묶고, 메모리 항목들은 그 절을 가리키는 한 줄로 바꿉니다.
묶는 기준은 원인이 아니라 증상 이름입니다 (「한쪽 렌더러에만 값이 안 닿음」 — 「resolver 버그」 아님).
올린 절의 각 행에는 근거를 적습니다: `(3회: <커밋 · 메모리 슬러그>)`, 한 번 본 것은 `(1회, 미검증)`.

사용자-가시 수정은 `docs/CHANGELOG.md` Fixed 엔트리를 같은 커밋 또는
바로 다음 커밋에 둡니다 ([CHANGELOG 규칙](../../rules/changelog.md)).
