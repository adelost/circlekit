# Round menu clearance — actual native proof

Owner: skyvw:4. Baseline CircleKit e2451df / 0.3.58. Scope: shared menu
geometry and readable labels, not service, interaction timing or product order.

## Root and choice

The old row inset sampled only the viewport centre. A shell reserving X at
HOUR_10 therefore overlapped the first row although its mount was declared.
The existing rectangle/chrome calculation now reserves the whole reading band.
The same reservation feeds the shared grid; cell widths stay stable while
scrolling. No product name or alternative renderer is involved.

The former watch grid used three columns with 6 sp labels and deliberately
ignored chrome to avoid ellipsis. It cannot meet both requirements at 192 dp.
The shared round capacity is now two columns / 8 sp labels, retaining the
same 30 dp action atom and product order. Labels may take two lines. Phone
capacity is unchanged. The native Launcher now has scroll and crown handling,
like Rows; bottom entries are not permanently stranded outside the viewport.

## Evidence

- Existing RingRowLogicTest red before the fix for X@10 at 192/216 dp, green
  after; all 17 cases green. CircleGridPolicyTest 1 and MenuGridSpecTest 10
  green. Showcase Wear debug compiles. No new test files, CI or full suite.
- Actual wear34, 192 dp: `tools/showcase-probe.sh --device wear --serial
  emulator-5554 reset`; the real root renders two columns, complete first
  labels and a separate X. `root.png` inspected against those claims.
- Android PAGE_DOWN (a named hardware key, not a coordinate swipe) scrolls
  the actual launcher. `bottom.png` shows complete DATA, APP UPDATE and DEV
  labels; no fake QA renderer or scroll-state injection. Items passing the
  circular top/bottom while scrolling are naturally clipped; simultaneous
  visibility of the entire menu is neither claimed nor required.
- Named menu navigation still invokes the real entry callbacks.

84 existing icon geometries were additionally inspected at 18 and 30 px from
their actual asset paths. This is vector preview, not native renderer coverage.
No new vector shapes or semantic pigments were needed by this correction.

No data clear, density/font/location setting, updater disable or account
mutation. Release receipt is appended after immutable publication.
