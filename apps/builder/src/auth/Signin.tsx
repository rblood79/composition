/**
 * 라이선스 활성화 화면 — 서버 없는 폐쇄망 인증.
 *
 * 라이선스 토큰은 서버 루트 `public/license` 에서 자동으로 읽는다 (파일 선택 없음).
 * 사용자 입력은 6자리 검증 코드 하나. 검증은 `auth/license/licenseToken.ts` (WebCrypto, 외부 네트워크 0).
 * 통과하면 로컬 인증 기록을 남기고 대시보드로 간다.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { TextField } from "react-aria-components/TextField";
import { Input } from "react-aria-components/Input";
import { Label } from "react-aria-components/Label";
import { Text } from "react-aria-components/Text";
import { FieldError } from "react-aria-components/FieldError";
import { Button } from "@composition/shared/components";
import { useOptionalI18n } from "../i18n";
import { useBuilderChromeTheme } from "../builder/hooks/useBuilderChromeTheme";
import {
  LicenseVerifyError,
  verifyLicenseToken,
  type LicenseVerifyFailure,
} from "./license/licenseToken";
import {
  fetchDeployedLicenseToken,
  readBundledPublicKey,
} from "./license/licenseSource";
import {
  lockoutRemainingMs,
  recordFailedAttempt,
  resetAttempts,
  saveAuth,
} from "./license/localAuth";
import "./index.css";

type LicenseSource =
  { kind: "loading" } | { kind: "deployed"; token: string } | { kind: "none" };

const FAILURE_KEY: Record<LicenseVerifyFailure, string> = {
  malformed: "errorMalformed",
  algorithm: "errorAlgorithm",
  signature: "errorSignature",
  expired: "errorExpired",
  code: "errorCode",
};

const Signin = () => {
  const navigate = useNavigate();
  const i18n = useOptionalI18n();
  const t = (key: string, params?: Record<string, string | number>) =>
    i18n ? i18n.t(`auth.${key}`, params) : key;

  useBuilderChromeTheme();
  const publicKey = useMemo(() => readBundledPublicKey(), []);
  const [source, setSource] = useState<LicenseSource>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedMs, setLockedMs] = useState(() => lockoutRemainingMs());

  // 서버 루트의 license.jwt — 폐쇄망 서버가 앱과 같이 배포한 경우 자동 입력
  useEffect(() => {
    let cancelled = false;
    fetchDeployedLicenseToken().then((token) => {
      if (cancelled) return;
      setSource(token ? { kind: "deployed", token } : { kind: "none" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 잠금 카운트다운
  useEffect(() => {
    if (lockedMs <= 0) return;
    const id = window.setInterval(() => {
      const remaining = lockoutRemainingMs();
      setLockedMs(remaining);
      if (remaining <= 0) setError(null);
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockedMs]);

  const token = source.kind === "deployed" ? source.token : null;
  const codeValid = /^\d{6}$/.test(code);
  const locked = lockedMs > 0;
  const canSubmit =
    !!publicKey && !!token && codeValid && !verifying && !locked;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || !publicKey || !token) return;
    setVerifying(true);
    setError(null);
    try {
      const payload = await verifyLicenseToken(token, code, publicKey);
      resetAttempts();
      saveAuth(payload);
      navigate("/dashboard");
    } catch (err) {
      const reason =
        err instanceof LicenseVerifyError ? err.reason : "malformed";
      // 서명·만료는 파일 문제라 시도 제한 대상이 아니다 — 코드 추측만 늦춘다
      if (reason === "code") {
        const lock = recordFailedAttempt();
        if (lock > 0) {
          setLockedMs(lock);
          setError(t("errorLocked", { seconds: Math.ceil(lock / 1000) }));
          return;
        }
      }
      setError(t(FAILURE_KEY[reason]));
    } finally {
      setVerifying(false);
    }
  };

  return (
    // 대시보드와 같은 빌더 chrome — `data-context="builder"` 가 없으면 preview 팔레트로 렌더된다.
    <main className="auth-page" data-context="builder">
      <header className="auth-header">
        <div className="auth-brand">
          <span className="auth-logo">
            <img src="/appIcon.svg" alt="" aria-hidden />
          </span>
          <span className="auth-brand-title">composition</span>
        </div>
      </header>

      <div className="auth-body">
        <form onSubmit={handleSubmit} className="auth-island">
          <div className="auth-island-heading">
            <h1 className="auth-title">{t("title")}</h1>
            <p className="auth-subtitle">{t("subtitle")}</p>
          </div>

          <TextField
            className="react-aria-TextField auth-code-field"
            value={code}
            onChange={(next) => setCode(next.replace(/\D/g, "").slice(0, 6))}
            isRequired
            isInvalid={!!error}
            validationBehavior="aria"
            isDisabled={locked}
          >
            <Label>{t("code")}</Label>
            {/* 접근성·붙여넣기·자동완성(one-time-code) 은 input 하나가 맡고, 6칸은 그 값을 비추는 시각 표현이다.
                maxLength 는 두지 않는다 — "782-573" 처럼 구분자가 섞인 붙여넣기를 자르기 전에 onChange 가 숫자만 남긴다. */}
            <div className="auth-code-cells" data-focused={codeFocused || undefined}>
              <Input
                className="react-aria-Input auth-code-input"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                spellCheck={false}
                autoFocus
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
              />
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className="auth-code-cell"
                  aria-hidden
                  data-filled={i < code.length || undefined}
                  data-active={
                    codeFocused && i === Math.min(code.length, 5) ? true : undefined
                  }
                >
                  {code[i] ?? ""}
                </span>
              ))}
            </div>
            <Text slot="description">{t("codeDescription")}</Text>
            {error && <FieldError>{error}</FieldError>}
          </TextField>

          {source.kind === "none" && (
            <p className="auth-config-error" role="alert">
              {t("licenseFileNone")}
            </p>
          )}
          {!publicKey && (
            <p className="auth-config-error" role="alert">
              {t("errorPublicKeyMissing")}
            </p>
          )}

          <Button
            type="submit"
            variant="accent"
            size="md"
            className="auth-submit"
            isDisabled={!canSubmit}
            isLoading={verifying}
          >
            {verifying ? t("verifying") : t("submit")}
          </Button>
        </form>
      </div>
    </main>
  );
};

export default Signin;
