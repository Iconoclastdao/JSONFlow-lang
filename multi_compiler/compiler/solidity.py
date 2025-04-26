

   from base import get_expr_code, map_type

def generate_solidity_function(flow, state_vars=None, events=None):
    """
    Generates a Solidity function from a JSONFlow definition.
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

    lines.append("}")
    return "\n".join(lines)

def generate_step(step, context, state_vars, events, indent=1):
    lines = []
    pad = "    " * indent

    if "let" in step:
        for var, expr in step["let"].items():
            code = get_expr_code(expr, "solidity")
            # Try to infer type from context or expression (simple: default to uint256)
            lines.append(f"{pad}uint256 {var} = {code};")
    elif "set" in step:
        target = step["set"]["target"]
        if isinstance(target, list):
            # e.g., ["balances", "sender"] => balances[sender]
            target_str = f"{target[0]}[{target[1]}]"
        else:
            target_str = target
        value = get_expr_code(step["set"]["value"], "solidity")
        lines.append(f"{pad}{target_str} = {value};")
    elif "assert" in step:
        condition = get_expr_code(step["assert"]["condition"], "solidity")
        message = step["assert"]["message"]
        lines.append(f'{pad}require({condition}, "{message}");')
    elif "if" in step:
        condition = get_expr_code(step["if"]["condition"], "solidity")
        lines.append(f"{pad}if ({condition}) {{")
        lines.extend(generate_step(step["if"]["then"], context, state_vars, events, indent + 1))
        if "else" in step["if"]:
            lines.append(f"{pad}}} else {{")
            lines.extend(generate_step(step["if"]["else"], context, state_vars, events, indent + 1))
        lines.append(f"{pad}}}")
    elif "forEach" in step:
        source = step["forEach"]["source"]
        alias = step["forEach"]["as"]
        lines.append(f"{pad}for (uint i = 0; i < {source}.length; i++) {{")
        lines.append(f"{pad}    uint256 {alias} = {source}[i];")
        for substep in step["forEach"]["body"]:
            lines.extend(generate_step(substep, context, state_vars, events, indent + 1))
        lines.append(f"{pad}}}")
    elif "log" in step:
        # Solidity: use events for logging
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
            for part in step["print"]["message"]
        ])
        lines.append(f"{pad}// print: {msg}")
    elif "return" in step:
        val = step["return"]["get"]
        if isinstance(val, list):
            val_str = f"{val[0]}[{val[1]}]"
        else:
            val_str = val
        lines.append(f"{pad}return {val_str};")
    return lines

def generate_contract(flow, contract_name="Generated"):
    """
    Generates a full Solidity contract from a JSONFlow definition.
    """
    # Collect state variables and events
    state_vars = set()
    events = set()

    # Add context variables as contract-level state variables
    for var, typ in flow["schema"]["context"].items():
        solidity_type = map_type(typ, "solidity")
        # Special case: mapping
        if solidity_type == "mapping":
            # Assume mapping(address => uint256) for balances
            state_vars.add(f"mapping(address => uint256) public {var};")
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
    for var in state_vars:
        contract_lines.append(f"    {var}")
    # Events
    for event in events:
        contract_lines.append(f"    {event}")
    contract_lines.append("")
    # Function
    contract_lines.extend(["    " + line for line in func_code.splitlines()])
    contract_lines.append("}")

    return "\n".join(contract_lines)
