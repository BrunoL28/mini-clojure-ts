<div id="top">

<div align="center">

# MINI-CLOJURE-TS

<em>Um interpretador de Clojure robusto e modular escrito em TypeScript.</em>

[![license](https://img.shields.io/github/license/BrunoL28/mini-clojure-ts?style=default&logo=opensourceinitiative&logoColor=white&color=A931EC)](https://github.com/BrunoL28/mini-clojure-ts/blob/master/LICENSE)
[![last-commit](https://img.shields.io/github/last-commit/BrunoL28/mini-clojure-ts?style=default&logo=git&logoColor=white&color=A931EC)](https://github.com/BrunoL28/mini-clojure-ts/commits/master)
[![repo-top-language](https://img.shields.io/github/languages/top/BrunoL28/mini-clojure-ts?style=default&color=A931EC)](https://github.com/BrunoL28/mini-clojure-ts)
[![repo-language-count](https://img.shields.io/github/languages/count/BrunoL28/mini-clojure-ts?style=default&color=A931EC)](https://github.com/BrunoL28/mini-clojure-ts)

</div>

---

## Table of Contents

<details>
<summary>Table of Contents</summary>

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Project Index](#project-index)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Testing](#testing)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

</details>

---

## Overview

**Mini-Clojure-TS** é um interpretador de Lisp moderno inspirado em Clojure, construído inteiramente em TypeScript. Este projeto foi desenvolvido com foco em arquitetura modular, performance e extensibilidade. Ele suporta recursos avançados como otimização de chamada de cauda (TCO), metaprogramação via Macros e interoperabilidade direta com o ambiente JavaScript (Node.js).

---

## Features

|  | Component | Details |
| --- | --- | --- |
| ⚙️ | **Architecture** | <ul><li>Modular design separating Tokenizer, Parser, Evaluator, and Environment</li><li>Typed error handling system</li><li>Clean separation of Standard Library (`stdlib`)</li></ul> |
| ⚡️ | **Performance** | <ul><li>**Tail Call Optimization (TCO):** Implements Trampoline technique to handle infinite recursion without stack overflow</li><li>Efficient AST processing</li></ul> |
| 🧠 | **Metaprogramming** | <ul><li>Full Macro support (`defmacro`)</li><li>Quasiquote (```) and Unquote (`~`) implementation</li><li>Ability to extend the language syntax at runtime</li></ul> |
| 🌐 | **JS Interop** | <ul><li>Direct access to `globalThis` via `js/Namespace`</li><li>Instantiation of JS classes (`new`)</li><li>Method chaining and property access (`.`)</li></ul> |
| 📦 | **Data Structures** | <ul><li>Support for Lists `()`, Vectors `[]`, and Hash Maps `{}`</li><li>Keywords (`:key`) and primitive types</li><li>Immutable-style operations via `stdlib` functions</li></ul> |
| 💻 | **REPL** | <ul><li>Interactive Read-Eval-Print Loop with syntax highlighting</li><li>Persistent environment state</li><li>Detailed error reporting</li></ul> |

---

## Project Structure

```sh
└── mini-clojure-ts/
    ├── .github
    │   └── workflows
    ├── src/
    │   ├── core/
    │   ├── errors/
    │   ├── stdlib/
    │   ├── types/
    │   └── index.ts
    ├── tests/
    ├── package.json
    ├── tsconfig.json
    └── pnpm-lock.yaml

```

### Project Index

<details open>
<summary><b><code>MINI-CLOJURE-TS/</code></b></summary>
<details>
<summary><b>src</b></summary>
<blockquote>
<div class='directory-path' style='padding: 8px 0; color: #666;'>
<code><b>⦿ src</b></code>
<table style='width: 100%; border-collapse: collapse;'>
<thead>
<tr style='background-color: #f8f9fa;'>
<th style='width: 30%; text-align: left; padding: 8px;'>File Name</th>
<th style='text-align: left; padding: 8px;'>Summary</th>
</tr>
</thead>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b><a href='[https://github.com/BrunoL28/mini-clojure-ts/blob/master/src/index.ts](https://www.google.com/search?q=https://github.com/BrunoL28/mini-clojure-ts/blob/master/src/index.ts)'>index.ts</a></b></td>
<td style='padding: 8px;'>- Entry point of the application



- Handles CLI arguments to run files or start the interactive REPL.</td>
</tr>
</table>
<details>
<summary><b>core</b></summary>
<blockquote>
<div class='directory-path' style='padding: 8px 0; color: #666;'>
<code><b>⦿ src.core</b></code>
<table style='width: 100%; border-collapse: collapse;'>
<thead>
<tr style='background-color: #f8f9fa;'>
<th style='width: 30%; text-align: left; padding: 8px;'>File Name</th>
<th style='text-align: left; padding: 8px;'>Summary</th>
</tr>
</thead>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Evaluator.ts</b></td>
<td style='padding: 8px;'>- The brain of the interpreter



- Processes the AST, handles special forms (`def`, `if`, `fn`, `let`), macro expansion, and executes code.</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Parser.ts</b></td>
<td style='padding: 8px;'>- Converts tokens into an Abstract Syntax Tree (AST)



- Handles recursive structures like Lists, Vectors, and Maps.</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Tokenizer.ts</b></td>
<td style='padding: 8px;'>- Lexical analysis using Regex



- Handles comments, strings, symbols, and special characters.</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Environment.ts</b></td>
<td style='padding: 8px;'>- Manages variable scope and closures



- Implements the scope chain lookup.</td>
</tr>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>Trampoline.ts</b></td>
<td style='padding: 8px;'>- Implements the Trampoline pattern for Tail Call Optimization (TCO).</td>
</tr>
</table>
</blockquote>
</details>
<details>
<summary><b>stdlib</b></summary>
<blockquote>
<div class='directory-path' style='padding: 8px 0; color: #666;'>
<code><b>⦿ src.stdlib</b></code>
<table style='width: 100%; border-collapse: collapse;'>
<thead>
<tr style='background-color: #f8f9fa;'>
<th style='width: 30%; text-align: left; padding: 8px;'>File Name</th>
<th style='text-align: left; padding: 8px;'>Summary</th>
</tr>
</thead>
<tr style='border-bottom: 1px solid #eee;'>
<td style='padding: 8px;'><b>index.ts</b></td>
<td style='padding: 8px;'>- Contains the standard library functions (`map`, `filter`, `+`, `str`, etc.)



- Implements JS Interop functions.</td>
</tr>
</table>
</blockquote>
</details>
</blockquote>
</details>
</details>

---

## Getting Started

### Prerequisites

This project requires the following dependencies:

* **Runtime:** [Node.js](https://nodejs.org/) (v18+)
* **Package Manager:** [pnpm](https://pnpm.io/) (recommended) or npm

### Installation

1. **Clone the repository:**
```
❯ git clone https://github.com/BrunoL28/mini-clojure-ts.git

```


2. **Navigate to the project directory:**
```
❯ cd mini-clojure-ts

```


3. **Install the dependencies:**
**Using pnpm:**
```
❯ pnpm install

```


**Using npm:**
```
❯ npm install

```



### Usage

**Start the REPL (Interactive Mode):**

```
❯ pnpm start

```

**Execute a Clojure file:**

```
❯ pnpm start -- tests/final.clj

```

### Testing

The project includes a suite of `.clj` files to test various features like recursion, macros, and interop.

```
# Test Tail Call Optimization
❯ pnpm start -- tests/estouro.clj

# Test Macros
❯ pnpm start -- tests/macros.clj

```

---

## Roadmap

* [x] **v1.0.0:** TCO, Macros, Maps, Vectors, JS Interop.
* [x] **v1.1.0:** Atoms (State Management).
* [x] **v1.2.0:** Try/Catch Error Handling.
* [x] **v1.3.0:** Destructuring support.
* [ ] **v2.0.0:** Transpiler (Compile to JS).

---

## Contributing

* **💬 [Join the Discussions]**(https://www.google.com/search?q=https://github.com/BrunoL28/mini-clojure-ts/discussions): Share your insights, provide feedback, or ask questions.
* **🐛 [Report Issues]**(https://www.google.com/search?q=https://github.com/BrunoL28/mini-clojure-ts/issues): Submit bugs found or log feature requests.
* **💡 [Submit Pull Requests]**(https://www.google.com/search?q=https://github.com/BrunoL28/mini-clojure-ts/pulls): Review open PRs, and submit your own PRs.

<details closed>
<summary>Contributing Guidelines</summary>

1. **Fork the Repository**: Start by forking the project repository to your github account.
2. **Clone Locally**: Clone the forked repository to your local machine.
3. **Create a New Branch**: Always work on a new branch.
```
git checkout -b feature/my-new-feature

```


4. **Make Your Changes**: Develop and test your changes locally.
5. **Commit Your Changes**: Commit with a clear message.
6. **Push to github**: Push the changes to your forked repository.
7. **Submit a Pull Request**: Create a PR against the original project repository.

</details>

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Acknowledgments

* Inspired by **Rich Hickey's Clojure**.
* Built with TypeScript for type safety and developer experience.

<div align="right">

</div>

[]: #
