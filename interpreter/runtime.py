import operator
import logging
from typing import Any, Dict, List, Union, Tuple
import json
from concurrent.futures import ThreadPoolExecutor
import asyncio

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class Context:
    def __init__(self, initial: Dict[str, Any] = None, schema_context: Dict[str, str] = None):
        self.data = initial or {}
        self.schema_context = schema_context or {}

    def resolve(self, path: Union[str, List[str]]) -> Any:
        if isinstance(path, list):
            ref = self.data
            for key in path:
                ref = ref[key]
            return ref
        return self.data[path]

    def set(self, path: Union[str, List[str]], value: Any, value_type: str) -> None:
        target = path[-1] if isinstance(path, list) else path
        expected_type = self.schema_context.get(target)
        if expected_type and value_type != expected_type:
            log.warning(f"Type mismatch for '{target}': expected {expected_type}, got {value_type}")
        log.info(f"Setting '{target}' to '{value_type}' value '{value}'")
        
        if isinstance(path, list):
            ref = self.data
            for key in path[:-1]:
                ref = ref.setdefault(key, {})
            ref[path[-1]] = value
        elif isinstance(path, str):
            if path in self.data and isinstance(self.data[path], list) and self.schema_context.get(path) == 'array':
                self.data[path].append(value)
            else:
                self.data[path] = value

    def get(self, path: Union[str, List[str]]) -> Any:
        return self.resolve(path)

async def evaluate_expr(expr: Any, ctx: Context) -> Tuple[Any, str]:
    """
    Evaluates an expression and returns (value, type), supporting async calls.
    """
    if isinstance(expr, dict):
        if 'get' in expr:
            value = ctx.get(expr['get'])
            return value, ctx.schema_context.get(expr['get'], infer_type(value))
        if 'value' in expr:
            value = expr['value']
            return value, infer_type(value)
        if 'call' in expr:
            fn = expr['call']['function']
            args = [await evaluate_expr(arg, ctx) for arg in expr['call'].get('args', {}).values()]
            if expr['call'].get('async', False):
                # Simulate async call (replace with actual async function)
                await asyncio.sleep(0.1)
                result = f"{fn}({', '.join(str(a[0]) for a in args)})"
                return result, expr['call'].get('return_type', 'string')
            return f"{fn}({', '.join(str(a[0]) for a in args)})", 'string'
        # Other expressions (add, compare, etc.) remain as before
        if 'add' in expr:
            values = [await evaluate_expr(x, ctx) for x in expr['add']]
            return sum(v[0] for v in values), 'number'
        if 'compare' in expr:
            left, left_type = await evaluate_expr(expr['compare']['left'], ctx)
            right, right_type = await evaluate_expr(expr['compare']['right'], ctx)
            op = expr['compare']['op']
            ops = {'>': operator.gt, '<': operator.lt, '===': operator.eq, '!==': operator.ne, '>=': operator.ge, '<=': operator.le}
            return ops[op](left, right), 'boolean'
    elif isinstance(expr, (str, int, float, bool)):
        return expr, infer_type(expr)
    raise Exception(f"Unsupported expression: {expr}")

def infer_type(value: Any) -> str:
    if isinstance(value, int):
        return 'integer'
    elif isinstance(value, float):
        return 'number'
    elif isinstance(value, bool):
        return 'boolean'
    elif isinstance(value, list):
        return 'array'
    elif isinstance(value, dict):
        return 'object'
    return 'string'

async def run_steps(steps: List[Dict[str, Any]], ctx: Context) -> Any:
    with ThreadPoolExecutor() as executor:
        for step in steps:
            try:
                if 'let' in step:
                    for k, v in step['let'].items():
                        value, value_type = await evaluate_expr(v, ctx)
                        ctx.set(k, value, value_type)
                elif 'set' in step:
                    value, value_type = await evaluate_expr(step['set']['value'], ctx)
                    ctx.set(step['set']['target'], value, value_type)
                elif 'map' in step:
                    source = ctx.get(step['map']['source'])
                    alias = step['map']['as']
                    target = step['map']['target']
                    async def map_item(item):
                        ctx.set(alias, item, infer_type(item))
                        await run_steps(step['map']['body'], ctx)
                        return ctx.get(alias)
                    # Parallel execution
                    result = await asyncio.gather(*[map_item(item) for item in source])
                    ctx.set(target, result, 'array')
                elif 'forEach' in step:
                    source = ctx.get(step['forEach']['source'])
                    alias = step['forEach']['as']
                    for item in source:
                        ctx.set(alias, item, infer_type(item))
                        await run_steps(step['forEach']['body'], ctx)
                elif 'try' in step:
                    try:
                        await run_steps(step['try']['body'], ctx)
                    except Exception as e:
                        if 'catch' in step['try']:
                            error_obj = {'message': str(e), 'step': steps.index(step), 'details': {'type': type(e).__name__}}
                            ctx.set('error', error_obj, 'object')
                            await run_steps(step['try']['catch'], ctx)
                # Other steps (if, assert, etc.) remain as before
            except Exception as e:
                log.error(f"Step failed: {str(e)}")
                raise
