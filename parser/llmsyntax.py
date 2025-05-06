import re
import json
import openai
from typing import Dict, Any
import logging

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def parse_kid_sentence_llm(sentence: str) -> Dict[str, Any]:
    """
    Uses an LLM to parse a natural language sentence into a structured JSON block
    compatible with A+ JSONFlow.

    Args:
        sentence: The input sentence (e.g., "set balance to 100").

    Returns:
        A structured block with A+ JSONFlow-compatible structure.
    """
    prompt = f"""Convert this sentence to a structured JSON block for an A+ JSONFlow interpreter:
Sentence: "{sentence}"
The block must conform to A+ JSONFlow schema, supporting steps like set, if, forEach, map, try, call, assert, log, return.
Include type information for values (e.g., integer, string, array).
Respond with ONLY the JSON block. No explanation, no extra text."""
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=300,
        )
        content = response["choices"][0]["message"]["content"]
        try:
            block = json.loads(content)
            # Validate basic A+ JSONFlow structure
            if not isinstance(block, dict) or not any(key in block for key in [
                "set", "if", "forEach", "map", "try", "call", "assert", "log", "return"
            ]):
                return {"error": "Invalid JSONFlow block structure"}
            return block
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return {"error": "Failed to extract valid JSON from LLM response"}
    except Exception as e:
        log.error(f"LLM request failed for '{sentence}': {str(e)}")
        return {"error": f"LLM request failed: {str(e)}"}
