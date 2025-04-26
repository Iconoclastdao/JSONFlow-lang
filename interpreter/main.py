import json
import argparse
import sys
import os
import traceback
from multiprocessing import Process, Queue
from runtime import Context

try:
    from colorama import Fore, Style
    COLOR_ENABLED = True
except ImportError:
    COLOR_ENABLED = False

try:
    from jsonschema import validate
except ImportError:
    print("Missing dependency: jsonschema\nInstall with: pip install jsonschema")
    sys.exit(1)

def print_color(msg, color):
    if COLOR_ENABLED:
        print(f"{color}{msg}{Style.RESET_ALL}")
    else:
        print(msg)

def load_flow(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "r") as f:
        return json.load(f)

def load_context(ctx_input):
    try:
        if os.path.exists(ctx_input):
            with open(ctx_input, "r") as f:
                return json.load(f)
        else:
            return json.loads(ctx_input)
    except Exception as e:
        raise ValueError(f"Failed to load context: {str(e)}")

def validate_schema(flow):
    schema_path = os.path.join(os.path.dirname(__file__), "..", "schema", "schema.json")
    with open(schema_path, "r") as f:
        schema = json.load(f)
    validate(instance=flow, schema=schema)

def run_flow_in_process(flow_steps, context_data, queue):
    from runtime import Context, run_steps
    ctx = Context(initial=context_data)
    result = run_steps(flow_steps, ctx)
    queue.put((result, ctx.data))

def main():
    parser = argparse.ArgumentParser(
        description="Run a JSONFlow program.",
        epilog="""
Examples:
  python run.py path/to/flow.json
  python run.py flow.json --context context.json
  python run.py flow.json --context '{"user": "alice"}' --output result.json

JSONFlow files should contain at least 'steps'. Optional: 'schema', 'context'
        """,
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("file", help="Path to the JSONFlow file to execute")
    parser.add_argument("--context", help="Initial context as a file path or JSON string")
    parser.add_argument("--output", help="Path to write final result")
    parser.add_argument("--verbose", action="store_true", help="Show full traceback on error")
    parser.add_argument("--debug", action="store_true", help="Print context after execution")
    args = parser.parse_args()

    try:
        flow = load_flow(args.file)

        if "steps" not in flow:
            print_color("Invalid JSONFlow file: missing 'steps'", Fore.RED)
            sys.exit(1)

        validate_schema(flow)

        initial_context = flow.get("context", {})
        if args.context:
            user_ctx = load_context(args.context)
            initial_context.update(user_ctx)

        # 🚨 Run flow with timeout in sandboxed process
        queue = Queue()
        p = Process(target=run_flow_in_process, args=(flow["steps"], initial_context, queue))
        p.start()
        p.join(timeout=2)

        if p.is_alive():
            p.terminate()
            raise TimeoutError("Execution timed out")

        result, final_ctx = queue.get()
        ctx = Context(initial=final_ctx)

        if result is not None:
            print_color("Result: " + str(result), Fore.GREEN)
            if args.output:
                with open(args.output, "w") as f:
                    json.dump(result, f, indent=2)

        if args.debug:
            print_color("Final Context:", Fore.YELLOW)
            print(json.dumps(ctx.data, indent=2))

    except Exception as e:
        print_color("Error: " + str(e), Fore.RED)
        if args.verbose:
            traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
