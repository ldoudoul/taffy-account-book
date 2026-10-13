#define AppName "记账喵"
#define AppVersion "1.0.0"

[Setup]
AppId={{8C406B51-488A-4350-859B-82AFA80EA111}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=记账喵项目
DefaultDirName={localappdata}\Programs\MeowLedger
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\安装包
OutputBaseFilename=记账喵-1.0.0-Windows-x64-安装
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\MeowLedger.exe
SetupIconFile=dist\assets\app.ico
CloseApplications=yes
RestartApplications=no
InfoBeforeFile=安装须知.txt

[Languages]
Name: "chinesesimplified"; MessagesFile: "installer-language\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："; Flags: checkedonce

[Files]
Source: "..\构建产物\MeowLedger\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\文档\*.pdf"; DestDir: "{app}\文档"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\MeowLedger.exe"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\MeowLedger.exe"; Tasks: desktopicon
Name: "{autoprograms}\卸载{#AppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\MeowLedger.exe"; Description: "启动记账喵"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'MeowLedger');
end;

