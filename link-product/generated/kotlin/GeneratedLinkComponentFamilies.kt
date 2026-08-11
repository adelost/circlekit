// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM link-product/src/product.ts
// Source SHA-256: d083b2858d52e7a91425fb709af5ace3cfb9a3ae2745b92226778b50c767d501
package io.v1d.link.generated

enum class GeneratedLinkComponentFamilyRef(val wireId: String) { LINK_POSITION("link.position") }
enum class GeneratedLinkComponentId(val wireId: String) { POSITION_PAGE("position.page"), PAGE_HOST("page.host") }
enum class GeneratedLinkSurfaceClass { ROUND, PHONE_COMPACT, PHONE_WIDE }

data class GeneratedLinkComponentFamilyBinding(
    val route: GeneratedLinkPageRef,
    val family: GeneratedLinkComponentFamilyRef,
    val components: Set<GeneratedLinkComponentId>,
)

object GeneratedLinkComponentFamilies {
    val bindings: Set<GeneratedLinkComponentFamilyBinding> = setOf(
        GeneratedLinkComponentFamilyBinding(
            route = GeneratedLinkPageRef.POSITION,
            family = GeneratedLinkComponentFamilyRef.LINK_POSITION,
            components = setOf(GeneratedLinkComponentId.POSITION_PAGE, GeneratedLinkComponentId.PAGE_HOST),
        ),
    )

    /** Exact mounted instances for the active product route and host surface. */
    fun resolve(
        route: GeneratedLinkPageRef,
        surfaceClass: GeneratedLinkSurfaceClass,
    ): Set<GeneratedLinkComponentId> = when (route) {
            GeneratedLinkPageRef.POSITION -> when (surfaceClass) {
                GeneratedLinkSurfaceClass.ROUND -> setOf(GeneratedLinkComponentId.POSITION_PAGE, GeneratedLinkComponentId.PAGE_HOST)
                GeneratedLinkSurfaceClass.PHONE_COMPACT -> setOf(GeneratedLinkComponentId.POSITION_PAGE, GeneratedLinkComponentId.PAGE_HOST)
                GeneratedLinkSurfaceClass.PHONE_WIDE -> setOf(GeneratedLinkComponentId.POSITION_PAGE, GeneratedLinkComponentId.PAGE_HOST)
            }
    }

    init {
        require(bindings.map { it.route }.distinct().size == bindings.size)
        require(bindings.map { it.family }.distinct().size == bindings.size)
        val mountedIdentities = bindings.flatMap { binding ->
            binding.components.map { component -> Triple(binding.route, binding.family, component) }
        }
        require(mountedIdentities.distinct().size == mountedIdentities.size)
    }
}
