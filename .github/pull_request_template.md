## O que muda

<!-- Uma ou duas frases. O "porquê" importa mais que o "o quê". -->

Closes #

## Tipo

- [ ] Correção de bug
- [ ] Nova funcionalidade
- [ ] Performance
- [ ] Documentação
- [ ] Refatoração / manutenção

## Áreas tocadas

- [ ] Interpretador (`src/core/Evaluator.ts`, `Environment.ts`)
- [ ] Reader (`Tokenizer.ts`, `Parser.ts`)
- [ ] Stdlib (`src/stdlib/`)
- [ ] Compilador (`src/core/Compiler.ts`, `src/runtime/`)
- [ ] CLI / REPL (`src/cli.ts`)
- [ ] Módulos, interop ou sandbox
- [ ] Documentação

## Paridade interpretador × compilador

<!-- Só se mexeu em semântica da linguagem. -->

- [ ] Não se aplica
- [ ] Funciona igual nos dois, com caso em `compiler-parity.test.ts`
- [ ] Diverge de propósito, e a divergência está em `docs/compiler.md`

## Como testar

```clojure
;; código mínimo que exercita a mudança
```

## Checklist

- [ ] `pnpm lint` sem erros
- [ ] `pnpm typecheck` limpo
- [ ] `pnpm test` verde
- [ ] Testes cobrindo a mudança
- [ ] Documentação atualizada (`docs/`, README) se o comportamento mudou
- [ ] `CHANGELOG.md` atualizado
- [ ] Checkboxes do `ROADMAP.md` marcados, se fecha um épico

## Breaking change?

- [ ] Não
- [ ] Sim — descrito abaixo, com caminho de migração

<!-- O que quebra e como migrar. -->

## Performance

<!-- Só se mexeu em caminho quente. Cole a saída de
     `pnpm bench --baseline antes.json`.
     Compare PROCESSOS separados: duas versões no mesmo processo dão
     ~30% de viés contra a segunda. -->
