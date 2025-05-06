import unittest
from nl_to_jsonflow import parse_natural_language
from execute_jsonflow import run_steps, Context
from javascript import generate_javascript_function
from rust import generate_rust_function
from python import generate_python_function
import asyncio

class TestJSONFlow(unittest.TestCase):
    def setUp(self):
        self.sentences = [
            "set balance to 100",
            "if balance is greater than 50, then append 'approved' to logs",
            "try set balance to 200 catch log error"
        ]
        self.flow = parse_natural_language(self.sentences)

    def test_parsing(self):
        self.assertIn("steps", self.flow)
        self.assertEqual(len(self.flow["steps"]), 3)
        self.assertEqual(self.flow["steps"][0]["set"]["target"], "balance")

    def test_execution(self):
        ctx = Context({}, {"balance": "integer", "logs": "array"})
        asyncio.run(run_steps(self.flow["steps"], ctx))
        self.assertEqual(ctx.data["balance"], 200)
        self.assertIn("approved", ctx.data["logs"])

    def test_javascript_generation(self):
        code = generate_javascript_function(self.flow)
        self.assertIn("async function Workflow", code)
        self.assertIn("logs.push(\"approved\")", code)

    def test_rust_generation(self):
        code = generate_rust_function(self.flow)
        self.assertIn("async fn workflow", code)
        self.assertIn("context.logs.push(\"approved\")", code)

    def test_python_generation(self):
        code = generate_python_function(self.flow)
        self.assertIn("async def workflow", code)
        self.assertIn("logs.append(\"approved\")", code)

if __name__ == "__main__":
    unittest.main()
