import re
from typing import Dict, List, Any

def parse_natural_language(nl_input: str) -> Dict[str, Any]:
    """
    Converts natural language input to an A+ JSONFlow program.
    Supports commands like 'if', 'set', 'append', 'log', 'assert', 'map', 'try', 'call', 'return'.
    """
    flow = {
        "function": "GeneratedFlow",
        "schema": {
            "inputs": {},
            "context": {}
        },
        "context": {},
        "steps": []
    }

    # Tokenize and process sentences
    sentences = nl_input.lower().strip().split('.')
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Parse 'if' statements
        if sentence.startswith('if '):
            match = re.match(r'if (.+?) (is greater than|is less than|equals|is not equal to) (.+?), (.+?)(?:, otherwise (.+))?$', sentence)
            if match:
                condition, op, value, then_action, else_action = match.groups()
                op_map = {
                    'is greater than': '>',
                    'is less than': '<',
                    'equals': '===',
                    'is not equal to': '!=='
                }
                step = {
                    'if': {
                        'condition': {
                            'compare': {
                                'left': {'get': condition.strip()},
                                'op': op_map[op],
                                'right': {'value': parse_value(value.strip())}
                            }
                        },
                        'then': parse_action(then_action.strip(), flow)
                    }
                }
                if else_action:
                    step['if']['else'] = parse_action(else_action.strip(), flow)
                flow['steps'].append(step)
                # Update schema
                flow['schema']['context'][condition.strip()] = infer_type(value.strip())
                continue

        # Parse 'set' or 'append'
        if 'set ' in sentence or 'append ' in sentence:
            is_append = 'append ' in sentence
            keyword = 'append ' if is_append else 'set '
            target, value = sentence.split(keyword)[1].split(' to ')
            target = target.strip()
            value = parse_value(value.strip())
            flow['steps'].append({
                'set': {
                    'target': target,
                    'value': {'value': value}
                }
            })
            flow['schema']['context'][target] = 'array' if is_append else infer_type(value)
            if is_append:
                flow['context'].setdefault(target, [])
            continue

        # Parse 'log'
        if sentence.startswith('log '):
            level, message = sentence.split(' ', 1)[1].split(' message ')
            flow['steps'].append({
                'log': {
                    'level': level.strip(),
                    'message': [{'value': message.strip()}]
                }
            })
            continue

        # Parse 'assert'
        if sentence.startswith('assert '):
            condition, message = sentence.split(' with message ')
            match = re.match(r'(.+?) (is greater than|is less than|equals) (.+)', condition)
            if match:
                var, op, value = match.groups()
                op_map = {'is greater than': '>', 'is less than': '<', 'equals': '==='}
                flow['steps'].append({
                    'assert': {
                        'condition': {
                            'compare': {
                                'left': {'get': var.strip()},
                                'op': op_map[op],
                                'right': {'value': parse_value(value.strip())}
                            }
                        },
                        'message': message.strip()
                    }
                })
                flow['schema']['context'][var.strip()] = infer_type(value.strip())
            continue

        # Parse 'map'
        if sentence.startswith('map '):
            _, source, action, target = sentence.split(' over ')[0].split(' to ')[0].split(' with ')[0].split(' ')
            action = sentence.split(' with ')[1].split(' to ')[0]
            flow['steps'].append({
                'map': {
                    'source': source.strip(),
                    'as': 'item',
                    'body': parse_action(action.strip(), flow),
                    'target': target.strip()
                }
            })
            flow['schema']['context'][source.strip()] = 'array'
            flow['schema']['context'][target.strip()] = 'array'
            flow['context'].setdefault(source.strip(), [])
            flow['context'].setdefault(target.strip(), [])
            continue

        # Parse 'try'
        if sentence.startswith('try '):
            action, catch_action = sentence.split(' catch ')
            flow['steps'].append({
                'try': {
                    'body': parse_action(action.replace('try ', '').strip(), flow),
                    'catch': parse_action(catch_action.strip(), flow)
                }
            })
            flow['schema']['context']['error'] = 'object'
            continue

        # Parse 'call'
        if sentence.startswith('call '):
            func, args, target = sentence.replace('call ', '').split(' with args ')[0].split(' to ')
            args_dict = {f"arg{i+1}": {'value': parse_value(arg.strip())} for i, arg in enumerate(args.split(','))}
            flow['steps'].append({
                'call': {
                    'function': func.strip(),
                    'args': args_dict,
                    'target': target.strip()
                }
            })
            flow['schema']['context'][target.strip()] = 'string'  # Assume string result
            continue

        # Parse 'return'
        if sentence.startswith('return '):
            value = sentence.replace('return ', '').strip()
            flow['steps'].append({
                'return': {
                    'get': value
                }
            })
            flow['schema']['context'][value] = 'integer'  # Assume integer for simplicity
            continue

        log.warning(f"Unsupported NL command: {sentence}")

    return flow

def parse_action(action: str, flow: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parses an action string into a list of JSONFlow steps.
    """
    steps = []
    if 'append ' in action:
        target, value = action.split('append ')[1].split(' to ')
        steps.append({
            'set': {
                'target': target.strip(),
                'value': {'value': parse_value(value.strip())}
            }
        })
        flow['schema']['context'][target.strip()] = 'array'
        flow['context'].setdefault(target.strip(), [])
    elif 'set ' in action:
        target, value = action.split('set ')[1].split(' to ')
        steps.append({
            'set': {
                'target': target.strip(),
                'value': {'value': parse_value(value.strip())}
            }
        })
        flow['schema']['context'][target.strip()] = infer_type(value.strip())
    elif 'log ' in action:
        level, message = action.split('log ')[1].split(' message ')
        steps.append({
            'log': {
                'level': level.strip(),
                'message': [{'value': message.strip()}]
            }
        })
    else:
        log.warning(f"Unsupported action: {action}")
    return steps

def parse_value(value: str) -> Any:
    """
    Parses a string value into a Python type.
    """
    value = value.strip()
    if value.isdigit():
        return int(value)
    try:
        return float(value)
    except ValueError:
        if value.lower() in ('true', 'false'):
            return value.lower() == 'true'
        return value

def infer_type(value: Any) -> str:
    """
    Infers JSONFlow type from a value.
    """
    if isinstance(value, int):
        return 'integer'
    elif isinstance(value, float):
        return 'number'
    elif isinstance(value, bool):
        return 'boolean'
    elif isinstance(value, list):
        return 'array'
    elif isinstance(value, dict):
        return 'object'
    return 'string'

def nl_to_jsonflow(nl_input: str) -> Dict[str, Any]:
    """
    Converts natural language input to an A+ JSONFlow program.
    """
    return parse_natural_language(nl_input)
