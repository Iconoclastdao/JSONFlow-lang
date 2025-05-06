import logging
from typing import Dict, List, Any
from base import get_expr_code, map_type

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def generate_rust_function(flow: Dict[str, Any]) -> str:
    """
    Generates an async Rust function from an A+ JSONFlow definition using rayon and tokio.

    Args:
        flow: JSONFlow definition with function, schema, context, and steps.

    Returns:
        str: Generated Rust code.
    """
    func_name = flow["function"]
    inputs = flow["schema"].get("inputs", {})
    context = flow["schema"].get("context", {})
    steps = flow["steps"]

    lines = [
        "use std::collections::HashMap;",
        "use rayon::prelude::*;",
        "use tokio::task;",
        "#[derive(Debug)]",
        "struct Context {"
    ]
    for var, json_type in context.items():
        lines.append(f"    {var}: {map_type(json_type, 'rust')},")
    lines.append("}")

    lines.extend([
        "#[derive(Debug)]",
        "enum FlowError {",
        "    AssertionFailed(String),",
        "    Custom(String),",
        "}",
        "impl std::fmt::Display for FlowError {",
        "    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {",
        "        match self {",
        "            FlowError::AssertionFailed(msg) => write!(f, \"Assertion failed: {}\", msg),",
        "            FlowError::Custom(msg) => write!(f, \"Error: {}\", msg),",
        "        }",
        "    }",
        "}",
        "impl std::error::Error for FlowError {}",
        ""
    ])

    lines.append(f"async fn {func_name}({', '.join(f'{var}: {map_type(json_type, \"rust\")}' for var, json_type in inputs.items())}) -> Result<i32, FlowError> {{")
    lines.append("    let mut context = Context {")
    for var, json_type in context.items():
        initial_value = {"string": "String::new()", "integer": "0", "number": "0.0", "boolean": "false", "object": "HashMap::new()", "array": "Vec::new()"}.get(json_type, "Default::default()")
        lines.append(f"        {var}: {initial_value},")
    lines.append("    };")

    for step in steps:
        lines.extend(generate_step(step))

    lines.append("    Ok(context.balance.unwrap_or(0))")
    lines.append("}")

    return "\n".join(lines)

def generate_step(step: Dict[str, Any], indent: int = 1) -> List[str]:
    lines = []
    pad = "    " * indent

    if "map" in step:
        source = step["map"]["source"]
        alias = step["map"]["as"]
        target = step["map"]["target"]
        lines.append(f"{pad}let {target}: Vec<_> = context.{source}.par_iter().map(|{alias}| {{")
        for substep in step["map"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}    *{alias}")
        lines.append(f"{pad}}}).collect();")
        lines.append(f"{pad}context.{target} = {target};")
    elif "call" in step:
        func = step["call"]["function"]
        args = step["call"]["args"]
        target = step["call"]["target"]
        async_prefix = "task::spawn(async move { " if step["call"].get("async", False) else ""
        async_suffix = "}).await?;" if step["call"].get("async", False) else ";"
        arg_codes = [get_expr_code(arg, "rust")[0] for arg in args.values()]
        lines.append(f"{pad}let {target} = {async_prefix}{func}({', '.join(arg_codes)}){async_suffix}")
        lines.append(f"{pad}context.{target} = {target};")
    # Other steps remain as before
    return lines
