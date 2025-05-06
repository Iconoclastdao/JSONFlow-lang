from base import get_expr_code, map_type

def generate_solidity_function(flow, state_vars=None, events=None):
    """
    Generates a Solidity function from a JSONFlow definition (A+ schema).
    - state_vars: set for collecting contract-level state variables (e.g., mappings)
    - events: set for collecting event definitions
    """
    func_name = flow["function"]
    inputs = flow["schema"]["inputs"]
    context = flow["schema"]["context"]
    steps = flow["steps"]

    # Generate input parameters
    input_params = []
    for name, meta in inputs.items():
        solidity_type = map_type(meta["type"], "solidity")
        input_params.append(f"{solidity_type} {name}")

    # Start building the function
    lines = [f"function {func_name}({', '.join(input_params)}) public returns (uint256) {{"]

    # Compile steps
    for step in steps:
        lines.extend(generate_step(step, context, state_vars, events))

    # Default return if no explicit return (e.g., return 0 for success)
    lines.append("    return 0;")
    lines.append("}")
    return "\n".join(lines)

def generate_step(step, context, state_vars, events, indent=1):
    lines = []
    pad = "    " * indent

    if "let" in step:
        for var, expr in step["let"].items():
            # Infer type from context or expression; default to uint256 for simplicity
            expr_type = infer_type(expr, context)
            solidity_type = map_type(expr_type, "solidity")
            code = get_expr_code(expr, "solidity")
            lines.append(f"{pad}{solidity_type} {var} = {code};")
    elif "set" in step:
        target = step["set"]["target"]
        value = get_expr_code(step["set"]["value"], "solidity")
        # Determine if target is an array for append behavior
        target_type = get_context_type(target, context)
        if isinstance(target, list):
            # e.g., ["balances", "sender"] => balances[sender]
            target_str = f"{target[0]}[{target[1]}]"
        else:
            target_str = target
        if target_type == "array":
            # Append to array (e.g., arrays.push(value))
            lines.append(f"{pad}{target_str}.push({value});")
        else:
            # Direct assignment
            lines.append(f"{pad}{target_str} = {value};")
    elif "assert" in step:
        condition = get_expr_code(step["assert"]["condition"], "solidity")
        message = step["assert"]["message"]
        lines.append(f'{pad}require({condition}, "{message}");')
    elif "if" in step:
        condition = get_expr_code(step["if"]["condition"], "solidity")
        lines.append(f"{pad}if ({condition}) {{")
        # Handle then as single step or array
        then_steps = step["if"]["then"] if isinstance(step["if"]["then"], list) else [step["if"]["then"]]
        for substep in then_steps:
            lines.extend(generate_step(substep, context, state_vars, events, indent + 1))
        if "else" in step["if"]:
            lines.append(f"{pad}}} else {{")
            else_steps = step["if"]["else"] if isinstance(step["if"]["else"], list) else [step["if"]["else"]]
            for substep in else_steps:
                lines.extend(generate_step(substep, context, state_vars, events, indent + 1))
        lines.append(f"{pad}}}")
    elif "map" in step:
        source = step["map"]["source"]
        alias = step["map"]["as"]
        target = step["map"]["target"]
        # Assume source and target are arrays; create temporary array for results
        lines.append(f"{pad}{map_type('array', 'solidity')} memory {target} = new {map_type('array', 'solidity')}({source}.length);")
        lines.append(f"{pad}for (uint i = 0; i < {source}.length; i++) {{")
        lines.append(f"{pad}    uint256 {alias} = {source}[i];")
        for substep in step["map"]["body"]:
            lines.extend(generate_step(substep, context, state_vars, events, indent + 1))
        # Store result in target array
        lines.append(f"{pad}    {target}[i] = {alias};")
        lines.append(f"{pad}}}")
    elif "forEach" in step:
        source = step["forEach"]["source"]
        alias = step["forEach"]["as"]
        lines.append(f"{pad}for (uint i = 0; i < {source}.length; i++) {{")
        lines.append(f"{pad}    uint256 {alias} = {source}[i];")
        for substep in step["forEach"]["body"]:
            lines.extend(generate_step(substep, context, state_vars, events, indent + 1))
        lines.append(f"{pad}}}")
    elif "try" in step:
        # Solidity has no native try-catch; simulate with if-require
        lines.append(f"{pad}{{ // try")
        for substep in step["try"]["body"]:
            lines.extend(generate_step(substep, context, state_vars, events, indent + 1))
        lines.append(f"{pad}}} // end try")
        if "catch" in step["try"]:
            lines.append(f"{pad}{{ // catch")
            # Define error variable (simplified; assumes string message)
            lines.append(f"{pad}    string memory error = 'Caught error';")
            for substep in step["try"]["catch"]:
                lines.extend(generate_step(substep, context, state_vars, events, indent + 1))
            lines.append(f"{pad}}} // end catch")
    elif "log" in step:
        if events is not None:
            events.add("event Log(string message);")
        msg = " + ".join([
            get_expr_code(part, "solidity") if isinstance(part, dict) else f'"{part}"'
            for part in step["log"]["message"]
        ])
        lines.append(f"{pad}emit Log({msg});")
    elif "print" in step:
        # Solidity: no print, use event or comment
        msg = " + ".join([
            get_expr_code(part, "solidity") if isinstance(part, dict) else f'"{part}"'
            for part in step["print"]["values"]
        ])
        lines.append(f"{pad}// print: {msg}")
    elif "call" in step:
        func = step["call"]["function"]
        target = step["call"]["target"]
        args = step["call"]["args"]
        arg_list = ", ".join([get_expr_code(arg, "solidity") for arg in args.values()])
        # Assume external contract call; simplistic handling
        lines.append(f"{pad}uint256 {target} = {func}({arg_list});")
        if state_vars is not None:
            # Add external contract interface (simplified)
            state_vars.add(f"function {func}({', '.join(['uint256' for _ in args])}) external returns (uint256);")
    elif "return" in step:
        val = step["return"]["get"]
        if isinstance(val, list):
            val_str = f"{val[0]}[{val[1]}]"
        else:
            val_str = val
        lines.append(f"{pad}return {val_str};")
    return lines

def infer_type(expr, context):
    """
    Infers the type of an expression based on context or expression structure.
    """
    if "get" in expr:
        return get_context_type(expr["get"], context)
    elif "value" in expr:
        if isinstance(expr["value"], str):
            return "string"
        elif isinstance(expr["value"], bool):
            return "boolean"
        elif isinstance(expr["value"], (int, float)):
            return "integer" if isinstance(expr["value"], int) else "number"
        elif isinstance(expr["value"], list):
            return "array"
        elif isinstance(expr["value"], dict):
            return "object"
    elif "add" in expr or "subtract" in expr or "multiply" in expr or "divide" in expr or "mod" in expr:
        return "integer"  # Assume numeric operations return integers
    elif "compare" in expr or "and" in expr or "or" in expr or "not" in expr:
        return "boolean"
    elif "length" in expr:
        return "integer"
    elif "in" in expr:
        return "boolean"
    return "integer"  # Default fallback

def get_context_type(target, context):
    """
    Retrieves the type of a context variable or path.
    """
    if isinstance(target, list):
        # Assume first element is context variable, rest are keys
        return context.get(target[0], "integer")
    return context.get(target, "integer")

def generate_contract(flow, contract_name="Generated"):
    """
    Generates a full Solidity contract from a JSONFlow definition (A+ schema).
    """
    # Collect state variables and events
    state_vars = set()
    events = set()

    # Add context variables as contract-level state variables
    for var, typ in flow["schema"]["context"].items():
        solidity_type = map_type(typ, "solidity")
        if solidity_type == "mapping":
            # Assume mapping(address => uint256) for simplicity
            state_vars.add(f"mapping(address => uint256) public {var};")
        elif solidity_type == "array":
            # Solidity arrays need type specification
            state_vars.add(f"uint256[] public {var};")
        else:
            state_vars.add(f"{solidity_type} public {var};")

    # Generate function code
    func_code = generate_solidity_function(flow, state_vars, events)

    # Compose contract
    contract_lines = [
        "// SPDX-License-Identifier: MIT",
        "pragma solidity ^0.8.0;",
        "",
        f"contract {contract_name} {{"
    ]
    # State variables
    for var in sorted(state_vars):
        contract_lines.append(f"    {var}")
    # Events
    for event in sorted(events):
        contract_lines.append(f"    {event}")
    contract_lines.append("")
    # Function
    contract_lines.extend(["    " + line for line in func_code.splitlines()])
    contract_lines.append("}")

    return "\n".join(contract_lines)
