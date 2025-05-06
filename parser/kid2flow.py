from typing import Dict, List, Any
import logging
from base import infer_type, infer_nested_type

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def translate_kid_blocks(blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Translates structured blocks into an A+ JSONFlow program with nested type inference.

    Args:
        blocks: List of structured blocks from parser or LLM.

    Returns:
        A+ JSONFlow program with function, schema, context, and steps.
    """
    flow = {
        "function": "KidFlow",
        "schema": {"inputs": {}, "context": {}},
        "context": {},
        "steps": []
    }

    for block in blocks:
        if "error" in block:
            log.warning(f"Skipping invalid block: {block['error']}")
            continue

        if "set" in block:
            target = block["set"]["target"]
            value = block["set"]["value"]
            value_type = infer_type(value["value"] if "value" in value else value)
            flow["steps"].append({"set": {"target": target, "value": value}})
            flow["schema"]["context"][target] = value_type
            flow["context"].setdefault(target, [] if value_type == "array" else {})
        elif "map" in block:
            flow["steps"].append(block)
            flow["schema"]["context"][block["map"]["source"]] = "array"
            flow["schema"]["context"][block["map"]["target"]] = "array"
            flow["context"].setdefault(block["map"]["source"], [])
            flow["context"].setdefault(block["map"]["target"], [])
        elif "try" in block:
            flow["steps"].append(block)
            flow["schema"]["context"]["error"] = "object"
            flow["context"].setdefault("error", {})
        # Other steps as before
    return flow
