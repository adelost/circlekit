import SwiftUI

struct ShowcaseVectorIcon: View {
    let asset: ShowcaseIconAsset
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            let scale = min(
                geometry.size.width / asset.viewportWidth,
                geometry.size.height / asset.viewportHeight
            )
            ZStack {
                ForEach(Array(asset.paths.enumerated()), id: \.offset) { _, iconPath in
                    let shape = ShowcaseIconShape(asset: asset, iconPath: iconPath)
                    switch iconPath.style {
                    case let .fill(evenOdd):
                        shape.fill(color, style: FillStyle(eoFill: evenOdd))
                    case let .stroke(width):
                        shape.stroke(color, style: StrokeStyle(
                            lineWidth: width * scale,
                            lineCap: .round,
                            lineJoin: .round
                        ))
                    }
                }
            }
        }
    }
}

private struct ShowcaseIconShape: Shape {
    let asset: ShowcaseIconAsset
    let iconPath: ShowcaseIconPath

    func path(in rect: CGRect) -> Path {
        var path = Path()
        var current = CGPoint.zero
        for command in iconPath.commands {
            switch command {
            case let .move(x, y):
                current = CGPoint(x: x, y: y)
                path.move(to: current)
            case let .line(x, y):
                current = CGPoint(x: x, y: y)
                path.addLine(to: current)
            case let .cubic(x1, y1, x2, y2, x, y):
                current = CGPoint(x: x, y: y)
                path.addCurve(
                    to: current,
                    control1: CGPoint(x: x1, y: y1),
                    control2: CGPoint(x: x2, y: y2)
                )
            case let .quad(x1, y1, x, y):
                current = CGPoint(x: x, y: y)
                path.addQuadCurve(to: current, control: CGPoint(x: x1, y: y1))
            case let .arc(radiusX, radiusY, rotation, largeArc, sweep, x, y):
                let end = CGPoint(x: x, y: y)
                addSvgArc(
                    to: &path,
                    from: current,
                    end: end,
                    radiusX: Double(radiusX),
                    radiusY: Double(radiusY),
                    rotation: Double(rotation),
                    largeArc: largeArc,
                    sweep: sweep
                )
                current = end
            case .close:
                path.closeSubpath()
            }
        }
        let scale = min(
            rect.width / CGFloat(asset.viewportWidth),
            rect.height / CGFloat(asset.viewportHeight)
        )
        let offsetX = rect.midX - CGFloat(asset.viewportWidth) * scale / 2
        let offsetY = rect.midY - CGFloat(asset.viewportHeight) * scale / 2
        let transform = CGAffineTransform(translationX: offsetX, y: offsetY)
            .scaledBy(x: scale, y: scale)
        return path.applying(transform)
    }
}

private func addSvgArc(
    to path: inout Path,
    from start: CGPoint,
    end: CGPoint,
    radiusX initialRadiusX: Double,
    radiusY initialRadiusY: Double,
    rotation: Double,
    largeArc: Bool,
    sweep: Bool
) {
    guard start != end, initialRadiusX > 0, initialRadiusY > 0 else {
        path.addLine(to: end)
        return
    }
    let phi = rotation * .pi / 180
    let cosPhi = cos(phi)
    let sinPhi = sin(phi)
    let dx = Double(start.x - end.x) / 2
    let dy = Double(start.y - end.y) / 2
    let transformedX = cosPhi * dx + sinPhi * dy
    let transformedY = -sinPhi * dx + cosPhi * dy
    var radiusX = abs(initialRadiusX)
    var radiusY = abs(initialRadiusY)
    let scale = transformedX * transformedX / (radiusX * radiusX)
        + transformedY * transformedY / (radiusY * radiusY)
    if scale > 1 {
        let root = sqrt(scale)
        radiusX *= root
        radiusY *= root
    }
    let rx2 = radiusX * radiusX
    let ry2 = radiusY * radiusY
    let x2 = transformedX * transformedX
    let y2 = transformedY * transformedY
    let denominator = rx2 * y2 + ry2 * x2
    let numerator = max(0, rx2 * ry2 - denominator)
    let sign = largeArc == sweep ? -1.0 : 1.0
    let factor = denominator == 0 ? 0 : sign * sqrt(numerator / denominator)
    let centerXPrime = factor * radiusX * transformedY / radiusY
    let centerYPrime = factor * -radiusY * transformedX / radiusX
    let centerX = cosPhi * centerXPrime - sinPhi * centerYPrime
        + Double(start.x + end.x) / 2
    let centerY = sinPhi * centerXPrime + cosPhi * centerYPrime
        + Double(start.y + end.y) / 2
    let startVector = (
        x: (transformedX - centerXPrime) / radiusX,
        y: (transformedY - centerYPrime) / radiusY
    )
    let endVector = (
        x: (-transformedX - centerXPrime) / radiusX,
        y: (-transformedY - centerYPrime) / radiusY
    )
    let startAngle = atan2(startVector.y, startVector.x)
    var delta = signedAngle(from: startVector, to: endVector)
    if !sweep, delta > 0 { delta -= 2 * .pi }
    if sweep, delta < 0 { delta += 2 * .pi }
    let segments = max(1, Int(ceil(abs(delta) / (.pi / 2))))
    let step = delta / Double(segments)
    for segment in 0..<segments {
        addArcSegment(
            to: &path,
            centerX: centerX,
            centerY: centerY,
            radiusX: radiusX,
            radiusY: radiusY,
            cosPhi: cosPhi,
            sinPhi: sinPhi,
            startAngle: startAngle + Double(segment) * step,
            endAngle: startAngle + Double(segment + 1) * step
        )
    }
}

private func signedAngle(
    from first: (x: Double, y: Double),
    to second: (x: Double, y: Double)
) -> Double {
    atan2(first.x * second.y - first.y * second.x, first.x * second.x + first.y * second.y)
}

private func addArcSegment(
    to path: inout Path,
    centerX: Double,
    centerY: Double,
    radiusX: Double,
    radiusY: Double,
    cosPhi: Double,
    sinPhi: Double,
    startAngle: Double,
    endAngle: Double
) {
    let delta = endAngle - startAngle
    let alpha = 4.0 / 3.0 * tan(delta / 4)
    let start = ellipsePoint(
        centerX: centerX, centerY: centerY, radiusX: radiusX, radiusY: radiusY,
        cosPhi: cosPhi, sinPhi: sinPhi, angle: startAngle
    )
    let end = ellipsePoint(
        centerX: centerX, centerY: centerY, radiusX: radiusX, radiusY: radiusY,
        cosPhi: cosPhi, sinPhi: sinPhi, angle: endAngle
    )
    let startDerivative = ellipseDerivative(
        radiusX: radiusX, radiusY: radiusY, cosPhi: cosPhi, sinPhi: sinPhi, angle: startAngle
    )
    let endDerivative = ellipseDerivative(
        radiusX: radiusX, radiusY: radiusY, cosPhi: cosPhi, sinPhi: sinPhi, angle: endAngle
    )
    path.addCurve(
        to: end,
        control1: CGPoint(
            x: start.x + CGFloat(alpha * startDerivative.x),
            y: start.y + CGFloat(alpha * startDerivative.y)
        ),
        control2: CGPoint(
            x: end.x - CGFloat(alpha * endDerivative.x),
            y: end.y - CGFloat(alpha * endDerivative.y)
        )
    )
}

private func ellipsePoint(
    centerX: Double,
    centerY: Double,
    radiusX: Double,
    radiusY: Double,
    cosPhi: Double,
    sinPhi: Double,
    angle: Double
) -> CGPoint {
    CGPoint(
        x: CGFloat(centerX + radiusX * cosPhi * cos(angle) - radiusY * sinPhi * sin(angle)),
        y: CGFloat(centerY + radiusX * sinPhi * cos(angle) + radiusY * cosPhi * sin(angle))
    )
}

private func ellipseDerivative(
    radiusX: Double,
    radiusY: Double,
    cosPhi: Double,
    sinPhi: Double,
    angle: Double
) -> (x: Double, y: Double) {
    (
        x: -radiusX * cosPhi * sin(angle) - radiusY * sinPhi * cos(angle),
        y: -radiusX * sinPhi * sin(angle) + radiusY * cosPhi * cos(angle)
    )
}
