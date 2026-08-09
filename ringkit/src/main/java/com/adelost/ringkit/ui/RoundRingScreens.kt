package com.adelost.ringkit.ui

import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.*

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import com.adelost.ringkit.data.Health

/**
 * The ROUND half of the one renderer: [RingScreen] data turned into watch
 * pixels. [PhoneRingScreens] is its sibling, and [RingScreens] holds the data
 * these two interpret plus the surface dispatch that picks between them.
 *
 * Nothing here is reachable except through that dispatch, so a round layout
 * decision cannot leak onto the phone by being written in the wrong file.
 *
 * Round geometry is the recurring subject: the circle eats row edges and the
 * chrome mounted from 9 o'clock eats more, so the insets are measured rather
 * than guessed. Those measurements live in designkit next to the atoms they
 * constrain; this file only asks for them.
 */
@Composable
internal fun MenuScreen(
    screen: RingScreen.Menu,
    nav: RingNavigator,
) {
    when (screen) {
        is RingScreen.Launcher -> LauncherScreen(screen, nav, screen.gridRole)
        is RingScreen.Rows -> RowsScreen(screen, nav)
    }
}

/**
 * The screen's name, kept inside the round face.
 *
 * The title sits HIGH, where the circle is at its narrowest, and it was the
 * one surface in the menu system that did not take the shared round-safe
 * inset: every row below it steps aside from the arc, the heading above them
 * did not. So ALARM HEIGHTS rendered as "ARM HEIGH" and MAP OBJECTS as
 * "AP OBJECT" — letters gone from both ends, with no ellipsis to admit it.
 *
 * [roundSafeContentInset] measures its own position, which is exactly what a
 * heading needs: hosts place it at different heights, and the answer to "how
 * wide may I be here" differs at each one. Ellipsis on top, so a title that
 * still cannot fit says so instead of losing its last letter silently.
 */
@Composable
internal fun ScreenTitle(
    text: String,
    icon: ImageVector? = null,
    topPadding: Dp = MenuDesign.roundTitleTopPadding,
) {
    Row(
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = topPadding)
            .roundSafeContentInset(),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = RingTokens.Dim, modifier = Modifier.width(14.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(
            text = text,
            color = RingTokens.Dim,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 3.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
internal fun HubScreen(s: RingScreen.Hub, nav: RingNavigator) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val face = minOf(maxWidth, maxHeight).value
        val statDiameter = hubStatRingDiameterDp(
            viewportDiameterDp = face,
            reservedSlots = LocalRoundChromeReservation.current,
        ).dp
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxSize().padding(top = 6.dp),
        ) {
            ScreenTitle(s.title)
            Spacer(Modifier.height(6.dp))
            s.rows.chunked(HUB_COLUMNS).forEach { rowChunk ->
                Row(horizontalArrangement = Arrangement.spacedBy(HUB_GAP_DP.dp)) {
                    rowChunk.forEach { row ->
                        val value = row.value.collectAsState(initial = "–").value
                        val health = row.health.collectAsState(initial = Health.OFF).value
                        val iconRotation = row.iconRotation.collectAsState(initial = 0f).value
                        StatRing(
                            icon = row.icon,
                            iconRotationDeg = iconRotation,
                            value = value,
                            health = health,
                            label = row.label,
                            diameter = statDiameter,
                            onTap = { nav.push(row.detail()) },
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
            }
            Spacer(Modifier.height(2.dp))
            s.corner?.let { corner ->
                IconRing(
                    icon = corner.icon,
                    label = "",
                    diameter = MenuDesign.cornerDiameter,
                    onTap = { corner.open()?.let(nav::push) ?: corner.run?.invoke() },
                )
            }
        }
    }
}

private const val HUB_COLUMNS = 3
private const val HUB_GAP_DP = 3f

/** Keeps the hub centred while shrinking only when floating chrome consumes its chord. */
internal fun hubStatRingDiameterDp(
    viewportDiameterDp: Float,
    reservedSlots: List<CircleChromeSlot>,
): Float {
    val chromeInset = roundChromeInsetDp(
        viewportWidthDp = viewportDiameterDp,
        viewportHeightDp = viewportDiameterDp,
        contentCenterYDp = viewportDiameterDp / 2f,
        reservedSlots = reservedSlots,
    )
    val availableWidth = (viewportDiameterDp - chromeInset * 2f).coerceAtLeast(0f)
    val diameterByWidth = (
        availableWidth - HUB_GAP_DP * (HUB_COLUMNS - 1)
        ).coerceAtLeast(0f) / HUB_COLUMNS
    return minOf(MenuDesign.statRingDiameter.value, diameterByWidth)
}

@Composable
internal fun DetailScreen(s: RingScreen.Detail) {
    val hero = s.hero.collectAsState(initial = "–").value
    val sub = s.sub.collectAsState(initial = "").value
    val freshness = s.freshness.collectAsState(initial = "").value
    val health = s.health.collectAsState(initial = Health.OFF).value
    val progress = s.progress.collectAsState(initial = null).value
    val refreshEnabled = s.refreshEnabled?.collectAsState(initial = true)?.value ?: true
    val scrollState = rememberScrollState()
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxSize().verticalScroll(scrollState).rotaryScroll(scrollState),
    ) {
        ScreenTitle(s.title, s.icon)
        Spacer(Modifier.height(10.dp))
        Text(text = hero, color = RingTokens.Ink, fontSize = 30.sp, fontWeight = FontWeight.Black)
        // A source's own words are the longest text on any menu surface --
        // "OBSERVED RESET PRESSURE + FORECAST PRESSURE TREND" -- and they were
        // centred with no width budget, so they ran off BOTH edges of the
        // round face. Same arc, same shared answer the rows already use;
        // wrapping is right here because these are sentences, not labels.
        if (sub.isNotEmpty()) {
            Text(
                text = sub,
                color = RingTokens.Dim,
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().roundSafeContentInset(),
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = freshness,
            color = health.ringColor(),
            fontSize = 10.5.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().roundSafeContentInset(),
        )
        Spacer(Modifier.height(8.dp))
        // A Detail's actions are ROWS, the same atom the rest of the menu
        // system uses. They were bare centred words, which read as captions
        // under the hero number rather than as things you could press.
        s.actions.forEach { action ->
            RingRow(
                title = action.label,
                sub = "",
                icon = action.icon,
                accent = if (action.destructive) CircleAccent.DANGER else ringIconAccent(action.icon),
                onTap = action.onRun,
                holdToConfirm = action.holdToConfirm,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 3.dp, bottom = 3.dp)
                    .roundSafeContentInset(),
            )
        }
        if (s.onRefresh != null) {
            // One verb, one feedback channel: measured fetch state lives in
            // REFRESH's label instead of a second progress ring beside it.
            RingRow(
                title = "REFRESH",
                sub = "",
                icon = RingIcons.Refresh,
                onTap = if (refreshEnabled) s.onRefresh else null,
                labelProgress = measuredWorkLabelProgress(progress, inFlight = !refreshEnabled),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 3.dp, bottom = 3.dp)
                    .roundSafeContentInset(),
            )
            Spacer(Modifier.height(6.dp))
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun LauncherScreen(
    s: RingScreen.Launcher,
    nav: RingNavigator,
    gridRole: MenuGridRole,
) {
    val grid = menuGridSpec(
        LocalCircleSurfaceLayout.current.surfaceClass,
        LocalCircleMenuDensity.current,
        gridRole,
    )
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxSize(),
    ) {
        ScreenTitle(s.title)
        Spacer(Modifier.height(8.dp))
        RingMenuGrid(items = s.entries, spec = grid) { entry ->
            val active = entry.active.collectAsState(initial = null).value
            val enabled = entry.enabled.collectAsState(initial = true).value
            val label = entry.liveLabel?.collectAsState(initial = entry.label)?.value ?: entry.label
            IconRing(
                icon = entry.icon,
                label = label,
                active = active,
                enabled = enabled,
                actionTiming = entry.actionTiming,
                diameter = grid.diameter,
                labelSize = grid.labelSize,
                onTap = { entry.open()?.let(nav::push) ?: entry.run?.invoke() },
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun RowsScreen(
    s: RingScreen.Rows,
    nav: RingNavigator,
) {
    val items: State<List<RowSpec>> = s.items.collectAsState(initial = emptyList())
    // A pushed Rows screen is a new information surface. Reusing the previous
    // screen's scroll offset made nested pages open halfway down (AUDIO ->
    // ALARM HEIGHTS could hide BREAK-OFF and PULL entirely).
    val scrollState = remember(s) { ScrollState(0) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val diameter = if (maxWidth < maxHeight) maxWidth else maxHeight
        val insets = ringRowHorizontalInsets(
            round = LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND,
        )
        // Full-width rows must start where their edges clear the round
        // frame (watch physically, phone via the WatchFrame simulation) —
        // above that depth the arc eats the row ("…ATION", 2026-07-10).
        // Circle rows have no corner chrome, but the icon ring's top sits
        // at the same chord the pill corners did, so the inset math holds.
        // A reading list keeps a STRAIGHT left edge: every row shares the
        // deepest inset any of them needs, so the width is sized for the
        // whole row band. Measuring per row is right for a focus list whose
        // rows scale as they move, but here it only made the edge ripple —
        // one row tucked in, its neighbour not. The straight edges stay fixed,
        // but a left-side X no longer steals the free right edge too.
        val rowInsets = rowsListInsetsDp(
            viewportWidthDp = diameter.value,
            viewportHeightDp = maxHeight.value,
            titleBandBottomDp = (MenuDesign.roundTitleTopPadding + MenuDesign.roundTitleHeight).value,
            baseInsetDp = insets.start.value,
            reservedSlots = LocalRoundChromeReservation.current,
        )
        val safeTop = circleSafeTopInsetDp(
            diameterDp = diameter.value,
            contentWidthDp = (maxWidth - rowInsets.start - rowInsets.end).value,
        ).dp
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxSize().verticalScroll(scrollState).rotaryScroll(scrollState),
        ) {
            // The title sits at the SAME height as on every other menu screen,
            // and the rows start below whichever comes lower.
            //
            // It used to be pinned to the bottom of a band measured for the
            // ROWS' width. That band is short exactly when the rows are wide,
            // so the heading was pushed into the narrowest part of the circle
            // and lost letters at both ends: ALARM HEIGHTS rendered as
            // "ARM HEIGH", MAP OBJECTS as "AP OBJECT". Hub and Detail titles
            // were always fine, because they use this fixed height — the bug
            // was never the title, it was placing it by the rows' geometry.
            //
            // The band answers to the CIRCLE only. That holds because chrome
            // is mounted from 9 o'clock downward (see ROUND_CHROME_* slots),
            // leaving the top of the face free. A future button at 11, 12 or 1
            // would silently overlap the title, so such a slot must take the
            // reservation into account here as well (circle:8 review).
            ScreenTitle(s.title)
            Spacer(Modifier.height(maxOf(safeTop - MenuDesign.roundTitleTopPadding, 8.dp)))
            items.value.forEach { row ->
                val rowModifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 3.dp, bottom = 3.dp)
                    .padding(start = rowInsets.start, end = rowInsets.end)
                when (rowKind(row)) {
                    RowKind.ADJUSTMENT -> {
                        val link = adjustmentLinkRow(row) {
                            nav.push(s.adjustmentScreen(row))
                        }
                        RingRow(
                            title = link.title,
                            sub = link.sub,
                            icon = link.icon,
                            accent = link.accent,
                            semanticColor = row.semanticColor,
                            onTap = link.onTap,
                            hint = row.hint,
                            infoAction = row.infoAction,
                            modifier = rowModifier,
                        )
                    }
                    RowKind.TOGGLE, RowKind.CHOICE_OF_N -> {
                        val interaction = choiceRowInteraction(row)
                        RingChoiceRow(
                            title = row.title,
                            selected = row.sub,
                            icon = row.icon,
                            accent = row.accent,
                            options = row.choices,
                            role = row.choiceRole,
                            onSelect = requireNotNull(row.onSelect),
                            holdMs = interaction.holdMs,
                            actionTiming = interaction.timing,
                            hint = row.hint,
                            infoAction = row.infoAction,
                            modifier = rowModifier,
                        )
                    }
                    RowKind.INFORMATION, RowKind.ACTION -> RingRow(
                        title = row.title,
                        sub = row.sub,
                        icon = row.icon,
                        accent = row.accent,
                        semanticColor = row.semanticColor,
                        onTap = row.onTap,
                        labelProgress = row.labelProgress,
                        holdToConfirm = row.holdToConfirm,
                        holdMs = row.holdMs,
                        centerValue = row.centerValue,
                        actionTiming = row.actionTiming,
                        hint = row.hint,
                        infoAction = row.infoAction,
                        modifier = rowModifier,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            // Bottom mirror of the safe band so the last row can scroll
            // fully clear of the lower arc.
            Spacer(Modifier.height(safeTop))
        }
    }
}
