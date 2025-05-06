from typing import List, Dict, Any
from nl_to_jsonflow import parse_natural_language
from javascript import generate_javascript_function
from rust import generate_rust_function
from python import generate_python_function
import json
import logging

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def generate_code(sentences: List[str], language: str, use_llm: bool = False) -> str:
    """
    Generates code from NL sentences in the specified language.

    Args:
        sentences: List of NL sentences.
        language: Target language ("javascript", "rust", "python").
        use_llm: Use LLM parsing if True.

    Returns:
        Generated code as a string.
    """
    flow = parse_natural_language(sentences)
    if language == "javascript":
        return generate_javascript_function(flow)
    elif language == "rust":
        return generate_rust_function(flow)
    elif language == "python":
        return generate_python_function(flow)
    raise ValueError(f"Unsupported language: {language}")

def main():
    """Example usage."""
    sentences = [
        "set balance to 100",
        "if balance is greater than 50, then append 'approved' to logs",
        "try set balance to 200 catch log error",
        "call fetchData with 'url' and save to result async"
    ]
    for lang in ["javascript", "rust", "python"]:
        code = generate_code(sentences, lang)
        print(f"\n{lang.capitalize()} Code:\n{code}")

if __name__ == "__main__":
    main()
