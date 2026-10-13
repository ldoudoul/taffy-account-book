"""Create the three assignment PDFs and editable Markdown source documents."""
import json
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / '文档'
FONT = 'MeowChinese'
pdfmetrics.registerFont(TTFont(FONT, 'C:/Windows/Fonts/msyh.ttc'))
STYLE = {
    'title': ParagraphStyle('title', fontName=FONT, fontSize=24, leading=34, textColor=colors.HexColor('#9f5678'), spaceAfter=12),
    'subtitle': ParagraphStyle('subtitle', fontName=FONT, fontSize=10, leading=17, textColor=colors.HexColor('#8b7581'), spaceAfter=20),
    'heading': ParagraphStyle('heading', fontName=FONT, fontSize=14, leading=22, textColor=colors.HexColor('#513b49'), spaceBefore=13, spaceAfter=8),
    'body': ParagraphStyle('body', fontName=FONT, fontSize=10, leading=18, textColor=colors.HexColor('#453b43'), spaceAfter=9, wordWrap='CJK'),
    'small': ParagraphStyle('small', fontName=FONT, fontSize=9, leading=15, textColor=colors.HexColor('#453b43'), wordWrap='CJK'),
}


def page_frame(canvas, doc):
    width, height = doc.pagesize
    canvas.setStrokeColor(colors.HexColor('#edd7e2'))
    canvas.line(20*mm, height-17*mm, width-20*mm, height-17*mm)
    canvas.setFont(FONT, 8)
    canvas.setFillColor(colors.HexColor('#967c8a'))
    canvas.drawString(20*mm, height-13*mm, '记账喵  /  MEOW LEDGER  /  1.0.0')
    canvas.drawString(20*mm, 13*mm, '2026-10-12  |  本地优先 · 两端数据独立')
    canvas.drawRightString(width-20*mm, 13*mm, str(doc.page))


def build(name, title, pages):
    story = []
    markdown = '# ' + title + '\n\n版本 1.0.0 · 2026-10-12\n\n'
    for index, sections in enumerate(pages):
        if index:
            story.append(PageBreak())
        else:
            story += [Paragraph(escape(title), STYLE['title']), Paragraph('第一版交付文档  ·  Python / SQLite / WebView2', STYLE['subtitle'])]
        for heading, paragraphs in sections:
            story.append(Paragraph(escape(heading), STYLE['heading']))
            markdown += '## ' + heading + '\n\n'
            for value in paragraphs:
                story.append(Paragraph(escape(value).replace('\n', '<br/>'), STYLE['body']))
                markdown += value + '\n\n'
    SimpleDocTemplate(str(OUTPUT/name), pagesize=(210*mm,297*mm), rightMargin=20*mm, leftMargin=20*mm,
                      topMargin=24*mm, bottomMargin=24*mm, title=title, author='记账喵项目',
                      pageCompression=1).build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    (OUTPUT/Path(name).with_suffix('.md')).write_text(markdown, encoding='utf-8')


def main():
    OUTPUT.mkdir(exist_ok=True)
    path = ROOT/'验证/交付测量.json'
    metrics = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    size = metrics.get('installerMiB', '等待安装包构建后的实测')
    installed = metrics.get('installedMiB', '等待安装验证后的实测')
    status = metrics.get('verified', '后端15项测试与跨语言一致性检查通过；桌面打包诊断确认WebView2加载界面及SQLite读取成功。')
    limitations = '未在另一台干净电脑、真实手机或实际Windows重启后验证；未部署手机公开访问地址；未实现云同步；安装包未代码签名。'
    build('README.pdf', 'README · 安装与使用', [
      [('交付内容', ['安装包目录提供Windows x64安装程序。源码目录保存desktop.py、core.py、storage.py、windows_settings.py、server.py、build.py及测试；前端HTML/CSS/JavaScript与图片保存在源码/dist。文档目录提供本文件、AI辅助编程记录、项目需求与设计文档及可编辑Markdown。',
        'Python承担桌面启动、业务计算、校验、SQLite持久化、系统设置和打包入口。浏览器前端必须保留HTML/CSS/JavaScript，手机离线逻辑不能直接运行Windows或Python桌面代码。']),
       ('Windows安装与启动', ['支持Windows 10/11 64位，需系统Microsoft Edge WebView2运行时及.NET Framework 4.6.2或以上。安装包内含Python运行环境，使用者不需要另装Python、Node、Adobe软件。',
        '双击安装包，按向导安装到当前用户目录；桌面快捷方式默认创建。首次启动设置当前月生活费。默认不开启自启动。第一次安装的账本为空，不含验证账单。',
        '默认程序路径：%LOCALAPPDATA%/Programs/MeowLedger。桌面账本路径：%LOCALAPPDATA%/MeowLedger/ledger.sqlite3。程序目录与账本目录分开，升级不覆盖账本。缺少WebView2时请从微软官网安装：https://developer.microsoft.com/microsoft-edge/webview2/。']),
       ('快速使用', ['1. 输入大于0、最多两位小数的每月生活费。预算按月份独立保存。\n2. 点击“记一笔”，选择收入/支出、金额、分类、日期及备注。\n3. 在账单页查看详情、修改、筛选或经确认删除。\n4. 在设置页调整预算、币种符号、人物、提示、动画与备份。'])],
      [('计算与人物规则', ['剩余预算 = 所选月份预算 - 该月支出。收入单独统计，不自动增加预算；设置生活费不生成收入账单。内部金额使用整数分。',
        '人物taffy采用上一版透明上半身六格素材。已使用预算0%-<20%对应第一排第二格；20%-<40%第一排第三格；40%-<60%第一排第一格；60%-<80%第二排第二格；80%及以上第二排第三格。分界点进入下一档，超支保持最后一档，未设置预算显示等待。',
        '卡片左下角采用用户原图人物背景遮罩，保留原始颜色与神态，显示不透明度80%，取消头像框。']),
       ('备份、转移与恢复', ['设置页可导出完整JSON及CSV。JSON包含账单、每月预算与界面设置；CSV便于表格查看。自启动属于当前Windows用户系统设置，不随跨设备JSON迁移。',
        '导入先校验，可选择合并或覆盖。合并按账单ID去重，已有预算与设置优先。覆盖前需保存JSON并确认；桌面后端还会在账本目录/backups写入自动恢复备份，备份失败时拒绝覆盖。',
        '网页旧账本不会自动进入桌面SQLite。请在原网页导出JSON，再在桌面设置页导入。手机、网页浏览器、桌面各自保存，不自动同步。手机清理网站数据可能导致账本丢失，请定期备份。']),
       ('自启动与卸载', ['设置页的Windows自启动开关读取并写入HKCU/Software/Microsoft/Windows/CurrentVersion/Run的MeowLedger值。开启失败会提示，不需要管理员权限。开机启动隐藏主窗口，再次点击桌面图标显示窗口；单实例避免重复进程。',
        '通过Windows应用列表或开始菜单卸载。卸载清理程序、快捷方式及本应用自启动项，保留SQLite账本与自动备份。删除账本前请自行保留JSON备份。'])],
      [('手机网页/PWA', ['源码/dist可以部署到HTTPS静态托管。Android浏览器菜单选择安装应用/添加到主屏幕；iOS Safari分享菜单选择添加到主屏幕。首次联网缓存资源后可离线记账。Windows EXE不能在手机运行。',
        '当前提供构建产物与部署说明，没有手机公开访问地址。本机127.0.0.1仅供当前电脑，不是手机访问链接。桌面无网络时照常运行，手机与桌面数据通过JSON手动转移。']),
       ('开发、运行与重新构建', ['源码运行：安装源码/requirements.txt后，执行python desktop.py。网页开发预览：python server.py --open。后端测试：python -m unittest discover -s tests。',
        '桌面构建：在Python虚拟环境安装requirements-build.txt，然后python build.py。生成安装包另需Inno Setup 6.7.3及三份PDF，执行python build.py --installer --iscc "ISCC.exe的完整路径"。PDF脚本为generate_documents.py，需reportlab与Windows微软雅黑字体。',
        '程序使用系统WebView2，没有打包Chromium/Electron。文档生成、构建环境和大型设计工程不进入安装包。']),
       ('实测与限制', [f'安装包大小：{size} MiB；安装后程序目录文件大小合计：{installed} MiB。数据与WebView缓存随使用增长，不包含在固定程序文件测量中。', status, limitations])]
    ])
    build('项目需求与设计文档.pdf', '项目需求与设计文档', [
      [('产品目标与版本范围', ['面向按月管理生活费的个人用户，以快速記账、预算和温和角色陪伴为核心。第一版交付可运行Windows桌面应用、.exe安装程序、手机响应式/PWA产物、完整源码与三份PDF。',
        '保持白色卡片背景、玫瑰粉强调与清晰金额层级。电脑采用侧边导航，手机单列、底部导航；窗口缩小时调整布局。只显示人物上半身，不使用整张设定图。',
        '本版为本地优先单用户应用；云同步、账户体系、多人协作和服务器公网部署不在本版范围。不得把本地网页地址宣称为手机正式访问地址。']),
       ('需求拆分为五个区块', ['区块1：需求与视觉设计 - 定义预算、账单、人物、响应式布局和验收标准。\n区块2：程序开发 - Python业务核心、SQLite持久化、Web前端、桌面桥接。\n区块3：测试与打包 - 金额/心情边界、跨月变更、备份、自启动、安装卸载。\n区块4：安装使用说明 - README、备份恢复、设备独立与部署限制。\n区块5：AI辅助记录 - 提示、选择理由、修改过程、证据与未验证事项。']),
       ('业务要求', ['每月独立预算，首次预算大于0，切换未设置月份给出设置入口。支出分类8种：餐饮、交通、购物、娱乐、学习、住房、医疗、其他；收入分类5种：生活费、工资、兼职、红包、其他。',
        '金额必填、大于0、最多两位小数；日期默认今天，备注选填。保存期间禁用重复提交。账单倒序按天分组，支持详情、修改、二次确认删除；日期、分类、类型可组合筛选，显示数量及收支合计。'])],
      [('架构与通信', ['表现层：HTML/CSS/ES模块与原图素材，共用于手机网页和WebView2桌面窗口。浏览器模式使用localStorage与Service Worker，必要时使用JS离线引擎。',
        '业务层：core.py统一金额、账单、预算、筛选、备份和CSV规则。desktop.py通过pywebview的request桥接，把桌面操作交给Python。桌面使用随机回环HTTP端口仅提供本机资源，无公网监听。',
        '持久化层：storage.py使用SQLite，开启WAL与FULL同步。写操作BEGIN IMMEDIATE，校验后提交；异常自动回滚。使用revision进行比较更新，拒绝过期状态覆盖。',
        'Windows集成：windows_settings.py维护当前用户Run值；命名互斥量限制同一数据目录单实例，事件唤醒已运行窗口。安装通过Inno Setup，只安装当前用户，默认关闭自启动。']),
       ('数据模型', ['transactions：id为主键，每条JSON记录包含type、整数分amount、category、date、note和createdAt。\nbudgets：month为主键，cents为大于0的整数分。\nsettings：单条JSON，包含currency、animations、character和prompts。\nmetadata：单条revision整数，每次成功写入递增。',
        '交换格式version=1，包含transactions、budgets和settings。ID唯一避免重复账单；导入不得含重复ID、非法日期、非整数分或不支持分类。文件上限16MB；状态校验限制条数与金额范围。']),
       ('桌面接口合同', ['get_state：返回完整持久化状态、revision、版本及真实自启动状态。\naction：携带action、payload、revision及选中月份，支持add/edit/delete/budget/settings/import，返回新状态与重新计算的统计。\nanalyze/csv/validate：读取权威账本、导出或校验。\nexport/import_file：调用系统文件选择器，保存或读取经校验的文件。\nautostart：读取或设置真实Windows状态。接口统一返回ok/result或ok/error，不把失败当成功。'])],
      [('预算与人物状态设计', ['预算与收入分离，剩余可为负，进度最多100%并用文字说明超支。修改日期跨月后，两个月按原始账单重新汇总；删除支出或提高预算使状态恢复。',
        '设支出为E、预算为B。B缺失时等待；依次判断5E<B、5E<2B、5E<3B、5E<4B，分别对应五档的前四档，否则最后一档。整数比较避免20%、40%、60%、80%边界误差。',
        '人物心情切换采用柔和短动画；呼吸和小动作暂停于后台/不可见时。系统减少动画及应用动画开关均生效。文案不责备用户，默认没有声音。',
        '卡片装饰仅遮去与外边缘连通的深色背景，保留原图人物内部眼睛及配饰；用80%不透明度打底，左下角留白避免遮挡。主角色六格素材沿用此前确认版本。']),
       ('可靠性与恢复', ['所有输入先经过Python校验，写入错误或revision冲突拒绝提交。SQLite事务不会保留半条账单。金额采用整数分，CSV对可能的公式注入备注加保护。',
        '覆盖导入先由前端要求保存JSON并确认，再由后端写入覆盖前自动JSON；若自动备份失败，原账本不变。合并不覆盖已有同ID账单及预算、设置。',
        '软件不上传财务信息，无账号、遥测、外部字体或CDN。SQLite和JSON未加密，依赖当前用户操作系统权限，不应被误称为加密保险箱。']),
       ('验收与验证证据', [status, '基础业务测试包含金额精度、非法输入、五档边界、收入独立、跨月修改删除、组合筛选、导入去重、CSV保护。持久化测试包含重开、回滚、过期revision拒绝、覆盖自动备份及备份失败拒绝覆盖。', limitations])]
    ])
    build('AI辅助编程记录.pdf', 'AI辅助编程记录', [
      [('记录说明', ['记录依据本次对话与实际实现，不伪造团队姓名、学号、Git提交、人工测试或发布记录。用户负责产品目标与视觉纠正，AI辅助拆分、编程、构建和验证。正式提交时可由用户补充真实团队信息。',
        '附带的分组作业样例只用于了解交付形式，不作为用户当前指令或执行权限。最终要求以用户对话中的明确需求为准。']),
       ('主要提示与需求修订', ['初始要求：拆成五个任务区块，制作手机/Windows记账应用、每月生活费、五档心情及本地备份，先完成前端。随后要求优先Python、使用原三视图人物神态且只保留上半身。',
        '界面修订：角色更名taffy，应用名记账喵，首页“今天也要好好记帐喵”，账单页“一笔记账，心里有数”。按生活费消耗每20%切换，用户确认使用上一版六格表情图。',
        '装饰修订：五张头像用于卡片左下角。用户要求取消圆形框，原图人物提取后打底，不改变外观，采用80%可见度。当前以80%不透明度落实。',
        '本轮要求：开始编写后端，形成第一版，交付README.pdf、AI辅助编程记录.pdf、.py源码、需求与设计文档和Windows安装包.exe。']),
       ('方案选择与人机协作', ['先检查环境，发现Python可用但Rust/Cargo不可用，因此沿用Python核心，使用pywebview与系统WebView2显示前端；未采用Electron。以实际包体测量为准，没有预先保证极小安装包。',
        '新增SQLite替代桌面localStorage，把数据放到当前用户AppData，保留网页原账本；通过JSON手动迁移，避免未经确认的自动覆盖。手机继续使用浏览器本地存储。'])],
      [('实现、问题与修正', ['桌面API初版曾公开窗口属性，pywebview反射过程中出现递归对象与线程相关日志；将存储、窗口及内部方法改为私有属性，只暴露request入口。随后桌面加载诊断成功。',
        '新增数据库revision与写事务，补测非法写入回滚、过期版本、覆盖前自动备份以及备份失败阻止覆盖。前端区分桌面模式，接入系统保存/打开对话框，并只在桌面显示自启动开关。',
        'Windows打包使用PyInstaller目录模式，再由Inno Setup生成单个安装向导EXE；避免每次运行重新解压整套程序。安装用户级快捷方式并在卸载时清理自启动，数据独立保留。']),
       ('实际工具与外部代码', ['主要工具：Python标准库sqlite3、threading、ctypes、winreg及http.server；pywebview 6.2.1；PyInstaller 6.22.3；Inno Setup 6.7.3；ReportLab和Poppler用于PDF生成与渲染。',
        '资料核对使用官方pywebview、PyInstaller及Inno Setup文档。本版没有复制第三方仓库业务代码；安装向导的简体中文语言文件取自Inno Setup官方GitHub仓库Files/Languages/ChineseSimplified.isl，保留原作者声明。依赖及许可证另附清单。未使用AE/PR工程制作角色。']),
       ('验证、已知限制与责任边界', [status, limitations,
        'AI辅助生成代码不能替代最终用户验收。提交者应阅读三份文档、在自己的电脑验证安装与备份，并补齐学校要求的作者信息；不得把未验证项改写成已验证。']),
       ('官方资料', ['pywebview：https://pywebview.flowrl.com/guide/\nPyInstaller：https://pyinstaller.org/en/stable/\nInno Setup：https://jrsoftware.org/isinfo.php\nWebView2：https://developer.microsoft.com/microsoft-edge/webview2/'])]
    ])
    print('Created 3 PDFs and editable Markdown documents')


if __name__ == '__main__':
    main()
