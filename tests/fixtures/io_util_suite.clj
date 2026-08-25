;; =========================================================
;; [R3/E4] IO/util — issue #15
;; slurp/spit são Node-only.
;; =========================================================
(println "--- INICIO IO SUITE ---")

;; --- assert ---
(assert true "assert com valor verdadeiro não lança")
(assert 0 "assert: 0 é verdadeiro em Clojure")
(assert (= (assert true) nil) "assert retorna nil quando passa")
(assert (= (try (assert false "explodiu") :nao-lancou (catch e e))
           "Assert falhou: explodiu")
        "assert lança com a mensagem fornecida")
(assert (= (try (assert nil "nil também falha") :nao-lancou (catch e e))
           "Assert falhou: nil também falha")
        "assert trata nil como falso")

;; --- time ---
;; time imprime "Elapsed time: N msecs" e devolve o valor da expressão.
(assert (= (time (+ 1 2)) 3) "time retorna o valor da expressão")
(assert (= (time (reduce + (range 100))) 4950) "time com expressão composta")
(assert (= (time "valor") "valor") "time com literal")

;; --- slurp / spit (Node-only) ---
(def arquivo-tmp "tests/fixtures/.tmp-io-suite.txt")
(spit arquivo-tmp "conteudo de teste")
(assert (= (slurp arquivo-tmp) "conteudo de teste") "slurp lê o que spit escreveu")
(assert (= (spit arquivo-tmp "outro") nil) "spit retorna nil")
(assert (= (slurp arquivo-tmp) "outro") "spit sobrescreve o arquivo")
(assert (= (try (slurp "tests/fixtures/nao-existe-mesmo.txt") :nao-lancou (catch e :erro))
           :erro)
        "slurp de arquivo inexistente lança erro")

(println "--- FIM IO SUITE ---")
