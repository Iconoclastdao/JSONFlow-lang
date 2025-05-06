import re
import json
import openai
from typing import Dict, Any
import logging
from functools import lru_cache
from parser import parse_kid_sentence_grammar

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

@lru_cache(maxsize=500)
def parse_kid_sentence_llm(sentence: str) -> Dict[str, Any]:
    """
    Uses an LLM to parse a natural language sentence into a structured JSON block
    compatible with A+ JSONFlow, with retries and fallback.

    Args:
        sentence: Input sentence (e.g., "set balance to 100").

    Returns:
        Structured block with A+ JSONFlow-compatible structure.
    """
    prompt = f"""Convert this sentence to a structured JSON block for an A+ JSONFlow interpreter:
Sentence: "{sentence}"
The block must conform to A+ JSONFlow schema, supporting steps like set, if, forEach, map, try, call, assert, log, return.
Include type information for values (e.g., integer, string, array).
Respond with ONLY the JSON block. No explanation, no extra text."""
    for attempt in range(3):
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
                if not isinstance(block, dict) or not any(key in block for key in [
                    "set", "if", "forEach", "map", "try", "call", "assert", "log", "return"
                ]):
                    raise ValueError("Invalid JSONFlow block structure")
                return block
            except json.JSONDecodeError:
                match = re.search(r"\{.*\}", content, re.DOTALL)
                if match:
                    return json.loads(match.group(0))
                raise ValueError("Failed to extract valid JSON")
        except Exception as e:
            log.warning(f"LLM attempt {attempt + 1} failed for '{sentence}': {str(e)}")
            if attempt == 2:
                log.info(f"Falling back to grammar parsing for '{sentence}'")
                return parse_kid_sentence_grammar(sentence)
    return {"error": "LLM parsing failed after retries"}
