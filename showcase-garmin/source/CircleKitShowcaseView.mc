import Toybox.Graphics;
import Toybox.Math;
import Toybox.WatchUi;

class CircleKitShowcaseView extends WatchUi.View {
    function initialize() {
        View.initialize();
    }

    function onUpdate(dc as Dc) as Void {
        dc.setColor(GeneratedCircleKitShowcase.COLOR_SURFACE, GeneratedCircleKitShowcase.COLOR_SURFACE);
        dc.clear();

        var centreX = dc.getWidth() / 2;
        var centreY = dc.getHeight() / 2;
        drawProgressDial(dc, centreX, centreY);

        dc.setColor(GeneratedCircleKitShowcase.COLOR_ACTION, Graphics.COLOR_TRANSPARENT);
        PixelText.draw(dc, centreX, 31, GeneratedCircleKitShowcase.PRODUCT_LABEL, 2);
        dc.setColor(GeneratedCircleKitShowcase.COLOR_MUTED, Graphics.COLOR_TRANSPARENT);
        PixelText.draw(dc, centreX, 49, GeneratedCircleKitShowcase.SURFACE_LABEL, 1);

        dc.setColor(GeneratedCircleKitShowcase.COLOR_ACTION, Graphics.COLOR_TRANSPARENT);
        PixelText.draw(dc, centreX, 91, GeneratedCircleKitShowcase.COMPONENT_LABEL, 2);
        dc.setColor(GeneratedCircleKitShowcase.COLOR_ACTION, Graphics.COLOR_TRANSPARENT);
        PixelText.draw(dc, centreX, 119, GeneratedCircleKitShowcase.SCENARIO_LABEL, 2);
        drawProductIcon(dc, centreX, 151);

        dc.setColor(GeneratedCircleKitShowcase.COLOR_FAINT, Graphics.COLOR_TRANSPARENT);
        PixelText.draw(dc, centreX, 195, GeneratedCircleKitShowcase.COMPONENT_ID_LABEL, 1);
        PixelText.draw(dc, centreX, 212, GeneratedCircleKitShowcase.FOOTER_LABEL, 1);
    }

    private function drawProgressDial(dc, centreX, centreY) {
        var radius = 112;
        dc.setColor(GeneratedCircleKitShowcase.COLOR_LINE, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);
        dc.drawCircle(centreX, centreY, radius);
        dc.setColor(GeneratedCircleKitShowcase.COLOR_ACTION, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(3);
        dc.drawCircle(centreX, centreY, radius - 7);

        for (var tick = 0; tick < 32; tick += 1) {
            var angle = (tick * Math.PI / 16.0) - (Math.PI / 2.0);
            var outer = radius - 13;
            var inner = outer - (tick % 4 == 0 ? 11 : 6);
            var x1 = centreX + (Math.cos(angle) * inner).toNumber();
            var y1 = centreY + (Math.sin(angle) * inner).toNumber();
            var x2 = centreX + (Math.cos(angle) * outer).toNumber();
            var y2 = centreY + (Math.sin(angle) * outer).toNumber();
            dc.setColor(
                tick < GeneratedCircleKitShowcase.ACTIVE_TICKS
                    ? GeneratedCircleKitShowcase.COLOR_ACTION
                    : GeneratedCircleKitShowcase.COLOR_LINE,
                Graphics.COLOR_TRANSPARENT
            );
            dc.setPenWidth(tick % 4 == 0 ? 3 : 1);
            dc.drawLine(x1, y1, x2, y2);
        }
    }

    private function drawProductIcon(dc, centreX, top) {
        var size = 28.0;
        var scale = size / GeneratedCircleKitShowcase.ICON_VIEWPORT_WIDTH;
        var left = centreX - (size / 2.0);
        dc.setColor(GeneratedCircleKitShowcase.COLOR_ICON, Graphics.COLOR_TRANSPARENT);

        for (var fillIndex = 0;
                fillIndex < GeneratedCircleKitShowcase.ICON_FILL_PATHS.size();
                fillIndex += 1) {
            var sourceFill = GeneratedCircleKitShowcase.ICON_FILL_PATHS[fillIndex];
            var fillPoints = [];
            for (var pointIndex = 0; pointIndex < sourceFill.size(); pointIndex += 1) {
                var point = sourceFill[pointIndex];
                fillPoints.add([
                    (left + (point[0] * scale)).toNumber(),
                    (top + (point[1] * scale)).toNumber()
                ]);
            }
            dc.fillPolygon(fillPoints);
        }

        for (var strokeIndex = 0;
                strokeIndex < GeneratedCircleKitShowcase.ICON_STROKE_PATHS.size();
                strokeIndex += 1) {
            var sourceStroke = GeneratedCircleKitShowcase.ICON_STROKE_PATHS[strokeIndex];
            dc.setPenWidth((GeneratedCircleKitShowcase.ICON_STROKE_WIDTHS[strokeIndex] * scale).toNumber());
            for (var lineIndex = 1; lineIndex < sourceStroke.size(); lineIndex += 1) {
                var from = sourceStroke[lineIndex - 1];
                var to = sourceStroke[lineIndex];
                dc.drawLine(
                    (left + (from[0] * scale)).toNumber(),
                    (top + (from[1] * scale)).toNumber(),
                    (left + (to[0] * scale)).toNumber(),
                    (top + (to[1] * scale)).toNumber()
                );
            }
        }
    }
}
