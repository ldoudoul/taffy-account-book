import csv
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import core


def item(ident='t1', amount=2500, day='2026-10-12', kind='expense', note=''):
    return dict(id=ident, amount=amount, date=day, type=kind,
                category='餐饮' if kind == 'expense' else '生活费', note=note, createdAt=day)


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.state = core.apply_action(core.empty_state(), 'budget', {'month': '2026-10', 'value': '100.00'})

    def test_sound_setting_migrates_and_validates(self):
        old = core.empty_state()
        old['settings'].pop('sounds')
        self.assertFalse(core.validate_state(old)['settings']['sounds'])
        changed = core.apply_action(old, 'settings', {'sounds': True})
        self.assertTrue(changed['settings']['sounds'])
        with self.assertRaises(ValueError):
            core.apply_action(old, 'settings', {'sounds': 'yes'})

    def test_money_and_input(self):
        self.assertEqual(core.cents('0.01'), 1)
        self.assertEqual(core.cents('10.10'), 1010)
        for value in ['0', '-1', '1.001', 'NaN', '', '1e2', 'Infinity']:
            with self.assertRaises(ValueError):
                core.cents(value)

    def test_mood_boundaries(self):
        for expense, expected in [(0, 'happy'), (1999, 'happy'), (2000, 'relaxed'), (3999, 'relaxed'),
                                  (4000, 'worried'), (5999, 'worried'), (6000, 'low'), (7999, 'low'),
                                  (8000, 'sad'), (9999, 'sad'), (10000, 'sad'), (10001, 'sad')]:
            self.assertEqual(core.mood(10000, expense), expected)
        self.assertEqual(core.mood(None, 900), 'neutral')

    def test_income_and_budget_are_separate(self):
        self.assertEqual(len(self.state['transactions']), 0)
        s = core.apply_action(self.state, 'add', item(kind='income', amount=50000))
        a = core.analyze(s, '2026-10')
        self.assertEqual((a['income'], a['remaining'], a['mood']), (50000, 10000, 'happy'))

    def test_edit_date_and_delete_recalculate_both_months(self):
        s = core.apply_action(self.state, 'add', item(amount=11000))
        self.assertEqual(core.analyze(s, '2026-10')['remaining'], -1000)
        self.assertEqual(core.analyze(s, '2026-10')['progress'], 100)
        s = core.apply_action(s, 'edit', item(amount=9000, day='2026-09-30'))
        self.assertEqual(core.analyze(s, '2026-10')['mood'], 'happy')
        self.assertEqual(core.analyze(s, '2026-09')['expense'], 9000)
        self.assertEqual(core.analyze(s, '2026-09')['mood'], 'neutral')
        s = core.apply_action(s, 'delete', {'id': 't1'})
        self.assertEqual(core.analyze(s, '2026-09')['expense'], 0)

    def test_combined_filters(self):
        s = core.apply_action(self.state, 'add', item())
        s = core.apply_action(s, 'add', item('t2', day='2026-09-30'))
        s = core.apply_action(s, 'add', item('t3', kind='income'))
        a = core.analyze(s, '2026-10', {'start': '2026-10-01', 'end': '2026-10-31', 'category': '餐饮', 'type': 'expense'})
        self.assertEqual([t['id'] for t in a['filtered']], ['t1'])
        self.assertEqual(a['totals'], dict(income=0, expense=2500))

    def test_import_dedup_existing_budget_and_settings_win(self):
        s = core.apply_action(self.state, 'add', item())
        incoming = core.apply_action(s, 'budget', {'month': '2026-10', 'value': '200'})
        incoming = core.apply_action(incoming, 'add', item('t2'))
        merged = core.apply_action(s, 'import', {'mode': 'merge', 'data': incoming})
        self.assertEqual(len(merged['transactions']), 2)
        self.assertEqual(merged['budgets']['2026-10'], 10000)
        replaced = core.apply_action(s, 'import', {'mode': 'replace', 'data': incoming})
        self.assertEqual(replaced['budgets']['2026-10'], 20000)

    def test_backup_rejects_duplicate_ids_fractional_cents_bad_date(self):
        bad = core.empty_state()
        bad['transactions'] = [item(), item()]
        with self.assertRaises(ValueError):
            core.validate_state(bad)
        for bad_item in [item(amount=1.5), item(day='2026-02-30'), item(amount=True)]:
            with self.assertRaises(ValueError):
                core.transaction(bad_item)

    def test_csv_is_exact_and_formula_safe(self):
        s = core.apply_action(self.state, 'add', item(amount=1010, note='=HYPERLINK("bad")'))
        rows = list(csv.reader(io.StringIO(core.export_csv(s).lstrip('\ufeff'))))
        self.assertEqual(rows[1][4], '10.10')
        self.assertTrue(rows[1][5].startswith("'="))


if __name__ == '__main__':
    unittest.main(verbosity=2)
