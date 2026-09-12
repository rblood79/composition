/**
 * 발급기 공개키 (ES256 P-256, PEM SPKI) — 라이선스 토큰 서명 검증의 정본.
 *
 * 발급기 `/Users/admin/work/jwt` 의 `keys/public_key` 와 같은 값. 개인키는 발급기에만 있다.
 * 키를 교체하면 (발급기 "키 쌍 새로 만들기") 이 값도 같이 바꾼다 — 그 전에 발급된 토큰은 전부 무효.
 * 공개키라 커밋해도 된다. 배포별 override 는 `.env` `VITE_LICENSE_PUBLIC_KEY` (선택).
 */
export const ISSUER_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9VLu+/cHo82qy2WUvPdw617bGOyT
6hTeQWFk9uto6ujXZbD28K0T7vi37w6DadNOtTOSmkdQ4q2O3wkKT6k50g==
-----END PUBLIC KEY-----`;
