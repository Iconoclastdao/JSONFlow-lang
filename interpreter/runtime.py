import operator
import logging
from typing import Any, Dict, List, Union
import json

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class Context:
    def __init__(self, initial: Dict[str, Any] = None):
        self.data = initial or {}

    def resolve(self, path: Union[str, List[str]]) -> Any:
        if isinstance(path, list):
            ref = self.data
            for key in path:
                ref = ref[key]
            return ref
        elif isinstance(path, str):
            return self.data[path]
        raise KeyError(f"Invalid path: {path}")

    def set(self, path: Union[str, List[str]], value: Any) -> None:
        if isinstance(path, list):
            ref = self.data
            for key in path[:-1]:
                ref = ref.setdefault(key, {})
            ref[path[-1]] = value
        elif isinstance(path, str):
            # Check if path is an array in context
            if path in self.data and isinstance(self.data[path], list):
                self.data[path].append(value)
            else:
                self.data[path] = value

    def get(self, path: Union[str, List[str]]) -> Any:
        return self.resolve(path)

def evaluate_expr(expr: Any, ctx: Context) -> Any:
    if isinstance(expr, dict):
        if 'get' in expr:
            return ctx.get(expr['get'])
        if 'value' in expr:
            return expr['value']
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
        if 'abs' in expr:
            return abs(evaluate_expr(expr['abs']['value'], ctx))
        if 'length' in expr:
            return len(ctx.get(expr['length']))
        if 'in' in expr:
            item = evaluate_expr(expr['in']['item'], ctx)
            array = evaluate_expr(expr['in']['array'], ctx)
            if not isinstance(array, list):
                raise ValueError(f"Expected array for 'in' operation, got {type(array)}")
            return item in array
        if 'not' in expr:
            return not evaluate_expr(expr['not'], ctx)
        if 'and' in expr:
            return all(evaluate_expr(x, ctx) for x in expr['and'])
        if 'or' in expr:
            return any(evaluate_expr(x, ctx) for x in expr['or'])
        if 'compare' in expr:
            left = evaluate_expr(expr['compare']['left'], ctx)
            right = evaluate_expr(expr['compare']['right'], ctx)
            op = expr['compare']['op']
            ops = {
                '>': operator.gt,
                '<': operator.lt,
                '===': operator.eq,
                '!==': operator.ne,
                '>=': operator.ge,
                '<=': operator.le
            }
            return ops[op](left, right)
    elif isinstance(expr, (str, int, float, bool)):
        if isinstance(expr, str) and expr in ctx.data:
            return ctx.get(expr)
        return expr
    raise Exception(f"Unsupported expression: {expr}")

def run_steps(steps: List[Dict[str, Any]], ctx: Context) -> Any:
    for step in steps:
        try:
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
                    then_steps = step['if']['then'] if isinstance(step['if']['then'], list) else [step['if']['then']]
                    run_steps(then_steps, ctx)
                elif 'else' in step['if']:
                    else_steps = step['if']['else'] if isinstance(step['if']['else'], list) else [step['if']['else']]
                    run_steps(else_steps, ctx)
            elif 'set' in step:
                ctx.set(step['set']['target'], evaluate_expr(step['set']['value'], ctx))
            elif 'map' in step:
                source = ctx.get(step['map']['source'])
                if not isinstance(source, list):
                    raise ValueError(f"Expected array for 'map' source, got {type(source)}")
                alias = step['map']['as']
                target = step['map']['target']
                result = []
                for item in source:
                    ctx.set(alias, item)
                    for substep in step['map']['body']:
                        run_steps([substep], ctx)
                    result.append(ctx.get(alias))
                ctx.set(target, result)
            elif 'forEach' in step:
                source = ctx.get(step['forEach']['source'])
                if not isinstance(source, list):
                    raise ValueError(f"Expected array for 'forEach' source, got {type(source)}")
                alias = step['forEach']['as']
                for item in source:
                    ctx.set(alias, item)
                    run_steps(step['forEach']['body'], ctx)
            elif 'try' in step:
                try:
                    run_steps(step['try']['body'], ctx)
                except Exception as e:
                    if 'catch' in step['try']:
                        error_obj = {
                            'message': str(e),
                            'step': steps.index(step),
                            'details': {'type': type(e).__name__}
                        }
                        ctx.set('error', error_obj)
                        run_steps(step['try']['catch'], ctx)
                    else:
                        raise
            elif 'log' in step:
                msg = ' '.join(str(evaluate_expr(x, ctx)) for x in step['log']['message'])
                level = step['log']['level']
                if hasattr(log, level.lower()):
                    getattr(log, level.lower())(msg)
                else:
                    log.info(msg)
            elif 'print' in step:
                values = [evaluate_expr(x, ctx) for x in step['print']['values']]
                print(*values)
            elif 'call' in step:
                # Simulate external call (e.g., API or function); actual implementation depends on environment
                func = step['call']['function']
                args = {k: evaluate_expr(v, ctx) for k, v in step['call']['args'].items()}
                target = step['call']['target']
                # Mock result for demonstration; real implementation would invoke func(args)
                result = f"Result of {func}({json.dumps(args)})"
                ctx.set(target, result)
            elif 'return' in step:
                return ctx.get(step['return']['get'])
        except Exception as e:
            raise Exception(f"Error in step {steps.index(step)}: {str(e)}") from e
    return None

def execute_flow(flow: Dict[str, Any], inputs: Dict[str, Any] = None) -> Any:
    """
    Executes a JSONFlow program with given inputs and initial context.
    """
    ctx = Context(flow.get('context', {}))
    if inputs:
        for k, v in inputs.items():
            ctx.set(k, v)
    return run_steps(flow['steps'], ctx)
