package com.adelost.ringkit.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import com.adelost.designkit.measurement.LocalDisplayUnits
import com.adelost.designkit.ui.GraphiteTokens
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.SkyvwActionTiming
import com.adelost.designkit.ui.SkyvwColorScheme
import com.adelost.designkit.ui.SkyvwColorSchemes
import com.adelost.designkit.ui.SkyvwColorTheme
import com.adelost.designkit.ui.SkyvwIconDisc
import kotlin.math.roundToInt

@Composable
internal fun ColorPickerScreen(
    screen: RingScreen.ColorPicker,
    nav: RingNavigator,
) {
    val selected = screen.selected.collectAsState(initial = SkyvwColorTheme.SEA_GLASS).value
    ColorPickerContent(
        title = screen.title,
        selected = selected,
        preview = screen.dialPreview,
        onSelect = screen.onSelect,
        onPreview = { altitudeM ->
            nav.push(
                RingScreen.DialPreview(
                    startAltitudeM = altitudeM,
                    theme = selected,
                    spec = screen.dialPreview,
                ),
            )
        },
        phone = false,
    )
}

@Composable
internal fun PhoneColorPickerScreen(
    screen: RingScreen.ColorPicker,
    nav: RingNavigator,
    onBack: () -> Unit,
) {
    val selected = screen.selected.collectAsState(initial = SkyvwColorTheme.SEA_GLASS).value
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PhoneScreenHeader(screen.title, onBack)
        ColorPickerContent(
            title = screen.title,
            selected = selected,
            preview = screen.dialPreview,
            onSelect = screen.onSelect,
            onPreview = { altitudeM ->
                nav.push(
                    RingScreen.DialPreview(
                        startAltitudeM = altitudeM,
                        theme = selected,
                        spec = screen.dialPreview,
                    ),
                )
            },
            phone = true,
        )
    }
}

@Composable
private fun ColorPickerContent(
    title: String,
    selected: SkyvwColorTheme,
    preview: ColorDialPreviewSpec,
    onSelect: (SkyvwColorTheme) -> Unit,
    onPreview: (Float) -> Unit,
    phone: Boolean,
) {
    val scheme = SkyvwColorSchemes.resolve(selected)
    val units = LocalDisplayUnits.current
    var startAltitudeM by remember(preview) { mutableFloatStateOf(preview.defaultAltitudeM) }
    val altitudeLabel = units.formatAltitude(startAltitudeM).spaced()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (phone) Modifier.padding(horizontal = 24.dp) else Modifier),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (!phone) ScreenTitle(title)
        Spacer(Modifier.height(if (phone) 8.dp else 2.dp))
        Text(
            text = selected.optionLabel,
            color = scheme.highlight,
            fontSize = if (phone) 15.sp else 8.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = if (phone) 1.8.sp else 0.8.sp,
        )
        Text(
            text = selected.character,
            color = GraphiteTokens.Muted,
            fontSize = if (phone) 10.sp else 6.sp,
            letterSpacing = 0.6.sp,
        )
        Spacer(Modifier.height(if (phone) 18.dp else 3.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (phone) Modifier else Modifier.padding(horizontal = 30.dp)),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.Top,
        ) {
            SkyvwColorSchemes.all.forEach { candidate ->
                ColorSchemeChoice(
                    scheme = candidate,
                    selected = candidate.theme == selected,
                    onTap = { onSelect(candidate.theme) },
                    phone = phone,
                )
            }
        }
        Spacer(Modifier.height(if (phone) 28.dp else 4.dp))
        Text(
            text = "START · $altitudeLabel",
            color = scheme.supporting,
            fontSize = if (phone) 11.sp else 6.5.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.7.sp,
        )
        AltitudePreviewScrubber(
            altitudeM = startAltitudeM,
            spec = preview,
            scheme = scheme,
            onAltitudeChange = { startAltitudeM = it },
            phone = phone,
        )
        Spacer(Modifier.height(if (phone) 18.dp else 2.dp))
        SkyvwIconDisc(
            icon = RingIcons.Play,
            contentDescription = "Preview from $altitudeLabel",
            actionLabel = "PREVIEW",
            onTap = { onPreview(startAltitudeM) },
            diameter = if (phone) 52.dp else MenuDesign.watchActionRingDiameter,
            iconSize = if (phone) 23.dp else MenuDesign.iconSize,
            active = true,
            iconTint = scheme.active,
            timing = SkyvwActionTiming.IMMEDIATE,
        )
        Text(
            text = "PREVIEW",
            color = scheme.highlight,
            fontSize = if (phone) 10.sp else 6.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.7.sp,
        )
        Spacer(Modifier.height(if (phone) 32.dp else 0.dp))
    }
}

@Composable
private fun ColorSchemeChoice(
    scheme: SkyvwColorScheme,
    selected: Boolean,
    onTap: () -> Unit,
    phone: Boolean,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        SkyvwIconDisc(
            icon = RingIcons.Palette,
            contentDescription = "Use ${scheme.theme.optionLabel}",
            // The palette's own name IS the action here: a bare "USE" would
            // name the gesture and hide the only part worth reading.
            actionLabel = scheme.theme.optionLabel,
            onTap = onTap,
            diameter = if (phone) 52.dp else MenuDesign.watchActionRingDiameter,
            iconSize = if (phone) 23.dp else MenuDesign.iconSize,
            active = selected,
            iconTint = scheme.active,
            timing = SkyvwActionTiming.DELIBERATE,
        )
        Spacer(Modifier.height(if (phone) 7.dp else 2.dp))
        Text(
            text = scheme.theme.shortLabel,
            color = if (selected) scheme.highlight else GraphiteTokens.Muted,
            fontSize = if (phone) 10.sp else 5.8.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
        )
    }
}

@Composable
private fun AltitudePreviewScrubber(
    altitudeM: Float,
    spec: ColorDialPreviewSpec,
    scheme: SkyvwColorScheme,
    onAltitudeChange: (Float) -> Unit,
    phone: Boolean,
) {
    val fraction = (altitudeM / spec.maxAltitudeM).coerceIn(0f, 1f)
    val currentColor = spec.colorAt(altitudeM, scheme.theme)

    fun altitudeAt(x: Float, width: Float): Float =
        previewAltitudeAtFraction(x / width.coerceAtLeast(1f), spec.maxAltitudeM)

    Canvas(
        modifier = Modifier
            .fillMaxWidth(if (phone) 0.82f else 0.72f)
            .height(if (phone) 34.dp else 18.dp)
            .semantics {
                contentDescription = "Preview start altitude"
                progressBarRangeInfo = ProgressBarRangeInfo(
                    altitudeM,
                    0f..spec.maxAltitudeM,
                    0,
                )
                setProgress { requested ->
                    onAltitudeChange(requested.coerceIn(0f, spec.maxAltitudeM))
                    true
                }
            }
            .pointerInput(spec.maxAltitudeM) {
                detectDragGestures(
                    onDragStart = { start -> onAltitudeChange(altitudeAt(start.x, size.width.toFloat())) },
                ) { change, _ ->
                    onAltitudeChange(altitudeAt(change.position.x, size.width.toFloat()))
                    change.consume()
                }
            },
    ) {
        val y = size.height / 2f
        val stroke = if (phone) 4.dp.toPx() else 2.dp.toPx()
        drawLine(
            color = scheme.subdued.copy(alpha = 0.55f),
            start = Offset(0f, y),
            end = Offset(size.width, y),
            strokeWidth = stroke,
            cap = StrokeCap.Round,
        )
        drawLine(
            color = scheme.active,
            start = Offset(0f, y),
            end = Offset(size.width * fraction, y),
            strokeWidth = stroke,
            cap = StrokeCap.Round,
        )
        spec.checkpointsM.distinct().forEach { checkpoint ->
            val x = size.width * (checkpoint / spec.maxAltitudeM).coerceIn(0f, 1f)
            drawLine(
                color = spec.colorAt(checkpoint, scheme.theme).copy(alpha = 0.8f),
                start = Offset(x, y - stroke * 1.8f),
                end = Offset(x, y + stroke * 1.8f),
                strokeWidth = stroke * 0.65f,
                cap = StrokeCap.Round,
            )
        }
        drawCircle(
            color = Color.Black,
            radius = stroke * 2.2f,
            center = Offset(size.width * fraction, y),
        )
        drawCircle(
            color = currentColor,
            radius = stroke * 1.45f,
            center = Offset(size.width * fraction, y),
        )
    }
}

@Composable
internal fun DialPreviewScreen(screen: RingScreen.DialPreview) {
    val altitude = remember(screen) { Animatable(screen.startAltitudeM) }
    LaunchedEffect(screen) {
        altitude.snapTo(screen.startAltitudeM)
        altitude.animateTo(
            targetValue = 0f,
            animationSpec = tween(
                durationMillis = colorPreviewDurationMs(
                    screen.startAltitudeM,
                    screen.spec.maxAltitudeM,
                ),
                easing = LinearEasing,
            ),
        )
    }
    screen.spec.render(
        altitude.value,
        screen.theme,
        Modifier.fillMaxSize(),
    )
}

@Composable
internal fun PhoneDialPreviewScreen(
    screen: RingScreen.DialPreview,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PhoneScreenHeader(screen.title, onBack)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 560.dp)
                .aspectRatio(1f),
        ) {
            DialPreviewScreen(screen)
        }
    }
}

internal fun previewAltitudeAtFraction(fraction: Float, maxAltitudeM: Float): Float =
    (fraction.coerceIn(0f, 1f) * maxAltitudeM / 50f).roundToInt() * 50f

internal fun colorPreviewDurationMs(startAltitudeM: Float, maxAltitudeM: Float): Int =
    (12_000f * (startAltitudeM / maxAltitudeM).coerceIn(0f, 1f))
        .roundToInt()
        .coerceAtLeast(3_000)
