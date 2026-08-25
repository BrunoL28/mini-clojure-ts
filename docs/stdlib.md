# Biblioteca Padrão — Mini-Clojure-TS

Referência do core disponível no ambiente global (`createGlobalEnv()`).

> **Convenções**
>
> - **Formas especiais** são interpretadas diretamente pelo `Evaluator` e **não podem ser passadas como valor** (ex.: `(map and ...)` não funciona). Em compensação, elas avaliam os argumentos preguiçosamente — é isso que dá o _short-circuit_ de `and`/`or`.
> - **Funções** são valores normais: podem ser passadas para `map`, `reduce`, `comp`, etc., e podem ser sobrescritas com `def`/`defn`.
> - **Truthiness:** apenas `false` e `nil` são falsos. `0`, `""` e `[]` são **verdadeiros**.
> - **Listas × vetores:** `[1 2]` é um `ClojureVector`; `'(1 2)` e o retorno das funções de sequência são **listas**. Por isso `(vector? (filter ...))` é `false` e `(seq? (filter ...))` é `true`, igual a Clojure.
> - Não há **lazy seqs** neste subset: `range`, `repeat`, `map`, `filter` etc. são _eager_.

---

## Aritmética

| Forma          | Aridade | Descrição                                           |
| -------------- | ------- | --------------------------------------------------- |
| `(+ & nums)`   | 0+      | Soma. `(+)` → `0`                                   |
| `(- x & nums)` | 1+      | Subtração. `(- 5)` → `-5`                           |
| `(* & nums)`   | 0+      | Produto. `(*)` → `1`                                |
| `(/ x & nums)` | 1+      | Divisão. `(/ 2)` → `0.5`. Lança em divisão por zero |
| `(rem a b)`    | 2       | Resto (sinal do dividendo)                          |
| `(% a b)`      | 2       | Alias histórico de `rem`                            |
| `(mod a b)`    | 2       | Módulo (sinal do divisor)                           |
| `(quot a b)`   | 2       | Divisão inteira truncada                            |
| `(inc x)`      | 1       | `x + 1`                                             |
| `(dec x)`      | 1       | `x - 1`                                             |
| `(max & nums)` | 1+      | Maior valor                                         |
| `(min & nums)` | 1+      | Menor valor                                         |
| `(abs x)`      | 1       | Valor absoluto                                      |

## Comparação e lógica

| Forma                                      | Descrição                                                             |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `(= & xs)`                                 | Igualdade **estrutural** encadeada (vetores, listas, mapas, keywords) |
| `(not= & xs)`                              | Negação de `=`                                                        |
| `(identical? a b)`                         | Identidade de referência (`===`)                                      |
| `(< & nums)`                               | Encadeado: `(< 1 2 3)` → `true`                                       |
| `(> & nums)`, `(<= & nums)`, `(>= & nums)` | Idem                                                                  |
| `(not x)`                                  | `true` só para `false`/`nil`                                          |

---

## Predicados e tipos <sub>[R3/E2]</sub>

| Predicado                                                    | `true` quando…                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `(nil? x)`                                                   | `x` é `nil`                                                 |
| `(some? x)`                                                  | `x` **não** é `nil` (inclusive `false`)                     |
| `(true? x)`                                                  | `x` é exatamente `true`                                     |
| `(false? x)`                                                 | `x` é exatamente `false`                                    |
| `(boolean? x)`                                               | `x` é `true` ou `false`                                     |
| `(number? x)`                                                | `x` é número (e não `NaN`)                                  |
| `(string? x)`                                                | `x` é string                                                |
| `(keyword? x)`                                               | `x` é keyword (`:a`)                                        |
| `(symbol? x)`                                                | `x` é símbolo (`'a`)                                        |
| `(fn? x)`                                                    | `x` é invocável (nativa ou `fn`/`defn`); keywords → `false` |
| `(macro? x)`                                                 | `x` é uma macro definida com `defmacro`                     |
| `(map? x)`                                                   | `x` é um mapa                                               |
| `(vector? x)`                                                | `x` é um vetor `[]`                                         |
| `(list? x)`                                                  | `x` é uma lista (inclui o retorno das funções de sequência) |
| `(seq? x)`                                                   | Igual a `list?` — **vetores não são seqs**, como em Clojure |
| `(coll? x)`                                                  | `x` é vetor, lista ou mapa                                  |
| `(atom? x)`                                                  | `x` é um átomo                                              |
| `(zero? x)`, `(pos? x)`, `(neg? x)`, `(even? x)`, `(odd? x)` | Numéricos                                                   |
| `(empty? coll)`                                              | Coleção vazia ou `nil`                                      |
| `(contains? coll k)`                                         | Mapa tem a chave, ou índice válido em vetor/string          |

---

## Coleções

| Forma                     | Descrição                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `(list & xs)`             | Cria uma lista                                                                                |
| `(vector & xs)`           | Cria um vetor                                                                                 |
| `(hash-map & kvs)`        | Cria um mapa (número par de argumentos)                                                       |
| `(first coll)`            | Primeiro elemento ou `nil`                                                                    |
| `(second coll)`           | Segundo elemento ou `nil`                                                                     |
| `(last coll)`             | Último elemento ou `nil`                                                                      |
| `(rest coll)`             | Lista sem o primeiro elemento (`()` se vazia)                                                 |
| `(count coll)`            | Tamanho de vetor/lista/string/mapa; `0` para `nil`                                            |
| `(nth coll i [notFound])` | Elemento por índice; lança se fora dos limites e sem `notFound`                               |
| `(cons x coll)`           | Nova lista com `x` no início                                                                  |
| `(conj coll & xs)`        | Adiciona preservando o tipo: **fim** em vetores, **início** em listas, pares `[k v]` em mapas |
| `(concat & colls)`        | Concatena em uma lista                                                                        |

`first`, `count`, `seq` etc. aceitam strings (tratadas como sequência de caracteres) e mapas (tratados como sequência de pares `[chave valor]`).

---

## Sequências <sub>[R3/E1]</sub>

| Forma                    | Descrição                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| `(map f coll & colls)`   | Aplica `f`; com várias coleções, para na mais curta                       |
| `(filter pred coll)`     | Mantém os itens em que `pred` é verdadeiro                                |
| `(remove pred coll)`     | Complemento de `filter`                                                   |
| `(reduce f coll)`        | Sem valor inicial; `(reduce f [])` chama `(f)`                            |
| `(reduce f init coll)`   | Com valor inicial                                                         |
| `(some pred coll)`       | Primeiro valor verdadeiro retornado por `pred`, ou `nil`                  |
| `(every? pred coll)`     | `true` se todos satisfazem (vazio → `true`)                               |
| `(not-any? pred coll)`   | `true` se nenhum satisfaz                                                 |
| `(take n coll)`          | Primeiros `n` itens                                                       |
| `(drop n coll)`          | Remove os primeiros `n` itens                                             |
| `(range end)`            | `0 … end-1`                                                               |
| `(range start end)`      | `start … end-1`                                                           |
| `(range start end step)` | Aceita `step` negativo; `step` `0` lança erro                             |
| `(repeat n x)`           | `x` repetido `n` vezes (**eager** — não há `(repeat x)` infinito)         |
| `(reverse coll)`         | Lista invertida                                                           |
| `(seq coll)`             | A sequência, ou `nil` se vazia                                            |
| `(into to from)`         | Adiciona todos os itens de `from` em `to`, **preservando o tipo de `to`** |

> `into` usa a semântica de `conj`: `(into [1] [2 3])` → `[1 2 3]`, mas `(into '(1) '(2 3))` → `(3 2 1)`.

## Helpers funcionais <sub>[R3/E1]</sub>

| Forma                   | Descrição                                                    |
| ----------------------- | ------------------------------------------------------------ |
| `(identity x)`          | Devolve `x`                                                  |
| `(apply f & args coll)` | Chama `f` com os argumentos fixos + os itens de `coll`       |
| `(comp & fns)`          | Composição da direita para a esquerda; `(comp)` é `identity` |
| `(partial f & args)`    | Fixa os primeiros argumentos de `f`                          |

Todos aceitam tanto funções nativas quanto funções de usuário (`fn`/`defn`) e keywords como função (`(map :a [{:a 1}])`).

---

## Mapas

| Forma                          | Descrição                                                    |
| ------------------------------ | ------------------------------------------------------------ |
| `(get coll k [notFound])`      | Valor por chave (mapas) ou índice (vetores/strings)          |
| `(assoc coll & kvs)`           | Associa em mapa **ou vetor** (índice) — retorna nova coleção |
| `(dissoc map & ks)`            | Remove chaves                                                |
| `(keys map)` / `(vals map)`    | Chaves/valores como lista; `nil` se o mapa for vazio         |
| `(merge & maps)`               | Mescla; o último vence. `nil` é ignorado                     |
| `(update coll k f & args)`     | `(assoc coll k (f (get coll k) & args))`                     |
| `(get-in coll ks [notFound])`  | Busca em caminho aninhado                                    |
| `(assoc-in coll ks v)`         | Associa em caminho aninhado (cria mapas intermediários)      |
| `(update-in coll ks f & args)` | Aplica `f` em caminho aninhado                               |

Mapas são persistentes (HAMT): todas essas operações retornam uma nova estrutura.

---

## Macros utilitárias <sub>[R3/E3]</sub>

Implementadas como **formas especiais** no `Evaluator` para garantir avaliação preguiçosa.

| Forma                          | Descrição                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `(defn nome [params] & corpo)` | Define uma função nomeada. Suporta destructuring e `&` rest                     |
| `(when teste & corpo)`         | Executa o corpo se `teste` for verdadeiro; senão `nil`                          |
| `(when-not teste & corpo)`     | O inverso                                                                       |
| `(and & xs)`                   | Curto-circuito. `(and)` → `true`; retorna o primeiro falso ou o último valor    |
| `(or & xs)`                    | Curto-circuito. `(or)` → `nil`; retorna o primeiro verdadeiro ou o último valor |
| `(cond t1 e1 t2 e2 …)`         | Pares teste/expressão; use `:else` como padrão. Sem match → `nil`               |
| `(-> x & formas)`              | _Thread-first_: insere o valor como **primeiro** argumento                      |
| `(->> x & formas)`             | _Thread-last_: insere o valor como **último** argumento                         |

```clojure
(-> {:a 1} (assoc :b 2) (get :b))                  ;=> 2
(->> [1 2 3 4] (filter even?) (reduce + 0))        ;=> 6
(cond (neg? x) :negativo (zero? x) :zero :else :positivo)
```

---

## IO e utilitários <sub>[R3/E4]</sub>

| Forma                                 | Tipo           | Descrição                                                         |
| ------------------------------------- | -------------- | ----------------------------------------------------------------- |
| `(print & args)` / `(println & args)` | função         | Imprime de forma legível para humanos                             |
| `(prn & args)` / `(pr-str & args)`    | função         | Imprime/serializa de forma _readably_ (strings com aspas)         |
| `(str & args)`                        | função         | Concatena a representação humana dos argumentos                   |
| `(read-string s)`                     | função         | Faz o parse de uma string em AST                                  |
| `(assert expr [msg])`                 | função         | Lança `ClojureError` se `expr` for falso. Retorna `nil` se passar |
| `(time expr)`                         | forma especial | Imprime `Elapsed time: N msecs` e devolve o valor de `expr`       |
| `(slurp caminho)`                     | função         | **Node-only.** Lê o arquivo inteiro como string (UTF-8)           |
| `(spit caminho conteudo)`             | função         | **Node-only.** Escreve (sobrescrevendo) e retorna `nil`           |

> **`assert` é função, não macro.** A expressão chega já avaliada, então a mensagem
> opcional é o que dá contexto ao erro — prefira sempre `(assert expr "descrição")`.
> Por ser função, também pode ser sobrescrita com `defn` em suítes de teste próprias.

> **`slurp`/`spit` dependem do `fs` do Node** e não funcionam em ambiente browser
> (ver [R6/E3] no roadmap).

---

## Átomos e interop

| Forma                    | Descrição                                                  |
| ------------------------ | ---------------------------------------------------------- |
| `(atom v)`               | Cria um átomo                                              |
| `(deref a)` / `@a`       | Lê o valor                                                 |
| `(reset! a v)`           | Substitui o valor                                          |
| `(swap! a f & args)`     | Aplica `f` ao valor atual (aceita fn nativa ou de usuário) |
| `(new Classe & args)`    | Instancia uma classe JS                                    |
| `(. membro alvo & args)` | Acessa propriedade ou chama método JS                      |
| `js/Nome`                | Resolve um global JavaScript                               |
| `(throw msg)`            | Lança um `ClojureError`                                    |

---

## Cobertura de testes

As suítes de aceitação vivem em `tests/fixtures/` e rodam no CI via `pnpm test`:

| Fixture                 | Issue | Cobre                            |
| ----------------------- | ----- | -------------------------------- |
| `stdlib_seq_suite.clj`  | #12   | Sequências, helpers, mapas       |
| `predicates_suite.clj`  | #13   | Predicados e tipos               |
| `core_macros_suite.clj` | #14   | Macros utilitárias               |
| `io_util_suite.clj`     | #15   | `assert`, `time`, `slurp`/`spit` |

As fixtures usam o próprio `assert` da stdlib: qualquer falha lança e quebra o teste com a mensagem descritiva.
