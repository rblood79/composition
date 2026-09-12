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
import { Button } from "react-aria-components/Button";
import { useOptionalI18n } from "../i18n";
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
  | { kind: "loading" }
  | { kind: "deployed"; token: string }
  | { kind: "none" };

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

  const publicKey = useMemo(() => readBundledPublicKey(), []);
  const [source, setSource] = useState<LicenseSource>({ kind: "loading" });
  const [code, setCode] = useState("");
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
    <main className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">{t("title")}</h1>
          <p className="auth-subtitle">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-field auth-license-file">
            <span className="auth-field-label">{t("licenseFile")}</span>
            <div className="auth-license-source" data-kind={source.kind}>
              <span className="auth-license-status" role="status">
                {source.kind === "deployed" && t("licenseFileDeployed")}
                {source.kind === "none" && t("licenseFileNone")}
              </span>
            </div>
          </div>

          <TextField
            className="auth-form-field"
            value={code}
            onChange={(next) => setCode(next.replace(/\D/g, "").slice(0, 6))}
            isRequired
            isInvalid={!!error}
            validationBehavior="aria"
            isDisabled={locked}
          >
            <Label>{t("code")}</Label>
            <Input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
            />
            <Text slot="description">{t("codeDescription")}</Text>
            {error && <FieldError>{error}</FieldError>}
          </TextField>

          {!publicKey && (
            <p className="auth-config-error" role="alert">
              {t("errorPublicKeyMissing")}
            </p>
          )}

          <Button
            type="submit"
            className="react-aria-Button"
            isDisabled={!canSubmit}
            data-size="md"
            data-variant="primary"
          >
            {verifying ? t("verifying") : t("submit")}
          </Button>
        </form>
      </div>
    </main>
  );
};

export default Signin;
