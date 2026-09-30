# ZEUS

### *a python code*

> A lightweight, Python-focused code editor designed for Python 3 development, Jupyter notebooks, integrated development tools, and AI-assisted coding.

**ZEUS is currently under active development.**
The core editor is being built first, with additional features and optimizations planned for upcoming releases.

---

## About ZEUS

ZEUS is a Python-first code editor designed to provide the essential tools required for Python development in a single lightweight application.

Instead of building a general-purpose editor with a large extension ecosystem, ZEUS focuses specifically on the Python development workflow.

The goal is to provide:

* A fast and lightweight editor
* Python 3 development
* Built-in error detection
* Native `.ipynb` notebook support
* Integrated terminal
* Debugging
* Git integration
* AI-assisted coding
* Minimal background services
* Low memory usage

---

## Current Features

### Python Development

* Python 3 support
* Python syntax highlighting
* Code editing
* File explorer
* Multiple editor tabs
* Project-based development
* Python interpreter selection
* Virtual environment support

### Built-in Error Lens

ZEUS includes an integrated Error Lens-style diagnostic system.

Errors and warnings can be displayed directly in the editor while writing code instead of requiring the program to be executed first.

Example:

```python
name = "Dinesh"

print(username)
```

ZEUS can indicate the problem directly near the code:

```text
print(username)
      ^

Undefined name 'username'
```

The diagnostic system is designed to analyze code incrementally as the user writes.

There is no need to install a separate Error Lens extension.

---

## Jupyter Notebook Support

ZEUS is designed to support `.ipynb` files directly inside the editor.

Planned notebook capabilities include:

* Code cells
* Markdown cells
* Run individual cells
* Run all cells
* Kernel management
* Cell output
* Tables
* Images
* Plots
* Python environment integration

Example:

```text
project/
│
├── main.py
├── model.py
├── utils.py
├── experiment.ipynb
└── requirements.txt
```

Python files and notebooks can be part of the same project.

---

## Integrated Terminal

ZEUS includes an integrated terminal for development workflows.

The terminal is intended to support:

```bash
python main.py
pip install pandas
git status
git add .
git commit
```

Planned terminal capabilities include:

* Multiple terminal sessions
* PowerShell
* CMD
* Git Bash where available
* Python REPL
* Terminal resizing
* Process termination
* Copy and paste
* Shell selection

---

## AI-Assisted Development

ZEUS is designed with an optional AI coding layer.

AI features are intended to assist with:

* Code completion
* Code correction
* Code optimization
* Code explanation
* Refactoring
* Test generation
* Documentation generation
* Notebook assistance

### AI Provider Flexibility

The AI architecture is designed to be provider-independent.

The editor should be able to work with either:

```text
API
```

or:

```text
Local / Pretrained LLM
```

without changing the rest of the application.

The AI integration is intentionally isolated so that changing the underlying AI implementation does not require modifying the editor itself.

AI is an optional feature. The core Python development environment should continue to work without an AI service.

---

## AI Code Completion

ZEUS is planned to provide AI-powered inline code completion.

For example:

```python
def calculate_average(numbers):
```

The editor may provide a ghost-text suggestion:

```python
def calculate_average(numbers):
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)
```

The user can accept the suggestion using:

```text
TAB
```

and reject it using:

```text
ESC
```

---

## Code Corrector

ZEUS will provide an AI-assisted code correction feature.

The user can select code and request a correction.

The proposed changes should be displayed before being applied.

```text
Original
────────
def calculate(a,b)
    return a+b

Corrected
─────────
def calculate(a, b):
    return a + b
```

Users remain in control of whether suggested changes are applied.

---

## Code Optimizer

ZEUS will provide AI-assisted code optimization for:

* Readability
* Maintainability
* Pythonic code
* Unnecessary operations
* Code duplication
* Algorithmic improvements
* Potential performance improvements

Optimization suggestions should be reviewed before applying them.

---

## Debugging

Python debugging is part of the planned development roadmap.

Expected capabilities include:

* Breakpoints
* Step over
* Step into
* Step out
* Continue
* Stop
* Variable inspection
* Call stack
* Debug console

---

## Git Integration

ZEUS is designed to support Git-based workflows.

Planned functionality includes:

* Git initialization
* Clone
* Status
* Stage
* Commit
* Push
* Pull
* Branches
* Checkout
* Diff

Advanced Git commands can still be performed through the integrated terminal.

---

# Lightweight Architecture

Low memory usage is one of the primary design goals of ZEUS.

The application is designed around the principle:

> **Only run what is currently needed.**

For example:

```text
ZEUS Startup
     │
     ├── Editor
     ├── UI
     └── Lightweight diagnostics
```

Opening a notebook:

```text
.ipynb
  │
  └── Start notebook services
```

Starting debugging:

```text
Debug
  │
  └── Start debugger
```

Opening a terminal:

```text
Terminal
  │
  └── Start shell
```

Using AI:

```text
AI Request
    │
    └── Use configured AI provider
```

Unnecessary services should not remain active in the background.

---

# Technology

The architecture is being designed around lightweight desktop technologies.

Current/target technologies include:

* **Tauri 2**
* **Rust**
* **React**
* **TypeScript**
* **Monaco Editor**
* **Python 3**
* **Jupyter**
* **Python language tooling**
* **Git**

The project previously explored Electron, but the current direction is focused on a more lightweight Tauri-based desktop architecture.

---

```

The exact structure may change during development.

---

# Roadmap

ZEUS is currently under development.

### Completed / In Progress

* [x] Initial project architecture
* [x] Python-focused editor
* [x] Basic code editing
* [x] Project/file handling
* [x] Initial Error Lens architecture
* [x] AI integration architecture
* [x] AI provider flexibility
* [ ] Lightweight desktop runtime migration
* [ ] Integrated terminal improvements
* [ ] Complete Jupyter workflow
* [ ] Python debugging
* [ ] Git integration
* [ ] AI code completion
* [ ] AI code correction
* [ ] AI code optimization
* [ ] Performance optimization
* [ ] Memory optimization
* [ ] Windows packaging
* [ ] Stable release

The roadmap may change as development continues.

---

# Design Goals

ZEUS is being developed around a few core principles:

### Python First

Focus on Python development instead of trying to support every programming language.

### Lightweight

Avoid unnecessary background services and reduce memory consumption.

### Built-in Tools

Important Python development capabilities should work without requiring users to install a large collection of extensions.

### AI Optional

AI should enhance development rather than become a requirement for using the editor.

### User Control

AI-generated changes should be reviewed before modifying source code.

### Modular

Core components should remain independent and replaceable.

### Developer Friendly

The editor should make common Python workflows quick and straightforward.

---

# Current Status

**Development Status: Work in Progress**

ZEUS is not yet a production-ready release.

The project is actively being developed and additional features, improvements, testing, and performance optimization are still required.

Interfaces, architecture, and features may change during development.

---

# Future Ideas

Potential future improvements include:

* Advanced Python IntelliSense
* Better incremental diagnostics
* AI inline completion
* AI chat
* AI-powered quick fixes
* Advanced notebook experience
* Python environment manager
* Package manager UI
* Improved debugging
* Git visualizations
* Project templates
* Code profiling
* Performance analyzer
* Plugin architecture for future optional functionality
* Custom themes
* Keyboard shortcut customization
* Cross-platform support

---

# Contributing

ZEUS is currently under active development.

Contributions, ideas, bug reports, and suggestions are welcome as the project becomes more stable.

If you find a problem, please open an issue with:

1. Description of the problem
2. Steps to reproduce it
3. Expected behavior
4. Actual behavior
5. Operating system
6. Python version
7. Relevant logs or screenshots

---

# Disclaimer

ZEUS is an independent open-source project and is not affiliated with or endorsed by Microsoft, Visual Studio Code, Jupyter, Python Software Foundation, or any AI provider.

---

# License

License information will be added as the project approaches its first stable release.

---

## ZEUS

### *a python code*

**A lightweight Python development environment — built for Python developers.**
