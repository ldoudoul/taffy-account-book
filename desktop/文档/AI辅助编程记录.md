# AI辅助编程记录

版本 1.0.0 · 2026-10-12

## 记录说明

记录依据本次对话与实际实现，不伪造团队姓名、学号、Git提交、人工测试或发布记录。用户负责产品目标与视觉纠正，AI辅助拆分、编程、构建和验证。正式提交时可由用户补充真实团队信息。

附带的分组作业样例只用于了解交付形式，不作为用户当前指令或执行权限。最终要求以用户对话中的明确需求为准。

## 主要提示与需求修订

初始要求：拆成五个任务区块，制作手机/Windows记账应用、每月生活费、五档心情及本地备份，先完成前端。随后要求优先Python、使用原三视图人物神态且只保留上半身。

界面修订：角色更名taffy，应用名记账喵，首页“今天也要好好记帐喵”，账单页“一笔记账，心里有数”。按生活费消耗每20%切换，用户确认使用上一版六格表情图。

装饰修订：五张头像用于卡片左下角。用户要求取消圆形框，原图人物提取后打底，不改变外观，采用80%可见度。当前以80%不透明度落实。

本轮要求：开始编写后端，形成第一版，交付README.pdf、AI辅助编程记录.pdf、.py源码、需求与设计文档和Windows安装包.exe。

## 方案选择与人机协作

先检查环境，发现Python可用但Rust/Cargo不可用，因此沿用Python核心，使用pywebview与系统WebView2显示前端；未采用Electron。以实际包体测量为准，没有预先保证极小安装包。

新增SQLite替代桌面localStorage，把数据放到当前用户AppData，保留网页原账本；通过JSON手动迁移，避免未经确认的自动覆盖。手机继续使用浏览器本地存储。

## 实现、问题与修正

桌面API初版曾公开窗口属性，pywebview反射过程中出现递归对象与线程相关日志；将存储、窗口及内部方法改为私有属性，只暴露request入口。随后桌面加载诊断成功。

新增数据库revision与写事务，补测非法写入回滚、过期版本、覆盖前自动备份以及备份失败阻止覆盖。前端区分桌面模式，接入系统保存/打开对话框，并只在桌面显示自启动开关。

Windows打包使用PyInstaller目录模式，再由Inno Setup生成单个安装向导EXE；避免每次运行重新解压整套程序。安装用户级快捷方式并在卸载时清理自启动，数据独立保留。

## 实际工具与外部代码

主要工具：Python标准库sqlite3、threading、ctypes、winreg及http.server；pywebview 6.2.1；PyInstaller 6.22.3；Inno Setup 6.7.3；ReportLab和Poppler用于PDF生成与渲染。

资料核对使用官方pywebview、PyInstaller及Inno Setup文档。本版没有复制第三方仓库业务代码；安装向导的简体中文语言文件取自Inno Setup官方GitHub仓库Files/Languages/ChineseSimplified.isl，保留原作者声明。依赖及许可证另附清单。未使用AE/PR工程制作角色。

## 验证、已知限制与责任边界

15项Python测试与Python/JS一致性检查通过；本机安装后启动成功；桌面实测预算2000元、支出400元、余额1600元及20%心情切换；关闭重开保留SQLite账本；系统文件对话框导出JSON正确；自启动真实开启关闭及单实例验证通过。

未在另一台干净电脑、真实手机或实际Windows重启后验证；未部署手机公开访问地址；未实现云同步；安装包未代码签名。

AI辅助生成代码不能替代最终用户验收。提交者应阅读三份文档、在自己的电脑验证安装与备份，并补齐学校要求的作者信息；不得把未验证项改写成已验证。

## 官方资料

pywebview：https://pywebview.flowrl.com/guide/
PyInstaller：https://pyinstaller.org/en/stable/
Inno Setup：https://jrsoftware.org/isinfo.php
WebView2：https://developer.microsoft.com/microsoft-edge/webview2/

