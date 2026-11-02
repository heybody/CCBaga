#!/bin/sh
# [INPUT]: assets/ 两张压缩品牌图、scripts/make-icon.swift 与 macOS iconutil。
# [OUTPUT]: make-ccd-icons.py 生成透明底 CCD Switch 应用/托盘图标；browser-runtime/icons 下另生成浏览器 B 图标。
# [POS]: 两个应用图标的可重复生成入口；生成后由 brand-browser.sh 与 Tauri 打包使用。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
make() {
  letter=$1; source=$2; png=$3; icns=$4
  set_dir=${work}/${letter}.iconset
  mkdir -p "$set_dir"
  for size in 16 32 128 256 512; do
    /usr/bin/swift "$root/scripts/make-icon.swift" "$source" "$set_dir/icon_${size}x${size}.png" "$size"
    /usr/bin/swift "$root/scripts/make-icon.swift" "$source" "$set_dir/icon_${size}x${size}@2x.png" "$((size * 2))"
  done
  /usr/bin/iconutil -c icns "$set_dir" -o "$icns"
  cp "$set_dir/icon_512x512.png" "$png"
}
mkdir -p "$root/browser-runtime/icons"
python3 "$root/scripts/make-ccd-icons.py"
make B "$root/assets/browser-logo.jpg" "$root/browser-runtime/icons/icon.png" "$root/browser-runtime/icons/app.icns"
echo "图标已生成"
