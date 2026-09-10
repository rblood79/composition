# 디자인 캔버스 (`/design` 산출물)

`/design` 스킬이 만드는 다중 아트보드 캔버스를 모아 둔다. 한 캔버스 = 한 디렉토리 =
`canvas.json` (아트보드 배치·주석) + `*.dc.html` (아트보드). 합본 HTML 은 커밋하지 않는다 (아래).

> **배치 규칙**: 새 캔버스는 `docs/design/<주제-kebab-case>/` 에 만든다. 저장소 루트에
> `design/` · `.design/` 처럼 흩어 두지 않는다 — `/design` 스킬 자체는 출력 위치를 정하지
> 않으므로 세션마다 이름이 갈렸고, 2026-09-09 에 세 곳을 여기로 통합했다.
>
> `canvas.json` 은 아트보드를 **파일명(상대 경로)** 으로만 참조하므로 디렉토리째 옮겨도 그대로 동작한다.

---

## 캔버스 목록

### [nodes-panel-states/](nodes-panel-states/) — Navigator 트리 항목 상호작용 상태 (2026-08-21)

hover 와 selected 가 같은 채널을 쓰던 문제의 상태 모델. 아트보드 4 (현재 구현 · 권장 상태 모델 ·
Light 대조 · 스펙 시트).
출처 감사: [2026-08-21-nodes-panel-tree-item-interaction-states.md](../reference/audits/2026-08-21-nodes-panel-tree-item-interaction-states.md)

### [builder-tab-pattern-unification/](builder-tab-pattern-unification/) — 빌더 탭 패턴 통일 (2026-08-30)

현재 3계열 탭을 DataTable 어법으로 통일하는 안. 아트보드 4 (Before · 통일안 · 상태 대조 ·
마이그레이션 범위).

### [builder-ui-webstudio/](builder-ui-webstudio/) — 빌더 UI before/after (2026-09-08)

Styles 패널 5개 탭 (배치 · 스타일 · 텍스트 · 화면 · 수정) 을 장마다 "지금 / 적용 후 / 왜" 3열로
대조하고, 캔버스 변경분과 History 되돌리기를 덧붙였다. 아트보드 8, 다크 토글 포함.

이 캔버스만 손으로 만든 빌드 도구를 함께 둔다 — `build.sh` · `gen_*.py` 8 · `_core.css` ·
`_panel.css`. 전부 **작업 디렉토리 기준 상대 경로**라 이 디렉토리 안에서 실행해야 한다.

```bash
cd docs/design/builder-ui-webstudio
python3 gen_layout.py      # → TabLayout.dc.html
```

### [header-contextual-island/](header-contextual-island/) — 헤더 컨텍스트 아일랜드 (2026-09-09)

헤더의 `.builder-viewport-controls` Group **그 요소가** 선택 대상에 따라 변형되고 토스트·알림도
같은 자리에서 뜨는 안 (iPhone Dynamic Island 어법). 형태는 앱 상단 edge 에 붙은 **노치** — supaste.com
네비게이션과 같은 기법이고, `header.css` 에 주석으로 남아 있던 어깨(fillet) 블록이 그 흔적이다.
아트보드 7 — 제안 (선택 6 × 알림 6 × 크기 3단, notch/pill 트윅, 클릭 가능) · 한 요소의 변형 t0→t4 ·
노치 보충 · 토스트 이전 · 크기 어법 4단 · 벤치마크 · 현재 대조군.

치수는 Apple HIG 기준 (compact 36px · expanded 최대 144pt ≈ 192px), 색·간격·컨트롤 크기는
`builder-system.css` §Chrome island 토큰 실측값이다. 아직 시안 — 코드 변경 없음.

---

## 합본 HTML 은 두지 않는다

`/design` 은 게시할 때 아트보드와 캔버스 편집기 런타임을 한 장에 담은 번들 HTML (2.2 ~ 2.6MB) 을
같이 떨어뜨린다. 용량의 대부분이 편집기 코드이고 디자인 내용은 아트보드 + `canvas.json` 이 원본이라,
2026-09-09 에 세 건을 삭제했다 (7.1MB → 0, git 이력에는 남아 있다).

번들이 다시 필요하면 그때 게시해서 얻고, 저장소에는 커밋하지 않는다.
