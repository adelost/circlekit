// GENERATED from circlekit-assets/src/circle-style.ts - do not edit.
package com.adelost.designkit.ui

data class CircleRoleStyle(val sp: Float, val weight: Int, val trackingEm: Float, val unitSp: Float, val unitWeight: Int)

enum class CircleTextFace { ONEST, BARLOW_SEMI_CONDENSED }

object CircleTextFaces { val Words = CircleTextFace.ONEST; val Numerals = CircleTextFace.BARLOW_SEMI_CONDENSED }

sealed class CircleTextRole(val name: String, val watch: CircleRoleStyle, val phone: CircleRoleStyle) {
    data object TITLE : CircleWordRole("TITLE", CircleRoleStyle(11f, 700, 0.27f, 11f, 700), CircleRoleStyle(20.307692f, 700, 0.27f, 20.307692f, 700))
    data object NAME : CircleWordRole("NAME", CircleRoleStyle(9.5f, 700, 0.02f, 9.5f, 700), CircleRoleStyle(17.538462f, 700, 0.02f, 17.538462f, 700))
    data object LABEL : CircleWordRole("LABEL", CircleRoleStyle(7.5f, 700, 0.13f, 7.5f, 700), CircleRoleStyle(13.846154f, 700, 0.13f, 13.846154f, 700))
    data object VALUE : CircleWordRole("VALUE", CircleRoleStyle(9f, 400, 0f, 9f, 400), CircleRoleStyle(16.615385f, 400, 0f, 16.615385f, 400))
    data object NUMBER : CircleTextRole("NUMBER", CircleRoleStyle(12f, 700, 0f, 7.5f, 600), CircleRoleStyle(22.153846f, 700, 0f, 13.846154f, 600))
    data object NOTE : CircleWordRole("NOTE", CircleRoleStyle(6.5f, 600, 0f, 6.5f, 600), CircleRoleStyle(12f, 600, 0f, 12f, 600))
    companion object { val entries: List<CircleTextRole> get() = listOf(TITLE, NAME, LABEL, VALUE, NUMBER, NOTE) }
}

/** Words cannot select NUMBER: only a typed value may occupy that role. */
sealed class CircleWordRole(name: String, watch: CircleRoleStyle, phone: CircleRoleStyle) : CircleTextRole(name, watch, phone)
