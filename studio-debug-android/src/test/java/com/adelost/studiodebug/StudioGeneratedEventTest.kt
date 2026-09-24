package com.adelost.studiodebug

import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StudioGeneratedEventTest {
    @Test
    fun onlyScopedGeneratedFieldsEnterTheLiveBatch() {
        val port = JSONObject("""{"kind":"port","phase":"returned","portRef":"capture.talk.command"}""")
        assertTrue(safeGeneratedFields(port, setOf("port")))
        assertFalse(safeGeneratedFields(port, setOf("decision")))
        port.put("ticket", "must-not-cross")
        assertFalse(safeGeneratedFields(port, setOf("port")))
        assertFalse(safeGeneratedFields(JSONObject("""{"kind":"command","value":1}"""), setOf("port")))
    }
}
