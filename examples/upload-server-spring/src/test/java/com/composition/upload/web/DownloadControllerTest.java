package com.composition.upload.web;

import static org.junit.Assert.assertArrayEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.CoreMatchers;
import org.junit.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MvcResult;

import com.composition.upload.AbstractTusTest;

/** S6 — 다운로드: APPROVED · 소유자 · attachment · nosniff · 매직바이트 기반 Content-Type. */
public class DownloadControllerTest extends AbstractTusTest {

    @Test
    public void approvedFileDownloadsAsAttachmentWithNosniff() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("dl"));
        byte[] png = pngBytes(40);
        String location = create(s, "사진 01.png", png.length);
        mvc.perform(tusPatch(s, location, 0, png)).andExpect(status().isNoContent());

        MvcResult r = mvc.perform(get("/files/" + idOf(location)).session(s))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("Content-Disposition", CoreMatchers.startsWith("attachment;")))
            .andExpect(header().string("Content-Disposition", CoreMatchers.containsString("filename*=UTF-8''")))
            .andExpect(header().string("Content-Length", String.valueOf(png.length)))
            .andExpect(content().contentType("image/png"))
            .andReturn();
        assertArrayEquals(png, r.getResponse().getContentAsByteArray());
    }

    @Test
    public void incompleteUploadIs404() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("dl-partial"));
        String location = create(s, "partial.bin", 32);
        mvc.perform(tusPatch(s, location, 0, bytes(8, (byte) 1))).andExpect(status().isNoContent());
        mvc.perform(get("/files/" + idOf(location)).session(s)).andExpect(status().isNotFound());
    }

    @Test
    public void rejectedUploadIs404() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("dl-rejected"));
        byte[] fake = "not a png".getBytes("UTF-8");
        String location = create(s, "fake.png", fake.length);
        mvc.perform(tusPatch(s, location, 0, fake)).andExpect(status().isNoContent());
        mvc.perform(get("/files/" + idOf(location)).session(s)).andExpect(status().isNotFound());
    }

    @Test
    public void otherPrincipalIs403AndAnonymousIs401() throws Exception {
        MockHttpSession owner = sessionFor(uniqueOwner("dl-owner"));
        byte[] png = pngBytes(16);
        String location = create(owner, "mine.png", png.length);
        mvc.perform(tusPatch(owner, location, 0, png)).andExpect(status().isNoContent());

        mvc.perform(get("/files/" + idOf(location)).session(sessionFor(uniqueOwner("dl-other"))))
            .andExpect(status().isForbidden());
        mvc.perform(get("/files/" + idOf(location)).session(new MockHttpSession()))
            .andExpect(status().isUnauthorized());
    }

    @Test
    public void unknownSignatureFallsBackToOctetStream() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("dl-bin"));
        byte[] body = bytes(12, (byte) 0x7A);
        String location = create(s, "raw.bin", body.length);
        mvc.perform(tusPatch(s, location, 0, body)).andExpect(status().isNoContent());
        mvc.perform(get("/files/" + idOf(location)).session(s))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/octet-stream"));
    }
}
