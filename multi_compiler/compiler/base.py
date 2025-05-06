# base.py
import logging
from typing import Any, Dict, List, Tuple, Union

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def get_expr_code(expr: Any, lang: str) -> Tuple[str, str]:
    """
    Recursively generates code for an A+ JSONFlow expression in the target language and returns its type.
    Supports dict access, arithmetic, logical, comparison, function calls, literals, and A+ schema constructs.

    Args:
        expr: The JSONFlow expression (e.g., dict, int, str).
        lang: Target language ("solidity", "python", "javascript").

    Returns:
        Tuple[str, str]: Generated code and inferred A+ JSONFlow type (e.g., "integer", "string").

    Raises:
        ValueError: If the expression or language is unsupported.
    """
    if lang not in ("solidity", "python", "javascript"):
        raise ValueError(f"Unsupported language: {lang}")

    if isinstance(expr, (int, float, bool, str)):
        value_type = infer_type(expr)
        if isinstance(expr, str):
            # In Solidity, bare identifiers are variables; in Python/JS, wrap strings
            code = expr if lang == "solidity" else repr(expr)
        else:
            code = str(expr).lower() if isinstance(expr, bool) and lang != "solidity" else str(expr)
        log.debug(f"Generated code for literal {expr}: {code}, type: {value_type}")
        return code, value_type

    if not isinstance(expr, dict):
        raise ValueError(f"Unsupported expression type: {type(expr)}")

    # Variable or mapping access
    if "get" in expr:
        target = expr["get"]
        if isinstance(target, list) and len(target) == 2:
            base, base_type = get_expr_code(target[0], lang)
            key, key_type = get_expr_code(target[1], lang)
            code = f"{base}[{key}]"
            # Assume mapping access returns the value type of the mapping (simplified)
            value_type = "integer" if base_type == "mapping" else base_type
        else:
            code = str(target)
            value_type = "integer"  # Default for variables
        log.debug(f"Generated code for get {target}: {code}, type: {value_type}")
        return code, value_type

    # Literal value
    if "value" in expr:
        value = expr["value"]
        value_type = infer_type(value)
        code = repr(value) if isinstance(value, str) and lang != "solidity" else str(value)
        log.debug(f"Generated code for value {value}: {code}, type: {value_type}")
        return code, value_type

    # Comparison
    if "compare" in expr:
        left, left_type = get_expr_code(expr["compare"]["left"], lang)
        op = expr["compare"]["op"]
        right, right_type = get_expr_code(expr["compare"]["right"], lang)
        # Map A+ operators to language-specific ones
        op_map = {
            "===": "==" if lang == "solidity" else "===" if lang == "javascript" else "==",
            "!==": "!=" if lang == "solidity" else "!==" if lang == "javascript" else "!=",
            ">": ">",
            "<": "<",
            ">=": ">=",
            "<=": "<="
        }
        if op not in op_map:
            raise ValueError(f"Unsupported comparison operator: {op}")
        code = f"{left} {op_map[op]} {right}"
        log.debug(f"Generated code for compare {left} {op} {right}: {code}, type: boolean")
        return code, "boolean"

    # Function call
    if "call" in expr:
        fn = expr["call"]["function"]
        args = expr["call"].get("args", {})
        arg_codes = [get_expr_code(arg, lang)[0] for arg in args.values()]
        code = f"{fn}({', '.join(arg_codes)})"
        # Assume function returns a string (common for external calls); can be extended
        value_type = "string"
        log.debug(f"Generated code for call {fn}: {code}, type: {value_type}")
        return code, value_type

    # Array length
    if "length" in expr:
        arr, arr_type = get_expr_code(expr["length"], lang)
        if arr_type != "array":
            log.warning(f"Length operation on non-array type: {arr_type}")
        code = f"{arr}.length" if lang in ("solidity", "javascript") else f"len({arr})"
        log.debug(f"Generated code for length {arr}: {code}, type: integer")
        return code, "integer"

    # Arithmetic/logical expressions
    if any(key in expr for key in ["add", "subtract", "multiply", "divide", "mod", "and", "or", "not"]):
        return handle_expr(expr, lang)

    raise ValueError(f"Unsupported expression: {expr}")

def handle_expr(expr: Dict[str, Any], lang: str) -> Tuple[str, str]:
    """
    Handles arithmetic, logical, and unary expressions for A+ JSONFlow.

    Args:
        expr: The expression dict (e.g., {"add": [...]}, {"not": ...}).
        lang: Target language ("solidity", "python", "javascript").

    Returns:
        Tuple[str, str]: Generated code and inferred type.

    Raises:
        ValueError: If the expression is unsupported.
    """
    # Arithmetic
    if "add" in expr:
        items = [get_expr_code(i, lang) for i in expr["add"]]
        code = " + ".join(item[0] for item in items)
        # Type is number if any operand is number, else integer
        value_type = "number" if any(item[1] == "number" for item in items) else "integer"
        log.debug(f"Generated code for add: {code}, type: {value_type}")
        return code, value_type

    if "subtract" in expr:
        items = [get_expr_code(i, lang) for i in expr["subtract"]]
        code = " - ".join(item[0] for item in items)
        value_type = "number" if any(item[1] == "number" for item in items) else "integer"
        log.debug(f"Generated code for subtract: {code}, type: {value_type}")
        return code, value_type

    if "multiply" in expr:
        items = [get_expr_code(i, lang) for i in expr["multiply"]]
        code = " * ".join(item[0] for item in items)
        value_type = "number" if any(item[1] == "number" for item in items) else "integer"
        log.debug(f"Generated code for multiply: {code}, type: {value_type}")
        return code, value_type

    if "divide" in expr:
        items = [get_expr_code(i, lang) for i in expr["divide"]]
        code = " / ".join(item[0] for item in items)
        value_type = "number"  # Division typically yields number
        log.debug(f"Generated code for divide: {code}, type: {value_type}")
        return code, value_type

    if "mod" in expr:
        items = [get_expr_code(i, lang) for i in expr["mod"]]
        code = " % ".join(item[0] for item in items)
        value_type = "integer"
        log.debug(f"Generated code for mod: {code}, type: {value_type}")
        return code, value_type

    # Logical
    if "and" in expr:
        items = [get_expr_code(i, lang) for i in expr["and"]]
        code = " && ".join(item[0] for item in items) if lang == "solidity" else " and ".join(item[0] for item in items)
        value_type = "boolean"
        log.debug(f"Generated code for and: {code}, type: {value_type}")
        return code, value_type

    if "or" in expr:
        items = [get_expr_code(i, lang) for i in expr["or"]]
        code = " || ".join(item[0] for item in items) if lang == "solidity" else " or ".join(item[0] for item in items)
        value_type = "boolean"
        log.debug(f"Generated code for or: {code}, type: {value_type}")
        return code, value_type

    if "not" in expr:
        val, val_type = get_expr_code(expr["not"], lang)
        code = f"!{val}" if lang == "solidity" else f"not {val}"
        if val_type != "boolean":
            log.warning(f"Not operation on non-boolean type: {val_type}")
        value_type = "boolean"
        log.debug(f"Generated code for not: {code}, type: {value_type}")
        return code, value_type

    # Unary
    if "neg" in expr:
        val, val_type = get_expr_code(expr["neg"], lang)
        code = f"-{val}"
        value_type = val_type
        log.debug(f"Generated code for neg: {code}, type: {value_type}")
        return code, value_type

    if "in" in expr:
        item, item_type = get_expr_code(expr["in"]["item"], lang)
        array, array_type = get_expr_code(expr["in"]["array"], lang)
        if array_type != "array":
            log.warning(f"In operation on non-array type: {array_type}")
        code = f"{item} in {array}" if lang == "python" else f"{array}.includes({item})" if lang == "javascript" else f"contains({array}, {item})"
        value_type = "boolean"
        log.debug(f"Generated code for in: {code}, type: {value_type}")
        return code, value_type

    raise ValueError(f"Unsupported subexpression: {expr}")

def infer_type(value: Any) -> str:
    """
    Infers the A+ JSONFlow type from a Python value.

    Args:
        value: The value to infer type for (e.g., int, str, list).

    Returns:
        str: A+ JSONFlow type (e.g., "integer", "string", "array").
    """
    if isinstance(value, int):
        return "integer"
    elif isinstance(value, float):
        return "number"
    elif isinstance(value, bool):
        return "boolean"
    elif isinstance(value, str):
        return "string"
    elif isinstance(value, list):
        return "array"
    elif isinstance(value, dict):
        return "object"
    return "string"  # Default fallback

def map_type(json_type: str, lang: str) -> str:
    """
    Maps an A+ JSONFlow type to a target language type.

    Args:
        json_type: A+ JSONFlow type (e.g., "integer", "string").
        lang: Target language ("solidity", "python", "javascript").

    Returns:
        str: Corresponding type in the target language.

    Raises:
        ValueError: If the type or language is unsupported.
    """
    mapping = {
        "string": {"solidity": "string", "javascript": "string", "python": "str"},
        "integer": {"solidity": "uint256", "javascript": "number", "python": "int"},
        "number": {"solidity": "uint256", "javascript": "number", "python": "float"},  # Solidity approximates number
        "boolean": {"solidity": "bool", "javascript": "boolean", "python": "bool"},
        "object": {"solidity": "mapping", "javascript": "object", "python": "dict"},
        "array": {"solidity": "uint256[]", "javascript": "Array", "python": "list"},
        "address": {"solidity": "address", "javascript": "string", "python": "str"}  # For blockchain
    }
    if json_type not in mapping:
        raise ValueError(f"Unsupported JSONFlow type: {json_type}")
    if lang not in mapping[json_type]:
        raise ValueError(f"Language {lang} not supported for type {json_type}")
    return mapping[json_type][lang]
