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
    let viewportWidth: CGFloat
    let viewportHeight: CGFloat
    let paths: [ShowcaseIconPath]
}

struct ShowcaseService: Hashable {
    let id: GeneratedShowcaseServiceId
    let typeRef: String
}

struct ShowcasePortBinding: Hashable {
    let kind: String
    let from: GeneratedShowcasePortId
    let to: GeneratedShowcasePortId
    let purpose: String
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
