"""Reproducible desktop bundle. Run using the project build virtualenv."""
import argparse
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--installer', action='store_true')
    parser.add_argument('--iscc', help='Path to Inno Setup ISCC.exe')
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    project = source.parent
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--windowed', '--onedir',
                    '--name', 'MeowLedger', '--icon', str(source / 'dist/assets/app.ico'),
                    '--distpath', str(project / '构建产物'), '--workpath', str(project / '构建缓存'),
                    '--specpath', str(source), '--add-data', str(source / 'dist') + ';dist',
                    '--add-data', str(source / '第三方许可证') + ';第三方许可证',
                    '--collect-all', 'webview', '--hidden-import', 'clr',
                    '--exclude-module', 'PyQt5', '--exclude-module', 'PyQt6', '--exclude-module', 'PySide6',
                    str(source / 'desktop.py')], cwd=source, check=True)
    if args.installer:
        compiler = args.iscc or str(project / '构建工具/InnoSetup/ISCC.exe')
        subprocess.run([compiler, str(source / 'installer.iss')], cwd=source, check=True)


if __name__ == '__main__':
    main()
