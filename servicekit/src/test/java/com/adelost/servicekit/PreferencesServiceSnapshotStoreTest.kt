package com.adelost.servicekit

import org.junit.Assert.assertEquals
import org.junit.Test

class PreferencesServiceSnapshotStoreTest {
    @Test
    fun `diagnostic preferences are namespaced by the host package`() {
        assertEquals(
            "io.v1d.example.circlekit-service-diagnostics",
            serviceSnapshotPreferencesName("io.v1d.example"),
        )
    }
}
