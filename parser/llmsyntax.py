
import re
import json
# Swap this with any LLM API (Anthropic, Mistral, local, etc.)
import openai

def parse_kid_sentence_llm(sentence):
    """
    Uses an LLM to parse a natural language sentence into a structured JSON block.
    """
    prompt = f"""Convert this sentence to a structured JSON block for a logic interpreter:
Sentence: "{sentence}"
Respond with ONLY the JSON block. No explanation, no extra text."""
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=300,
        )
        content = response["choices"][0]["message"]["content"]
        # Try to parse JSON directly
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Fallback: extract JSON substring
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            else:
                return {"error": "Failed to extract valid JSON from LLM response."}
    except Exception as e:
        return {"error": f"LLM request failed: {str(e)}"}