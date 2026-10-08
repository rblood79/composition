---
name: fix
description: Composition 버그의 원인을 추적하고 수정·회귀 검증할 때 사용.
argument-hint: [버그 설명]
---

# 버그 수정

재현과 계측으로 실제 원인을 좁히고, 요청 범위의 수정과 회귀 검증까지 완료합니다.
가설과 확인된 사실을 구분합니다. 임시 표시 보정이나 캐시 리셋으로 원인을 숨기지 않습니다.
착수 영역에 메모리 「착수 전 필독 (함정)」 항목이 있으면 그 함정이 재현되는 입력으로 먼저 지나갑니다.

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
「Why」 한 줄을 남깁니다 — 규칙 파일의 Why 가 병인의 정본입니다. 규칙에 맞지 않는 함정은
메모리에 기록합니다. 사용자-가시 수정은 `docs/CHANGELOG.md` Fixed 엔트리를 같은 커밋 또는
바로 다음 커밋에 둡니다 ([CHANGELOG 규칙](../../rules/changelog.md)).
