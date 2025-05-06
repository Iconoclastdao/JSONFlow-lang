import logging
from typing import Dict, List, Any, Union
from base import get_expr_code, map_type

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def generate_rust_function(flow: Dict[str, Any]) -> str:
    """
    Generates a Rust function from an A+ JSONFlow definition.

    Args:
        flow: JSONFlow definition with function, schema, context, and steps.

    Returns:
        str: Generated Rust code as a string.

    Raises:
        ValueError: If the flow structure is invalid or unsupported steps are encountered.
    """
    if not all(key in flow for key in ["function", "schema", "steps"]):
        raise ValueError("Invalid JSONFlow structure: missing required keys")

    func_name = flow["function"]
    inputs = flow["schema"].get("inputs", {})
    context = flow["schema"].get("context", {})
    steps = flow["steps"]

    # Generate context struct
    lines = ["use std::collections::HashMap;"]
    lines.append("")
    lines.append("#[derive(Debug)]")
    lines.append("struct Context {")
    for var, json_type in context.items():
        rust_type = map_type(json_type, "rust")
        lines.append(f"    {var}: {rust_type},")
    lines.append("}")
    lines.append("")

    # Define custom error type
    lines.append("#[derive(Debug)]")
    lines.append("enum FlowError {")
    lines.append("    AssertionFailed(String),")
    lines.append("    Custom(String),")
    lines.append("}")
    lines.append("")
    lines.append("impl std::fmt::Display for FlowError {")
    lines.append("    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {")
    lines.append("        match self {")
    lines.append('            FlowError::AssertionFailed(msg) => write!(f, "Assertion failed: {}", msg),')
    lines.append('            FlowError::Custom(msg) => write!(f, "Error: {}", msg),')
    lines.append("        }")
    lines.append("    }")
    lines.append("}")
    lines.append("")
    lines.append("impl std::error::Error for FlowError {}")
    lines.append("")

    # Generate function signature
    input_params = ", ".join(f"{var}: {map_type(json_type, 'rust')}" for var, json_type in inputs.items())
    lines.append(f"fn {func_name}({input_params}) -> Result<i32, FlowError> {{")

    # Initialize context
    lines.append("    let mut context = Context {")
    for var, json_type in context.items():
        initial_value = {
            "string": 'String::new()',
            "integer": "0",
            "number": "0.0",
            "boolean": "false",
            "object": "HashMap::new()",
            "array": "Vec::new()"
        }.get(json_type, "Default::default()")
        lines.append(f"        {var}: {initial_value},")
    lines.append("    };")
    lines.append("")

    # Compile steps
    for step in steps:
        step_lines = generate_step(step)
        lines.extend(step_lines)

    # Default return
    lines.append("    Ok(context.balance.unwrap_or(0))")
    lines.append("}")

    generated_code = "\n".join(lines)
    log.info(f"Generated Rust function {func_name}")
    return generated_code

def generate_step(step: Dict[str, Any], indent: int = 1) -> List[str]:
    """
    Generates Rust code for a single A+ JSONFlow step.

    Args:
        step: JSONFlow step (e.g., set, if, map, try).
        indent: Indentation level for code formatting.

    Returns:
        List[str]: Lines of generated Rust code.

    Raises:
        ValueError: If the step type is unsupported or invalid.
    """
    lines = []
    pad = "    " * indent

    if not isinstance(step, dict):
        raise ValueError(f"Invalid step format: {step}")

    if "let" in step:
        for var, expr in step["let"].items():
            code, expr_type = get_expr_code(expr, "rust")
            rust_type = map_type(expr_type, "rust")
            lines.append(f"{pad}let {var}: {rust_type} = {code};")
            log.debug(f"Generated let: {var} = {code}, type: {expr_type}")

    elif "set" in step:
        target = step["set"]["target"]
        value, value_type = get_expr_code(step["set"]["value"], "rust")
        if isinstance(target, list):
            target_str = f"context.{target[0]}.insert({repr(target[1])}, {value})"
            lines.append(f"{pad}{target_str};")
            log.debug(f"Generated map set: {target_str}, type: {value_type}")
        else:
            is_array = step.get("schema", {}).get("context", {}).get(target) == "array"
            if is_array:
                lines.append(f"{pad}context.{target}.push({value});")
                log.debug(f"Generated array append: context.{target}.push({value}), type: {value_type}")
            else:
                lines.append(f"{pad}context.{target} = {value};")
                log.debug(f"Generated set: context.{target} = {value}, type: {value_type}")

    elif "assert" in step:
        condition, cond_type = get_expr_code(step["assert"]["condition"], "rust")
        if cond_type != "boolean":
            log.warning(f"Assert condition has non-boolean type: {cond_type}")
        message = step["assert"]["message"]
        lines.append(f"{pad}if !({condition}) {{")
        lines.append(f"{pad}    return Err(FlowError::AssertionFailed(\"{message}\".to_string()));")
        lines.append(f"{pad}}}")
        log.debug(f"Generated assert: if !({condition})")

    elif "if" in step:
        condition, cond_type = get_expr_code(step["if"]["condition"], "rust")
        if cond_type != "boolean":
            log.warning(f"If condition has non-boolean type: {cond_type}")
        lines.append(f"{pad}if {condition} {{")
        then_steps = step["if"]["then"] if isinstance(step["if"]["then"], list) else [step["if"]["then"]]
        for substep in then_steps:
            lines.extend(generate_step(substep, indent + 1))
        if "else" in step["if"]:
            lines.append(f"{pad}}} else {{")
            else_steps = step["if"]["else"] if isinstance(step["if"]["else"], list) else [step["if"]["else"]]
            for substep in else_steps:
                lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}}}")
        log.debug(f"Generated if: if {condition}")

    elif "forEach" in step:
        source = step["forEach"]["source"]
        alias = step["forEach"]["as"]
        lines.append(f"{pad}for {alias} in &context.{source} {{")
        for substep in step["forEach"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}}}")
        log.debug(f"Generated forEach: for {alias} in context.{source}")

    elif "map" in step:
        source = step["map"]["source"]
        alias = step["map"]["as"]
        target = step["map"]["target"]
        lines.append(f"{pad}let {target}: Vec<_> = context.{source}.iter().map(|{alias}| {{")
        for substep in step["map"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}    *{alias}")
        lines.append(f"{pad}}}).collect();")
        lines.append(f"{pad}context.{target} = {target};")
        log.debug(f"Generated map: {target} = context.{source}.iter().map")

    elif "try" in step:
        lines.append(f"{pad}{{{")
        for substep in step["try"]["body"]:
            lines.extend(generate_step(substep, indent + 1))
        lines.append(f"{pad}}} // try")
        lines.append(f"{pad}.map_err(|e| FlowError::Custom(e.to_string()))?")
        if "catch" in step["try"]:
            lines.append(f"{pad}context.error = Some(format!(\"{{}}\", e));")
            for substep in step["try"]["catch"]:
                lines.extend(generate_step(substep, indent + 1))
        log.debug("Generated try-catch block")

    elif "call" in step:
        func = step["call"]["function"]
        args = step["call"]["args"]
        target = step["call"]["target"]
        arg_codes = [get_expr_code(arg, "rust")[0] for arg in args.values()]
        lines.append(f"{pad}let {target} = {func}({', '.join(arg_codes)})?;")
        lines.append(f"{pad}context.{target} = {target};")
        log.debug(f"Generated call: {target} = {func}({', '.join(arg_codes)})")

    elif "log" in step or "print" in step:
        key = "log" if "log" in step else "print"
        level = step[key].get("level", "info")
        message_parts = step[key]["message"]
        message = ", ".join([
            get_expr_code(part, "rust")[0] if isinstance(part, dict) else f'"{part}"'
            for part in message_parts
        ])
        rust_level = {"info": "info!", "error": "error!", "warn": "warn!"}.get(level, "info!")
        lines.append(f"{pad}log::{rust_level}({message});")
        log.debug(f"Generated {key}: log::{rust_level}({message})")

    elif "return" in step:
        value, value_type = get_expr_code({"get": step["return"]["get"]}, "rust")
        lines.append(f"{pad}return Ok({value});")
        log.debug(f"Generated return: return Ok({value}), type: {value_type}")

    else:
        raise ValueError(f"Unsupported step: {step}")

    return lines

def map_type(json_type: str, lang: str) -> str:
    """
    Maps an A+ JSONFlow type to a Rust type.

    Args:
        json_type: A+ JSONFlow type (e.g., "integer", "string").
        lang: Target language ("rust").

    Returns:
        str: Corresponding type in Rust.

    Raises:
        ValueError: If the type or language is unsupported.
    """
    if lang != "rust":
        return super().map_type(json_type, lang)
    
    mapping = {
        "string": "String",
        "integer": "i32",
        "number": "f64",
        "boolean": "bool",
        "object": "HashMap<String, i32>",
        "array": "Vec<i32>",
        "address": "String"  # For blockchain compatibility
    }
    if json_type not in mapping:
        raise ValueError(f"Unsupported JSONFlow type: {json_type}")
    return mapping[json_type]
