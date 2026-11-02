#!/usr/bin/env python3
# [INPUT]: 透明底 C 字弧与圆点 SVG、Tauri 原生图标转换器。
# [OUTPUT]: 应用 PNG/ICO/ICNS、macOS 单色托盘与 Windows 深浅两色托盘。
# [POS]: CCD Switch 图标生成入口；只替换明确列出的应用资产，不处理浏览器 B。
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bun', default='bun')
    args = parser.parse_args()
    source = ROOT / 'assets/ccd-switch-icon.svg'
    icon_dir = ROOT / 'src-tauri/icons'
    svg = source.read_text(encoding='utf-8')
    with tempfile.TemporaryDirectory(prefix='ccd-icons-') as temporary:
        work = Path(temporary)
        def convert(input_path, output, size=None):
            command = [args.bun, 'run', 'tauri', 'icon', str(input_path), '--output', str(output)]
            if size:
                command += ['--png', str(size)]
            subprocess.run(command, cwd=ROOT, check=True)
        convert(source, work / 'app')
        for name in ('icon.png', 'icon.ico', 'icon.icns'):
            shutil.copyfile(work / 'app' / name, icon_dir / name)
        shutil.copyfile(work / 'app/icon.png', ROOT / 'assets/ccd-switch-icon.png')
        variants = {
            'tray': ('#000', '#000', 48),
            'tray-windows-light': ('#172125', '#139b70', 32),
            'tray-windows-dark': ('#fff', '#66efb6', 32),
        }
        for name, (ink, dot, size) in variants.items():
            variant = svg.replace('#172125', ink).replace('#24b888', dot)
            vector = work / f'{name}.svg'
            vector.write_text(variant, encoding='utf-8', newline='\n')
            convert(vector, work / name, size)
            shutil.copyfile(work / name / f'{size}x{size}.png', icon_dir / f'{name}.png')
            if name == 'tray':
                (icon_dir / 'tray.svg').write_text(variant, encoding='utf-8', newline='\n')
    print('CCD Switch 透明图标已生成；应用与托盘共用已确认的 C 字弧轮廓。')

if __name__ == '__main__':
    main()
