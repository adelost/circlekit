package com.adelost.ringkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RingTextInputSpecTest {
    @Test
    fun composerContractKeepsStateAndIntentProductOwned() {
        var next = ""
        var sends = 0
        val spec = RingTextInputSpec(
            value = "hello",
            label = "MESSAGE",
            maxLength = 12,
            onValueChange = { next = it },
            onSubmit = { sends += 1 },
        )

        spec.onValueChange("world")
        spec.onSubmit()

        assertEquals("world", next)
        assertEquals(1, sends)
    }

    @Test
    fun impossibleLengthsFailAtTheDataBoundary() {
        assertThrows(IllegalArgumentException::class.java) {
            RingTextInputSpec(
                value = "too long",
                label = "MESSAGE",
                maxLength = 3,
                onValueChange = {},
                onSubmit = {},
            )
        }
    }
}
