import logging
from typing import Dict, List, Any
from base import get_expr_code, map_type

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def generate_python_function(flow: Dict[str, Any]) -> str:
    """
    Generates an async Python function from an A+ JSONFlow definition.

    Args:
        flow: JSONFlow definition with function, schema, context, and steps.

    Returns:
        str: Generated Python code.
    """
    func_name = flow["function"]
    inputs = flow["schema"].get("inputs", {})
    context = flow["schema"].get("context", {})
    steps = flow["steps"]

    lines = ["from typing import Dict, List, Any", "import asyncio", ""]
    lines.append(f"async def {func_name}({', '.join(f'{var}: {map_type(json_type, \"python\")}' for var, json_type in inputs.items())}) -> int:")

    for var, json_type in context.items():
        initial_value = {"string": "''", "integer": "0", "number": "0.0", "boolean": "False", "object": "{}", "array": "[]"}.get(json_type, "None")
        lines.append(f"    {var}: {map_type(json_type, 'python')} = {initial_value}")

    for step in steps:
        lines.extend(generate_step(step))

    lines.append("    return balance if 'balance' in locals() else 0")

    return "\n".join(lines)

def generate_step(step: Dict[str, Any], indent: int = 1) -> List[str]:
    lines = []
    pad = "    " * indent

    if "set" in step:
        target = step["set"]["target"]
        value, value_type = get_expr_code(step["set"]["value"], "python")
        is_array = step.get("schema", {}).get("context", {}).get(target) == "array"
        lines.append(f"{pad}{target}.append({value})" if is_array else f"{pad}{target} = {value}")
    elif "map" in step:
        source = step["map"]["source"]
        alias = step["map"]["as"]
        target = step["map"]["target"]
        lines.append(f"{pad}{target} = [({alias} async for {alias} in {source}) for {alias} in {source}]")
        for substep in step["map"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
    elif "call" in step:
        func = step["call"]["function"]
        args = step["call"]["args"]
        target = step["call"]["target"]
        async_prefix = "await " if step["call"].get("async", False) else ""
        arg_codes = [get_expr_code(arg, "python")[0] for arg in args.values()]
        lines.append(f"{pad}{target} = {async_prefix}{func}({', '.join(arg_codes)})")
    # Other steps similar to javascript.py
    return lines
