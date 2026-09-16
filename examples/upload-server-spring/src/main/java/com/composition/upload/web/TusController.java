package com.composition.upload.web;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import com.composition.upload.config.UploadProperties;
import com.composition.upload.service.OwnerResolver;
import com.composition.upload.service.UploadException;
import com.composition.upload.service.UploadMetadataParser;
import com.composition.upload.service.UploadMetadataParser.UploadMetadata;
import com.composition.upload.service.UploadSession;
import com.composition.upload.service.UploadSessionService;

/**
 * 변형 ① — jar 무의존 TUS 1.0 컨트롤러 (core + creation + expiration + termination + checksum).
 *
 * <p>PATCH 바디는 {@code request.getInputStream()} 을 그대로 읽어 {@code RandomAccessFile.seek(offset)} 뒤 1회 쓴다 —
 * multipart 파서·임시 파일·병합 단계가 없다 (Spring {@code MultipartResolver} 와 무관). 응답 헤더·상태 코드는
 * docs/reference/upload/server-contract.md §2 표와 1:1.
 */
@Controller
@RequestMapping("/upload")
public class TusController {

    private final UploadProperties properties;
    private final UploadSessionService service;
    private final OwnerResolver owners;
    private final UploadMetadataParser metadata;

    public TusController(UploadProperties properties, UploadSessionService service, OwnerResolver owners,
                         UploadMetadataParser metadata) {
        this.properties = properties;
        this.service = service;
        this.owners = owners;
        this.metadata = metadata;
    }

    /** §1 능력 감지 — 인증 없이 응답 (CORS pre-flight 겸용). */
    @RequestMapping(value = { "", "/", "/{id}" }, method = RequestMethod.OPTIONS)
    public void options(HttpServletResponse response) {
        response.setStatus(HttpServletResponse.SC_NO_CONTENT);
        response.setHeader(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION);
        response.setHeader(TusHeaders.TUS_VERSION_HEADER, TusHeaders.TUS_VERSION);
        response.setHeader(TusHeaders.TUS_EXTENSION, TusHeaders.TUS_EXTENSIONS);
        response.setHeader(TusHeaders.TUS_MAX_SIZE, String.valueOf(properties.getMaxSize()));
        response.setHeader(TusHeaders.TUS_CHECKSUM_ALGORITHM, TusHeaders.TUS_CHECKSUM_ALGORITHMS);
        response.setHeader("Allow", "OPTIONS, POST, HEAD, PATCH, DELETE");
    }

    /** §2 생성 — 201 Location + Upload-Expires. */
    @RequestMapping(value = { "", "/" }, method = RequestMethod.POST)
    public void create(HttpServletRequest request, HttpServletResponse response) {
        requireTusResumable(request);
        String owner = requireOwner(request);
        if (request.getHeader(TusHeaders.UPLOAD_DEFER_LENGTH) != null) {
            throw new UploadException(400, "Upload-Defer-Length is not supported — send Upload-Length");
        }
        long length = parseLongHeader(request, TusHeaders.UPLOAD_LENGTH, true);
        UploadMetadata meta = metadata.parse(request.getHeader(TusHeaders.UPLOAD_METADATA));
        UploadSession created = service.create(owner, meta, length);

        response.setStatus(HttpServletResponse.SC_CREATED);
        common(response);
        response.setHeader("Location", locationFor(request, created.getId()));
        response.setHeader(TusHeaders.UPLOAD_EXPIRES, TusHeaders.httpDate(created.getExpiresAt()));
    }

    /** §2 조회 (재개) — 서버 offset 이 진실. */
    @RequestMapping(value = "/{id}", method = RequestMethod.HEAD)
    public void head(@PathVariable("id") String id, HttpServletRequest request, HttpServletResponse response) {
        requireTusResumable(request);
        String owner = requireOwner(request);
        UploadSession s = service.requireOwned(id, owner);

        response.setStatus(HttpServletResponse.SC_OK);
        common(response);
        response.setHeader(TusHeaders.UPLOAD_OFFSET, String.valueOf(s.getUploadOffset()));
        response.setHeader(TusHeaders.UPLOAD_LENGTH, String.valueOf(s.getTotalSize()));
        response.setHeader(TusHeaders.UPLOAD_EXPIRES, TusHeaders.httpDate(s.getExpiresAt()));
        response.setHeader(TusHeaders.UPLOAD_METADATA, UploadMetadataParser.encode(s));
        response.setHeader("Cache-Control", "no-store");
    }

    /** §2 전송 — 204 Upload-Offset. */
    @RequestMapping(value = "/{id}", method = RequestMethod.PATCH)
    public void patch(@PathVariable("id") String id, HttpServletRequest request, HttpServletResponse response)
        throws IOException {
        requireTusResumable(request);
        String owner = requireOwner(request);
        requireOffsetContentType(request);
        long offset = parseLongHeader(request, TusHeaders.UPLOAD_OFFSET, true);
        long length = request.getContentLengthLong();
        if (length < 0) {
            throw new UploadException(411, "Content-Length is required for PATCH");
        }
        UploadSession s = service.appendChunk(id, owner, offset, length, request.getInputStream(),
            request.getHeader(TusHeaders.UPLOAD_CHECKSUM));

        response.setStatus(HttpServletResponse.SC_NO_CONTENT);
        common(response);
        response.setHeader(TusHeaders.UPLOAD_OFFSET, String.valueOf(s.getUploadOffset()));
        response.setHeader(TusHeaders.UPLOAD_EXPIRES, TusHeaders.httpDate(s.getExpiresAt()));
    }

    /** termination 확장. */
    @RequestMapping(value = "/{id}", method = RequestMethod.DELETE)
    public void delete(@PathVariable("id") String id, HttpServletRequest request, HttpServletResponse response) {
        requireTusResumable(request);
        String owner = requireOwner(request);
        service.terminate(id, owner);
        response.setStatus(HttpServletResponse.SC_NO_CONTENT);
        common(response);
    }

    // ---------------------------------------------------------------- helpers

    private static void common(HttpServletResponse response) {
        response.setHeader(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION);
    }

    private static void requireTusResumable(HttpServletRequest request) {
        String v = request.getHeader(TusHeaders.TUS_RESUMABLE);
        if (v == null || !TusHeaders.TUS_VERSION.equals(v.trim())) {
            throw new UploadException(412, "Tus-Resumable: 1.0.0 is required")
                .withHeader(TusHeaders.TUS_VERSION_HEADER, TusHeaders.TUS_VERSION);
        }
    }

    private String requireOwner(HttpServletRequest request) {
        String owner = owners.resolve(request);
        if (owner == null) {
            throw new UploadException(401, "authentication required");
        }
        return owner;
    }

    private static void requireOffsetContentType(HttpServletRequest request) {
        String ct = request.getContentType();
        if (ct == null) {
            throw new UploadException(415, "Content-Type must be " + TusHeaders.OFFSET_CONTENT_TYPE);
        }
        int semi = ct.indexOf(';');
        String type = (semi < 0 ? ct : ct.substring(0, semi)).trim();
        if (!TusHeaders.OFFSET_CONTENT_TYPE.equalsIgnoreCase(type)) {
            throw new UploadException(415, "Content-Type must be " + TusHeaders.OFFSET_CONTENT_TYPE);
        }
    }

    private static long parseLongHeader(HttpServletRequest request, String name, boolean required) {
        String v = request.getHeader(name);
        if (v == null || v.trim().isEmpty()) {
            if (required) {
                throw new UploadException(400, name + " is required");
            }
            return -1L;
        }
        long n;
        try {
            n = Long.parseLong(v.trim());
        } catch (NumberFormatException e) {
            throw new UploadException(400, name + " must be a non-negative integer");
        }
        if (n < 0) {
            throw new UploadException(400, name + " must be a non-negative integer");
        }
        return n;
    }

    /**
     * Location 은 요청 URI 기준 상대 경로 (`/ctx/upload/{id}`) — 프록시 뒤에서 scheme/host 를 잘못 추측하지 않는다.
     * 클라이언트는 요청 URL 기준으로 해석한다 (tus-js-client · @composition/upload 동일).
     */
    private static String locationFor(HttpServletRequest request, String id) {
        String uri = request.getRequestURI();
        if (uri.endsWith("/")) {
            uri = uri.substring(0, uri.length() - 1);
        }
        return uri + "/" + id;
    }
}
