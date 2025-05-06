from lark import Lark, Transformer, v_args
from typing import Dict, Any, List
import logging

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Load grammar
with open('kidlang.lark') as f:
    grammar = f.read()

parser = Lark(grammar, parser='lalr', transformer=None)

@v_args(inline=True)
class KidLangTransformer(Transformer):
    def remember_name(self, name: str) -> Dict[str, Any]:
        """Maps 'remember my name is X' to a set operation."""
        return {"set": {"target": "name", "value": str(name)}}

    def add_expr(self, num1: str, num2: str, var_name: str) -> Dict[str, Any]:
        """Maps 'add X and Y and call it Z' to an add expression."""
        return {
            "set": {
                "target": str(var_name),
                "value": {
                    "add": [
                        {"value": int(num1)},
                        {"value": int(num2)}
                    ]
                }
            }
        }

    def set_value(self, name: str, value: str) -> Dict[str, Any]:
        """Maps 'set X to Y' to a set operation."""
        parsed_value = parse_value(value)
        return {
            "set": {
                "target": str(name),
                "value": {"value": parsed_value}
            }
        }

    def append_value(self, value: str, name: str) -> Dict[str, Any]:
        """Maps 'append X to Y' to an array append operation."""
        parsed_value = parse_value(value)
        return {
            "set": {
                "target": str(name),
                "value": {"value": parsed_value}
            }
        }

    def gt(self) -> str:
        return ">"

    def lt(self) -> str:
        return "<"

    def eq(self) -> str:
        return "==="

    def neq(self) -> str:
        return "!=="

    def if_stmt(self, var_name: str, op: str, number: str, *args) -> Dict[str, Any]:
        """Maps 'if X op Y, then Z otherwise W' to an if statement."""
        then_steps = args[0] if len(args) > 0 else []
        else_steps = args[1] if len(args) > 1 else []
        return {
            "if": {
                "condition": {
                    "compare": {
                        "left": {"get": str(var_name)},
                        "op": op,
                        "right": {"value": int(number)}
                    }
                },
                "then": then_steps if isinstance(then_steps, list) else [then_steps],
                "else": else_steps if isinstance(else_steps, list) else [else_steps] if else_steps else []
            }
        }

    def repeat_stmt(self, times: str, *statements) -> Dict[str, Any]:
        """Maps 'repeat X times, Y' to a repeat loop."""
        return {
            "forEach": {
                "source": {"value": list(range(int(times)))},
                "as": "_index",
                "body": statements
            }
        }

    def foreach_stmt(self, item_name: str, array_name: str, *statements) -> Dict[str, Any]:
        """Maps 'for each X in Y, Z' to a forEach loop."""
        return {
            "forEach": {
                "source": str(array_name),
                "as": str(item_name),
                "body": statements
            }
        }

    def try_catch_stmt(self, *args) -> Dict[str, Any]:
        """Maps 'try X catch Y' to a try-catch block."""
        body = args[:len(args)//2]
        catch = args[len(args)//2:]
        return {
            "try": {
                "body": body,
                "catch": catch
            }
        }

    def map_add_stmt(self, source: str, target: str, number: str) -> Dict[str, Any]:
        """Maps 'map X to Y by adding Z' to a map operation."""
        return {
            "map": {
                "source": str(source),
                "as": "item",
                "body": [
                    {
                        "set": {
                            "target": "item",
                            "value": {
                                "add": [
                                    {"get": "item"},
                                    {"value": int(number)}
                                ]
                            }
                        }
                    }
                ],
                "target": str(target)
            }
        }

    def call_stmt(self, func: str, value: str, target: str) -> Dict[str, Any]:
        """Maps 'call X with Y and save to Z' to a call operation."""
        parsed_value = parse_value(value)
        return {
            "call": {
                "function": str(func),
                "args": {"arg1": {"value": parsed_value}},
                "target": str(target)
            }
        }

    def assert_stmt(self, var_name: str, op: str, number: str, message: str) -> Dict[str, Any]:
        """Maps 'assert X op Y or say Z' to an assert operation."""
        return {
            "assert": {
                "condition": {
                    "compare": {
                        "left": {"get": str(var_name)},
                        "op": op,
                        "right": {"value": int(number)}
                    }
                },
                "message": message.strip('"')
            }
        }

    def return_stmt(self, name: str) -> Dict[str, Any]:
        """Maps 'return X' to a return operation."""
        return {
            "return": {
                "get": str(name)
            }
        }

    def say_stmt(self, message: str) -> Dict[str, Any]:
        """Maps 'say X' to a log operation."""
        return {
            "log": {
                "level": "info",
                "message": [{"value": message.strip('"')}]
            }
        }

def parse_value(value: str) -> Any:
    """Parses a string value into a Python type."""
    if value.isdigit():
        return int(value)
    if value in ("true", "false"):
        return value == "true"
    return value.strip('"')

def parse_kid_sentence_grammar(sentence: str) -> Dict[str, Any]:
    """
    Parses a kid-friendly sentence into a structured block using Lark grammar.
    
    Args:
        sentence: The input sentence (e.g., "set balance to 100").
    
    Returns:
        A structured block compatible with A+ JSONFlow translation.
    """
    try:
        tree = parser.parse(sentence)
        transformer = KidLangTransformer()
        return transformer.transform(tree)
    except Exception as e:
        log.error(f"Failed to parse sentence '{sentence}': {str(e)}")
        return {"error": f"Parse error: {str(e)}"}
