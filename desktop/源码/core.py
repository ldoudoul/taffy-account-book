"""Pocket Companion business rules. No third-party/runtime dependency.

Money is always integer minor units; the browser owns per-device persistence.
The HTTP service is stateless and never stores or synchronizes personal ledgers.
"""
from __future__ import annotations

import calendar
import copy
import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

EXPENSE = ['餐饮', '交通', '购物', '娱乐', '学习', '住房', '医疗', '其他']
INCOME = ['生活费', '工资', '兼职', '红包', '其他']
LIMIT = 999_999_999_999
DEFAULT_SETTINGS = dict(currency='CNY', animations=True, character=True, prompts=True)


def empty_state():
    return dict(version=1, transactions=[], budgets={}, settings=DEFAULT_SETTINGS.copy())


def cents(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{1,10}(?:\.\d{1,2})?', value.strip()):
        raise ValueError('请输入大于 0 的金额，最多两位小数')
    result = int(Decimal(value.strip()) * 100)
    if not 0 < result <= LIMIT:
        raise ValueError('金额必须大于 0 且不超过 99 亿')
    return result


def valid_money(value, positive=True):
    if type(value) is not int or not (0 < value <= LIMIT if positive else 0 <= value <= LIMIT):
        raise ValueError('备份中的金额必须是有效的整数分')
    return value


def valid_month(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}', value):
        raise ValueError('月份格式应为 YYYY-MM')
    try:
        date.fromisoformat(value + '-01')
    except ValueError:
        raise ValueError('月份无效') from None
    return value


def transaction(item):
    if not isinstance(item, dict):
        raise ValueError('账单格式无效')
    kind = item.get('type')
    if kind not in ('income', 'expense'):
        raise ValueError('请选择收入或支出')
    if item.get('category') not in (EXPENSE if kind == 'expense' else INCOME):
        raise ValueError('分类与收支类型不匹配')
    day = item.get('date')
    try:
        if not isinstance(day, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', day):
            raise ValueError()
        date.fromisoformat(day)
    except ValueError:
        raise ValueError('请选择有效日期') from None
    note = item.get('note', '')
    if not isinstance(note, str) or len(note) > 200:
        raise ValueError('备注最多 200 字')
    ident = item.get('id')
    if not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', ident):
        raise ValueError('账单唯一标识无效')
    return dict(id=ident, type=kind, amount=valid_money(item.get('amount')),
                category=item['category'], date=day, note=note.strip(),
                createdAt=str(item.get('createdAt', day))[:40])


def validate_state(value):
    if not isinstance(value, dict) or value.get('version') != 1:
        raise ValueError('不支持的备份格式或版本')
    if not isinstance(value.get('transactions'), list) or len(value['transactions']) > 50000:
        raise ValueError('账单列表格式无效或超过 50000 条')
    items = [transaction(t) for t in value['transactions']]
    identifiers = set()
    for t in items:
        if t['id'] in identifiers:
            raise ValueError('备份中存在重复账单标识')
        identifiers.add(t['id'])
    if sum(t['amount'] for t in items) > 9_000_000_000_000_000:
        raise ValueError('累计金额超过安全计算范围')
    budgets = value.get('budgets')
    if not isinstance(budgets, dict) or len(budgets) > 12000:
        raise ValueError('预算格式无效')
    budgets = {valid_month(k): valid_money(v) for k, v in budgets.items()}
    raw_settings = value.get('settings', {})
    if not isinstance(raw_settings, dict):
        raise ValueError('设置格式无效')
    settings = DEFAULT_SETTINGS.copy()
    for k in ('animations', 'character', 'prompts'):
        if k in raw_settings:
            if type(raw_settings[k]) is not bool:
                raise ValueError('设置开关格式无效')
            settings[k] = raw_settings[k]
    if raw_settings.get('currency', 'CNY') not in ('CNY', 'USD', 'EUR', 'JPY'):
        raise ValueError('币种无效')
    settings['currency'] = raw_settings.get('currency', 'CNY')
    return dict(version=1, transactions=items, budgets=budgets, settings=settings)


def mood(budget, expense):
    if not budget:
        return 'neutral'
    # Consumption bands use integer comparisons; boundaries enter the next band.
    for threshold, status in [(1, 'happy'), (2, 'relaxed'), (3, 'worried'), (4, 'low')]:
        if expense * 5 < budget * threshold:
            return status
    return 'sad'


def matches(item, filters):
    return ((not filters.get('start') or item['date'] >= filters['start'])
            and (not filters.get('end') or item['date'] <= filters['end'])
            and (not filters.get('type') or item['type'] == filters['type'])
            and (not filters.get('category') or item['category'] == filters['category']))


def analyze(state, month, filters=None):
    valid_month(month)
    items = [t for t in state['transactions'] if t['date'].startswith(month)]
    income = sum(t['amount'] for t in items if t['type'] == 'income')
    expense = sum(t['amount'] for t in items if t['type'] == 'expense')
    budget = state['budgets'].get(month)
    filtered = sorted([t for t in state['transactions'] if matches(t, filters or {})],
                      key=lambda t: (t['date'], t['createdAt'], t['id']), reverse=True)
    totals = {kind: sum(t['amount'] for t in filtered if t['type'] == kind)
              for kind in ('income', 'expense')}
    return dict(month=month, budget=budget, income=income, expense=expense,
                remaining=budget - expense if budget else None,
                progress=min(100, expense / budget * 100) if budget else 0,
                mood=mood(budget, expense), filtered=filtered, totals=totals)


def apply_action(raw_state, action, payload):
    state = validate_state(raw_state)
    if not isinstance(payload, dict):
        raise ValueError('操作参数格式无效')
    if action in ('add', 'edit'):
        item = transaction(payload)
        index = next((i for i, t in enumerate(state['transactions']) if t['id'] == item['id']), None)
        if action == 'add':
            if index is not None:
                raise ValueError('这条账单已经保存，请勿重复提交')
            state['transactions'].append(item)
        else:
            if index is None:
                raise ValueError('账单不存在，请刷新重试')
            state['transactions'][index] = item
    elif action == 'delete':
        if not any(t['id'] == payload.get('id') for t in state['transactions']):
            raise ValueError('账单不存在')
        state['transactions'] = [t for t in state['transactions'] if t['id'] != payload['id']]
    elif action == 'budget':
        state['budgets'][valid_month(payload.get('month'))] = cents(payload.get('value'))
    elif action == 'settings':
        state['settings'].update(payload)
    elif action == 'import':
        incoming = validate_state(payload.get('data'))
        if payload.get('mode') == 'replace':
            state = incoming
        elif payload.get('mode') == 'merge':
            ids = {t['id'] for t in state['transactions']}
            state['transactions'].extend(t for t in incoming['transactions'] if t['id'] not in ids)
            # Existing budgets/settings win in a merge. Never overwrite silently.
            state['budgets'] = {**incoming['budgets'], **state['budgets']}
        else:
            raise ValueError('请选择合并或覆盖导入')
    else:
        raise ValueError('未知操作')
    return validate_state(state)


def export_csv(raw_state):
    state = validate_state(raw_state)
    output = io.StringIO(newline='')
    writer = csv.writer(output)
    writer.writerow(['唯一标识', '日期', '收支类型', '分类', '金额', '备注'])
    for t in sorted(state['transactions'], key=lambda t: (t['date'], t['id']), reverse=True):
        # Prevent spreadsheet formula execution from user-provided notes.
        note = t['note']
        if re.match(r'^\s*[=+@-]', note):
            note = "'" + note
        writer.writerow([t['id'], t['date'], '收入' if t['type'] == 'income' else '支出',
                         t['category'], f"{t['amount'] // 100}.{t['amount'] % 100:02d}", note])
    return '\ufeff' + output.getvalue()


def api(request):
    op = request.get('operation')
    if op == 'action':
        result = apply_action(request.get('state'), request.get('action'), request.get('payload'))
        response = dict(state=result)
        if request.get('month'):
            response['analysis'] = analyze(result, request['month'])
            response['filteredAnalysis'] = analyze(result, request['month'], request.get('filters'))
        return response
    if op == 'analyze':
        return analyze(validate_state(request.get('state')), request.get('month'), request.get('filters'))
    if op == 'validate':
        return dict(state=validate_state(request.get('data')))
    if op == 'csv':
        return dict(csv=export_csv(request.get('state')))
    raise ValueError('未知请求')
