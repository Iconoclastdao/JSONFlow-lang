# javascript.py

from base import get_expr_code, map_type


def generate_javascript_function(flow):
    func_name = flow["function"]
    inputs = flow["schema"]["inputs"]
    context = flow["schema"]["context"]
    steps = flow["steps"]

    # Generate input parameters
    input_params = ", ".join(inputs.keys())

    lines = [f"function {func_name}({input_params}) {{"]

    # Declare context variables
    for var in context.keys():
        lines.append(f"    let {var};")

    # Compile steps
    for step in steps:
        lines.extend(generate_step(step))

    lines.append("}")
    return "\n".join(lines)


def generate_step(step, indent=1):
    lines = []
    pad = "    " * indent

    if "let" in step:
        for var, expr in step["let"].items():
            code = get_expr_code(expr, "js")
            lines.append(f"{pad}let {var} = {code};")
    elif "set" in step:
        target = step["set"]["target"]
        if isinstance(target, list):
            target_str = f"{target[0]}[{repr(target[1])}]"
        else:
            target_str = target
        value = get_expr_code(step["set"]["value"], "js")
        lines.append(f"{pad}{target_str} = {value};")
    elif "assert" in step:
        condition = get_expr_code(step["assert"]["condition"], "js")
        message = step["assert"]["message"]
        lines.append(f"{pad}if (!({condition})) throw new Error('{message}');")
    elif "if" in step:
        condition = get_expr_code(step["if"]["condition"], "js")
        lines.append(f"{pad}if ({condition}) {{")
        lines.extend(generate_step(step["if"]["then"], indent + 1))
        if "else" in step["if"]:
            lines.append(f"{pad}}} else {{")
            lines.extend(generate_step(step["if"]["else"], indent + 1))
        lines.append(f"{pad}}}")
    elif "forEach" in step:
        source = step["forEach"]["source"]
        alias = step["forEach"]["as"]
        lines.append(f"{pad}for (let {alias} of {source}) {{")
        for substep in step["forEach"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}}}")
    elif "log" in step or "print" in step:
        key = "log" if "log" in step else "print"
        level = step.get(key, {}).get("level", "log")
        message_parts = step[key]["message"]
        message = " + ".join([
            get_expr_code(part, "js") if isinstance(part, dict) else f'"{part}"'
            for part in message_parts
        ])
        lines.append(f"{pad}console.{level}({message});")

    return lines
