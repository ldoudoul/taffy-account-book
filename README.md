# 永雏塔菲记账本

应用名：记账喵 · Meow Ledger；记账伙伴：taffy。

白色与粉色卡片界面的本地记账应用，提供 Windows 桌面版、Android 安装版和响应式网页/PWA。记账伙伴 **taffy** 按当月生活费消耗比例变化表情。

> 首版为本地优先：手机、浏览器和 Windows 的账本独立，不自动同步。跨端转移使用 JSON 备份。

## interactivity 分支进度 · 1.2.0

新增六种人物短动画：抱金币与星星眼、猫耳轻摆、拨算盘、翻账本、量卡尺、按计算器。先选择状态，再点击塔菲；约2.2秒后恢复原预算表情，350ms柔和切换。人物腰线固定在卡片底部，移除钱包状态。

- [1.2.0 动画与验收记录](docs/1.2.0-人物动画版.md)
- [两端图标说明](docs/1.1.1-图标更新.md)
- [五个区块任务文档](docs/tasks/)

## Windows 与 Android 下载

**[下载 Windows 安装包 1.2.0（约21.3 MiB）](https://github.com/ldoudoul/taffy-account-book/releases/download/v1.2.0/taffy-account-book-1.2.0-windows-x64-setup.exe)**

**[下载 Android APK 1.2.0（约7.3 MiB）](https://github.com/ldoudoul/taffy-account-book/releases/download/v1.2.0/taffy-account-book-1.2.0-android.apk)**

[SHA256 校验文件](https://github.com/ldoudoul/taffy-account-book/releases/download/v1.2.0/SHA256SUMS.txt) · [历史 Release](https://github.com/ldoudoul/taffy-account-book/releases)

新版文件位于公开 Release v1.2.0，并保留 v1.2.0 标签下的 distribution/1.2.0 备份。Android 包已签名并校验，Android 真机安装与音效听感未验收。仓库中旧版 PDF 保留原版本记录，新功能以版本说明为准。

支持 Windows 10/11 x64。下载后双击安装，从桌面启动；系统需要 WebView2 和 .NET Framework 4.6.2 以上，使用者无需安装Python。详细安装、备份和运行依赖见下方文档。

## 功能

- 每月独立生活费预算，剩余预算 = 当月预算 − 当月支出；收入单独统计。
- 收支录入、详情、修改、确认删除，日期/分类/收支类型组合筛选。
- 内部使用整数分，最多两位小数；备份合并按账单 ID 去重。
- JSON 完整备份、CSV 账单导出，覆盖导入先备份并确认。
- 角色显示、提示和动画可关闭，尊重系统减少动态效果。
- Windows 使用 Python + SQLite，提供真实当前用户自启动开关、单实例与安装向导。
- Android 内置全部资源，使用私有原子文件保存和系统文件选择器；首次打开即可离线使用。
- PWA 支持 HTTPS 部署及添加到主屏幕。

## 项目结构

```text
desktop/
  源码/             Python 后端、Web 前端、测试及打包脚本
  文档/             README、需求设计、AI辅助记录（PDF + Markdown）
android/
  源码/             Java 原生入口、Manifest、内置前端与人物资源
  构建APK.py        编译、签名及验证 APK
  准备工具.py       准备项目内的官方便携构建工具
docs/
  tasks/            五个任务区块的当前状态
  images/           标注为浏览器模拟的手机预览
  *verification.md  验收结果及未验证事项
```

## Windows 源码运行

Windows 10/11 x64，Python 3.13，系统需要 Microsoft Edge WebView2 和 .NET Framework 4.6.2 以上。

```powershell
cd desktop/源码
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe desktop.py
```

桌面数据位于 `%LOCALAPPDATA%/MeowLedger/ledger.sqlite3`，不会写进源码目录。卸载程序保留账本，自启动默认关闭。

Windows 构建：

```powershell
.venv/Scripts/python.exe -m pip install -r requirements-build.txt
.venv/Scripts/python.exe build.py
# 安装 Inno Setup 6.7.3 后生成安装向导
.venv/Scripts/python.exe build.py --installer --iscc "完整路径/ISCC.exe"
```

安装包会生成在 `desktop/安装包`。文档生成脚本另外需要 ReportLab 和 Windows 微软雅黑；已经生成的三份 PDF 可直接阅读。

## Android 构建与安装

Android 8.0 及以上，保持系统 Android System WebView 更新。原生外壳使用 Java；手机业务使用与 Python 对照验证的 JavaScript 整数分引擎，不在手机打包 Python 或完整 Chromium。

在 Windows 的 Python 3 环境执行：

```powershell
cd android
python 准备工具.py
python 构建APK.py
python 验证/检查APK.py
```

工具只下载到项目的 `构建工具` 目录。首次构建生成本地签名，APK 位于 `android/安装包`。后续覆盖升级必须保留并复用同一签名目录；密钥和密码不会提交到 Git。

将 APK 传送到安卓手机，点开并按手机提示安装即可。详细说明见 [安卓安装说明](android/安卓安装说明.md)。原网页或 Windows 账本需导出 JSON 后手动导入安卓。

## 网页/PWA

```powershell
cd desktop/源码
python server.py --open
```

本机预览地址默认 `http://127.0.0.1:8765`。要在手机浏览器使用，将 `desktop/源码/dist` 全部文件部署到 HTTPS 静态站点；本机回环地址不属于手机访问地址。首次缓存后支持离线。清理网站数据可能丢失浏览器账本，请定期导出 JSON。

## 人物状态

以 **支出 ÷ 当月预算** 为准，20%、40%、60%、80% 边界进入下一档：

| 已消耗生活费 | 当前四表情素材 |
| --- | --- |
| 0%–低于20% | 金钱眼 |
| 20%–低于40% | 露齿笑 |
| 40%–低于60% | 担忧 |
| 60%–低于80% | 担忧 |
| 80%及以上 | 哭泣 |

未设置预算时等待，超支保持最后一档；收入不直接改变角色状态。卡片左下角人物保持原图神态，80%不透明度，不加头像框。

## 测试与验证

```powershell
cd desktop/源码
python -m unittest discover -s tests
node tests/test_parity.mjs
```

已通过 16 项 Python 测试与 Python/JavaScript 一致性检查，包括金额精度、心情边界、跨月修改删除、筛选、导入去重、SQLite 重开、事务回滚和覆盖前备份。

Windows 本机安装、启动、卸载、实际自启动开关、单实例、记账和重开保留已验证。首版安装包约 16.0 MiB，安装后程序文件约 34.4 MiB，不含系统 WebView2、账本和缓存。

Android 首版 APK 约 2.7 MiB，编译、v2/v3 签名、对齐、实际打包资源检查通过；界面和桥接回调仅做了隔离浏览器模拟，**尚未安卓真机或模拟器安装运行测试**。手机公开 PWA 地址、真机离线/键盘/文件选择及 Windows 实际重启仍待验证。

详细证据：[Windows 验证](docs/windows-verification.md)、[Android 验证](docs/android-verification.md)。仓库不包含用户账本、测试导出数据、私钥或大型工具；已验证的Windows安装包在distribution/windows保留，用于自动发布至GitHub Releases。

## 文档

- [安装与使用 PDF](desktop/文档/README.pdf)
- [项目需求与设计 PDF](desktop/文档/项目需求与设计文档.pdf)
- [AI辅助编程记录 PDF](desktop/文档/AI辅助编程记录.pdf)
- [第三方依赖及许可证](desktop/源码/第三方许可证/依赖清单.txt)

手机界面预览（浏览器模拟，非真机截图）：

<img src="docs/images/mobile-preview.png" alt="记账喵手机布局预览，浏览器模拟" width="320">

## 授权说明

本项目尚未指定开源许可证。人物素材和第三方组件的权利分别保留，发布源码不自动授予人物素材的商业使用权。详细说明见 [授权说明](LICENSE.md)。
