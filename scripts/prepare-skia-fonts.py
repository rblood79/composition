"""CanvasKit용 TTF 생성. fonttools==4.64.0, brotli==1.2.0 필요.

원본 WOFF2의 variation/글리프/이름 테이블을 유지하고 컨테이너 압축만 해제한다.
실행: python scripts/prepare-skia-fonts.py (작업 디렉터리 무관)
"""
from pathlib import Path
from fontTools.ttLib import TTFont

fonts = Path(__file__).resolve().parents[1] / "apps/builder/public/fonts"
for family in ("PretendardVariable", "InterVariable"):
    with TTFont(fonts / f"{family}.woff2", recalcTimestamp=False) as font:
        font.flavor = None
        font.save(fonts / f"{family}.ttf")
