# Como contribuir

Obrigado pelo interesse! Este guia cobre o essencial para o primeiro PR.

---

## Começando

```sh
pnpm install
pnpm test          # deve passar antes de qualquer mudança
```

| Comando          | O que faz                                    |
| ---------------- | -------------------------------------------- |
| `pnpm test`      | Suíte completa (`node:test`)                 |
| `pnpm typecheck` | Type-check de `src` **e** `tests`            |
| `pnpm lint`      | ESLint                                       |
| `pnpm format`    | Prettier                                     |
| `pnpm build`     | Gera `dist/` (ESM, CJS e bundles de browser) |
| `pnpm bench`     | Benchmarks do interpretador                  |
| `pnpm start`     | Roda a CLI a partir do fonte                 |

---

## Mapa do código

```
src/
├── core/
│   ├── Tokenizer.ts    Fonte → tokens (com linha/coluna)
│   ├── Parser.ts       Tokens → AST
│   ├── Evaluator.ts    O interpretador e as formas especiais
│   ├── Environment.ts  Escopos encadeados
│   ├── Compiler.ts     AST → JavaScript
│   ├── Modules.ts      require / load-file, com cache
│   ├── Interop.ts      Contrato de interop e sandbox
│   ├── Host.ts         Abstração de sistema de arquivos (Node × browser)
│   ├── Limits.ts       Limites de tempo e de impressão
│   ├── Trace.ts        Tracing e profiling
│   └── Api.ts          API pública browser-safe
├── stdlib/             A biblioteca padrão
├── runtime/            O que o código compilado importa
├── browser/            Entrypoint de browser
└── index.ts            Entrypoint de Node
```

Documentação de referência em [`docs/`](../docs): `stdlib.md`, `modules.md`,
`compiler.md`, `interop.md`, `browser.md`.

---

## Fluxo de trabalho

O repositório trabalha direto na `master`, com branches curtas por mudança.

1. Crie uma branch a partir da `master`: `feat/nome-curto`, `fix/nome-curto`.
2. Faça a mudança **com teste**.
3. Rode o portão de qualidade (abaixo).
4. Abra o PR referenciando a issue (`Closes #123`).

### Portão de qualidade

Um PR só entra quando:

- ✅ `pnpm lint` sem erros
- ✅ `pnpm typecheck` limpo
- ✅ `pnpm test` verde
- ✅ tem teste cobrindo a mudança
- ✅ não quebra os exemplos existentes
- ✅ se mexe no interpretador **e** no compilador, a decisão de paridade está
  documentada

Mudança de performance precisa de número: rode `pnpm bench --save antes.json`
antes e `pnpm bench --baseline antes.json` depois.

> ⚠️ Benchmark é traiçoeiro. **Não** compare duas versões carregadas no mesmo
> processo: a segunda cópia do interpretador despolimorfiza os call sites do V8
> e sai ~30% mais lenta mesmo sendo idêntica. Compare processos separados,
> alternando a ordem, e reporte o melhor de várias amostras.

---

## Commits

O `commitlint` exige `:emoji: tipo: descrição`, com a descrição em até
72 caracteres e sem ponto final.

Tipos: `feat`, `fix`, `docs`, `test`, `build`, `perf`, `style`, `refactor`,
`chore`, `ci`, `raw`, `cleanup`, `remove`.

```
:sparkles: feat: adiciona take-while e drop-while na stdlib
:bug: fix: corrige destructuring de mapa com :or aninhado
:zap: perf: torna into linear em vetores
```

Para mensagens longas, use um arquivo — colar várias linhas com `-m` no
terminal costuma embaralhar o cabeçalho:

```sh
git commit -F mensagem.txt
```

---

## Versionamento

O projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/), com uma
convenção própria: **cada milestone do [roadmap](../ROADMAP.md) vira uma
major**. R3 foi a `5.0.0`, R4 a `6.0.0`, R5 a `7.0.0`.

| Mudança                                              | Incremento |
| ---------------------------------------------------- | ---------- |
| Quebra a linguagem, a CLI, a API ou o formato gerado | major      |
| Nova forma, função de stdlib ou flag                 | minor      |
| Correção sem mudança de contrato                     | patch      |

### O que conta como breaking change

- Remover ou renomear forma especial, função de stdlib ou flag da CLI
- Mudar o resultado de código que hoje funciona
- Mudar o formato do JavaScript gerado
- Mudar assinatura ou remoção na API pública (`src/index.ts`)
- Endurecer um default (ex.: ligar sandbox por padrão)

**Não** conta: mensagem de erro mais clara, ganho de performance, correção de
comportamento que contradizia a documentação.

Toda mudança entra no [`CHANGELOG.md`](../CHANGELOG.md), no formato
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Breaking changes
ganham seção própria explicando **como migrar**.

---

## Receitas

### Adicionar uma função à stdlib

1. Implemente em `src/stdlib/index.ts`. Use `callFn` para receber funções —
   funções de usuário são objetos `{params, body, env}`, não funções JS.
2. Teste numa fixture de `tests/fixtures/` (elas usam o próprio `assert`).
3. Documente em [`docs/stdlib.md`](../docs/stdlib.md) e na tabela do README.

### Adicionar uma forma especial

1. Acrescente o nome ao `SPECIAL_FORMS` em `src/core/Evaluator.ts` — um nome
   que falte lá é tratado como chamada de função comum.
2. Implemente o caso.
3. **Decida a paridade com o compilador:** implemente em
   `src/core/Compiler.ts` ou faça falhar com erro explícito, e registre a
   escolha na tabela de divergências em [`docs/compiler.md`](../docs/compiler.md).
4. Acrescente um caso em `tests/integration/compiler-parity.test.ts`.

### Trabalhar numa issue do roadmap

Cada épico do [`ROADMAP.md`](../ROADMAP.md) é uma issue. Ao concluir, marque os
checkboxes no roadmap no mesmo PR.

---

## Reportar bugs

Abra uma [issue](https://github.com/BrunoL28/mini-clojure-ts/issues/new/choose)
com o código `.clj` mínimo que reproduz, o que esperava, o que aconteceu, e a
saída de `mini-clj --version`.
