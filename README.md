# 🔁 JSONFlow — A Structured, Interpretable JSON Programming Language

**Author:** James Chapman  
**License:** All Rights Reserved © 2025  
**Contact:** [iconoclastdao@gmail.com](mailto:iconoclastdao@gmail.com)  

![License](https://img.shields.io/badge/license-Proprietary-red.svg)  
![Status](https://img.shields.io/badge/status-Proof--of--Concept-blue.svg)

---

## 🧠 What is JSONFlow?

**JSONFlow** is a proof-of-concept programming language that merges the readability of JSON with the expressiveness of Python-like logic.  
It allows developers to write logic in a fully structured, schema-validatable format that is:

- 🔐 Safe (no `eval`, no arbitrary code)  
- 🔍 Inspectable (every operation is a structured node)  
- 📜 Typed and schema-driven  
- 🧩 Extensible for smart contracts, automation, data flow, and more  

---

## 🗣️ Natural Language Integration (KidSpeak → Code)

JSONFlow now supports **“kid-speak” to code** translation via two systems:

### 1. 💡 LLM-Powered Parser

Free-form input like:

> “Add 5 and 2 and call it score”

Is converted using an LLM into:

```json
{ "verb": "add", "inputs": [5, 2], "target": "score" }
```

And then translated to JSONFlow:

```json
{ "let": { "score": { "expr": { "add": [5, 2] } } } }
```

### 2. 🧠 Grammar-Based Parser (Lark)

You can also parse structured sentence patterns using a custom grammar:

> “If score is greater than 10, say 'You're winning!'”

→ Becomes structured block:

```json
{
  "if": {
    "condition": { "left": "score", "op": "greater than", "right": 10 },
    "then": { "say": "You're winning!" }
  }
}
```

---

## 🧪 Sample Program – `deposit.json`

```json
{
  "function": "deposit",
  "schema": {
    "inputs": {
      "sender": "string",
      "amount": { "type": "int", "min": 1 }
    },
    "context": {
      "balances": "dict<string, int>"
    }
  },
  "context": {
    "balances": {}
  },
  "steps": [
    {
      "let": {
        "new_balance": {
          "expr": {
            "add": [
              { "get": ["balances", "sender"] },
              { "get": "amount" }
            ]
          }
        }
      }
    },
    {
      "set": {
        "target": ["balances", "sender"],
        "value": { "get": "new_balance" }
      }
    },
    {
      "return": { "get": "new_balance" }
    }
  ]
}
```

---

## 🚀 How to Run

```bash
# Install dependencies
pip install colorama jsonschema lark openai

# Run a JSONFlow file
python interpreter/main.py examples/deposit.json --context '{"sender": "alice", "amount": 50}'

# Translate kid-speak and run
python parser/pipeline.py
```

---

## 🧰 Features

- ✅ `let` – Create temporary variables  
- ✅ `assert` – Validate logic  
- ✅ `set` – Modify context state  
- ✅ `log` / `print` – Output values  
- ✅ `return` – Final return value  
- 🧠 `expr` – Perform math, comparisons, boolean logic  
- ⛑️ `try` / `catch` *(soon)*  
- 🔁 `loop`, `forEach`, `map` *(coming soon)*  
- 🎙️ `say`, `remember`, `repeat`, `add`, `if` from plain English  
- 🧠 LLM + Grammar backends for natural language

---

## 🔒 License

JSONFlow is released under a **dual-license** model:

- 🆓 **MIT License** – for non-commercial use only  
- 💼 **Commercial License** – required for any commercial use  

All Rights Reserved © 2025 James Chapman  
To use, distribute, or license JSONFlow for commercial or private business purposes, you **must** obtain a commercial license.  

📩 Contact: [iconoclastdao@gmail.com](mailto:iconoclastdao@gmail.com)  
📄 See [LICENSE.md](./LICENSE.md) for full terms

---

## 🌐 Vision

JSONFlow is the early seed of something much bigger — imagine a world where flows can be:

- 📦 Stored on-chain  
- ⚙️ Interpreted in smart contracts  
- 🔍 Analyzed statically  
- 🧬 Rewritten, composed, and merged  
- 🤖 Verified by AI models  
- 🎨 Created by children and used by machines  

**Structure is power. Let’s rewrite the future of code.**
