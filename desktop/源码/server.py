"""Local Python web application. python server.py [--port 8765] [--open]."""
import argparse
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import webbrowser

import core

ROOT = Path(__file__).resolve().parent / 'dist'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == '/api/health':
            self.reply(200, {'engine': 'python', 'version': 1, 'storage': 'browser-local'})
        else:
            super().do_GET()

    def reply(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if urlsplit(self.path).path != '/api/engine':
            self.reply(404, {'error': '接口不存在'})
            return
        # Same-origin only; no CORS or remote ledger writes.
        origin = self.headers.get('Origin')
        if origin and urlsplit(origin).netloc != self.headers.get('Host'):
            self.reply(403, {'error': '只允许当前网页请求'})
            return
        try:
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= 16 * 1024 * 1024:
                raise ValueError('请求文件为空或超过 16 MB')
            request = json.loads(self.rfile.read(size))
            if not isinstance(request, dict):
                raise ValueError('请求格式无效')
            self.reply(200, core.api(request))
        except (ValueError, TypeError, KeyError) as error:
            self.reply(400, {'error': str(error)})

    def log_message(self, fmt, *args):
        # Never print request bodies or personal financial data.
        if args and '/api/' not in str(args[0]):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--open', action='store_true')
    options = parser.parse_args()
    try:
        server = ThreadingHTTPServer(('127.0.0.1', options.port), Handler)
    except OSError:
        raise SystemExit(f'Port {options.port} is busy. Use --port with a different port.')
    url = f'http://127.0.0.1:{options.port}'
    print(f'Meow Ledger / Python business engine\nLocal: {url}\nCtrl+C to stop', flush=True)
    if options.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
