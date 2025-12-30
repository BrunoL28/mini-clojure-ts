;; Testes de Igualdade e Identidade

(println ">>> Iniciando testes de igualdade (=) e identidade (identical?)")

;; 1. Primitivos
(if (= 1 1) (println "PASS: 1 = 1") (throw "FAIL: 1 != 1"))
(if (= "a" "a") (println "PASS: string =") (throw "FAIL: string"))
(if (= nil nil) (println "PASS: nil = nil") (throw "FAIL: nil"))
(if (not= 1 2) (println "PASS: 1 != 2") (throw "FAIL: 1 should not be 2"))

;; 2. Keywords (Valor)
(if (= :foo :foo) (println "PASS: :foo = :foo") (throw "FAIL: :foo != :foo"))
(if (not= :foo :bar) (println "PASS: :foo != :bar") (throw "FAIL: :foo == :bar"))

;; 3. Coleções Sequenciais (Vectors)
(def v1 [1 2 3])
(def v2 [1 2 3])
(def v3 [1 2 4])

(if (= v1 v2) (println "PASS: Vetores iguais") (throw "FAIL: Vetores iguais"))
(if (not= v1 v3) (println "PASS: Vetores diferentes") (throw "FAIL: Vetores diferentes"))

;; Aninhamento
(if (= [1 [2 3]] [1 [2 3]]) (println "PASS: Vetor aninhado") (throw "FAIL: Vetor aninhado"))

;; 4. Identidade (identical?)
(def list-a [1 2])
(def list-b [1 2])
(def list-c list-a)

(if (identical? list-a list-a) (println "PASS: identical? mesmo obj") (throw "FAIL: identical? mesmo obj"))
(if (identical? list-a list-c) (println "PASS: identical? referencia") (throw "FAIL: identical? referencia"))

;; Listas iguais em valor, mas objetos diferentes na memória
(if (not (identical? list-a list-b)) (println "PASS: not identical? diff obj") (throw "FAIL: identical? diff obj"))

(println ">>> Sucesso!")