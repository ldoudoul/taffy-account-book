"""Download official portable JDK/Android tools into this project only."""
import hashlib
import json
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TOOLS = ROOT / '构建工具'
TOOLS.mkdir(exist_ok=True)
PACKAGES = [
    ('jdk.zip', 'https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip', None, 'jdk'),
    ('platform.zip', 'https://dl.google.com/android/repository/platform-35_r02.zip', '0bb560a90a7a2cbd0dd8348224d518b638fe7949', 'platform'),
    ('build-tools.zip', 'https://dl.google.com/android/repository/build-tools_r35_windows.zip', 'af059bb67cf7786f45ee0db85e2d24985df1b4b6', 'build-tools'),
    ('platform-tools.zip', 'https://dl.google.com/android/repository/platform-tools_r37.0.1-win.zip', 'e03e78b1d80b396f1c3358e31251cb31740e1110', 'platform-tools'),
]


def prepare(package):
    name, url, expected, directory = package
    path = TOOLS / name
    if not path.exists():
        with urllib.request.urlopen(url, timeout=90) as response, path.open('wb') as output:
            while data := response.read(1024 * 1024):
                output.write(data)
    if expected and hashlib.sha1(path.read_bytes()).hexdigest() != expected:
        raise ValueError('Official checksum mismatch: ' + name)
    destination = TOOLS / directory
    destination.mkdir(exist_ok=True)
    with zipfile.ZipFile(path) as archive:
        archive.extractall(destination)
    result = {'file': name, 'url': url, 'bytes': path.stat().st_size,
              'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    print(name + ': verified and extracted', flush=True)
    return result


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(prepare, PACKAGES))
    (TOOLS / '下载记录.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
