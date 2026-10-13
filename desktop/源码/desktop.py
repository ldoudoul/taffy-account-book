"""记账喵 Windows application: native WebView2 shell + Python/SQLite."""
import argparse
import ctypes
import hashlib
import json
import logging
import os
import sys
import threading
from pathlib import Path
from http.server import ThreadingHTTPServer

import core
from storage import LedgerStore
from windows_settings import read_startup, set_startup

VERSION = '1.0.0'


class DesktopAPI:
    def __init__(self, store):
        self._store = store
        self._window = None

    def request(self, request):
        try:
            if not isinstance(request, dict):
                raise ValueError('无效请求')
            op = request.get('operation')
            if op == 'get_state':
                result = self._store.snapshot()
                result.update(version=VERSION, startup=read_startup())
            elif op == 'action':
                result = self._store.action(request.get('action'), request.get('payload'),
                                           request.get('revision'), request.get('month'), request.get('filters'))
            elif op in ('analyze', 'csv'):
                state = self._store.snapshot()['state']
                result = core.api({**request, 'state': state})
            elif op == 'validate':
                result = core.api(request)
            elif op == 'autostart':
                result = set_startup(request['enabled']) if 'enabled' in request else read_startup()
            elif op == 'export':
                result = self._export(request.get('kind'), request.get('label'))
            elif op == 'import_file':
                result = self._import_file()
            else:
                raise ValueError('未知桌面请求')
            return {'ok': True, 'result': result}
        except Exception as error:
            logging.exception('Desktop operation failed: %s', request.get('operation') if isinstance(request, dict) else 'invalid')
            return {'ok': False, 'error': str(error)}

    def _export(self, kind, label):
        import webview
        from datetime import datetime
        state = self._store.snapshot()['state']
        csv = kind == 'csv'
        suffix = 'csv' if csv else 'json'
        filename = f"记账喵-{'全部账单' if csv else '覆盖前备份' if label=='覆盖前备份' else '完整备份'}-{datetime.now():%Y%m%d-%H%M%S}.{suffix}"
        selected = self._window.create_file_dialog(webview.FileDialog.SAVE, save_filename=filename,
                                                  file_types=(f'{suffix.upper()} (*.{suffix})',))
        if not selected:
            return {'saved': False}
        target = Path(selected[0] if isinstance(selected, (list, tuple)) else selected)
        if target.suffix.lower() != '.' + suffix:
            target = target.with_suffix('.' + suffix)
        content = core.export_csv(state) if csv else json.dumps(state, ensure_ascii=False, indent=2)
        with target.open('w', encoding='utf-8', newline='') as out:
            out.write(content)
            out.flush()
            os.fsync(out.fileno())
        return {'saved': True, 'path': str(target)}

    def _import_file(self):
        import webview
        selected = self._window.create_file_dialog(webview.FileDialog.OPEN, allow_multiple=False,
                                                  file_types=('JSON (*.json)',))
        if not selected:
            return {'cancelled': True}
        path = Path(selected[0])
        if path.stat().st_size > 16 * 1024 * 1024:
            raise ValueError('备份文件不能超过16MB')
        state = core.validate_state(json.loads(path.read_text(encoding='utf-8-sig')))
        return {'state': state}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--autostart', action='store_true')
    parser.add_argument('--data-dir', help='Development/test data directory')
    parser.add_argument('--diagnose', action='store_true', help='Write runtime readiness report and close')
    args = parser.parse_args()
    directory = Path(args.data_dir) if args.data_dir else Path(os.environ['LOCALAPPDATA']) / 'MeowLedger'
    directory.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(filename=directory / 'runtime.log', level=logging.WARNING,
                        format='%(asctime)s %(levelname)s %(message)s', encoding='utf-8')
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateMutexW.restype = ctypes.c_void_p
    kernel.CreateEventW.restype = ctypes.c_void_p
    kernel.SetEvent.argtypes = [ctypes.c_void_p]
    kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    identity = hashlib.sha256(str(directory.resolve()).lower().encode()).hexdigest()[:20]
    mutex = kernel.CreateMutexW(None, False, 'Local\\MeowLedger-' + identity)
    duplicate = ctypes.get_last_error() == 183
    event = kernel.CreateEventW(None, False, False, 'Local\\MeowLedger-show-' + identity)
    if duplicate:
        if not args.autostart:
            kernel.SetEvent(event)
        kernel.CloseHandle(event)
        kernel.CloseHandle(mutex)
        return
    try:
        import webview
        import server
        server.ROOT = Path(getattr(sys, '_MEIPASS', Path(__file__).parent)) / 'dist'
        http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        threading.Thread(target=http.serve_forever, daemon=True).start()
        api = DesktopAPI(LedgerStore(directory))
        window = webview.create_window('记账喵', f'http://127.0.0.1:{http.server_port}/?desktop=1#home',
                                       js_api=api, width=1180, height=820, min_size=(390, 580),
                                       hidden=args.autostart or args.diagnose, background_color='#fcfafb')
        api._window = window

        def activate():
            while True:
                if kernel.WaitForSingleObject(event, 500) == 0:
                    window.show()
                    window.restore()

        def diagnose():
            import time
            for _ in range(100):
                time.sleep(.15)
                value = window.evaluate_js("JSON.stringify({ready:document.body.dataset.desktopReady,title:document.title,cards:document.querySelectorAll('.card').length,error:document.querySelector('.app-error')?.textContent})")
                report = json.loads(value)
                if report.get('ready'):
                    report.update(snapshot=api._store.snapshot(), renderer='WebView2', version=VERSION)
                    (directory / 'diagnostic.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
                    window.destroy()
                    return
            (directory / 'diagnostic.json').write_text(json.dumps({'error': 'frontend readiness timeout'}), encoding='utf-8')
            window.destroy()

        threading.Thread(target=activate, daemon=True).start()
        if args.diagnose:
            window.events.loaded += lambda: threading.Thread(target=diagnose, daemon=True).start()
        webview.start(gui='edgechromium', private_mode=False, storage_path=str(directory / 'webview'), debug=False)
        http.shutdown()
        http.server_close()
    except Exception as error:
        logging.exception('Startup failed')
        ctypes.windll.user32.MessageBoxW(None, '无法启动记账喵：' + str(error) + '\n需要Microsoft Edge WebView2运行时。请查看README。', '记账喵', 16)
        raise
    finally:
        kernel.CloseHandle(event)
        kernel.CloseHandle(mutex)


if __name__ == '__main__':
    main()
