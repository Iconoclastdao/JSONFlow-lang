from lark import Lark, Transformer, v_args

# Load grammar from file
with open('kidlang.lark') as f:
    grammar = f.read()

parser = Lark(grammar, parser='lalr', transformer=None)

@v_args(inline=True)
class KidLangTransformer(Transformer):
    def remember_name(self, name):
        return {"remember": {"var": "name", "value": str(name)}}

    def add_expr(self, num1, num2, var_name):
        return {"verb": "add", "inputs": [int(num1), int(num2)], "target": str(var_name)}

    def gt(self):
        return "greater than"

    def lt(self):
        return "less than"

    def eq(self):
        return "equals"

    def if_stmt(self, var_name, op, number, message):
        return {
            "if": {
                "condition": {"left": str(var_name), "op": op, "right": int(number)},
                "then": {"say": message.strip('"')}
            }
        }

    def repeat_stmt(self, times, message):
        return {
            "repeat": {
                "times": int(times),
                "do": [{"say": message.strip('"')}]
            }
        }

    def say_stmt(self, message):
        return {"say": message.strip('"')}

def parse_kid_sentence_grammar(sentence):
    """
    Uses the kidlang grammar to parse a sentence into a structured block.
    """
    tree = parser.parse(sentence)
    transformer = KidLangTransformer()
    return transformer.transform(tree)
