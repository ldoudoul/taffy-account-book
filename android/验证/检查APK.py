"""Check packaged manifest, permissions, web assets, and source provenance."""
import hashlib
import json
import subprocess
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
APK = ROOT/'安装包/记账喵-1.0.0-Android.apk'
TOOLS = ROOT/'构建工具/build-tools/android-15'
with ZipFile(APK) as archive:
    assert archive.testzip() is None
    assert 'classes.dex' in archive.namelist()
    for name in ['index.html', 'app.js', 'engine.js', 'decorations.js', 'style.css',
                 'assets/companion.png', *[f'assets/decor-{n}.jpg' for n in range(1, 6)]]:
        packaged = archive.read('assets/web/'+name)
        assert packaged == (ROOT/'源码/assets/web'/name).read_bytes(), name
    assert not any(n.endswith(('.sqlite3','.jks')) for n in archive.namelist())
    assert not any('签名密码' in n or '测试账本' in n for n in archive.namelist())
badging = subprocess.run([str(TOOLS/'aapt.exe'), 'dump', 'badging', 'build/MeowLedger-1.0.0.apk'],
                          cwd=ROOT, capture_output=True, check=True)
text = badging.stdout.decode('utf-8')
assert "sdkVersion:'26'" in text and "targetSdkVersion:'35'" in text
assert 'uses-permission:' not in text
assert "launchable-activity: name='cn.meowledger.app.MainActivity'" in text
(ROOT/'验证/包信息.txt').write_text(text, encoding='utf-8')
report = json.loads((ROOT/'验证/APK测量.json').read_text(encoding='utf-8'))
assert report['sha256'] == hashlib.sha256(APK.read_bytes()).hexdigest()
print('PASS: APK ZIP, actual packaged asset equality, launcher, SDK, no runtime permissions, no test ledger/key')
