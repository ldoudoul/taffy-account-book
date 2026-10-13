"""Build and verify a signed, universal APK using official Android SDK tools."""
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / '源码'
TOOLS = ROOT / '构建工具'
BUILD = ROOT / 'build'
BUILD.mkdir(exist_ok=True)
JDK = next((TOOLS / 'jdk').glob('jdk-*'))
SDK = TOOLS / 'build-tools/android-15'
ANDROID = TOOLS / 'platform/android-35/android.jar'
ENV = {**os.environ, 'JAVA_HOME': str(JDK), 'PATH': str(JDK / 'bin') + os.pathsep + os.environ.get('PATH', '')}


def run(command):
    subprocess.run([str(c) for c in command], env=ENV, check=True, cwd=ROOT)


def main():
    staged = BUILD / 'src'
    shutil.copytree(SOURCE, staged, dirs_exist_ok=True, ignore=shutil.ignore_patterns('*.md', '*.ico'))
    for extra in (staged / 'assets').rglob('*'):
        if extra.is_file() and extra.suffix in ('.md', '.ico'):
            extra.unlink()
    shutil.copyfile(ANDROID, BUILD / 'android.jar')
    res = BUILD / 'resources.zip'
    unsigned = BUILD / 'unsigned.apk'
    aligned = BUILD / 'aligned.apk'
    classes = BUILD / 'classes'
    classes.mkdir(exist_ok=True)
    run([SDK / 'aapt2.exe', 'compile', '--dir', 'build/src/res', '-o', 'build/resources.zip'])
    run([SDK / 'aapt2.exe', 'link', '-o', 'build/resource.apk', '-I', 'build/android.jar', '--manifest', 'build/src/AndroidManifest.xml',
         '-A', 'build/src/assets', '--min-sdk-version', '26', '--target-sdk-version', '35', 'build/resources.zip'])
    run([JDK / 'bin/javac.exe', '-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', ANDROID,
         '-d', classes, SOURCE / 'java/cn/meowledger/app/MainActivity.java'])
    run([JDK / 'bin/java.exe', '-cp', SDK / 'lib/d8.jar', 'com.android.tools.r8.D8', '--min-api', '26',
         '--lib', ANDROID, '--output', BUILD, *classes.rglob('*.class')])
    with zipfile.ZipFile(BUILD / 'resource.apk') as resources, zipfile.ZipFile(unsigned, 'w') as archive:
        for info in resources.infolist():
            archive.writestr(info, resources.read(info.filename))
        archive.write(BUILD / 'classes.dex', 'classes.dex')
    run([SDK / 'zipalign.exe', '-f', '-p', '4', 'build/unsigned.apk', 'build/aligned.apk'])
    signing = ROOT / '签名'
    signing.mkdir(exist_ok=True)
    password = signing / '签名密码.txt'
    key = signing / 'meowledger-release.jks'
    if not key.exists():
        password.write_text(secrets.token_urlsafe(32), encoding='utf-8')
        run([JDK / 'bin/keytool.exe', '-genkeypair', '-keystore', key, '-alias', 'meowledger',
             '-storepass:file', password, '-keypass:file', password, '-keyalg', 'RSA', '-keysize', '2048',
             '-validity', '10000', '-dname', 'CN=Meow Ledger, O=Meow Ledger Project, C=CN', '-noprompt'])
    apk = BUILD / 'MeowLedger-1.0.0.apk'
    run([JDK / 'bin/java.exe', '-jar', SDK / 'lib/apksigner.jar', 'sign', '--ks', key,
         '--ks-key-alias', 'meowledger', '--ks-pass', 'file:' + str(password),
         '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true',
         '--out', apk, aligned])
    verify = subprocess.run([str(JDK / 'bin/java.exe'), '-jar', str(SDK / 'lib/apksigner.jar'),
                             'verify', '--verbose', '--print-certs', str(apk)], check=True, env=ENV, capture_output=True, text=True)
    (ROOT / '验证/签名验证.txt').write_text(verify.stdout, encoding='utf-8')
    run([SDK / 'zipalign.exe', '-c', '-p', '4', 'build/MeowLedger-1.0.0.apk'])
    destination = ROOT / '安装包/记账喵-1.0.0-Android.apk'
    destination.parent.mkdir(exist_ok=True)
    shutil.copyfile(apk, destination)
    report = {'apk': destination.name, 'bytes': apk.stat().st_size, 'MiB': round(apk.stat().st_size / 1048576, 2),
              'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'minAndroid': '8.0', 'targetSdk': 35,
              'signed': True, 'deviceTested': False}
    (ROOT / '验证/APK测量.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
