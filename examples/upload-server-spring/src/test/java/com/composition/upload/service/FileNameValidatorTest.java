package com.composition.upload.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.fail;

import java.text.Normalizer;

import org.junit.Test;

/** 계약 §3-1 규칙의 단위 검증 — 통과해야 하는 이름과 NFC 정규화. 거부 corpus 는 AttackCorpusTest. */
public class FileNameValidatorTest {

    @Test
    public void ordinaryNamesPass() {
        assertEquals("report 2026.pdf", FileNameValidator.validateFileName("report 2026.pdf"));
        assertEquals("my..file.txt", FileNameValidator.validateFileName("my..file.txt"));
        assertEquals("보고서_최종.hwp", FileNameValidator.validateFileName("보고서_최종.hwp"));
        assertEquals("a.b.c.tar.gz", FileNameValidator.validateFileName("a.b.c.tar.gz"));
        assertEquals("console.log", FileNameValidator.validateFileName("console.log"));
    }

    @Test
    public void nfdInputIsNormalizedToNfc() {
        String nfd = Normalizer.normalize("한글.txt", Normalizer.Form.NFD);
        String nfc = Normalizer.normalize("한글.txt", Normalizer.Form.NFC);
        assertEquals(nfc, FileNameValidator.validateFileName(nfd));
    }

    @Test
    public void exactly255CharsPassesAnd256Fails() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 251; i++) {
            sb.append('x');
        }
        String ok = sb + ".txt";
        assertEquals(255, ok.length());
        assertEquals(ok, FileNameValidator.validateFileName(ok));
        try {
            FileNameValidator.validateFileName(ok + "x");
            fail("256 chars must fail");
        } catch (FileNameValidator.ValidationException expected) {
            // ok
        }
    }

    @Test
    public void relativePathAllowsNestedFoldersAndEmpty() {
        assertNull(FileNameValidator.validateRelativePath(null));
        assertNull(FileNameValidator.validateRelativePath(""));
        assertEquals("photos/2026/a.txt", FileNameValidator.validateRelativePath("photos/2026/a.txt"));
    }

    @Test
    public void extensionIsLowercasedAndEmptyWhenMissing() {
        assertEquals("pdf", FileNameValidator.extensionOf("A.PDF"));
        assertEquals("gz", FileNameValidator.extensionOf("a.tar.gz"));
        assertEquals("", FileNameValidator.extensionOf("noext"));
        assertEquals("", FileNameValidator.extensionOf("trailing."));
    }

    @Test
    public void controlCharactersAreRejected() {
        for (String bad : new String[] { "a.txt", "a.txt", "a\tb.txt" }) {
            try {
                FileNameValidator.validateFileName(bad);
                fail("control character must fail: " + bad);
            } catch (FileNameValidator.ValidationException expected) {
                // ok
            }
        }
    }
}
