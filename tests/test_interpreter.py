import unittest
import json
import os
from interpreter.runtime import Context, run_steps

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)

class TestJSONFlowExamples(unittest.TestCase):

    def test_square(self):
        flow = load_json('examples/square.json')
        ctx = Context(initial={"x": 5})
        result = run_steps(flow["steps"], ctx)
        self.assertEqual(result, 25)
        self.assertEqual(ctx.get("result"), 25)

    def test_transfer(self):
        flow = load_json('examples/transfer.json')
        ctx = Context(initial={
            "sender": "alice",
            "recipient": "bob",
            "amount": 25,
            "balances": {
                "alice": 100,
                "bob": 50
            }
        })
        result = run_steps(flow["steps"], ctx)
        self.assertEqual(result, 75)
        self.assertEqual(ctx.get(["balances", "alice"]), 75)
        self.assertEqual(ctx.get(["balances", "bob"]), 75)

    def test_transfer_insufficient_funds(self):
        flow = load_json('examples/transfer.json')
        ctx = Context(initial={
            "sender": "alice",
            "recipient": "bob",
            "amount": 200,
            "balances": {
                "alice": 100,
                "bob": 50
            }
        })
        with self.assertRaises(AssertionError):
            run_steps(flow["steps"], ctx)

if __name__ == '__main__':
    unittest.main()