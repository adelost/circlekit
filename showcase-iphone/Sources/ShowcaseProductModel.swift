import SwiftUI

struct ShowcaseArtifact: Hashable {
    let id: GeneratedShowcaseArtifactId
    let rendererId: String
    let entryScreen: String
    let screenRefs: [String]
    let surfaces: [GeneratedShowcaseSurface]
}

enum ShowcasePaletteTokenKind: String, Hashable {
    case identity
    case category
    case status
}

struct ShowcasePaletteToken: Identifiable, Hashable {
    let id: String
    let kind: ShowcasePaletteTokenKind
    let hex: String
}

struct ShowcasePalette: Hashable {
    let id: String?
    let tokens: [ShowcasePaletteToken]

    func accent(fallback: Color) -> Color {
        let token = tokens.first(where: { $0.kind == .category }) ?? tokens.first
        return token.map { Color(hex: $0.hex) } ?? fallback
    }
}

struct ShowcaseStyle: Hashable {
    let surfaceHex: String
    let actionHex: String
    let actionMutedHex: String
    let faintHex: String
    let lineHex: String
}

struct ShowcaseResolvedColors {
    let surface: Color
    let action: Color
    let muted: Color
    let faint: Color
    let line: Color
    let accent: Color
}

extension GeneratedShowcaseProduct {
    static var colors: ShowcaseResolvedColors {
        let action = Color(hex: style.actionHex)
        return ShowcaseResolvedColors(
            surface: Color(hex: style.surfaceHex),
            action: action,
            muted: Color(hex: style.actionMutedHex),
            faint: Color(hex: style.faintHex),
            line: Color(hex: style.lineHex),
            accent: palette.accent(fallback: action)
        )
    }
}

struct ShowcaseScenario: Identifiable, Hashable {
    let id: String
    let label: String
}

struct ShowcaseComponent: Identifiable, Hashable {
    let id: GeneratedShowcaseComponentId
    let rendererId: String
    let title: String
    let iconId: String
    let openPort: String
    let scenarios: [ShowcaseScenario]
}

struct ShowcaseImmutableInputBundle {
    let values: [String: Any]

    func require(_ consumerPortRef: String) -> Any {
        precondition(values[consumerPortRef] != nil, "Missing immutable Showcase input \(consumerPortRef)")
        return values[consumerPortRef]!
    }
}

struct ShowcaseBoundEventBinding {
    let sourcePortRef: String
    let targetPortRef: String
    let contractRef: String
    let emit: @MainActor (Any) -> Void
}

enum ShowcaseRendererEmitter {
    case empty((Never) -> Never)
    case typed([ShowcaseBoundEventBinding])
}

struct ShowcaseMountedRenderer {
    let componentId: GeneratedShowcaseComponentId
    let inputs: ShowcaseImmutableInputBundle
    let emitter: ShowcaseRendererEmitter

    @MainActor
    func emit(sourcePortRef: String, payload: Any) {
        guard case .typed(let bindings) = emitter else {
            preconditionFailure("Read-only Showcase renderer \(componentId.rawValue) cannot emit")
        }
        let binding = bindings.first(where: { $0.sourcePortRef == sourcePortRef })!
        binding.emit(payload)
    }
}

struct ShowcaseComponentMount: Identifiable, Hashable {
    let id: String
    let componentId: GeneratedShowcaseComponentId
    let region: String
    let order: Int
}

struct ShowcaseTree: Hashable {
    let artifactId: GeneratedShowcaseArtifactId
    let screenId: String
    let surface: GeneratedShowcaseSurface
    let mounts: [ShowcaseComponentMount]
}

enum ShowcaseIconPathStyle: Hashable {
    case fill(evenOdd: Bool)
    case stroke(width: CGFloat)
}

enum ShowcaseIconPathCommand: Hashable {
    case move(x: CGFloat, y: CGFloat)
    case line(x: CGFloat, y: CGFloat)
    case cubic(x1: CGFloat, y1: CGFloat, x2: CGFloat, y2: CGFloat, x: CGFloat, y: CGFloat)
    case quad(x1: CGFloat, y1: CGFloat, x: CGFloat, y: CGFloat)
    case arc(
        radiusX: CGFloat,
        radiusY: CGFloat,
        rotation: CGFloat,
        largeArc: Bool,
        sweep: Bool,
        x: CGFloat,
        y: CGFloat
    )
    case close
}

struct ShowcaseIconPath: Hashable {
    let style: ShowcaseIconPathStyle
    let commands: [ShowcaseIconPathCommand]
}

struct ShowcaseIconAsset: Identifiable, Hashable {
    let id: String
    let nativeSymbol: String
    let viewportWidth: CGFloat
    let viewportHeight: CGFloat
    let paths: [ShowcaseIconPath]
}

struct ShowcaseNode: Hashable {
    let id: GeneratedShowcaseNodeId
    let typeRef: String
    let kind: String
    let nativePortId: String
    let profiles: [GeneratedShowcaseArtifactId]
    let inputPorts: [String]
    let outputPorts: [String]
}

struct ShowcaseNativeMountRegistration {
    let profileId: GeneratedShowcaseArtifactId
    let pageRef: String
    let surface: GeneratedShowcaseSurface
    let mountRef: String
    let mount: @MainActor (ShowcaseImmutableInputBundle, ShowcaseRendererEmitter) -> Any
}

struct ShowcaseNativeInputRegistration {
    let consumerPortRef: String
    let producerPortRef: String
    let contractRef: String
    let required: Bool
    let read: @MainActor (ShowcaseNativeEnvironment) -> Any
}

struct ShowcaseNativeEventBindingRegistration {
    let sourcePortRef: String
    let targetPortRef: String
    let contractRef: String
    let emit: @MainActor (ShowcaseNativeEnvironment, Any) -> Void
}

enum ShowcaseNativeEventEmitterRegistration {
    case empty((Never) -> Never)
    case typed([ShowcaseNativeEventBindingRegistration])
}

struct ShowcaseNativeComponentRegistration {
    let componentInstanceRef: GeneratedShowcaseComponentId
    let componentTypeRef: String
    let mounts: [ShowcaseNativeMountRegistration]
    let immutableInputs: [ShowcaseNativeInputRegistration]
    let eventEmitter: ShowcaseNativeEventEmitterRegistration
}

struct ShowcasePortBinding: Hashable {
    let kind: String
    let from: GeneratedShowcasePortId
    let to: GeneratedShowcasePortId
    let purpose: String
}

struct ShowcaseNavigationPage: Hashable {
    let pageRef: String
    let restore: String
    let back: String
    let guardContractRef: String?
}

struct ShowcaseNavigationArtifact: Hashable {
    let artifactId: GeneratedShowcaseArtifactId
    let entryPageRef: String
    let pages: [ShowcaseNavigationPage]
}

struct ShowcaseActivePageBinding: Hashable {
    let publisherPortRef: GeneratedShowcasePortId
    let pageHostPortRef: GeneratedShowcasePortId
}

struct ShowcaseNavigationAction: Hashable {
    let sourcePortRef: GeneratedShowcasePortId
    let targetPortRef: GeneratedShowcasePortId
    let effect: String
}

struct ShowcaseNavigationActionGroup: Hashable {
    let artifactId: GeneratedShowcaseArtifactId
    let componentId: GeneratedShowcaseComponentId
    let actions: [ShowcaseNavigationAction]
}

extension Color {
    init(hex: String) {
        let value = UInt64(hex.dropFirst(), radix: 16) ?? 0xffffff
        self.init(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }
}
