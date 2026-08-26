# Impressão e formatação

Duas coisas diferentes, que a issue [#35] junta: **imprimir dados** de forma
legível (`pprint`) e **formatar código-fonte** (`mini-clj fmt`).

---

## `pprint` — imprimir dados

```clojure
(pprint valor)       ; imprime
(pprint-str valor)   ; devolve a string
```

A regra é uma só: **cabe na largura, sai numa linha.** Só o que não cabe
quebra.

```clojure
(pprint {:a 1 :b 2})
;; {:a 1 :b 2}

(pprint {:nome "ana" :idade 30 :tags [:admin :dev :ops]
         :endereco {:cidade "sao paulo" :cep "01000-000"}})
;; {:nome "ana"
;;  :idade 30
;;  :tags [:admin :dev :ops]
;;  :endereco {:cidade "sao paulo" :cep "01000-000"}}
```

- **Mapas** quebram por par chave/valor — quebrar entre a chave e o valor
  deixaria o mapa ilegível.
- **Sequências de escalares preenchem a linha** em vez de gastar uma linha por
  item: `(range 500)` sai em poucas linhas, não em quinhentas.
- Os itens seguintes alinham sob o primeiro.
- Respeita `set-print-length!` e `set-print-level!`. Ver
  [`performance.md`](performance.md).

```clojure
(set-print-width! 40)     ; largura alvo; padrão 80
(:width (print-limits))   ;=> 40
```

Pela API:

```typescript
import { ppStr } from "mini-clojure-ts";
ppStr(valor, { width: 100, indent: 4 });
```

`indent` diz quantas colunas já foram consumidas na linha atual — útil para
encaixar a saída dentro de texto já indentado.

---

## `mini-clj fmt` — formatar código-fonte

```sh
mini-clj fmt app.clj                    # escreve o resultado na saída padrão
mini-clj fmt --write src/*.clj          # reescreve os arquivos
mini-clj fmt --check src/*.clj          # falha se algo estiver fora do formato
mini-clj fmt --write --width 100 app.clj
```

Sem `--write` nem `--check`, o resultado vai para a saída padrão: o
comportamento menos destrutivo é o padrão.

`--check` sai com código 1 e lista os arquivos desalinhados — é o que entra num
hook de pre-commit ou num passo de CI.

### Duas garantias

O formatador é verificado contra duas propriedades, em **todo `.clj` do
repositório**:

1. **Não altera o programa.** `parse(format(x))` é igual a `parse(x)`.
2. **É idempotente.** `format(format(x))` é igual a `format(x)`.

Se qualquer uma quebrar, o CI acusa.

### O que ele faz

| Regra                                        | Comportamento                       |
| -------------------------------------------- | ----------------------------------- |
| Cabe na largura                              | Junta numa linha só                 |
| Corpo de `defn`, `let`, `when`, `do`, `try`… | Indenta 2 espaços                   |
| Chamada de função                            | Alinha os argumentos sob o primeiro |
| Mapa                                         | Um par chave/valor por linha        |
| Linhas em branco                             | Colapsa duas ou mais em uma         |
| Fim do arquivo                               | Garante uma nova linha final        |

### Comentários

**Comentários são preservados.** Isso não era de graça: o tokenizer descartava
comentários, então um formatador ingênuo apagaria todos eles. O reader do
formatador liga `keepComments` e monta uma árvore **concreta**, que guarda o
que o parser normal joga fora.

```clojure
;; comentário de topo fica na própria linha
(def x 1) ; comentário pendurado fica no fim da linha
```

### Fonte inválido

Um arquivo que não parseia **não é formatado** — o comando reporta o erro com
linha e coluna e segue para o próximo. Reescrever um arquivo que não parseia
seria a pior coisa que um formatador pode fazer.

### Limitações conhecidas

- Um comentário pendurado é colado no fim da linha, e pode ultrapassar a
  largura alvo.
- Não há regras por-forma configuráveis: a tabela de indentação de corpo é
  fixa (`src/core/Formatter.ts`).
- `cond` não recebe tratamento especial — se os pares couberem numa linha,
  ficam numa linha.
- Os `.clj` versionados no repositório **não** estão formatados por esta
  ferramenta; muitos usam indentação própria de propósito.

[#35]: https://github.com/BrunoL28/mini-clojure-ts/issues/35
