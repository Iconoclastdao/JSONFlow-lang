import spacy
from typing import Dict, List, Any
from parser import parse_kid_sentence_grammar
from llm_parser import parse_kid_sentence_llm

nlp = spacy.load("en_core_web_sm")
context_map = {}

def parse_natural_language(sentences: List[str]) -> Dict[str, Any]:
    """
    Converts natural language sentences to an A+ JSONFlow program with context-aware parsing.

    Args:
        sentences: List of NL sentences (e.g., "Set balance to 100").

    Returns:
        A+ JSONFlow program with function, schema, context, and steps.
    """
    flow = {
        "function": "Workflow",
        "schema": {"inputs": {}, "context": {}},
        "context": {},
        "steps": []
    }
    for sentence in sentences:
        doc = nlp(sentence)
        action = parse_action(doc, sentence)
        flow["steps"].append(action)
        update_context(action, flow["schema"]["context"])
    return flow

def parse_action(doc: spacy.tokens.Doc, sentence: str) -> Dict[str, Any]:
    """
    Parses a single sentence into a JSONFlow step, using context and fallback grammar.
    """
    global context_map
    try:
        # Try LLM parsing first
        action = parse_kid_sentence_llm(sentence)
        if "error" not in action:
            return action
        # Fallback to grammar-based parsing
        action = parse_kid_sentence_grammar(sentence)
        if "error" not in action:
            return action
    except Exception as e:
        log.error(f"Parsing failed for '{sentence}': {str(e)}")
    
    # Context-aware parsing
    root = doc[0] if doc else None
    if root and root.lemma_ in ("set", "assign"):
        target = next((t.text for t in doc if t.dep_ == "dobj"), None)
        value_token = next((t for t in doc if t.dep_ in ("attr", "prep")), None)
        value = value_token.text if value_token else "0"
        value_type = infer_type(value)
        context_map[target] = value_type
        return {
            "set": {
                "target": target,
                "value": {"value": int(value) if value.isdigit() else value}
            }
        }
    return {"error": f"Failed to parse: {sentence}"}

def update_context(action: Dict[str, Any], schema_context: Dict[str, str]):
    """
    Updates schema context with inferred types from actions.
    """
    if "set" in action:
        target = action["set"]["target"]
        value = action["set"]["value"]
        schema_context[target] = infer_type(value.get("value", value))
    elif "map" in action:
        schema_context[action["map"]["source"]] = "array"
        schema_context[action["map"]["target"]] = "array"
    elif "try" in action:
        schema_context["error"] = "object"

def infer_type(value: Any) -> str:
    try:
        int(value)
        return "integer"
    except (ValueError, TypeError):
        return "string" if isinstance(value, str) else "object"
