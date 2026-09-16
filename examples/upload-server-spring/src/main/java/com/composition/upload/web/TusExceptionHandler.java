package com.composition.upload.web;

import java.io.IOException;
import java.util.Map;

import javax.servlet.http.HttpServletResponse;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import com.composition.upload.service.FileNameValidator;
import com.composition.upload.service.UploadException;

/**
 * S10 — 예외를 계약 상태 코드로. 응답 본문은 짧은 영문 사유 1줄 (스택·경로·호스트명 0). 460 같은 비표준 코드는
 * {@code HttpServletResponse.setStatus(int)} 로 직접 쓴다.
 */
@ControllerAdvice
public class TusExceptionHandler {

    private static final Log LOG = LogFactory.getLog(TusExceptionHandler.class);

    @ExceptionHandler(UploadException.class)
    public void handleUpload(UploadException e, HttpServletResponse response) throws IOException {
        write(response, e.getStatus(), e.getMessage(), e.getHeaders());
    }

    /** Upload-Metadata 규칙 위반 (P1) → 400. */
    @ExceptionHandler(FileNameValidator.ValidationException.class)
    public void handleValidation(FileNameValidator.ValidationException e, HttpServletResponse response) throws IOException {
        write(response, HttpServletResponse.SC_BAD_REQUEST, e.getMessage(), null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public void handleMethod(HttpRequestMethodNotSupportedException e, HttpServletResponse response) throws IOException {
        String[] supported = e.getSupportedMethods();
        if (supported != null && supported.length > 0) {
            response.setHeader("Allow", String.join(", ", supported));
        }
        write(response, HttpServletResponse.SC_METHOD_NOT_ALLOWED, "method not allowed", null);
    }

    @ExceptionHandler(Exception.class)
    public void handleOther(Exception e, HttpServletResponse response) throws IOException {
        LOG.error("unhandled error", e);
        write(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "internal error", null);
    }

    private static void write(HttpServletResponse response, int status, String message, Map<String, String> headers)
        throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(status);
        response.setHeader(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION);
        if (headers != null) {
            for (Map.Entry<String, String> h : headers.entrySet()) {
                response.setHeader(h.getKey(), h.getValue());
            }
        }
        response.setContentType("text/plain;charset=UTF-8");
        response.getWriter().write(message == null ? "" : message);
        response.flushBuffer();
    }
}
