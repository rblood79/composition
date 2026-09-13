---
name: fix
description: Composition 버그의 원인을 추적하고 수정·회귀 검증할 때 사용.
argument-hint: [버그 설명]
---

# 버그 수정

재현과 계측으로 실제 원인을 좁히고, 요청 범위의 수정과 회귀 검증까지 완료합니다.
가설과 확인된 사실을 구분합니다. 임시 표시 보정이나 캐시 리셋으로 원인을 숨기지 않습니다.

도메인별 진단 시작점:

- 상태·Undo·페이지 전환: canonical mutation, history 및 selection commit 경계.
  [상태 관리](../../rules/state-management.md)를 참조합니다.
- grid·레이아웃: 컨테이너 등록과 `GRID_REBUILD_TRIGGER_KEYS`, layout invalidation 및
  cache signature를 [레이아웃 규칙](../../rules/layout-engine.md)에 대조합니다.
- Canvas: [렌더링 규칙](../../rules/canvas-rendering.md)의 초기화·캐시·컬링 경계.
- Preview: origin 검증, PREVIEW_READY 버퍼링, canonical 메시지 소비.

검증은 실패 트리거를 고정하는 인접 테스트와 실제 사용자 동작에 맞춥니다.
시각 변경은 `cross-check`, Builder 흐름은 사용 가능한 브라우저로 확인합니다.
같은 원인이 다른 경로에도 있는지 검색하되 무관한 리팩토링으로 확장하지 않습니다.
성능 상한은 해당 ADR의 현재 승인·만료 기록을 사용합니다.
