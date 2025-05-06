import click
from main import generate_code
import logging

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

@click.command()
@click.option("--input", type=click.Path(exists=True), help="Input file with NL sentences")
@click.option("--language", default="javascript", type=click.Choice(["javascript", "rust", "python"]), help="Target language")
@click.option("--output", type=click.Path(), help="Output file for generated code")
@click.option("--use-llm", is_flag=True, help="Use LLM parsing")
def generate(input: str, language: str, output: str, use_llm: bool):
    """
    CLI for generating code from natural language sentences.
    """
    try:
        if input:
            with open(input, "r") as f:
                sentences = [line.strip() for line in f if line.strip()]
        else:
            sentences = []
            print("Enter sentences (press Ctrl+D or Ctrl+Z to finish):")
            while True:
                try:
                    line = input("> ")
                    sentences.append(line.strip())
                except EOFError:
                    break

        code = generate_code(sentences, language, use_llm)
        if output:
            with open(output, "w") as f:
                f.write(code)
            print(f"Code written to {output}")
        else:
            print(f"\nGenerated {language.capitalize()} Code:\n{code}")
    except Exception as e:
        log.error(f"CLI error: {str(e)}")
        raise click.ClickException(str(e))

if __name__ == "__main__":
    generate()
