package com.adelost.renderkit.gestures

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The policy is applied by the gesture component, not by the surfaces.
 *
 * These tests are the reason that is safe: the filter is a pure function over
 * the delta, so what every ISO surface and the map will do can be checked here
 * without a device, a Compose harness or a gesture.
 */
class GestureInterpretationTest {

    private val drag = DirectManipulationDelta.Drag(
        panPx = Offset(12f, -8f),
        panFraction = Offset(0.12f, -0.08f),
    )
    private val transform = DirectManipulationDelta.Transform(
        panPx = Offset(12f, -8f),
        panFraction = Offset(0.12f, -0.08f),
        zoomFactor = 1.25f,
    )

    @Test
    fun `the default reading changes nothing`() {
        // Everything below only matters if the untouched app is untouched.
        assertEquals(drag, GestureInterpretation().filter(drag))
        assertEquals(transform, GestureInterpretation().filter(transform))
    }

    @Test
    fun `ORBIT keeps the turn and drops the tilt`() {
        val filtered = GestureInterpretation(drag = DragInterpretation.ORBIT)
            .filter(drag) as DirectManipulationDelta.Drag

        assertEquals(Offset(12f, 0f), filtered.panPx)
        assertEquals(Offset(0.12f, 0f), filtered.panFraction)
    }

    @Test
    fun `TILT keeps the eye height and drops the turn`() {
        val filtered = GestureInterpretation(drag = DragInterpretation.TILT)
            .filter(drag) as DirectManipulationDelta.Drag

        assertEquals(Offset(0f, -8f), filtered.panPx)
        assertEquals(Offset(0f, -0.08f), filtered.panFraction)
    }

    @Test
    fun `a drag along only the dropped axis is not dispatched at all`() {
        // Null rather than a zero delta: a consumer that reacts to being
        // called (anchor release, follow cancel) must not hear about a
        // gesture the jumper switched off.
        val vertical = DirectManipulationDelta.Drag(Offset(0f, -8f), Offset(0f, -0.08f))

        assertNull(GestureInterpretation(drag = DragInterpretation.ORBIT).filter(vertical))
        assertNotNull(GestureInterpretation(drag = DragInterpretation.TILT).filter(vertical))
    }

    @Test
    fun `ZOOM keeps the scale and neutralises the pan`() {
        val filtered = GestureInterpretation(pinch = PinchInterpretation.ZOOM)
            .filter(transform) as DirectManipulationDelta.Transform

        assertEquals(Offset.Zero, filtered.panPx)
        assertEquals(Offset.Zero, filtered.panFraction)
        assertEquals(1.25f, filtered.zoomFactor, 0f)
    }

    @Test
    fun `PAN keeps the movement and neutralises the scale`() {
        val filtered = GestureInterpretation(pinch = PinchInterpretation.PAN)
            .filter(transform) as DirectManipulationDelta.Transform

        assertEquals(Offset(12f, -8f), filtered.panPx)
        // 1f, not 0f: every consumer guards its zoom with a pinch threshold, so
        // a neutral factor is ignored without the consumer knowing the policy.
        assertEquals(1f, filtered.zoomFactor, 0f)
    }

    @Test
    fun `a pure pinch under PAN is not dispatched at all`() {
        val pureZoom = DirectManipulationDelta.Transform(Offset.Zero, Offset.Zero, 1.25f)

        assertNull(GestureInterpretation(pinch = PinchInterpretation.PAN).filter(pureZoom))
        assertNotNull(GestureInterpretation(pinch = PinchInterpretation.ZOOM).filter(pureZoom))
    }

    @Test
    fun `the two gestures are independent axes`() {
        // The reason this is two settings and not one enum: switching off the
        // tilt must not decide anything about what two fingers do.
        val policy = GestureInterpretation(DragInterpretation.ORBIT, PinchInterpretation.PAN)

        assertEquals(
            Offset(12f, 0f),
            (policy.filter(drag) as DirectManipulationDelta.Drag).panPx,
        )
        assertEquals(
            Offset(12f, -8f),
            (policy.filter(transform) as DirectManipulationDelta.Transform).panPx,
        )
    }
}
