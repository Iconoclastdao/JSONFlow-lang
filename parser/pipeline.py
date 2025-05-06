from typing import List, Dict, Any
from parser import parse_kid_sentence_grammar
from llm_parser import parse_kid_sentence_llm
from kid2flow import translate_kid_blocks
import logging

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def parse_and_translate(sentences: List[str], use_llm: bool = False) -> Dict[str, Any]:
    """
    Parses a list of kid-friendly sentences and translates them to an A+ JSONFlow program.

    Args:
        sentences: List of natural language sentences.
        use_llm: If True, uses LLM parser; otherwise, uses grammar parser.

    Returns:
        An A+ JSONFlow program.
    """
    blocks = []
    for sentence in sentences:
        if use_llm:
            block = parse_kid_sentence_llm(sentence)
        else:
            block = parse_kid_sentence_grammar(sentence)
        blocks.append(block)
    
    try:
        flow = translate_kid_blocks(blocks)
        return flow
    except Exception as e:
        log.error(f"Translation failed: {str(e)}")
        return {"error": f"Translation error: {str(e)}"}

def main():
    """Example usage."""
    sentences = [
        "set balance to 100",
        "if balance is greater than 50, then say 'High balance'",
        "append 'approved' to logs",
        "try set balance to 200 catch say 'Error occurred'",
        "call fetchData with 'url' and save to result",
        "return balance"
    ]
    flow = parse_and_translate(sentences, use_llm=False)
    print(json.dumps(flow, indent=2))

if __name__ == "__main__":
    main()
