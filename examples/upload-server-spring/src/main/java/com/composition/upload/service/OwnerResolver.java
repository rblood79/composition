package com.composition.upload.service;

import javax.servlet.http.HttpServletRequest;

/**
 * P3 — 요청의 소유자 (principal) 를 결정한다. 업로드 세션은 이 값에 묶이고 HEAD/PATCH/DELETE 마다 대조된다.
 * 인증 체계 (Spring Security · 전자정부 로그인 · SSO) 에 맞춰 구현 1개를 바꿔 끼운다.
 */
public interface OwnerResolver {

    /** 미인증이면 null — 호출자가 401 로 바꾼다. */
    String resolve(HttpServletRequest request);
}
