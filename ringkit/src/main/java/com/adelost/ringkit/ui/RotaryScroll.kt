package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.foundation.ScrollState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.wear.compose.foundation.rotary.RotaryScrollableDefaults
import androidx.wear.compose.foundation.rotary.rotaryScrollable

/** Gives a plain vertical ScrollState the same crown/focus contract as a Wear
 * lazy list. Apply exactly once to the one scroll owner on a screen. */
@Composable
fun Modifier.rotaryScroll(state: ScrollState): Modifier {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { focusRequester.requestFocus() }
    return rotaryScrollable(
        RotaryScrollableDefaults.behavior(scrollableState = state),
        focusRequester = focusRequester,
    )
}
