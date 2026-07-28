package com.adelost.releasekit

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DownloadedPayloadTest {
    @Test
    fun `missing truncated and checksum-tampered payloads fail closed`() {
        val directory = Files.createTempDirectory("releasekit-payload-test").toFile()
        try {
            val apk = File(directory, "update.apk")
            assertEquals("downloaded APK missing", downloadedPayloadFailure(apk, 4L, "unused"))

            apk.writeBytes(byteArrayOf(1, 2, 3))
            assertEquals("update size mismatch", downloadedPayloadFailure(apk, 4L, "unused"))

            val trusted = byteArrayOf(1, 2, 3, 4)
            apk.writeBytes(trusted)
            val digest = sha256(apk)
            assertNull(downloadedPayloadFailure(apk, trusted.size.toLong(), digest))

            apk.writeBytes(byteArrayOf(1, 2, 3, 5))
            assertEquals(
                "update checksum mismatch",
                downloadedPayloadFailure(apk, trusted.size.toLong(), digest),
            )
        } finally {
            directory.deleteRecursively()
        }
    }
}
