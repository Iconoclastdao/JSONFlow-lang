import json
from interpreter.runtime import Context, run_steps

def test_deposit():
    with open("examples/deposit.json") as f:
        program = json.load(f)

    ctx = Context({"sender": "alice", "amount": 100})
    result = run_steps(program["steps"], ctx)

    assert result == 100
    assert ctx.get(["balances", "alice"]) == 100