import json
from compiler.solidity import compile_to_solidity
from compiler.python import compile_to_python
from compiler.javascript import compile_to_javascript
from analysis.cost_estimator import estimate_cost
from analysis.deterministic_tagging import tag_determinism
from analysis.ops_whitelist import validate_ops

def compile_jsonflow(flow_path):
    with open(flow_path) as f:
        flow = json.load(f)

    validate_ops(flow)  # 🔒 restrict to backend-supported ops
    cost = estimate_cost(flow)  # 💸 estimate cost
    tagged = tag_determinism(flow)  # 🏷️ tag deterministic/non-deterministic

    sol_code = compile_to_solidity(tagged)
    py_code = compile_to_python(tagged)
    js_code = compile_to_javascript(tagged)

    return {
        "cost": cost,
        "solidity": sol_code,
        "python": py_code,
        "javascript": js_code
    }

if __name__ == "__main__":
    result = compile_jsonflow("example.json")
    for lang, code in result.items():
        if lang != "cost":
            print(f"\n--- {lang.upper()} ---\n{code}")
    print(f"\n💰 Estimated Cost: {result['cost']}")
