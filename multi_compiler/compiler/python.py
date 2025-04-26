from compiler.base import get_expr_code

def compile_to_python(flow):
    lines = [f"def {flow['function']}(sender, amount, balances):"]
    for step in flow["steps"]:
        if "let" in step:
            for var, val in step["let"].items():
                lines.append(f"    {var} = {get_expr_code(val, 'python')}")
        elif "assert" in step:
            cond = get_expr_code(step["assert"]["condition"], 'python')
            msg = step["assert"]["message"]
            lines.append(f"    assert {cond}, '{msg}'")
        elif "set" in step:
            tgt = step["set"]["target"]
            if isinstance(tgt, list):
                tgt_code = f"{tgt[0]}[{repr(tgt[1])}]"
            else:
                tgt_code = tgt
            val = get_expr_code(step["set"]["value"], "python")
            lines.append(f"    {tgt_code} = {val}")
        elif "log" in step:
            msg = " + ' ' + ".join(
                [f"str({get_expr_code(x, 'python')})" if isinstance(x, dict) else repr(x)
                 for x in step["log"]["message"]]
            )
            lines.append(f"    print({msg})")
        elif "return" in step:
            ret = get_expr_code(step["return"], "python")
            lines.append(f"    return {ret}")
    return "\n".join(lines)
