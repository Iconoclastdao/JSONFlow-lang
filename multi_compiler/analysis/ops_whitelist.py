BACKEND_OPS = {
    "solidity": {"get", "set", "expr", "compare", "assert", "return"},
    "python": {"get", "set", "expr", "compare", "assert", "return", "log"},
    "javascript": {"get", "set", "expr", "compare", "assert", "return", "log"},
}

def validate_ops(flow):
    used_ops = set()
    for step in flow["steps"]:
        used_ops.update(step.keys())
    for backend, allowed in BACKEND_OPS.items():
        if not used_ops.issubset(allowed):
            disallowed = used_ops - allowed
            raise Exception(f"{backend} does not allow: {disallowed}")
