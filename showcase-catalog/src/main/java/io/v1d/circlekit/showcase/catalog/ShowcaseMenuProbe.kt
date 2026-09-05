package io.v1d.circlekit.showcase.catalog

import com.adelost.ringkit.ui.RingNavigator
import com.adelost.ringkit.ui.RingScreen

/** Called only by the hosts' DEBUG receiver. Invokes actual launcher callbacks. */
object ShowcaseMenuProbe {
    fun handle(command: ShowcaseProbeCommand, session: ShowcaseSession, navigator: RingNavigator): Boolean? {
        if (command.verb != "menu") return null
        val path = command.value ?: return false
        session.closeSelection()
        session.restoreEntryPage()
        while (navigator.back()) { /* return to the real root */ }
        if (path.isBlank()) return true
        for (name in path.split('/')) {
            val current = navigator.current as? RingScreen.Launcher ?: return false
            val entry = current.entries.singleOrNull { it.label == name } ?: return false
            val next = entry.open() ?: return false
            navigator.push(next)
        }
        return true
    }
}
