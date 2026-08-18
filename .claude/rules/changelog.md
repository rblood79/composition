---
description: CHANGELOG.md 자동 갱신 규칙 — 커밋/PR/ADR Implemented 시 의무 업데이트
paths:
  - "docs/CHANGELOG.md"
  - "docs/CHANGELOG-*-archived.md"
---

# CHANGELOG 관리 규칙 — 자동 업데이트 의무화

> **배경**: 2026-04-06 이후 2026-04-24 까지 18일간 CHANGELOG 미갱신 + 1,300+ 커밋 drift 가 관측되었다 (ADR-907/908/909 등 주요 Implemented 4건 + 다수 bug fix 누락). 본 규칙은 동일 drift 재발 방지를 위한 trigger-based 의무 갱신 contract.

## 1. 트리거 — 이 중 하나라도 해당하면 **같은 커밋 또는 바로 다음 커밋**에 CHANGELOG 반영 (CRITICAL)

| 트리거                                       | 반영 범위                           | 타이밍                |
| -------------------------------------------- | ----------------------------------- | --------------------- |
| ADR Status `Accepted → Implemented` 승격     | 해당 ADR 전체 요약                  | Implemented 승격 커밋 |
| 사용자-가시 버그 수정 (UI/렌더/입력/저장)    | Bug Fixes 섹션                      | 수정 커밋             |
| 신규 컴포넌트 / 신규 prop / 신규 public API  | Features 섹션                       | 병합 커밋             |
| 3개 이상 파일에 걸친 아키텍처 변경           | Architecture 섹션                   | 최종 Phase 커밋       |
| BREAKING CHANGE (props 제거, 토큰명 변경 등) | Breaking Changes 섹션 (최상단 bold) | 변경 커밋             |
| 성능 회귀 수정 (FPS / 번들 / 초기 로드)      | Performance 섹션                    | 측정 반영 커밋        |
| Phase 다단계 작업 완결                       | Architecture 또는 Features          | Phase 최종 커밋       |

**단순 작업 면제** (CHANGELOG 반영 불필요): typo / 주석 수정 / 내부 변수명 리팩터 / 테스트만 추가 / 문서 오타 / agents.jsonl 통계 등 stats 파일 / `.claude/` hook 설정 튜닝.

## 2. Drift 감시 — 세션 시작 시 자가 점검 (CRITICAL)

세션 시작 후 첫 commit 작업 시 반드시 확인:

```bash
# 최근 CHANGELOG 엔트리 날짜 추출 (첫 ## [...] - YYYY-MM-DD 헤더)
grep -m1 -oE '^## \[.*\] - [0-9]{4}-[0-9]{2}-[0-9]{2}' docs/CHANGELOG.md \
  | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}'

# 해당 날짜 이후 커밋 수
git log --since="<위 날짜>" --oneline | wc -l
```

- **14일 초과 또는 100 커밋 초과 시**: 먼저 catch-up 엔트리 작성을 제안. 사용자 동의 시 `git log --since` 로 그룹화된 catch-up 섹션 작성 (ADR 번호 / 주제별 bundle)
- Catch-up 엔트리는 `## [Catch-up YYYY-MM-DD ~ YYYY-MM-DD] - YYYY-MM-DD` 헤더 사용, 개별 커밋 나열 금지 — **주제별 bundle** (예: "ADR-908 Fill Spec Schema SSOT — Phase 0~4 완결")

## 3. 엔트리 포맷 — Keep a Changelog 1.0.0 기반 composition 확장

### 헤더 규칙

```markdown
## [한글 제목 — 기술 요약] - YYYY-MM-DD
```

- 제목: 한글 주제 + `—` + 영문/기술 요약 (예: `Fill Spec Schema SSOT — ADR-908 Phase 0~4`)
- 날짜: ISO 8601 (`YYYY-MM-DD`), 커밋 날짜 기준 (author date, not commit date)
- 버전 번호(`v1.2.3`) 사용 금지 — composition 은 SemVer 미적용, 주제 기반 엔트리

### 서브섹션 순서 (고정)

1. `### Breaking Changes` (있을 때만, 최상단)
2. `### Bug Fixes`
3. `### Features`
4. `### Architecture`
5. `### Performance`
6. `### Documentation`
7. `### Infrastructure` (hook / CI / build)

없는 섹션은 생략. 순서 섞지 않음.

### 항목 작성 규칙

- **굵은 제목 + 줄바꿈 + 들여쓴 하위 설명** 구조 (기존 2026-04-06 이전 엔트리와 동일)
- ADR 관련 항목은 **반드시 ADR 번호 + Phase 명시** (예: `ADR-908 Phase 3-A — component spec shapes consumer 전환`)
- 위치 정보는 **경로 명시** (예: `위치: packages/specs/src/primitives/fillTokens.ts`)
- 근본 원인 있는 버그는 **"Why:"** 한 줄 포함 — 단순 "X 가 Y 로 변경됨" 금지

```markdown
### Bug Fixes

- **Label 20/21px 정렬 불일치** (ADR-057 Phase 3):
  - ProgressBarValue/MeterValue/SliderOutput Spec `sizes` 에 `lineHeight` 미정의 → CanvasKit 기본값 사용
  - **Why**: Label(20px) ↔ Value(21px CanvasKit 기본) drift → layout baseline 어긋남
  - 수정: xs=16 / sm=16 / md=20 / lg=24 / xl=28 명시 주입
  - 위치: `packages/specs/src/components/{ProgressBarValue,MeterValue,SliderOutput}.spec.ts`
```

## 4. 아카이빙 — 연도 컷오프

- `docs/CHANGELOG.md` 가 **500KB 초과** 또는 **연도 바뀜 직후 첫 주** 에 전년도 엔트리를 `docs/CHANGELOG-YYYY-archived.md` 로 이동
- `CHANGELOG.md` 최상단에 `> 이전 기록: [CHANGELOG-2025-archived.md](./CHANGELOG-2025-archived.md)` 링크 유지
- 아카이브 파일은 **append-only** — 재편집 금지

## 5. Catch-up 진행 시 권장 절차

1. `git log --since="<마지막 엔트리 날짜>" --pretty=format:"%h %ad %s" --date=short` 로 전수 조회
2. ADR 번호별 / 주제별 grouping (해시태그 보조: `ADR-XXX`, `fix:`, `feat:`, `perf:`, `refactor:` prefix 활용)
3. 각 group 을 하나의 **subsection item** 으로 축약 — 개별 커밋 나열 금지
4. 해당 group 의 **대표 커밋 해시 1개**만 항목 끝에 `(commit: <short-hash>)` 로 참조
5. 작성 완료 후 `docs/CHANGELOG.md` 최상단 catch-up 블록 유지, 다음 엔트리는 정상 주제 기반으로 복귀

## 6. 금지 패턴

- ❌ ADR `Implemented` 승격 커밋에 CHANGELOG 반영 누락
- ❌ BREAKING CHANGE 를 일반 `### Features` 에 섞어 기록 (별도 `### Breaking Changes` 필수)
- ❌ 커밋 SHA / 커밋 메시지를 그대로 복붙 — 사용자 관점 요약으로 재작성
- ❌ `v1.0.0` 같은 버전 헤더 (SemVer 미적용 프로젝트)
- ❌ 14일 이상 drift 를 무시하고 새 엔트리만 추가 — 반드시 catch-up 블록 먼저
- ❌ 아카이브 파일 (`CHANGELOG-YYYY-archived.md`) 재편집
- ❌ 서브섹션 순서 섞기 (Breaking → Bug Fixes → Features → Architecture → Performance → Documentation → Infrastructure 고정)
- ❌ 변경 이유 ("Why:") 없는 버그 수정 항목
- ❌ `docs/CHANGELOG.md` 가 500KB 넘어서도 아카이빙 미수행

## 7. 체크리스트 — 커밋 작성 직전 자가 검증

커밋 전 다음 질문에 하나라도 YES 면 CHANGELOG 반영:

- [ ] 이 커밋이 ADR 을 `Implemented` 로 승격시키는가?
- [ ] 사용자가 UI 또는 빌더 동작에서 차이를 느낄 변경인가?
- [ ] public API / prop / spec schema 가 바뀌는가?
- [ ] 3개 이상 파일이 같은 주제로 바뀌는가?
- [ ] 성능 측정값이 달라지는가?
- [ ] Breaking 인가?

반영하지 않는다면 왜 면제 대상인지 커밋 메시지에 한 줄 명시 (예: `(internal refactor, no user-visible change)`).

## 관련 파일

- `docs/CHANGELOG.md` — 현재 엔트리
- `docs/CHANGELOG-2025-archived.md` — 2025 년 아카이브 (append-only)
- `AGENTS.md` §Commit & Pull Request Guidelines — Codex 엔트리포인트 요약
- `CLAUDE.md` §자동 품질 게이트 — Claude 엔트리포인트 요약
