---
title: Error Handling at Consumer Boundaries
impact: CRITICAL
impactDescription: 오류를 숨기면 저장 상태와 화면의 불일치를 발견하거나 복구할 수 없음
tags: [validation, error-handling, react]
---

# 오류 경계와 복구

오류를 잡는 위치와 복구가 소유하는 상태를 구분합니다. 존재하지 않는
`ScopedErrorBoundary`를 import하거나 새 데이터 조회 계층을 복제하지 않습니다.

## 현재 경로

- Builder 열기 실패는 `apps/builder/src/builder/main/CatalogBuilderCore.tsx`의
  `failed` 상태와 `role="alert"` UI로 전달합니다. Canvas scene 오류는 `onError` 경로로 보고합니다.
- Publish 렌더 오류는 `apps/publish/src/PublishErrorBoundary.tsx`가 잡고,
  `apps/publish/src/App.tsx`가 오류와 재시도 UI를 제공합니다.
- 명령 거부는 기존 command runner가 toast로 알립니다. transaction consumer 실패를
  내부에서 삼키지 않아야 runtime의 rollback이 문서와 화면을 함께 복구합니다.
- 비동기 저장·로드 실패는 React Error Boundary가 잡지 않습니다. Promise 오류를 해당
  저장·로드 상태에 연결하고 재시도·취소·프로젝트 전환 경합을 기존 소유 경계에서 처리합니다.

## 변경 시 확인

1. 오류가 어느 명령·렌더·비동기 작업에서 발생하는지 먼저 재현합니다.
2. 기존 오류 보고와 복구 경로를 사용하고 빈 결과나 성공 상태로 바꾸지 않습니다.
3. 재시도가 이전 consumer의 상태를 새 consumer에 적용하지 않는지 확인합니다.
4. 새 렌더 경계가 필요하면 복구 단위·reset 조건과 인접 회귀를 함께 정합니다.

상태·transaction 계약은 [상태 관리](../../../rules/state-management.md)가 정본입니다.
