package com.adelost.designkit.ui

import org.junit.Assert.assertThrows
import org.junit.Test

class MenuDesignTextBudgetTest {

    @Test
    fun `round option budget accepts its edge and rejects overflow`() {
        MenuDesign.requireMenuOptionLabel(
            label = "X".repeat(MenuDesign.menuOptionLabelMaxChars),
            owner = "fixture",
        )

        assertThrows(IllegalArgumentException::class.java) {
            MenuDesign.requireMenuOptionLabel(
                label = "X".repeat(MenuDesign.menuOptionLabelMaxChars + 1),
                owner = "fixture",
            )
        }
    }

    @Test
    fun `action cue budget accepts its edge and rejects overflow`() {
        MenuDesign.requireActionCueLabel(
            label = "X".repeat(MenuDesign.actionCueLabelMaxChars),
            owner = "fixture",
        )

        assertThrows(IllegalArgumentException::class.java) {
            MenuDesign.requireActionCueLabel(
                label = "X".repeat(MenuDesign.actionCueLabelMaxChars + 1),
                owner = "fixture",
            )
        }
    }
}
