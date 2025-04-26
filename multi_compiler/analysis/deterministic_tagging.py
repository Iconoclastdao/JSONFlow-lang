def tag_determinism(flow):
    nondeterministic_ops = {"random", "timestamp", "external_call"}

    for step in flow["steps"]:
        for op in step:
            if op in nondeterministic_ops:
                step["deterministic"] = False
            else:
                step["deterministic"] = True
    return flow
