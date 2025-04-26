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

## 🧪 Sample Programs

### 🟦 deposit.json

Deposits an amount into a user's balance.

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

### 🚀 How to Run

```bash
# Install dependencies (optional)
pip install colorama jsonschema

# Run a flow
python interpreter/main.py examples/deposit.json --context '{"sender": "alice", "amount": 50}'
```

Add `--debug` to print final state. Use `--output` to save result.

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

---

## 🔒 License

JSONFlow is released under a **dual-license** model:

- 🆓 **MIT License** – for non-commercial use only  
- 💼 **Commercial License** – required for any commercial use

All Rights Reserved © 2025 James Chapman  
To use, distribute, or license JSONFlow for commercial or private business purposes, you **must** obtain a commercial license.

📩 Contact: [iconoclastdao@gmail.com](mailto:iconoclastdao@gmail.com)

For full terms, see [LICENSE.md](./LICENSE.md)
---

## 🌐 Vision

JSONFlow is the early seed of something much bigger — imagine a world where flows can be:

- 📦 Stored on-chain  
- ⚙️ Interpreted in smart contracts  
- 🔍 Analyzed statically  
- 🧬 Rewritten, composed, and merged  
- 🤖 Verified by AI models  

**Structure is power. Let’s rewrite the future of code.**
