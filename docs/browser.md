# Browser — Mini-Clojure-TS

O Mini-Clojure-TS roda no browser: interpretador, macros, estruturas
persistentes e compilador, sem servidor e sem Node ([#27]).

**Demo:** [`examples/browser/index.html`](../examples/browser/index.html) —
abra o arquivo direto no navegador depois de rodar `pnpm build`.

---

## Bundles

`pnpm build` gera dois arquivos prontos para `<script>`:

| Arquivo                       | Global               | Para quê                                                      |
| ----------------------------- | -------------------- | ------------------------------------------------------------- |
| `dist/mini-clojure.global.js` | `MiniClojure`        | Interpretador + compilador. É o que um runner/playground usa  |
| `dist/runtime.global.js`      | `MiniClojureRuntime` | Só o runtime, para rodar código compilado com `--target iife` |

```html
<script src="dist/mini-clojure.global.js"></script>
<script>
    console.log(MiniClojure.runSource("(reduce + [1 2 3])")); // 6
</script>
```

Via bundler, o subpath resolve sozinho — a condição `browser` do
`package.json` aponta para a variante sem `fs`:

```js
import { runSource } from "mini-clojure-ts/browser";
```

### Rodando código compilado no browser

```sh
mini-clj -t app.clj --target iife -o web/app.js
```

```html
<script src="dist/runtime.global.js"></script>
<!-- define MiniClojureRuntime -->
<script src="web/app.js"></script>
```

---

## O que muda

**Nada, exceto sistema de arquivos.** A stdlib inteira, macros, `let` com
destructuring, atoms, mapas persistentes, o compilador e o sandbox funcionam
igual.

| Recurso                      | Node | Browser                        |
| ---------------------------- | ---- | ------------------------------ |
| Interpretador e stdlib       | ✅   | ✅                             |
| Macros e `quasiquote`        | ✅   | ✅                             |
| Compilador (`compileSource`) | ✅   | ✅                             |
| Sandbox                      | ✅   | ✅                             |
| `slurp` / `spit`             | ✅   | ❌                             |
| `require` / `load-file`      | ✅   | ❌                             |
| `runFile` / `compileFile`    | ✅   | ❌ (não existem no entrypoint) |

As quatro formas indisponíveis **falham com mensagem explícita**, nunca
silenciosamente:

```
slurp não está disponível neste ambiente (host: sem sistema de arquivos).
```

---

## Como funciona

O que impedia o browser não era a linguagem, era o grafo de imports: o runtime
puxava `fs` e `path` através de `Modules.ts` e da stdlib, e nenhum bundler
consegue empacotar isso.

A solução foi um **host** (`src/core/Host.ts`): uma interface pequena com as
operações que dependem do ambiente. O runtime fala com o host, nunca com `fs`.

- **`NO_FILESYSTEM_HOST`** é o padrão. Manipulação de caminho funciona
  (é string pura), IO recusa com mensagem clara.
- **`NODE_HOST`** (`src/core/NodeHost.ts`) usa `fs` e o `path` nativo — que,
  diferente da versão POSIX pura, também acerta no Windows.

Quem instala o host de Node são os entrypoints de Node (`src/index.ts`,
`src/cli.ts`, `src/runtime/node.ts`). O entrypoint de browser não instala
nada, então fica com o padrão.

Isso é o que permite o `package.json` ter duas variantes do runtime:

```json
"./runtime": {
    "browser": "./dist/runtime/index.js",
    "import":  "./dist/runtime/node.js",
    "require": "./dist/cjs/runtime/node.js"
}
```

### Host customizado

Nada impede um host próprio — um sistema de arquivos virtual em memória, por
exemplo, faria `require` funcionar no browser:

```js
import { setHost } from "mini-clojure-ts/browser";

const arquivos = new Map([["/app/math.clj", "(defn soma [a b] (+ a b))"]]);

setHost({
    name: "memória",
    hasFileSystem: true,
    readFile: (p) => arquivos.get(p),
    writeFile: (p, c) => arquivos.set(p, c),
    exists: (p) => arquivos.has(p),
    // ...os helpers de caminho
});
```

---

## Limitações

- **Sem `fs`**: `slurp`, `spit`, `require` e `load-file` precisam de um host
  com sistema de arquivos.
- **Sem REPL de terminal**: `readline` é de Node. A demo usa um `textarea`.
- **Sem limite de tempo**: um laço infinito trava a aba. Isso vale para o
  Node também — é a issue [#30].
- **O sandbox não é fronteira de segurança**, nem no browser. Veja
  [`docs/interop.md`](interop.md).

[#27]: https://github.com/BrunoL28/mini-clojure-ts/issues/27
[#30]: https://github.com/BrunoL28/mini-clojure-ts/issues/30
