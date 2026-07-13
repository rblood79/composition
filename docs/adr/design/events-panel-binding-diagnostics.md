# Events Panel Binding Diagnostics Design

## Purpose

이 문서는 `Events Panel`에서 필요한 binding diagnostics 설계를 정의한다.

관련 문서:

- [ADR-032](../completed/032-events-data-integration.md)
- [ADR-034](../completed/034-events-panel-renovation.md)

---

## Problem

이벤트와 데이터가 강하게 연결될수록
깨진 참조를 늦게 발견하는 비용이 커진다.

예:

- 삭제된 DataTable
- 이름이 바뀐 field
- 사라진 variable
- 잘못된 element reference
- recipe가 기대한 schema와 현재 schema 불일치

따라서 diagnostics는 부가 기능이 아니라 핵심 UX다.

---

## Diagnostic Categories

### 1. Data Source Diagnostics

- missing data source
- inaccessible data source
- stale schema

### 2. Field Diagnostics

- missing field
- incompatible field type
- ambiguous replacement candidate

### 3. Variable Diagnostics

- missing variable
- invalid variable type

### 4. Element Diagnostics

- missing target element
- invalid target type

### 5. Logic Diagnostics

- invalid condition
- unsupported effect chain
- inconsistent recipe output

---

## Severity Model

### Error

실행 불가 상태.

예:

- missing field
- missing target element
- invalid condition parse failure

### Warning

실행은 가능하지만 의도와 달라질 수 있는 상태.

예:

- stale recipe
- inferred fallback binding

### Info

사용자에게 알려주면 좋은 상태.

예:

- 추천 가능한 repair action 존재

---

## Diagnostic Item Shape

```ts
interface DiagnosticItem {
  id: string;
  severity: "info" | "warning" | "error";
  type: string;
  title: string;
  message: string;
  handlerId?: string;
  actionId?: string;
  bindingRef?: unknown;
  suggestedFixes?: DiagnosticFix[];
}
```

```ts
interface DiagnosticFix {
  id: string;
  label: string;
  kind: "navigate" | "replace" | "reconnect" | "reapply";
}
```

---

## Detection Timing

진단은 다음 시점에 계산될 수 있다.

1. 패널 진입 시
2. handler 편집 후
3. data schema 변경 후
4. variable 목록 변경 후
5. recipe 적용 직후

원칙:

- blocking issue는 즉시 계산
- 무거운 전체 재스캔은 필요 시 지연 가능

---

## Presentation Rules

### Panel Level

상단 요약에는 다음만 보여준다.

- error count
- warning count
- broken binding 존재 여부

### Diagnostics Section

상세 diagnostics는 리스트로 보여준다.

각 항목은 다음을 포함한다.

- severity badge
- 제목
- 한 줄 설명
- 관련 handler/effect 링크
- fix action 버튼

### Handler List

핸들러 목록에는 full message 대신 상태 배지만 보여준다.

예:

- `Broken`
- `Warning`

---

## Fix UX

diagnostic은 단순 경고가 아니라
"어떻게 고칠지"로 바로 이어져야 한다.

가능한 fix:

- field 다시 선택
- variable 다시 연결
- element target 재선택
- recipe 기준으로 복원
- handler 편집기로 이동

---

## Interaction With Recipe System

recipe-generated handler는 diagnostics와 긴밀히 연결된다.

예:

- recipe가 기대한 field가 사라지면 `stale` 또는 `broken`
- 사용자가 수동 편집해 drift가 생기면 warning
- reapply 가능한 경우 fix action 제공

---

## Open Questions

1. diagnostics를 실시간으로 전부 계산할지 일부 배치로 계산할지
2. auto-fix를 어느 범위까지 허용할지
3. warning과 info를 기본으로 숨길지 여부
