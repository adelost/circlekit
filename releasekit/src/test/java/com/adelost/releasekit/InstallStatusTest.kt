package com.adelost.releasekit

import android.content.pm.PackageInstaller
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Carried over from Agentmux Link when its installer handoff was replaced by
 * this shared one — the invariant it paid for should not be lost with the code.
 */
class InstallStatusTest {
    @Test
    fun `pending confirmation and success are never shown as installer failures`() {
        // Android is about to raise its own dialog on PENDING_USER_ACTION.
        // Reporting a failure underneath it is how a working update looks broken.
        assertFalse(isInstallFailureStatus(PackageInstaller.STATUS_PENDING_USER_ACTION))
        assertFalse(isInstallFailureStatus(PackageInstaller.STATUS_SUCCESS))
        assertTrue(isInstallFailureStatus(PackageInstaller.STATUS_FAILURE))
        assertTrue(isInstallFailureStatus(PackageInstaller.STATUS_FAILURE_INVALID))
        assertTrue(isInstallFailureStatus(PackageInstaller.STATUS_FAILURE_ABORTED))
    }

    @Test
    fun `every failure names itself, and an unknown one still says something`() {
        assertEquals("Not enough storage", installFailureReasonFor(PackageInstaller.STATUS_FAILURE_STORAGE, null))
        assertEquals("Install cancelled", installFailureReasonFor(PackageInstaller.STATUS_FAILURE_ABORTED, null))
        // An unrecognised status falls back to the platform message, and to the
        // number itself when even that is absent — never to an empty string.
        assertEquals("disk on fire", installFailureReasonFor(9999, "disk on fire"))
        assertEquals("install status 9999", installFailureReasonFor(9999, null))
    }
}
