import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from storage import LedgerStore
import windows_settings


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = LedgerStore(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_reopen_exact_cents_and_revision(self):
        result = self.store.action('budget', {'month': '2026-10', 'value': '2000.01'}, 0)
        other = LedgerStore(self.temp.name).snapshot()
        self.assertEqual(other['state'], result['state'])
        self.assertEqual(other['revision'], 1)
        self.assertEqual(other['state']['budgets']['2026-10'], 200001)

    def test_invalid_write_rolls_back(self):
        before = self.store.snapshot()
        with self.assertRaises(ValueError):
            self.store.action('budget', {'month': '2026-10', 'value': '0'}, 0)
        self.assertEqual(self.store.snapshot(), before)

    def test_stale_revision_cannot_overwrite(self):
        self.store.action('budget', {'month': '2026-10', 'value': '100'}, 0)
        with self.assertRaises(ValueError):
            self.store.action('budget', {'month': '2026-10', 'value': '200'}, 0)
        self.assertEqual(self.store.snapshot()['state']['budgets']['2026-10'], 10000)

    def test_replace_creates_complete_recovery_backup(self):
        result = self.store.action('budget', {'month': '2026-10', 'value': '100'}, 0)
        incoming = {**result['state'], 'budgets': {'2026-10': 90000}}
        replaced = self.store.action('import', {'mode': 'replace', 'data': incoming}, 1)
        self.assertEqual(json.loads(Path(replaced['backup']).read_text(encoding='utf-8')), result['state'])
        self.assertEqual(self.store.snapshot()['state']['budgets']['2026-10'], 90000)

    def test_backup_failure_prevents_replacement(self):
        result = self.store.action('budget', {'month': '2026-10', 'value': '100'}, 0)
        # A file at the backup-directory location makes backup creation fail.
        (Path(self.temp.name) / 'backups').write_text('blocked', encoding='utf-8')
        with self.assertRaises(OSError):
            self.store.action('import', {'mode': 'replace', 'data': result['state']}, 1)
        self.assertEqual(self.store.snapshot()['revision'], 1)

    def test_import_dedup_and_month_recalculation(self):
        self.store.action('budget', {'month': '2026-10', 'value': '100'}, 0)
        t = dict(id='test', amount=8000, type='expense', category='餐饮', date='2026-10-12', note='', createdAt='2026-10-12')
        result = self.store.action('add', t, 1, '2026-10')
        self.assertEqual(result['analysis']['mood'], 'sad')
        self.store.action('import', {'mode': 'merge', 'data': result['state']}, 2)
        self.assertEqual(len(self.store.snapshot()['state']['transactions']), 1)
        result = self.store.action('edit', {**t, 'date': '2026-09-30'}, 3, '2026-10')
        self.assertEqual(result['analysis']['remaining'], 10000)
        self.assertEqual(result['analysis']['mood'], 'happy')
        result = self.store.action('delete', {'id': 'test'}, 4, '2026-09')
        self.assertEqual(result['analysis']['expense'], 0)

    def test_real_current_user_registry_roundtrip_isolated_name(self):
        # Uses a disposable value, never the user's real application preference.
        with patch.object(windows_settings, 'RUN_NAME', 'MeowLedger-Disposable-Test'):
            try:
                self.assertFalse(windows_settings.read_startup()['enabled'])
                self.assertTrue(windows_settings.set_startup(True)['enabled'])
                self.assertFalse(windows_settings.set_startup(False)['configured'])
            finally:
                windows_settings.set_startup(False)


if __name__ == '__main__':
    unittest.main(verbosity=2)
