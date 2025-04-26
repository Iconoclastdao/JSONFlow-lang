# base.py

def get_expr_code(expr, lang):
    """
    Recursively generates code for an expression in the target language.
    Supports dict access, arithmetic, logical, comparison, function calls, and literals.
    """
    if isinstance(expr, (int, float, bool)):
        return str(expr)
    if isinstance(expr, str):
        # In Solidity, bare identifiers are variables; in Python, wrap in str
        return expr if lang == "solidity" else repr(expr)

    if not isinstance(expr, dict):
        raise ValueError(f"Unsupported expression type: {type(expr)}")

    # Variable or mapping access
    if "get" in expr:
        target = expr["get"]
        if isinstance(target, list) and len(target) == 2:
            base = get_expr_code(target[0], lang)
            key = get_expr_code(target[1], lang)
            return f"{base}[{key}]"
        return str(target)

    # Arithmetic/logical/comparison expressions
    if "expr" in expr:
        return handle_expr(expr["expr"], lang)

    # Comparison
    if "compare" in expr:
        left = get_expr_code(expr["compare"]["left"], lang)
        op = expr["compare"]["op"]
        right = get_expr_code(expr["compare"]["right"], lang)
        return f"{left} {op} {right}"

    # Function call
    if "call" in expr:
        fn = expr["call"]["function"]
        args = [get_expr_code(arg, lang) for arg in expr["call"].get("args", [])]
        return f"{fn}({', '.join(args)})"

    # Literal value
    if "literal" in expr:
        return repr(expr["literal"])

    # Array length
    if "length" in expr:
        arr = get_expr_code(expr["length"], lang)
        if lang == "solidity":
            return f"{arr}.length"
        elif lang == "python":
            return f"len({arr})"
        else:
            return f"{arr}.length"

    raise ValueError(f"Unsupported expression: {expr}")

def handle_expr(expr, lang):
    """
    Handles arithmetic, logical, and unary expressions.
    """
    # Arithmetic
    if "add" in expr:
        items = [get_expr_code(i, lang) for i in expr["add"]]
        return " + ".join(items)
    if "sub" in expr:
        items = [get_expr_code(i, lang) for i in expr["sub"]]
        return " - ".join(items)
    if "mul" in expr:
        items = [get_expr_code(i, lang) for i in expr["mul"]]
        return " * ".join(items)
    if "div" in expr:
        items = [get_expr_code(i, lang) for i in expr["div"]]
        return " / ".join(items)
    if "mod" in expr:
        items = [get_expr_code(i, lang) for i in expr["mod"]]
        return " % ".join(items)

    # Logical
    if "and" in expr:
        items = [get_expr_code(i, lang) for i in expr["and"]]
        return " && ".join(items) if lang == "solidity" else " and ".join(items)
    if "or" in expr:
        items = [get_expr_code(i, lang) for i in expr["or"]]
        return " || ".join(items) if lang == "solidity" else " or ".join(items)
    if "not" in expr:
        val = get_expr_code(expr["not"], lang)
        return f"!{val}" if lang == "solidity" else f"not {val}"

    # Unary
    if "neg" in expr:
        val = get_expr_code(expr["neg"], lang)
        return f"-{val}"

    raise ValueError(f"Unsupported subexpression: {expr}")

def map_type(json_type, lang):
    """
    Maps a JSONFlow type to a target language type.
    """
    mapping = {
        "string":      {"solidity": "string", "javascript": "string", "python": "str"},
        "int":         {"solidity": "uint256", "javascript": "number", "python": "int"},
        "uint":        {"solidity": "uint256", "javascript": "number", "python": "int"},
        "float":       {"solidity": "uint256", "javascript": "number", "python": "float"},  # Solidity has no float
        "bool":        {"solidity": "bool", "javascript": "boolean", "python": "bool"},
        "address":     {"solidity": "address", "javascript": "string", "python": "str"},
        "dict":        {"solidity": "mapping", "javascript": "object", "python": "dict"},
        "mapping":     {"solidity": "mapping", "javascript": "object", "python": "dict"},
        "array":       {"solidity": "uint256[]", "javascript": "Array", "python": "list"},
    }
    return mapping.get(json_type, {}).get(lang, "any")

