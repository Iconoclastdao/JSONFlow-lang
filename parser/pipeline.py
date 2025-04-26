from parser.llmsyntax import parse_kid_sentence_llm
from interpreter.kid2flow import translate_kid_blocks

def parse_and_translate_llm(sentences):
    """
    Takes a list of natural language sentences (kid-speak),
    uses LLM to parse them to structured blocks,
    then translates to JSONFlow steps.
    """
    blocks = []
    for line in sentences:
        block = parse_kid_sentence_llm(line)
        blocks.append(block)
    return translate_kid_blocks(blocks)