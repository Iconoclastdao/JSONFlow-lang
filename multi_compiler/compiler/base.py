import logging
from typing import Any, Dict, List, Tuple, Union
from functools import lru_cache

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

@lru_cache(maxsize=1000)
def get_expr_code(expr: Any, lang: str) -> Tuple[str, str]:
    """
    Recursively generates code for an A+ JSONFlow expression in the target language and returns its type.
    Supports async calls, complex types, dict access, arithmetic, logical, comparison, and literals.

    Args:
        expr: JSONFlow expression (e.g., dict, int, str).
        lang: Target language ("solidity", "python", "javascript", "rust").

    Returns:
        Tuple[str, str]: Generated code and inferred A+ JSONFlow type (e.g., "integer", "string").

    Raises:
        ValueError: If the expression or language is unsupported.
    """
    if lang not in ("solidity", "python", "javascript", "rust"):
        raise ValueError(f"Unsupported language: {lang}")

    if isinstance(expr, (int, float, bool, str)):
        value_type = infer_type(expr)
        if isinstance(expr, str):
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
        if isinstance(target, list) and len(target) >= 2:
            base, base_type = get_expr_code(target[0], lang)
            key_parts = [get_expr_code(k, lang)[0] for k in target[1:]]
            key = ".".join(key_parts) if lang in ("javascript", "python") else key_parts[0]
            code = f"{base}[{key}]" if lang in ("solidity", "rust") else f"{base}.{key}"
            value_type = infer_nested_type(base_type, target[1:])
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
        op_map = {
            "===": "==" if lang in ("solidity", "rust", "python") else "===",
            "!==": "!=" if lang in ("solidity", "rust", "python") else "!==",
            ">": ">", "<": "<", ">=": ">=", "<=": "<="
        }
        if op not in op_map:
            raise ValueError(f"Unsupported comparison operator: {op}")
        code = f"{left} {op_map[op]} {right}"
        log.debug(f"Generated code for compare {left} {op} {right}: {code}, type: boolean")
        return code, "boolean"

    # Async function call
    if "call" in expr:
        fn = expr["call"]["function"]
        args = expr["call"].get("args", {})
        async_prefix = "await " if expr["call"].get("async", False) and lang in ("javascript", "python") else ""
        async_suffix = ".await" if expr["call"].get("async", False) and lang == "rust" else ""
        arg_codes = [get_expr_code(arg, lang)[0] for arg in args.values()]
        code = f"{async_prefix}{fn}({', '.join(arg_codes)}){async_suffix}"
        value_type = expr["call"].get("return_type", "string")
        log.debug(f"Generated code for call {fn}: {code}, type: {value_type}")
        return code, value_type

    # Array length
    if "length" in expr:
        arr, arr_type = get_expr_code(expr["length"], lang)
        if arr_type != "array":
            log.warning(f"Length operation on non-array type: {arr_type}")
        code = {
            "solidity": f"{arr}.length",
            "javascript": f"{arr}.length",
            "python": f"len({arr})",
            "rust": f"{arr}.len()"
        }[lang]
        log.debug(f"Generated code for length {arr}: {code}, type: integer")
        return code, "integer"

    # Arithmetic/logical expressions
    if any(key in expr for key in ["add", "subtract", "multiply", "divide", "mod", "and", "or", "not", "in"]):
        return handle_expr(expr, lang)

    raise ValueError(f"Unsupported expression: {expr}")

def handle_expr(expr: Dict[str, Any], lang: str) -> Tuple[str, str]:
    """
    Handles arithmetic, logical, and unary expressions for A+ JSONFlow.

    Args:
        expr: Expression dict (e.g., {"add": [...]}, {"not": ...}).
        lang: Target language ("solidity", "python", "javascript", "rust").

    Returns:
        Tuple[str, str]: Generated code and inferred type.

    Raises:
        ValueError: If the expression is unsupported.
    """
    op_map = {
        "add": "+", "subtract": "-", "multiply": "*", "divide": "/", "mod": "%",
        "and": "&&" if lang in ("solidity", "javascript", "rust") else "and",
        "or": "||" if lang in ("solidity", "javascript", "rust") else "or",
        "not": "!" if lang in ("solidity", "javascript", "rust") else "not "
    }

    for op in ["add", "subtract", "multiply", "divide", "mod"]:
        if op in expr:
            items = [get_expr_code(i, lang) for i in expr[op]]
            code = f" {op_map[op]} ".join(item[0] for item in items)
            value_type = "number" if op in ("divide", "multiply") or any(item[1] == "number" for item in items) else "integer"
            log.debug(f"Generated code for {op}: {code}, type: {value_type}")
            return code, value_type

    for op in ["and", "or"]:
        if op in expr:
            items = [get_expr_code(i, lang) for i in expr[op]]
            code = f" {op_map[op]} ".join(item[0] for item in items)
            value_type = "boolean"
            log.debug(f"Generated code for {op}: {code}, type: {value_type}")
            return code, value_type

    if "not" in expr:
        val, val_type = get_expr_code(expr["not"], lang)
        code = f"{op_map['not']}{val}"
        if val_type != "boolean":
            log.warning(f"Not operation on non-boolean type: {val_type}")
        value_type = "boolean"
        log.debug(f"Generated code for not: {code}, type: {value_type}")
        return code, value_type

    if "in" in expr:
        item, item_type = get_expr_code(expr["in"]["item"], lang)
        array, array_type = get_expr_code(expr["in"]["array"], lang)
        if array_type != "array":
            log.warning(f"In operation on non-array type: {array_type}")
        code = {
            "python": f"{item} in {array}",
            "javascript": f"{array}.includes({item})",
            "rust": f"{array}.contains(&{item})",
            "solidity": f"contains({array}, {item})"
        }[lang]
        value_type = "boolean"
        log.debug(f"Generated code for in: {code}, type: {value_type}")
        return code, value_type

    if "neg" in expr:
        val, val_type = get_expr_code(expr["neg"], lang)
        code = f"-{val}"
        value_type = val_type
        log.debug(f"Generated code for neg: {code}, type: {value_type}")
        return code, value_type

    raise ValueError(f"Unsupported subexpression: {expr}")

def infer_type(value: Any) -> str:
    """
    Infers the A+ JSONFlow type from a Python value, including nested types.

    Args:
        value: Value to infer type for (e.g., int, str, list, dict).

    Returns:
        str: A+ JSONFlow type (e.g., "integer", "array").
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

def infer_nested_type(base_type: str, path: List[Any]) -> str:
    """
    Infers the type of a nested access (e.g., object.field or array[0]).

    Args:
        base_type: Base type (e.g., "object", "array").
        path: Access path (e.g., ["field"], [0]).

    Returns:
        str: Inferred type for the nested access.
    """
    if base_type == "object":
        return "integer"  # Assume integer for object fields (e.g., balances[address])
    elif base_type == "array":
        return "integer"  # Assume array elements are integers
    return base_type  # Fallback to base type

def map_type(json_type: str, lang: str) -> str:
    """
    Maps an A+ JSONFlow type to a target language type.

    Args:
        json_type: A+ JSONFlow type (e.g., "integer", "string").
        lang: Target language ("solidity", "python", "javascript", "rust").

    Returns:
        str: Corresponding type in the target language.

    Raises:
        ValueError: If the type or language is unsupported.
    """
    mapping = {
        "string": {"solidity": "string", "javascript": "string", "python": "str", "rust": "String"},
        "integer": {"solidity": "uint256", "javascript": "number", "python": "int", "rust": "i32"},
        "number": {"solidity": "uint256", "javascript": "number", "python": "float", "rust": "f64"},
        "boolean": {"solidity": "bool", "javascript": "boolean", "python": "bool", "rust": "bool"},
        "object": {"solidity": "mapping", "javascript": "object", "python": "dict", "rust": "HashMap<String, i32>"},
        "array": {"solidity": "uint256[]", "javascript": "Array", "python": "list", "rust": "Vec<i32>"},
        "address": {"solidity": "address", "javascript": "string", "python": "str", "rust": "String"}
    }
    if json_type not in mapping:
        raise ValueError(f"Unsupported JSONFlow type: {json_type}")
    if lang not in mapping[json_type]:
        raise ValueError(f"Language {lang} not supported for type {json_type}")
    return mapping[json_type][lang]
