import operator
import logging

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class Context:
    def __init__(self, initial=None):
        self.data = initial or {}

    def resolve(self, path):
        if isinstance(path, list):
            ref = self.data
            for key in path:
                ref = ref[key]
            return ref
        elif isinstance(path, str):
            return self.data[path]
        raise KeyError(f"Invalid path: {path}")

    def set(self, path, value):
        if isinstance(path, list):
            ref = self.data
            for key in path[:-1]:
                ref = ref.setdefault(key, {})
            ref[path[-1]] = value
        elif isinstance(path, str):
            self.data[path] = value

    def get(self, path):
        return self.resolve(path)

def evaluate_expr(expr, ctx):
    if isinstance(expr, dict):
        if 'add' in expr:
            return sum(evaluate_expr(x, ctx) for x in expr['add'])
        if 'subtract' in expr:
            values = [evaluate_expr(x, ctx) for x in expr['subtract']]
            return values[0] - sum(values[1:])
        if 'multiply' in expr:
            result = 1
            for val in expr['multiply']:
                result *= evaluate_expr(val, ctx)
            return result
        if 'divide' in expr:
            values = [evaluate_expr(x, ctx) for x in expr['divide']]
            return values[0] / values[1]
        if 'mod' in expr:
            values = [evaluate_expr(x, ctx) for x in expr['mod']]
            return values[0] % values[1]
        if 'compare' in expr:
            left = evaluate_expr(expr['compare']['left'], ctx)
            right = evaluate_expr(expr['compare']['right'], ctx)
            op = expr['compare']['op']
            ops = {'>': operator.gt, '<': operator.lt, '==': operator.eq, '>=': operator.ge, '<=': operator.le}
            return ops[op](left, right)
        if 'abs' in expr:
            return abs(evaluate_expr(expr['abs']['value'], ctx))
        if 'length' in expr:
            return len(evaluate_expr(expr['length'], ctx))
        if 'in' in expr:
            return evaluate_expr(expr['in']['value'], ctx) in evaluate_expr(expr['in']['array'], ctx)
        if 'not' in expr:
            return not evaluate_expr(expr['not'], ctx)
        if 'and' in expr:
            return all(evaluate_expr(x, ctx) for x in expr['and'])
        if 'or' in expr:
            return any(evaluate_expr(x, ctx) for x in expr['or'])
        if 'get' in expr:
            return ctx.get(expr['get'])
        if 'value' in expr:
            return expr['value']
    elif isinstance(expr, (str, int, float, bool)):
        if isinstance(expr, str) and expr in ctx.data:
            return ctx.get(expr)
        return expr
    raise Exception(f"Unsupported expression: {expr}")

def run_steps(steps, ctx):
    for step in steps:
        if 'let' in step:
            for k, v in step['let'].items():
                ctx.set(k, evaluate_expr(v, ctx))
        elif 'assert' in step:
            cond = evaluate_expr(step['assert']['condition'], ctx)
            if not cond:
                raise AssertionError(step['assert']['message'])
        elif 'if' in step:
            condition = step['if'].get('condition')
            if condition is None:
                raise Exception("Missing 'condition' in 'if' block")
            if evaluate_expr(condition, ctx):
                run_steps([step['if']['then']], ctx)
            elif 'else' in step['if']:
                run_steps([step['if']['else']], ctx)
        elif 'set' in step:
            ctx.set(step['set']['target'], evaluate_expr(step['set']['value'], ctx))
        elif 'print' in step:
            values = [evaluate_expr(x, ctx) for x in step['print']]
            print(*values)
        elif 'log' in step:
            msg = ' '.join(str(evaluate_expr(x, ctx)) for x in step['log']['message'])
            level = step['log']['level']
            if hasattr(log, level.lower()):
                getattr(log, level.lower())(msg)
            else:
                log.info(msg)
        elif 'return' in step:
            val = step['return']['get']
            return evaluate_expr(val, ctx)
