"""Transactional desktop ledger. Amounts remain integer cents."""
import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
import core


class LedgerStore:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / 'ledger.sqlite3'
        self.lock = threading.RLock()
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
                INSERT OR IGNORE INTO metadata VALUES (1,0);
                CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, body TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS budgets (month TEXT PRIMARY KEY, cents INTEGER NOT NULL CHECK(cents>0));
                CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL);
            ''')
            db.execute('INSERT OR IGNORE INTO settings VALUES (1,?)',
                       (json.dumps(core.empty_state()['settings']),))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA synchronous=FULL')
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def read(db):
        state = core.empty_state()
        state['transactions'] = [json.loads(row[0]) for row in db.execute('SELECT body FROM transactions ORDER BY id')]
        state['budgets'] = dict(db.execute('SELECT month,cents FROM budgets'))
        state['settings'] = json.loads(db.execute('SELECT body FROM settings WHERE id=1').fetchone()[0])
        revision = db.execute('SELECT revision FROM metadata WHERE id=1').fetchone()[0]
        return core.validate_state(state), revision

    def snapshot(self):
        with self.lock, self.connect() as db:
            state, revision = self.read(db)
            return {'state': state, 'revision': revision}

    def action(self, action, payload, expected_revision, month=None, filters=None):
        with self.lock, self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            state, revision = self.read(db)
            if type(expected_revision) is not int or revision != expected_revision:
                raise ValueError('账本已变化，请重新打开页面后再保存，避免覆盖数据')
            next_state = core.apply_action(state, action, payload)
            # Write the recovery file before an explicit replacement transaction.
            backup = None
            if action == 'import' and payload.get('mode') == 'replace':
                folder = self.directory / 'backups'
                folder.mkdir(exist_ok=True)
                backup = folder / ('覆盖前备份-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.json')
                with backup.open('x', encoding='utf-8') as out:
                    json.dump(state, out, ensure_ascii=False, indent=2)
                    out.flush()
                    import os
                    os.fsync(out.fileno())
            db.execute('DELETE FROM transactions')
            db.executemany('INSERT INTO transactions VALUES (?,?)',
                           [(t['id'], json.dumps(t, ensure_ascii=False)) for t in next_state['transactions']])
            db.execute('DELETE FROM budgets')
            db.executemany('INSERT INTO budgets VALUES (?,?)', next_state['budgets'].items())
            db.execute('UPDATE settings SET body=? WHERE id=1', (json.dumps(next_state['settings']),))
            db.execute('UPDATE metadata SET revision=? WHERE id=1', (revision + 1,))
            result = {'state': next_state, 'revision': revision + 1, 'backup': str(backup) if backup else None}
            if month:
                result['analysis'] = core.analyze(next_state, month)
                result['filteredAnalysis'] = core.analyze(next_state, month, filters)
            return result
