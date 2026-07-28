package com.adelost.releasekit

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateCacheSafetyTest {
    @Test
    fun `ready metadata can only point inside the app update cache`() {
        val root = File("build/test-cache/releasekit").absoluteFile
        assertTrue(isFileInsideDirectory(File(root, "circle-phone-update.apk"), root))
        assertFalse(isFileInsideDirectory(root, root))
        assertFalse(isFileInsideDirectory(File(root, "../recordings/session.json"), root))
        assertFalse(isFileInsideDirectory(File(root.parentFile, "releasekit-evil/update.apk"), root))
    }
}
