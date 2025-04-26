def estimate_cost(flow):
    cost_table = {
        "get": 1,
        "set": 2,
        "expr": 3,
        "assert": 2,
        "log": 1,
        "return": 1
    }
    total = 0
    for step in flow["steps"]:
        for op in step:
            total += cost_table.get(op, 0)
    return total
