// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM link-product/src/product.ts
// Source SHA-256: 85f2a3bde7645a2a0c04a199be20bc4c7801290ca6f0a1aec4e68fb5de09ccbe
package io.v1d.link.generated

import com.adelost.designkit.ui.CircleSurfaceClass

enum class GeneratedLinkPositionComponent(val id: GeneratedLinkComponentId) {
    POSITION_PAGE(GeneratedLinkComponentId.POSITION_PAGE), PAGE_HOST(GeneratedLinkComponentId.PAGE_HOST)
}
enum class GeneratedLinkPositionRegion { PRIMARY, PAGE_HOST }

data class GeneratedLinkPositionMount(
    val id: String,
    val component: GeneratedLinkPositionComponent,
    val region: GeneratedLinkPositionRegion,
    val order: Int,
    val priority: Int,
    val capacity: Int?,
    val required: Boolean,
)

data class GeneratedLinkPositionTree(val mounts: List<GeneratedLinkPositionMount>) {
    val orderedMounts: List<GeneratedLinkPositionMount> = mounts.sortedWith(
        compareBy(GeneratedLinkPositionMount::order).thenBy(GeneratedLinkPositionMount::priority),
    )

    init {
        require(mounts.map { it.id }.distinct().size == mounts.size)
        require(mounts.map { it.region to it.order }.distinct().size == mounts.size)
        require(mounts == orderedMounts)
    }
}

object GeneratedLinkPositionComponents {
    val declaredSurfaceClasses: Set<CircleSurfaceClass> = setOf(
        CircleSurfaceClass.ROUND,
        CircleSurfaceClass.PHONE_COMPACT,
        CircleSurfaceClass.PHONE_WIDE,
    )

    fun resolve(surfaceClass: CircleSurfaceClass): GeneratedLinkPositionTree = when (surfaceClass) {
        CircleSurfaceClass.ROUND -> GeneratedLinkPositionTree(listOf(
            GeneratedLinkPositionMount(
                id = "position.page",
                component = GeneratedLinkPositionComponent.POSITION_PAGE,
                region = GeneratedLinkPositionRegion.PRIMARY,
                order = 0,
                priority = 0,
                capacity = null,
                required = true,
            ),
            GeneratedLinkPositionMount(
                id = "page.host",
                component = GeneratedLinkPositionComponent.PAGE_HOST,
                region = GeneratedLinkPositionRegion.PAGE_HOST,
                order = 1,
                priority = 0,
                capacity = null,
                required = true,
            ),
        ))
        CircleSurfaceClass.PHONE_COMPACT -> GeneratedLinkPositionTree(listOf(
            GeneratedLinkPositionMount(
                id = "position.page",
                component = GeneratedLinkPositionComponent.POSITION_PAGE,
                region = GeneratedLinkPositionRegion.PRIMARY,
                order = 0,
                priority = 0,
                capacity = null,
                required = true,
            ),
            GeneratedLinkPositionMount(
                id = "page.host",
                component = GeneratedLinkPositionComponent.PAGE_HOST,
                region = GeneratedLinkPositionRegion.PAGE_HOST,
                order = 1,
                priority = 0,
                capacity = null,
                required = true,
            ),
        ))
        CircleSurfaceClass.PHONE_WIDE -> GeneratedLinkPositionTree(listOf(
            GeneratedLinkPositionMount(
                id = "position.page",
                component = GeneratedLinkPositionComponent.POSITION_PAGE,
                region = GeneratedLinkPositionRegion.PRIMARY,
                order = 0,
                priority = 0,
                capacity = null,
                required = true,
            ),
            GeneratedLinkPositionMount(
                id = "page.host",
                component = GeneratedLinkPositionComponent.PAGE_HOST,
                region = GeneratedLinkPositionRegion.PAGE_HOST,
                order = 1,
                priority = 0,
                capacity = null,
                required = true,
            ),
        ))
    }
}
