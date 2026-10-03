// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM appspec/products/skyvw/settings/alarm-heights.ts
// Generator SHA-256: 3be4dbc55a151c558c30d261efe3ece77402933d2aa387286d9988da262939c8
package com.adelost.skydivealtimeter.appspec.generated

import com.adelost.skydivealtimeter.appspec.AppSpecFlagValue
import com.adelost.skydivealtimeter.appspec.AppSpecIntValue
import com.adelost.skydivealtimeter.appspec.AppSpecStoredValue

/** Saved values with no settings row: each key, default and range as declared, read by the stores. */
object GeneratedSkyvwStoredValues {
    val AlarmBreakOff = AppSpecIntValue(id = "alarm.break-off", wireName = "alarmBreakOffM", defaultValue = 1500, min = 50, max = 6000, step = 100)
    val AlarmPull = AppSpecIntValue(id = "alarm.pull", wireName = "alarmPullM", defaultValue = 1200, min = 50, max = 6000, step = 100)
    val AlarmHardDeck = AppSpecIntValue(id = "alarm.hard-deck", wireName = "alarmHardDeckM", defaultValue = 600, min = 50, max = 6000, step = 100)
    val AlarmDownwind = AppSpecIntValue(id = "alarm.downwind", wireName = "alarmDownwindM", defaultValue = 300, min = 50, max = 6000, step = 50)
    val AlarmBase = AppSpecIntValue(id = "alarm.base", wireName = "alarmBaseM", defaultValue = 200, min = 50, max = 6000, step = 50)
    val AlarmFinal = AppSpecIntValue(id = "alarm.final", wireName = "alarmFinalM", defaultValue = 100, min = 50, max = 6000, step = 50)
    val AlarmBreakOffEnabled = AppSpecFlagValue(id = "alarm.break-off.enabled", wireName = "alarmBreakOffEnabled", defaultValue = true)
    val AlarmPullEnabled = AppSpecFlagValue(id = "alarm.pull.enabled", wireName = "alarmPullEnabled", defaultValue = true)
    val AlarmDownwindEnabled = AppSpecFlagValue(id = "alarm.downwind.enabled", wireName = "alarmDownwindEnabled", defaultValue = true)
    val AlarmBaseEnabled = AppSpecFlagValue(id = "alarm.base.enabled", wireName = "alarmBaseEnabled", defaultValue = true)
    val AlarmFinalEnabled = AppSpecFlagValue(id = "alarm.final.enabled", wireName = "alarmFinalEnabled", defaultValue = true)

    val all: List<AppSpecStoredValue> = listOf(AlarmBreakOff, AlarmPull, AlarmHardDeck, AlarmDownwind, AlarmBase, AlarmFinal, AlarmBreakOffEnabled, AlarmPullEnabled, AlarmDownwindEnabled, AlarmBaseEnabled, AlarmFinalEnabled)
}
