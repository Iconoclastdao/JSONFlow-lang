# javascript.py

import logging
from typing import Dict, List, Any, Union
from base import get_expr_code, map_type

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def generate_javascript_function(flow: Dict[str, Any]) -> str:
    """
    Generates a JavaScript function from an A+ JSONFlow definition.

    Args:
        flow: JSONFlow definition with function, schema, context, and steps.

    Returns:
        str: Generated JavaScript code as a string.

    Raises:
        ValueError: If the flow structure is invalid or unsupported steps are encountered.
    """
    if not all(key in flow for key in ["function", "schema", "steps"]):
        raise ValueError("Invalid JSONFlow structure: missing required keys")

    func_name = flow["function"]
    inputs = flow["schema"].get("inputs", {})
    context = flow["schema"].get("context", {})
    steps = flow["steps"]

    # Generate input parameters
    input_params = ", ".join(inputs.keys())

    lines = [f"function {func_name}({input_params}) {{"]

    # Declare context variables with type initialization
    for var, json_type in context.items():
        js_type = map_type(json_type, "javascript")
        initial_value = {
            "string": "''",
            "number": "0",
            "boolean": "false",
            "object": "{}",
            "array": "[]"
        }.get(json_type, "null")
        lines.append(f"    let {var} = {initial_value};")
        log.debug(f"Initialized context variable {var} with type {js_type}: {initial_value}")

    # Compile steps
    for step in steps:
        step_lines = generate_step(step)
        lines.extend(step_lines)

    # Add default return for completeness
    lines.append("    return undefined;")
    lines.append("}")

    generated_code = "\n".join(lines)
    log.info(f"Generated JavaScript function {func_name}")
    return generated_code

def generate_step(step: Dict[str, Any], indent: int = 1) -> List[str]:
    """
    Generates JavaScript code for a single A+ JSONFlow step.

    Args:
        step: JSONFlow step (e.g., set, if, map, try).
        indent: Indentation level for code formatting.

    Returns:
        List[str]: Lines of generated JavaScript code.

    Raises:
        ValueError: If the step type is unsupported or invalid.
    """
    lines = []
    pad = "    " * indent

    if not isinstance(step, dict):
        raise ValueError(f"Invalid step format: {step}")

    if "let" in step:
        for var, expr in step["let"].items():
            code, expr_type = get_expr_code(expr, "javascript")
            lines.append(f"{pad}let {var} = {code};")
            log.debug(f"Generated let: {var} = {code}, type: {expr_type}")

    elif "set" in step:
        target = step["set"]["target"]
        value, value_type = get_expr_code(step["set"]["value"], "javascript")
        if isinstance(target, list):
            target_str = f"{target[0]}[{repr(target[1])}]"
        else:
            target_str = target
        # Check if target is an array for append behavior
        is_array = step.get("schema", {}).get("context", {}).get(target) == "array"
        if is_array:
            lines.append(f"{pad}{target_str}.push({value});")
            log.debug(f"Generated array append: {target_str}.push({value}), type: {value_type}")
        else:
            lines.append(f"{pad}{target_str} = {value};")
            log.debug(f"Generated set: {target_str} = {value}, type: {value_type}")

    elif "assert" in step:
        condition, cond_type = get_expr_code(step["assert"]["condition"], "javascript")
        if cond_type != "boolean":
            log.warning(f"Assert condition has non-boolean type: {cond_type}")
        message = step["assert"]["message"]
        lines.append(f"{pad}if (!({condition})) throw new Error('{message}');")
        log.debug(f"Generated assert: if (!({condition})) throw Error")

    elif "if" in step:
        condition, cond_type = get_expr_code(step["if"]["condition"], "javascript")
        if cond_type != "boolean":
            log.warning(f"If condition has non-boolean type: {cond_type}")
        lines.append(f"{pad}if ({condition}) {{")
        then_steps = step["if"]["then"] if isinstance(step["if"]["then"], list) else [step["if"]["then"]]
        for substep in then_steps:
            lines.extend(generate_step(substep, indent + 1))
        if "else" in step["if"]:
            lines.append(f"{pad}}} else {{")
            else_steps = step["if"]["else"] if isinstance(step["if"]["else"], list) else [step["if"]["else"]]
            for substep in else_steps:
                lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}}}")
        log.debug(f"Generated if: if ({condition})")

    elif "forEach" in step:
        source = step["forEach"]["source"]
        alias = step["forEach"]["as"]
        lines.append(f"{pad}for (let {alias} of {source}) {{")
        for substep in step["forEach"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}}}")
        log.debug(f"Generated forEach: for ({alias} of {source})")

    elif "map" in step:
        source = step["map"]["source"]
        alias = step["map"]["as"]
        target = step["map"]["target"]
        lines.append(f"{pad}const {target} = {source}.map({alias} => {{")
        for substep in step["map"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}    return {alias};")
        lines.append(f"{pad}}});")
        log.debug(f"Generated map: {target} = {source}.map({alias})")

    elif "try" in step:
        lines.append(f"{pad}try {{")
        for substep in step["try"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}}} catch (error) {{")
        if "catch" in step["try"]:
            for substep in step["try"]["catch"]:
                lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}}}")
        log.debug("Generated try-catch block")

    elif "call" in step:
        func = step["call"]["function"]
        args = step["call"]["args"]
        target = step["call"]["target"]
        arg_codes = [get_expr_code(arg, "javascript")[0] for arg in args.values()]
        lines.append(f"{pad}const {target} = {func}({', '.join(arg_codes)});")
        log.debug(f"Generated call: {target} = {func}({', '.join(arg_codes)})")

    elif "log" in step or "print" in step:
        key = "log" if "log" in step else "print"
        level = step[key].get("level", "log")
        message_parts = step[key]["message"]
        message = " + ".join([
            get_expr_code(part, "javascript")[0] if isinstance(part, dict) else f'"{part}"'
            for part in message_parts
        ])
        lines.append(f"{pad}console.{level}({message});")
        log.debug(f"Generated {key}: console.{level}({message})")

    elif "return" in step:
        value, value_type = get_expr_code({"get": step["return"]["get"]}, "javascript")
        lines.append(f"{pad}return {value};")
        log.debug(f"Generated return: return {value}, type: {value_type}")

    else:
        raise ValueError(f"Unsupported step: {step}")

    return lines
