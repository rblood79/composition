<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" session="true" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%--
  ADR-201 Phase 2 — JSP 1장 예제: @composition/upload IIFE 로 참조 서버 (examples/upload-server-spring) 에 업로드.

  - 스크립트 1줄: js/composition-upload.iife.js (= packages/upload-engine/dist/vanilla.global.js 복사본)
  - CSRF: CsrfHeaderFilter 가 GET 요청에서 세션 토큰을 만든다 → ${sessionScope.CSRF_TOKEN} 을 meta 로 내보내고
    getHeaders() 가 요청마다 읽는다 (계약 §5 — 문서에 비밀 0, 토큰은 런타임 헤더)
  - 인증: withCredentials: true (JSESSIONID 쿠키). 소유자는 세션 속성 UPLOAD_OWNER_ID (dev-login) 또는 컨테이너 principal
  - 배포: 이 파일을 서버 webapp 루트 (src/main/webapp/upload.jsp) 에 두면 same-origin — CORS 설정 불요
--%>
<c:set var="ctx" value="${pageContext.request.contextPath}" />
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="_csrf" content="<c:out value='${sessionScope.CSRF_TOKEN}' />">
  <title>대용량 업로드 예제 (TUS 1.0)</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 720px; }
    .status { margin: 1rem 0; padding: .75rem; border: 1px solid #ccc; border-radius: 6px; font-size: .9rem; }
    .status code { background: #f3f3f3; padding: 0 .25rem; }
    #uploader { min-height: 160px; }
    .log { white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: .8rem; background: #fafafa; padding: .5rem; max-height: 240px; overflow: auto; }
  </style>
</head>
<body>
  <h1>대용량 업로드 예제</h1>

  <div class="status">
    <c:choose>
      <c:when test="${not empty sessionScope.UPLOAD_OWNER_ID}">
        로그인: <code><c:out value="${sessionScope.UPLOAD_OWNER_ID}" /></code>
      </c:when>
      <c:when test="${not empty pageContext.request.userPrincipal}">
        로그인: <code><c:out value="${pageContext.request.userPrincipal.name}" /></code>
      </c:when>
      <c:otherwise>
        미인증 — 서버가 401 을 돌려준다. 개발용:
        <a href="${ctx}/session/dev-login?owner=demo">dev-login (owner=demo)</a>
        (<code>upload.devLogin.enabled=true</code> 일 때만)
      </c:otherwise>
    </c:choose>
    · endpoint <code>${ctx}/upload</code>
  </div>

  <div id="uploader"></div>
  <p>
    <button type="button" id="pause">일시정지</button>
    <button type="button" id="resume">재개</button>
    <button type="button" id="cancel">취소</button>
  </p>
  <div class="log" id="log"></div>

  <%-- 엔진 IIFE 1줄 — packages/upload-engine/dist/composition-upload.iife.js 를 js/ 로 복사 (README) --%>
  <script src="${ctx}/js/composition-upload.iife.js"></script>
  <script>
    (function () {
      var log = document.getElementById("log");
      function line(msg) { log.textContent += msg + "\n"; log.scrollTop = log.scrollHeight; }

      var meta = document.querySelector('meta[name="_csrf"]');
      function csrfToken() { return meta ? meta.getAttribute("content") || "" : ""; }

      // 토큰이 비어 있으면 (필터 밖에서 렌더된 경우) /session 에서 받아 meta 를 채운다
      var ready = csrfToken()
        ? Promise.resolve()
        : fetch("${ctx}/session", { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (j) { if (meta && j.csrfToken) { meta.setAttribute("content", j.csrfToken); } });

      ready.then(function () {
        var uploader = CompositionUpload.create(document.getElementById("uploader"), {
          endpoint: "${ctx}/upload",
          protocol: "tus",
          chunkSize: 8 * 1024 * 1024,            // 계약 §7 — Apache Timeout 60s 회선 안전 기본값
          parallelUploads: 1,
          retryDelays: [0, 1000, 3000, 5000, 10000],
          withCredentials: true,                  // JSESSIONID 쿠키 (계약 §5)
          getHeaders: function () {               // 요청마다 호출 — CSRF 토큰 (정적 headers 에 비밀 0)
            return { "X-CSRF-TOKEN": csrfToken() };
          },
          autoProceed: true
        });

        // subscribe(listener) — 인자는 항목 배열 (UploadItemState[]). item.status:
        //   queued|creating|uploading|paused|done|error · item.lastError?.code (계약 §9)
        var lastLine = {};
        uploader.subscribe(function (items) {
          items.forEach(function (item) {
            var pct = item.size ? Math.floor((item.offset / item.size) * 100) : 0;
            var msg = item.name + " " + item.status + " " + pct + "%"
              + (item.lastError ? " " + item.lastError.code + " " + (item.lastError.message || "") : "");
            if (lastLine[item.id] === msg) { return; }
            lastLine[item.id] = msg;
            line("[" + item.status + "] " + msg);
            if (item.lastError && item.lastError.code === "E_UNAUTHORIZED") {
              line("→ 세션 만료 또는 CSRF 토큰 불일치. 페이지를 새로고침한 뒤 같은 파일을 다시 고르면 HEAD offset 부터 이어진다.");
            }
          });
        });

        document.getElementById("pause").onclick = function () { uploader.pause(); };
        document.getElementById("resume").onclick = function () { uploader.resume(); };
        document.getElementById("cancel").onclick = function () { uploader.cancel(); };

        line("ready — endpoint ${ctx}/upload");
      }).catch(function (e) { line("init failed: " + e); });
    })();
  </script>
</body>
</html>
