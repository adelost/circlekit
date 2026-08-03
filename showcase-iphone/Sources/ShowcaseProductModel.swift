import SwiftUI

struct ShowcaseArtifact: Hashable {
    let id: GeneratedShowcaseArtifactId
    let rendererId: String
    let entryScreen: String
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
    let id: String
    let tokens: [ShowcasePaletteToken]

    var accent: Color {
        let token = tokens.first(where: { $0.kind == .category }) ?? tokens.first
        return Color(hex: token?.hex ?? "#ffffff")
    }
}

struct ShowcaseScenario: Identifiable, Hashable {
    let id: String
    let label: String
}

struct ShowcaseComponent: Identifiable, Hashable {
    let id: GeneratedShowcaseComponentId
    let title: String
    let iconId: String
    let scenarios: [ShowcaseScenario]
}

struct ShowcaseComponentMount: Identifiable, Hashable {
    let id: String
    let componentId: GeneratedShowcaseComponentId
    let region: String
    let order: Int
}

struct ShowcaseTree: Hashable {
    let artifactId: GeneratedShowcaseArtifactId
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
    let viewportWidth: CGFloat
    let viewportHeight: CGFloat
    let paths: [ShowcaseIconPath]
}

struct ShowcaseNativeMount: Hashable {
    let id: GeneratedShowcaseNativeMountId
    let legoSpecId: String
}

struct ShowcaseUiBinding: Hashable {
    let id: String
    let kind: String
    let ports: [String: GeneratedShowcasePortId]
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
