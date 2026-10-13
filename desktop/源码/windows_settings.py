"""Current-user Windows integration; no elevation or global startup entries."""
import os
import sys
import subprocess
from pathlib import Path
import winreg

RUN_KEY = r'Software\Microsoft\Windows\CurrentVersion\Run'
RUN_NAME = 'MeowLedger'


def startup_command():
    if getattr(sys, 'frozen', False):
        return subprocess.list2cmdline([sys.executable, '--autostart'])
    return subprocess.list2cmdline([sys.executable, str(Path(__file__).with_name('desktop.py')), '--autostart'])


def read_startup():
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            value, _ = winreg.QueryValueEx(key, RUN_NAME)
    except FileNotFoundError:
        return {'enabled': False, 'configured': False}
    return {'enabled': value == startup_command(), 'configured': True}


def set_startup(enabled):
    if type(enabled) is not bool:
        raise ValueError('自启动开关必须是布尔值')
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
        if enabled:
            winreg.SetValueEx(key, RUN_NAME, 0, winreg.REG_SZ, startup_command())
        else:
            try:
                winreg.DeleteValue(key, RUN_NAME)
            except FileNotFoundError:
                pass
    status = read_startup()
    if status['enabled'] != enabled or (not enabled and status['configured']):
        raise OSError('无法确认系统自启动状态，请检查当前用户权限')
    return status
