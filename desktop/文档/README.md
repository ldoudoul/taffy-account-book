# README · 安装与使用

版本 1.0.0 · 2026-10-12

## 交付内容

安装包目录提供Windows x64安装程序。源码目录保存desktop.py、core.py、storage.py、windows_settings.py、server.py、build.py及测试；前端HTML/CSS/JavaScript与图片保存在源码/dist。文档目录提供本文件、AI辅助编程记录、项目需求与设计文档及可编辑Markdown。

Python承担桌面启动、业务计算、校验、SQLite持久化、系统设置和打包入口。浏览器前端必须保留HTML/CSS/JavaScript，手机离线逻辑不能直接运行Windows或Python桌面代码。

## Windows安装与启动

支持Windows 10/11 64位，需系统Microsoft Edge WebView2运行时及.NET Framework 4.6.2或以上。安装包内含Python运行环境，使用者不需要另装Python、Node、Adobe软件。

双击安装包，按向导安装到当前用户目录；桌面快捷方式默认创建。首次启动设置当前月生活费。默认不开启自启动。第一次安装的账本为空，不含验证账单。

默认程序路径：%LOCALAPPDATA%/Programs/MeowLedger。桌面账本路径：%LOCALAPPDATA%/MeowLedger/ledger.sqlite3。程序目录与账本目录分开，升级不覆盖账本。缺少WebView2时请从微软官网安装：https://developer.microsoft.com/microsoft-edge/webview2/。

## 快速使用

1. 输入大于0、最多两位小数的每月生活费。预算按月份独立保存。
2. 点击“记一笔”，选择收入/支出、金额、分类、日期及备注。
3. 在账单页查看详情、修改、筛选或经确认删除。
4. 在设置页调整预算、币种符号、人物、提示、动画与备份。

## 计算与人物规则

剩余预算 = 所选月份预算 - 该月支出。收入单独统计，不自动增加预算；设置生活费不生成收入账单。内部金额使用整数分。

人物taffy采用上一版透明上半身六格素材。已使用预算0%-<20%对应第一排第二格；20%-<40%第一排第三格；40%-<60%第一排第一格；60%-<80%第二排第二格；80%及以上第二排第三格。分界点进入下一档，超支保持最后一档，未设置预算显示等待。

卡片左下角采用用户原图人物背景遮罩，保留原始颜色与神态，显示不透明度80%，取消头像框。

## 备份、转移与恢复

设置页可导出完整JSON及CSV。JSON包含账单、每月预算与界面设置；CSV便于表格查看。自启动属于当前Windows用户系统设置，不随跨设备JSON迁移。

导入先校验，可选择合并或覆盖。合并按账单ID去重，已有预算与设置优先。覆盖前需保存JSON并确认；桌面后端还会在账本目录/backups写入自动恢复备份，备份失败时拒绝覆盖。

网页旧账本不会自动进入桌面SQLite。请在原网页导出JSON，再在桌面设置页导入。手机、网页浏览器、桌面各自保存，不自动同步。手机清理网站数据可能导致账本丢失，请定期备份。

## 自启动与卸载

设置页的Windows自启动开关读取并写入HKCU/Software/Microsoft/Windows/CurrentVersion/Run的MeowLedger值。开启失败会提示，不需要管理员权限。开机启动隐藏主窗口，再次点击桌面图标显示窗口；单实例避免重复进程。

通过Windows应用列表或开始菜单卸载。卸载清理程序、快捷方式及本应用自启动项，保留SQLite账本与自动备份。删除账本前请自行保留JSON备份。

## 手机网页/PWA

源码/dist可以部署到HTTPS静态托管。Android浏览器菜单选择安装应用/添加到主屏幕；iOS Safari分享菜单选择添加到主屏幕。首次联网缓存资源后可离线记账。Windows EXE不能在手机运行。

当前提供构建产物与部署说明，没有手机公开访问地址。本机127.0.0.1仅供当前电脑，不是手机访问链接。桌面无网络时照常运行，手机与桌面数据通过JSON手动转移。

## 开发、运行与重新构建

源码运行：安装源码/requirements.txt后，执行python desktop.py。网页开发预览：python server.py --open。后端测试：python -m unittest discover -s tests。

桌面构建：在Python虚拟环境安装requirements-build.txt，然后python build.py。生成安装包另需Inno Setup 6.7.3及三份PDF，执行python build.py --installer --iscc "ISCC.exe的完整路径"。PDF脚本为generate_documents.py，需reportlab与Windows微软雅黑字体。

程序使用系统WebView2，没有打包Chromium/Electron。文档生成、构建环境和大型设计工程不进入安装包。

## 实测与限制

安装包大小：16.0 MiB；安装后程序目录文件大小合计：34.4 MiB。数据与WebView缓存随使用增长，不包含在固定程序文件测量中。

15项Python测试与Python/JS一致性检查通过；本机安装后启动成功；桌面实测预算2000元、支出400元、余额1600元及20%心情切换；关闭重开保留SQLite账本；系统文件对话框导出JSON正确；自启动真实开启关闭及单实例验证通过。

未在另一台干净电脑、真实手机或实际Windows重启后验证；未部署手机公开访问地址；未实现云同步；安装包未代码签名。

