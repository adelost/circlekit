package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * The rectangular-host translation of Skyvw's shared atoms.
 *
 * Product state and components stay common with Wear; this data only gives a
 * touch screen a phone-readable type floor and touch geometry. Keeping the
 * values behind [SkyvwSurfaceClass] makes it impossible for a phone polish to
 * silently resize the canonical round face.
 */
@Immutable
data class PhoneSurfaceDesign(
    val screenPadding: Dp,
    val controlGap: Dp,
    val hubGrid: MenuGridSpec,
    val hubTopGap: Dp,
    val launcherGrid: MenuGridSpec,
    val actionDiameter: Dp,
    val actionIconSize: Dp,
    val actionLabelSize: TextUnit,
    val actionSupportingSize: TextUnit,
    val actionTextGap: Dp,
    val actionPaddingVertical: Dp,
    val pillMinHeight: Dp,
    val pillPaddingHorizontal: Dp,
    val pillLabelSize: TextUnit,
    val headerContentGap: Dp,
    val headerTitleSize: TextUnit,
    val headerSubtitleSize: TextUnit,
    val rowIconDiameter: Dp,
    val rowIconSize: Dp,
    val rowCenterValueSize: TextUnit,
    val rowIconTextGap: Dp,
    val rowPaddingVertical: Dp,
    val rowTitleSize: TextUnit,
    val rowSubtitleSize: TextUnit,
    val sectionLabelSize: TextUnit,
    val sectionPaddingStart: Dp,
    val sectionPaddingTop: Dp,
    val sectionPaddingBottom: Dp,
    val metadataSize: TextUnit,
)

object PhoneSurfaceDesignCatalog {
    val Compact = PhoneSurfaceDesign(
        screenPadding = 16.dp,
        controlGap = 8.dp,
        hubGrid = MenuGridCatalog.PhoneRegular.copy(
            diameter = 64.dp,
            horizontalGap = 10.dp,
            verticalGap = 14.dp,
        ),
        hubTopGap = 18.dp,
        launcherGrid = MenuGridCatalog.PhoneRegular.copy(
            // Icon launchers share the 56 dp start-screen standard; only the
            // hub's stat rings stay 64 dp because they carry a value line.
            horizontalGap = 18.dp,
            verticalGap = 14.dp,
        ),
        // 48 dp is an accessibility floor, not the desired primary-control
        // feel. 56 dp is comfortable under a thumb without turning Skyvw's
        // restrained rings into oversized mobile cards.
        actionDiameter = 56.dp,
        actionIconSize = 24.dp,
        actionLabelSize = 12.sp,
        actionSupportingSize = 10.sp,
        actionTextGap = 6.dp,
        // Row rhythm comes from MenuGridSpec.verticalGap (the menus' spacing);
        // per-cell padding on top of that would double the pitch.
        actionPaddingVertical = 0.dp,
        pillMinHeight = 48.dp,
        pillPaddingHorizontal = 18.dp,
        pillLabelSize = 12.sp,
        headerContentGap = 12.dp,
        headerTitleSize = 16.sp,
        headerSubtitleSize = 11.sp,
        rowIconDiameter = 44.dp,
        rowIconSize = 20.dp,
        rowCenterValueSize = 10.sp,
        rowIconTextGap = 12.dp,
        rowPaddingVertical = 8.dp,
        rowTitleSize = 16.sp,
        rowSubtitleSize = 12.sp,
        sectionLabelSize = 11.sp,
        sectionPaddingStart = 12.dp,
        sectionPaddingTop = 12.dp,
        sectionPaddingBottom = 6.dp,
        metadataSize = 10.sp,
    )

    // Orientation changes capacity and arrangement, never physical atom size.
    // Keeping the same dp contract prevents controls "breathing" on rotation.
    val Wide = Compact.copy(
        hubGrid = Compact.hubGrid.copy(
            columns = 6,
            horizontalGap = 18.dp,
            contentMaxWidth = 640.dp,
        ),
        hubTopGap = 28.dp,
        launcherGrid = Compact.launcherGrid.copy(
            columns = 4,
            contentMaxWidth = 620.dp,
        ),
    )
}

/** Pure resolver so layout tests can prove that ROUND never enters phone sizing. */
fun phoneSurfaceDesignFor(surfaceClass: SkyvwSurfaceClass): PhoneSurfaceDesign? =
    when (surfaceClass) {
        SkyvwSurfaceClass.ROUND -> null
        SkyvwSurfaceClass.PHONE_COMPACT -> PhoneSurfaceDesignCatalog.Compact
        SkyvwSurfaceClass.PHONE_WIDE -> PhoneSurfaceDesignCatalog.Wide
    }

@Composable
@ReadOnlyComposable
fun phoneSurfaceDesign(): PhoneSurfaceDesign =
    requireNotNull(phoneSurfaceDesignFor(LocalSkyvwSurfaceLayout.current.surfaceClass)) {
        "Phone surface design is unavailable on the canonical round host"
    }
