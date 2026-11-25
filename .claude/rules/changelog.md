---
description: CHANGELOG.md 자동 갱신 규칙 — 커밋/ADR Implemented 시 의무 업데이트
paths:
  - "docs/CHANGELOG.md"
  - "docs/CHANGELOG-*-archived.md"
---

# CHANGELOG 관리 규칙 — 자동 업데이트 의무화

> drift 는 `session-start.sh` 가 매 세션 계산해 14일 또는 100 커밋 초과 시 경고한다. 본 규칙은 trigger 기반 갱신 계약이다.

## 1. 트리거 — 이 중 하나라도 해당하면 **같은 커밋 또는 바로 다음 커밋**에 CHANGELOG 반영

| 트리거                                       | 반영 범위                           | 타이밍                |
| -------------------------------------------- | ----------------------------------- | --------------------- |
| ADR Status `Accepted → Implemented` 승격     | 해당 ADR 전체 요약                  | Implemented 승격 커밋 |
| 사용자-가시 버그 수정 (UI/렌더/입력/저장)    | Fixed 섹션                          | 수정 커밋             |
| 신규 컴포넌트 / 신규 prop / 신규 public API  | Added 섹션                          | 추가 커밋             |
| 3개 이상 파일에 걸친 아키텍처 변경           | Changed 섹션                        | 최종 Phase 커밋       |
| BREAKING CHANGE (props 제거, 토큰명 변경 등) | Breaking Changes 섹션 (최상단 bold) | 변경 커밋             |
| 성능 회귀 수정 (FPS / 번들 / 초기 로드)      | Performance 섹션                    | 측정 반영 커밋        |
| Phase 다단계 작업 완결                       | Changed 또는 Added                  | Phase 최종 커밋       |

**단순 작업 면제** (CHANGELOG 반영 불필요): typo / 주석 수정 / 내부 변수명 리팩터 / 테스트만 추가 / 문서 오타 / `.claude/` hook 설정 튜닝.

## 2. Drift 감시 — 세션 시작 시 자가 점검

세션 시작 후 첫 commit 작업 시 확인한다. 계산은 `session-start.sh` 가 한다 — 본문의 첫 `## [...] - YYYY-MM-DD` 헤더 날짜와 그 뒤 커밋 수를 세어, 넘으면 세션 시작에 경고를 낸다.

- **14일 초과 또는 100 커밋 초과 시**: 먼저 catch-up 엔트리 작성을 제안. 사용자 동의 시 `git log --since` 로 그룹화된 catch-up 섹션 작성 (ADR 번호 / 주제별 bundle)
- Catch-up 엔트리는 `## [Catch-up YYYY-MM-DD ~ YYYY-MM-DD] - YYYY-MM-DD` 헤더 사용, 개별 커밋 나열 금지 — **주제별 bundle** (예: "ADR-315 Table — Phase 3 ~ 7")

## 3. 엔트리 포맷 — Keep a Changelog 1.0.0 기반 composition 확장

### 헤더 규칙

```markdown
## [한글 제목 — 기술 요약] - YYYY-MM-DD
```

- 제목: 한글 주제 + `—` + 영문/기술 요약 (예: `ADR-315 Phase 6 — Table 같은 값 합치기 · 칸 범위 선택 · 복사`)
- 날짜: ISO 8601 (`YYYY-MM-DD`), 커밋 날짜 기준 (author date, not commit date)
- 버전 번호(`v1.2.3`) 사용 금지 — composition 은 SemVer 미적용, 주제 기반 엔트리

### 서브섹션

| 섹션                   | 담는 것                                                |
| ---------------------- | ------------------------------------------------------ |
| `### Breaking Changes` | props 제거 / 토큰명 변경 등 — **있으면 최상단 (고정)** |
| `### Added`            | 신규 기능 / 컴포넌트 / prop / public API               |
| `### Changed`          | 동작·구조 변경, 아키텍처 전환, 판단 기록               |
| `### Removed`          | 제거된 기능 / prop / 파일                              |
| `### Fixed`            | 사용자-가시 버그 수정                                  |
| `### Performance`      | 측정값이 달라지는 변경                                 |
| `### Tests`            | 회귀 테스트 / 게이트 신설                              |
| `### Documentation`    | 문서                                                   |
| `### Infrastructure`   | hook / CI / build                                      |

없는 섹션은 생략. **강제되는 순서는 `Breaking Changes` 최상단 하나뿐**이고, 나머지는 위 순서를 권장한다 — 엔트리마다 무게중심이 다르므로 (버그 중심 엔트리는 `Fixed` 를 먼저 두는 편이 읽기 낫다) 순서를 고정하지 않는다.

**이름의 출처**: CHANGELOG.md 머리말이 선언한 대로 [Keep a Changelog 1.0.0](https://keepachangelog.com/en/1.0.0/) 의 원 규격 이름을 쓴다 (`Added / Changed / Deprecated / Removed / Fixed / Security`). `Performance` / `Tests` / `Documentation` / `Infrastructure` 는 composition 확장이다.

**과거 엔트리는 다시 쓰지 않는다**: 아카이브의 2026-08-25 이전 엔트리는 구 확장 이름 (`Bug Fixes` / `Features` / `Architecture`) 을 쓴다. 그 시점의 규약이었으므로 개명하지 않는다 — CHANGELOG 는 기록이고, 사후 편집은 기록을 왜곡한다. 본문의 엔트리는 모두 위 이름을 쓴다.

### 항목 작성 규칙

- **굵은 제목 + 줄바꿈 + 들여쓴 하위 설명** 구조
- ADR 관련 항목은 **반드시 ADR 번호 + Phase 명시** (예: `문서 contract 75 → 76 (ADR-315 Phase 5 — …)`)
- 위치 정보는 **경로 명시** (예: `위치: catalogRuntime/layerTree.ts`)
- 근본 원인 있는 버그는 **"Why:"** 한 줄 포함 — 단순 "X 가 Y 로 변경됨" 금지

아래는 2026-11-24 엔트리의 실제 항목이다:

```markdown
### Changed

- **Popover 제목**: 크기 단계 S (14) 를 빼고 브라우저 h3 (페이지 16 × 1.17 = 18.72, bold) 를 따른다.
  - **Why**: `.claude/rules/text-font.md` — S2 에 없는 owner 글자 값은 두지 않는다.
  - 위치: `componentRulesTable.ts` Popover `sizes` · `reusableOriginLibrary.ts` Popover 제목 template · 생성 `Popover.css`
```

## 4. 아카이빙 — 달 단위

- 달이 바뀌면 지난달 엔트리를 `docs/CHANGELOG-YYYY-MM-archived.md` 로 옮긴다 — 본문에는 이번 달만 둔다. 월 중간을 쪼개지 않는다
- **Why**: 크기 기준 (500KB) 은 지킬 수 없었다 — 2026-09 ~ 11 은 한 달 분량이 584 ~ 934KB 였고, 2026-09-09 에는 본문이 1,979KB (652 엔트리) 였다
- 달 단위 이전에 만든 구간 파일 (`CHANGELOG-2025-archived.md` · `CHANGELOG-2026-H1-archived.md` · `CHANGELOG-2026-Q3-archived.md`) 은 그대로 둔다 — 다시 나누지 않는다
- 옮길 때 엔트리 본문은 한 글자도 고치지 않는다 — 이동 전후 엔트리 합의 해시가 같은지 확인한다
- `CHANGELOG.md` 최상단에 아카이브 전부의 링크를 목록으로 유지 (구간·엔트리 수 병기)
- 아카이브 파일은 **append-only** — 재편집 금지

## 5. Catch-up 진행 시 권장 절차

1. `git log --since="<마지막 엔트리 날짜>" --pretty=format:"%h %ad %s" --date=short` 로 전수 조회
2. ADR 번호별 / 주제별 grouping (해시태그 보조: `ADR-XXX`, `fix:`, `feat:`, `perf:`, `refactor:` prefix 활용)
3. 각 group 을 하나의 **subsection item** 으로 축약 — 개별 커밋 나열 금지
4. 해당 group 의 **대표 커밋 해시 1개**만 항목 끝에 `(commit: <short-hash>)` 로 참조
5. 작성 완료 후 `docs/CHANGELOG.md` 최상단 catch-up 블록 유지, 다음 엔트리는 정상 주제 기반으로 복귀

## 6. 금지 패턴

- ❌ ADR `Implemented` 승격 커밋에 CHANGELOG 반영 누락
- ❌ 과거 엔트리의 섹션 이름을 새 규약으로 개명 (기록 사후 편집)
- ❌ BREAKING CHANGE 를 일반 `### Added` / `### Changed` 에 섞어 기록 (별도 `### Breaking Changes` 필수)
- ❌ 커밋 SHA / 커밋 메시지를 그대로 복붙 — 사용자 관점 요약으로 재작성
- ❌ `v1.0.0` 같은 버전 헤더 (SemVer 미적용 프로젝트)
- ❌ 14일 이상 drift 를 무시하고 새 엔트리만 추가 — 반드시 catch-up 블록 먼저
- ❌ 아카이브 파일 (`CHANGELOG-*-archived.md`) 재편집
- ❌ `### Breaking Changes` 를 최상단이 아닌 곳에 두기 (나머지 섹션 순서는 권장일 뿐 강제 아님)
- ❌ 변경 이유 ("Why:") 없는 버그 수정 항목
- ❌ 달이 바뀐 뒤에도 지난달 엔트리를 본문에 둔 채 새 달 엔트리 추가 (§4)

## 7. 체크리스트 — 커밋 작성 직전 자가 검증

커밋이 §1 트리거 표의 어느 행에든 해당하면 CHANGELOG 에 반영한다 (표가 정본 — 여기서 다시 나열하지 않는다).

반영하지 않는다면 왜 면제 대상인지 커밋 메시지에 한 줄 명시 (예: `(internal refactor, no user-visible change)`).

## 관련 파일

- `docs/CHANGELOG.md` — 현재 엔트리
- `docs/CHANGELOG-2026-10-archived.md` — 2026-10-03 ~ 10-31 아카이브 (append-only)
- `docs/CHANGELOG-2026-09-archived.md` — 2026-09-01 ~ 09-30 아카이브 (append-only)
- `docs/CHANGELOG-2026-Q3-archived.md` — 2026-07-01 ~ 08-31 아카이브 (append-only)
- `docs/CHANGELOG-2026-H1-archived.md` — 2026-02-22 ~ 06-30 아카이브 (append-only)
- `docs/CHANGELOG-2025-archived.md` — 2025 년 아카이브 (append-only)
- `AGENTS.md` §Git·문서·보호 파일 — Codex 엔트리포인트 요약
- `CLAUDE.md` §CHANGELOG 관리 — Claude 엔트리포인트 요약
