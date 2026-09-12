/**
 * 발급기 (`/Users/admin/work/jwt` main.py) 가 만든 실제 토큰으로 검증 계약을 고정한다.
 * fixture 의 개인키는 폐기됨 — 공개 JWK 만 실린다.
 */
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/license.fixture.json";
import {
  decodeLicensePayloadUnsafe,
  LicenseVerifyError,
  openVerificationCode,
  verifyLicenseToken,
  type LicensePublicJwk,
} from "../licenseToken";
import { parsePublicKey } from "../licenseSource";

const publicJwk = fixture.publicJwk as LicensePublicJwk;

async function reason(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (err) {
    return err instanceof LicenseVerifyError
      ? err.reason
      : `other:${String(err)}`;
  }
}

describe("verifyLicenseToken — 발급기 토큰 계약", () => {
  it("올바른 코드 + 번들 공개키 → payload (코드 평문 없음)", async () => {
    const payload = await verifyLicenseToken(
      fixture.token,
      fixture.code,
      publicJwk,
    );
    expect(payload.license_key).toBe(fixture.licenseKey);
    expect(payload.products).toBe("Composition");
    expect(payload.period).toBe("Unlimited");
    expect(payload.exp).toBeUndefined();
    expect("verification_code" in payload).toBe(false);
    expect(fixture.token).not.toContain(fixture.code);
  });

  it("틀린 코드 → code", async () => {
    expect(
      await reason(verifyLicenseToken(fixture.token, "000000", publicJwk)),
    ).toBe("code");
  });

  it("다른 발급기 키로 서명된 토큰 → signature (코드가 맞아도)", async () => {
    expect(
      await reason(
        verifyLicenseToken(fixture.foreignKeyToken, fixture.code, publicJwk),
      ),
    ).toBe("signature");
  });

  it("payload 변조 (유효 JSON, 서명 그대로) → signature", async () => {
    const [h, , s] = fixture.token.split(".");
    const payload = decodeLicensePayloadUnsafe(fixture.token);
    const forged = btoa(
      JSON.stringify({
        ...payload,
        period: "Unlimited",
        dev_count: "Unlimited",
      }),
    )
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(
      await reason(
        verifyLicenseToken(`${h}.${forged}.${s}`, fixture.code, publicJwk),
      ),
    ).toBe("signature");
  });

  it("만료 토큰 → expired (서명은 유효)", async () => {
    expect(
      await reason(
        verifyLicenseToken(fixture.expiredToken, fixture.code, publicJwk),
      ),
    ).toBe("expired");
    // 시각을 과거로 주입하면 통과 — 만료 판정이 exp 기준임을 고정
    const payload = await verifyLicenseToken(
      fixture.expiredToken,
      fixture.code,
      publicJwk,
      { now: () => Date.UTC(2019, 0, 1) },
    );
    expect(payload.period).toBe("20200101");
  });

  it("alg 가 ES256 이 아니면 서명 검증 전에 거부 (알고리즘 혼동 차단)", async () => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const [, p, s] = fixture.token.split(".");
    expect(
      await reason(
        verifyLicenseToken(`${header}.${p}.${s}`, fixture.code, publicJwk),
      ),
    ).toBe("algorithm");
    expect(
      await reason(verifyLicenseToken("not-a-jwt", fixture.code, publicJwk)),
    ).toBe("malformed");
  });
});

describe("공개키 형태 — PEM(SPKI) · 헤더 없는 본문 · 리터럴 \\n · JWK", () => {
  it("parsePublicKey 4 형태가 모두 같은 키로 서명을 검증한다", async () => {
    const pemHeaderless = fixture.publicPem
      .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "")
      .replace(/\s+/g, "");
    const forms = [
      fixture.publicPem,
      pemHeaderless,
      fixture.publicPem.replace(/\n/g, "\\n"),
      JSON.stringify(fixture.publicJwk),
    ];
    for (const raw of forms) {
      const key = parsePublicKey(raw);
      expect(key, raw.slice(0, 20)).not.toBeNull();
      const payload = await verifyLicenseToken(fixture.token, fixture.code, key!);
      expect(payload.license_key).toBe(fixture.licenseKey);
    }
  });

  it("손상·다른 형식은 null", () => {
    expect(parsePublicKey("")).toBeNull();
    expect(parsePublicKey("-----BEGIN PRIVATE KEY-----\nMIG…\n-----END PRIVATE KEY-----")).toBeNull();
    expect(parsePublicKey("{\"kty\":\"RSA\"}")).toBeNull();
    expect(parsePublicKey("QUJDREVGRw==")).toBeNull();
  });
});

describe("openVerificationCode", () => {
  it("vc 형식 불일치는 false (v · kdf · iter)", async () => {
    const { vc, license_key } = decodeLicensePayloadUnsafe(fixture.token);
    expect(
      await openVerificationCode(undefined, license_key, fixture.code),
    ).toBe(false);
    expect(
      await openVerificationCode(
        { ...vc, v: 2 as 1 },
        license_key,
        fixture.code,
      ),
    ).toBe(false);
    expect(
      await openVerificationCode({ ...vc, iter: 0 }, license_key, fixture.code),
    ).toBe(false);
    expect(await openVerificationCode(vc, "OTHER-KEY", fixture.code)).toBe(
      false,
    );
    expect(await openVerificationCode(vc, license_key, fixture.code)).toBe(
      true,
    );
  });
});
