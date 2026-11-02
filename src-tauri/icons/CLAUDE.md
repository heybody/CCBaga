# icons/
> L2 | 父级: ../CLAUDE.md
图标供 Tauri 应用包与菜单栏入口使用。
icon.png: 512 像素 RGBA 应用图标，CCD Switch 深色底 C 字弧加绿点圆角方形（源 assets/ccd-switch-icon.svg）；由 scripts/make-icons.sh 生成。
icon.ico: Tauri 原生 icon 转换器从相同 PNG 生成的 Windows 多尺寸图标。
icon.icns: macOS 应用包图标，16–1024 全尺寸 iconset 生成。
tray.svg / tray.png: macOS 菜单栏模板图标（C 字弧 + 实心点，纯黑透明 44px），main.rs 以 include_image! 嵌入并设为模板；其他平台托盘沿用应用图标。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
