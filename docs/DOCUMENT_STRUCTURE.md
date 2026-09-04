# docs 디렉토리 구조 가이드

> **최종 업데이트**: 2026-09-03

이 문서는 `docs/` 디렉토리의 구조와 각 하위 디렉토리의 목적을 설명합니다.

---

## 📁 디렉토리 구조

```
docs/
├── adr/                    # Architecture Decision Records
│   ├── completed/          # 완료된 ADR (221개)
│   ├── design/              # ADR 상세 구현 breakdown (SSOT: docs/adr/design/)
│   │   ├── completed/      # 완료된 ADR의 breakdown
│   │   └── *-breakdown.md   # 진행 중 ADR의 breakdown
│   └── *.md                # 진행 중/미구현 ADR (14개, README 제외)
│
├── features/               # 기능별 상세 문서
│   └── completed/          # 완료된 기능 문서 (20개, README 제외)
│
├── reference/              # 참조 문서
│   ├── api/                # API 문서
│   ├── components/         # 컴포넌트 참조 문서 (진행 중/계획)
│   ├── schemas/            # DB 스키마
│   └── status/             # 상태별 문서
│       ├── COMPLETED.md    # 완료 기능 요약 (인덱스)
│       ├── PLANNED.md      # 계획 중 기능 상세
│       └── UNIMPLEMENTED.md # 미구현 기능 개요
│
├── explanation/            # 설명 및 분석 문서
│   ├── architecture/       # 아키텍처 설명
│   └── research/           # 리서치 문서
│
├── how-to/                 # 실용 가이드
│   ├── development/        # 개발 가이드
│   ├── migration/          # 마이그레이션 가이드
│   └── troubleshooting/    # 문제 해결
│
├── legacy/                 # 역사적 참조를 위한 레거시 문서
│
├── CHANGELOG.md            # 변경 이력 (2026년~)
├── CHANGELOG-2025-archived.md  # 2025년 이전 변경 이력
├── COMPONENT_SPEC.md       # 컴포넌트 스펙 참조
├── CSS_SUPPORT_MATRIX.md   # CSS 지원 매트릭스
├── COLOR_PICKER.md         # Color Picker 설계
└── README.md               # 문서 메인 인덱스
```

---

## 📚 문서 타입별 가이드

### ADR (Architecture Decision Records)

**위치**: `docs/adr/`

- **`adr/completed/`**: 구현 완료된 ADR (절대 수정 금지)
- **`adr/*.md`**: 진행 중 또는 계획 중인 ADR
- **참조**: `adr/README.md` - 전체 ADR 현황 및 인덱스

### 기능 문서

**완료된 기능**:

- **위치**: `docs/features/completed/`
- **내용**: 구현 완료된 주요 기능의 상세 설계 및 구현 문서
- **인덱스**: `features/completed/README.md`
- **요약**: `reference/status/COMPLETED.md`

**계획 중 기능**:

- **상세 계획**: `reference/status/PLANNED.md`
- **개요**: `reference/status/UNIMPLEMENTED.md`

### Breakdown 문서

**위치**: `docs/adr/design/`

- **`adr/design/completed/`**: 완료된 ADR의 상세 구현 breakdown
- **`adr/design/*-breakdown.md`**: 진행 중 ADR의 breakdown

### 참조 문서

**위치**: `docs/reference/`

- **`components/`**: 개별 컴포넌트/기능 참조 문서 (진행 중/계획)
- **`schemas/`**: 데이터베이스 스키마 문서
- **`api/`**: API 엔드포인트 문서
- **`status/`**: 구현 상태별 문서

### 설명 문서

**위치**: `docs/explanation/`

- **`architecture/`**: 아키텍처 설명 및 설계 결정
- **`research/`**: 기술 리서치 및 비교 분석

### 실용 가이드

**위치**: `docs/how-to/`

- **`development/`**: 개발 관련 가이드
- **`migration/`**: 마이그레이션 가이드
- **`troubleshooting/`**: 문제 해결 가이드

---

## 🔄 문서 라이프사이클

### 1. 계획 단계

```
reference/status/PLANNED.md (상세 계획)
reference/status/UNIMPLEMENTED.md (개요)
```

### 2. 구현 중

```
adr/*.md (ADR 작성)
adr/design/*-breakdown.md (구현 상세)
reference/components/*.md (참조 문서)
```

### 3. 완료 후

```
adr/*.md → adr/completed/ (이동)
adr/design/*-breakdown.md → adr/design/completed/ (이동)
reference/components/*.md → features/completed/ (이동)
reference/status/COMPLETED.md (요약 업데이트)
```

---

## 📝 문서 작성 원칙

### DO

- ✅ 완료된 문서는 `completed/` 디렉토리로 이동
- ✅ ADR과 breakdown은 항상 쌍으로 관리
- ✅ 상태 변경 시 인덱스 문서 업데이트 (README.md, COMPLETED.md 등)
- ✅ 문서 간 상호 참조는 상대 경로 사용

### DON'T

- ❌ **ADR 디렉토리 수정 금지** (읽기 전용)
- ❌ 중복 내용 작성 (기존 문서 참조 링크 사용)
- ❌ 레거시 문서 재사용 (`legacy/` 디렉토리는 삭제 예정)

---

## 🔍 문서 찾기

### 특정 기능 찾기

1. **완료된 기능**: `features/completed/README.md` 또는 `reference/status/COMPLETED.md`
2. **계획 중 기능**: `reference/status/PLANNED.md`
3. **미구현 기능**: `reference/status/UNIMPLEMENTED.md`

### ADR 찾기

1. **전체 ADR 목록**: `adr/README.md`
2. **완료된 ADR**: `adr/completed/` (57개)
3. **진행 중 ADR**: `adr/*.md` (21개)

### 구현 상세 찾기

1. **ADR 관련**: `adr/design/*-breakdown.md` 또는 `adr/design/completed/`
2. **컴포넌트 관련**: `reference/components/*.md`

---

## 📊 문서 통계 (2026-04-17 기준)

| 카테고리             | 개수  | 위치                    |
| -------------------- | ----- | ----------------------- |
| ADR (완료)           | 57개  | `adr/completed/`        |
| ADR (진행 중/미구현) | 21개  | `adr/*.md`              |
| Breakdown (완료)     | 10개  | `adr/design/completed/` |
| Breakdown (진행 중)  | 20+개 | `adr/design/*.md`       |
| 완료 기능 문서       | 12개  | `features/completed/`   |
| 참조 문서            | 15+개 | `reference/components/` |
| 리서치 문서          | 10개  | `explanation/research/` |
| 가이드 문서          | 11개  | `how-to/`               |

---

## 🔗 주요 인덱스 문서

- [`adr/README.md`](adr/README.md) - ADR 전체 현황
- [`features/completed/README.md`](features/completed/README.md) - 완료 기능 목록
- [`reference/status/COMPLETED.md`](reference/status/COMPLETED.md) - 완료 기능 요약
- [`reference/status/PLANNED.md`](reference/status/PLANNED.md) - 계획 중 기능
- [`reference/status/UNIMPLEMENTED.md`](reference/status/UNIMPLEMENTED.md) - 미구현 기능
- [`README.md`](README.md) - 문서 메인 인덱스

---

**문서 구조 질문이나 제안사항**은 프로젝트 메인테이너에게 문의하세요.
