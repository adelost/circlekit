#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 --device phone|wear [--serial SERIAL] list|dump|reset|back"
  echo "       $0 --device phone|wear [--serial SERIAL] open CASE SCENARIO"
  echo "       $0 --device phone|wear [--serial SERIAL] invoke ACTION"
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
if [[ -z "$serial" ]]; then
  mapfile -t devices < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
  [[ ${#devices[@]} -eq 1 ]] || {
    echo "expected exactly one adb device; pass --serial" >&2
    exit 2
  }
  serial="${devices[0]}"
fi
adb_cmd=(adb -s "$serial")

"${adb_cmd[@]}" shell monkey -p "$package" 1 >/dev/null

command="$1"
shift
case "$command" in
  list|dump|reset|back)
    [[ $# -eq 0 ]] || { usage >&2; exit 2; }
    "${adb_cmd[@]}" shell am broadcast \
      -a io.v1d.circlekit.showcase.PROBE \
      --es cmd "$command"
    ;;
  open)
    [[ $# -eq 2 ]] || { usage >&2; exit 2; }
    "${adb_cmd[@]}" shell am broadcast \
      -a io.v1d.circlekit.showcase.PROBE \
      --es cmd open --es case "$1" --es scenario "$2"
    ;;
  invoke)
    [[ $# -eq 1 ]] || { usage >&2; exit 2; }
    "${adb_cmd[@]}" shell am broadcast \
      -a io.v1d.circlekit.showcase.PROBE \
      --es cmd invoke --es action "$1"
    ;;
  shot)
    [[ $# -eq 3 ]] || { usage >&2; exit 2; }
    "$0" --device "$device" --serial "$serial" open "$1" "$2" >/dev/null
    sleep 1
    "${adb_cmd[@]}" exec-out screencap -p > "$3"
    echo "$3"
    ;;
  *) usage >&2; exit 2 ;;
esac
