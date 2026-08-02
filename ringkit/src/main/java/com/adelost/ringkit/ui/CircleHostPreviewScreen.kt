package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CIRCLE_WATCH_PREVIEW_DIAMETERS_DP
import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.CircleHostMode
import com.adelost.designkit.ui.CircleHostOrientation
import com.adelost.designkit.ui.CircleHostPreviewState
import com.adelost.designkit.ui.RingIcons
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map

/** Native state/callback port. The shared screen owns only presentation. */
data class CircleHostPreviewPort(
    val isWatchDevice: Boolean,
    val state: StateFlow<CircleHostPreviewState>,
    val systemOrientationAllowed: Boolean,
    val onMode: (CircleHostMode) -> Unit,
    val onDiameter: (Float) -> Unit,
    val onOrientation: (CircleHostOrientation) -> Unit,
)

fun circleHostPreviewScreen(port: CircleHostPreviewPort): RingScreen.Rows = RingScreen.Rows(
    title = "DEV HOST",
    items = port.state.map { state -> circleHostPreviewRows(port, state) },
)

private fun circleHostPreviewRows(
    port: CircleHostPreviewPort,
    state: CircleHostPreviewState,
): List<RowSpec> = buildList {
    if (!port.isWatchDevice) {
        add(
            RowSpec(
                key = "host-mode",
                title = "LAYOUT",
                sub = state.mode.optionLabel,
                icon = if (state.mode == CircleHostMode.WATCH_EXACT) RingIcons.Watch else RingIcons.Phone,
                choices = CircleHostMode.entries.map(CircleHostMode::optionLabel),
                onSelect = { label ->
                    port.onMode(requireNotNull(CircleHostMode.entries.singleOrNull { it.optionLabel == label }))
                },
            ),
        )
        if (state.mode == CircleHostMode.WATCH_EXACT) {
            add(
                RowSpec(
                    key = "watch-diameter",
                    title = "WATCH SIZE",
                    sub = "${state.watchDiameterDp.toInt()} DP",
                    icon = RingIcons.Ruler,
                    choices = CIRCLE_WATCH_PREVIEW_DIAMETERS_DP.map { it.toInt().toString() },
                    onSelect = { label ->
                        val diameter = requireNotNull(
                            CIRCLE_WATCH_PREVIEW_DIAMETERS_DP.singleOrNull { it.toInt().toString() == label },
                        )
                        port.onDiameter(diameter)
                    },
                ),
            )
        }
        val orientations = CircleHostOrientation.entries.filter {
            port.systemOrientationAllowed || it != CircleHostOrientation.SYSTEM
        }
        add(
            RowSpec(
                key = "orientation",
                title = "ORIENTATION",
                sub = state.orientation.optionLabel,
                icon = RingIcons.RotationRate,
                choices = orientations.map(CircleHostOrientation::optionLabel),
                onSelect = { label ->
                    port.onOrientation(
                        requireNotNull(orientations.singleOrNull { it.optionLabel == label }),
                    )
                },
            ),
        )
    }
    add(
        RowSpec(
            key = "derived-surface",
            title = "SURFACE",
            sub = if (port.isWatchDevice || state.mode == CircleHostMode.WATCH_EXACT) {
                "ROUND · WATCH EXACT"
            } else {
                "FROM LIVE BOUNDS"
            },
            icon = RingIcons.Grid,
            choiceRole = CircleChoiceRole.STEPPED,
        ),
    )
}
