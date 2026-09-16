package com.composition.upload.web;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.nio.file.Path;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import com.composition.upload.service.FileNameValidator;
import com.composition.upload.service.MagicBytes;
import com.composition.upload.service.OwnerResolver;
import com.composition.upload.service.UploadException;
import com.composition.upload.service.UploadSession;
import com.composition.upload.service.UploadSessionService;

/**
 * S6 — 다운로드 예시. APPROVED 만 · 소유자만 · {@code Content-Disposition: attachment} ·
 * {@code X-Content-Type-Options: nosniff} · Content-Type 은 매직바이트로 확인된 값 또는 octet-stream.
 * 원본 파일명은 RFC 5987 ({@code filename*=UTF-8''…}) 로만 내보낸다.
 */
@Controller
@RequestMapping("/files")
public class DownloadController {

    private final UploadSessionService service;
    private final OwnerResolver owners;

    public DownloadController(UploadSessionService service, OwnerResolver owners) {
        this.service = service;
        this.owners = owners;
    }

    @RequestMapping(value = "/{id}", method = RequestMethod.GET)
    public void download(@PathVariable("id") String id, HttpServletRequest request, HttpServletResponse response)
        throws IOException {
        String owner = owners.resolve(request);
        if (owner == null) {
            throw new UploadException(401, "authentication required");
        }
        UploadSession s = service.requireApproved(id, owner);
        Path file = service.fileOf(s);
        if (!Files.isRegularFile(file)) {
            throw new UploadException(404, "file is not available");
        }
        String extension = FileNameValidator.extensionOf(s.getFileName());
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(MagicBytes.contentTypeFor(extension, file));
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Content-Disposition", "attachment; filename=\"download\"; filename*=UTF-8''" + rfc5987(s.getFileName()));
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Content-Length", String.valueOf(Files.size(file)));
        OutputStream out = response.getOutputStream();
        Files.copy(file, out);
        out.flush();
    }

    private static String rfc5987(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8").replace("+", "%20");
        } catch (UnsupportedEncodingException e) {
            return "download";
        }
    }
}
