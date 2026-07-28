# CircleKit

Shared Android foundations used by Skyvw and Agentmux Link.

- `designkit`: adaptive phone and round-Wear visual language.
- `ringkit`: spec-driven phone/watch screens and controls.
- `releasekit`: update state, download, APK verification and install flow.
- `servicekit`: bounded telemetry used by the shared modules.

Consumers pin released Maven artifacts. Product data and business logic stay
in their owning applications; CircleKit owns rendering and update mechanics.

The current `com.adelost.*` package names intentionally remain source
compatible with Skyvw during the first extraction. They are API names, not
permission for product-specific behavior to enter the shared modules.
