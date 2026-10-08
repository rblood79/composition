---
title: Input Validation at Boundaries
impact: CRITICAL
impactDescription: 미검증 입력은 잘못된 문서·메시지를 runtime에 반영할 수 있음
tags: [validation, security, boundary]
---

# Catalog 입력 경계

문서 영속 형식은 `CatalogDocument`, runtime 정본은 `CatalogGraph`다 (ADR-248).
옛 canonical 요소를 sanitize해서 새 runtime에 넣는 adapter를 만들지 않는다.

## Preview 메시지

- Builder 수신: `apps/builder/src/builder/workspace/canvas/catalog/CatalogPreviewFrame.tsx`의
  iframe `event.source`와 `event.origin` 검증을 유지한다.
- Preview 수신: `apps/builder/src/preview/catalog/CatalogPreviewApp.tsx`에서
  `event.origin === window.location.origin` 및 `event.source === window.parent`를 확인한 뒤
  `CatalogPreviewSession.receive(event.data)`에 넘긴다. 개발 모드도 검증한다.
- `CATALOG_SNAPSHOT` · `CATALOG_DELTA` 등의 payload 판정은 기존 session/channel 경로를 쓴다.
  `type` 문자열 존재나 TypeScript cast만으로 payload가 유효하다고 간주하지 않는다.
  거부 결과는 기존 오류 보고 경로에 전달한다. 전송에도 정확한 `targetOrigin`을 사용한다.

## 문서 저장·로드

- `packages/shared/src/catalog/document/validation.ts`의 `validateCatalogDocument`가 format,
  schema version, library contract version, entry 형식을 검증한다.
- `document/graph.ts`의 `createCatalogGraph`가 library와 문서의 구조·참조를 검증한다.
- `runtime/storage.ts`의 `CatalogStorage`가 저장 head의 format/version과 revision을 검사하고,
  로드한 문서로 graph를 검증한다. `CatalogAutosave`의 저장 실패를 삼키지 않는다.
- origin template 구조 변경의 버전 갱신·옛 프로젝트 거부는
  [구조 변경 감사](domain-structure-change-audit.md)의 저장 계약을 따른다.
  버전 불일치를 임의 변환·필드 삭제·기본값 fallback으로 통과시키지 않는다.

## 사용자 입력·도메인 명령

- URL의 ID는 문자열 형태뿐 아니라 현재 graph/session에서 대상이 존재하는지도 확인한다.
- 숫자·단위 등 패널 입력은 해당 edit contract에서 검증하고 typed field 명령으로 바꾼다.
  `node.props`나 graph를 직접 수정하지 않는다.
- children·필수 부품·상태 주체 참조는 [RAC 조립 계약](domain-rac-composition.md)과 명령의
  검증 경로를 따른다. `workspace.execute` 실패는 기존 command runner의 거부 UI로 전달한다.
- Zod 등 검증 라이브러리 추가는 경계의 필요에 따라 결정한다. 현재 catalog 검증기를
  우회하거나 같은 스키마를 별도로 복제하지 않는다.

편집·저장 순서와 history 계약은 [상태 관리](../../../rules/state-management.md)가 정본이다.
