#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 --device phone|wear [--serial SERIAL] list|dump|reset|back"
  echo "       $0 --device phone|wear [--serial SERIAL] open CASE SCENARIO"
  echo "       $0 --device phone|wear [--serial SERIAL] invoke ACTION"
  echo "       $0 --device phone|wear [--serial SERIAL] host-mode RESPONSIVE|WATCH_EXACT"
  echo "       $0 --device phone|wear [--serial SERIAL] watch-diameter 192|216|240|280|320|360|400"
  echo "       $0 --device phone|wear [--serial SERIAL] orientation SYSTEM|DEG_0|DEG_90|DEG_180|DEG_270"
  echo "       $0 --device phone|wear [--serial SERIAL] shot CASE SCENARIO FILE.png"
}

device=""
serial=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) device="${2:-}"; shift 2 ;;
    --serial) serial="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) break ;;
  esac
done

[[ "$device" == "phone" || "$device" == "wear" ]] || { usage >&2; exit 2; }
[[ $# -ge 1 ]] || { usage >&2; exit 2; }

package="io.v1d.circlekit.showcase.$device"
if [[ "$device" == "phone" ]]; then
  activity="$package/.PhoneShowcaseActivity"
else
  activity="$package/.WearShowcaseActivity"
fi
if [[ -z "$serial" ]]; then
  mapfile -t devices < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
  [[ ${#devices[@]} -eq 1 ]] || {
    echo "expected exactly one adb device; pass --serial" >&2
    exit 2
  }
  serial="${devices[0]}"
fi
adb_cmd=(adb -s "$serial")

"${adb_cmd[@]}" shell am start -n "$activity" >/dev/null

probe() {
  local output=""
  # The receiver is registered from onStart. A cold Activity launch can take
  # longer than `am start`, so wait for an ordered JSON reply rather than
  # silently screenshotting the root before the named command arrived.
  for _ in $(seq 1 30); do
    output="$("${adb_cmd[@]}" shell am broadcast -a io.v1d.circlekit.showcase.PROBE "$@")"
    if grep -q 'data="{' <<<"$output"; then
      printf '%s\n' "$output"
      return 0
    fi
    sleep 0.1
  done
  printf '%s\n' "$output" >&2
  echo "showcase probe receiver did not become ready" >&2
  return 1
}

command="$1"
shift
case "$command" in
  list|dump|reset|back)
    [[ $# -eq 0 ]] || { usage >&2; exit 2; }
    probe --es cmd "$command"
    ;;
  open)
    [[ $# -eq 2 ]] || { usage >&2; exit 2; }
    probe --es cmd open --es case "$1" --es scenario "$2"
    ;;
  invoke)
    [[ $# -eq 1 ]] || { usage >&2; exit 2; }
    probe --es cmd invoke --es action "$1"
    ;;
  host-mode|watch-diameter|orientation)
    [[ $# -eq 1 ]] || { usage >&2; exit 2; }
    probe --es cmd "$command" --es value "$1"
    ;;
  shot)
    [[ $# -eq 3 ]] || { usage >&2; exit 2; }
    # Re-entering the script starts the Activity twice. On a cold launch that
    # can open a second root session after the first session handled `open`.
    # Use the already-started host and receiver instead.
    probe --es cmd open --es case "$1" --es scenario "$2" >/dev/null
    sleep 1
    "${adb_cmd[@]}" exec-out screencap -p > "$3"
    echo "$3"
    ;;
  *) usage >&2; exit 2 ;;
esac
