import logging
from typing import Dict, List, Any
from base import get_expr_code, map_type

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def generate_javascript_function(flow: Dict[str, Any]) -> str:
    """
    Generates an async JavaScript function from an A+ JSONFlow definition.

    Args:
        flow: JSONFlow definition with function, schema, context, and steps.

    Returns:
        str: Generated JavaScript code.
    """
    func_name = flow["function"]
    inputs = flow["schema"].get("inputs", {})
    context = flow["schema"].get("context", {})
    steps = flow["steps"]

    lines = [f"async function {func_name}({', '.join(inputs.keys())}) {{"]

    for var, json_type in context.items():
        initial_value = {"string": "''", "number": "0", "boolean": "false", "object": "{}", "array": "[]"}.get(json_type, "null")
        lines.append(f"    let {var} = {initial_value};")

    for step in steps:
        lines.extend(generate_step(step))

    lines.append("    return undefined;")
    lines.append("}")

    return "\n".join(lines)

def generate_step(step: Dict[str, Any], indent: int = 1) -> List[str]:
    lines = []
    pad = "    " * indent

    if "set" in step:
        target = step["set"]["target"]
        value, value_type = get_expr_code(step["set"]["value"], "javascript")
        is_array = step.get("schema", {}).get("context", {}).get(target) == "array"
        lines.append(f"{pad}{target}.push({value});" if is_array else f"{pad}{target} = {value};")
    elif "map" in step:
        source = step["map"]["source"]
        alias = step["map"]["as"]
        target = step["map"]["target"]
        lines.append(f"{pad}const {target} = await Promise.all({source}.map(async ({alias}) => {{")
        for substep in step["map"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}    return {alias};"))
        lines.append(f"{pad}}));")
    elif "call" in step:
        func = step["call"]["function"]
        args = step["call"]["args"]
        target = step["call"]["target"]
        async_prefix = "await " if step["call"].get("async", False) else ""
        arg_codes = [get_expr_code(arg, "javascript")[0] for arg in args.values()]
        lines.append(f"{pad}const {target} = {async_prefix}{func}({', '.join(arg_codes)});")
    # Other steps (if, forEach, try, etc.) remain as before
    return lines
