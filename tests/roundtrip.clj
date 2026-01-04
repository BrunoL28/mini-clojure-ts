;; Testes de Roundtrip (pr-str -> read-string)

(println ">>> Iniciando testes de IO e Roundtrip")

(defn test-roundtrip [val desc]
  (let [serialized (pr-str val)
        deserialized (read-string serialized)]
    (if (= val deserialized)
      (println "PASS:" desc "->" serialized)
      (do
        (println "FAIL:" desc)
        (println "  Original: " val)
        (println "  Serializado: " serialized)
        (println "  Lido: " deserialized)
        (throw "Erro de roundtrip")))))

;; 1. Primitivos Simples
(test-roundtrip 123 "Número")
(test-roundtrip -42.5 "Número Negativo/Float")
(test-roundtrip true "Booleano True")
(test-roundtrip nil "Nil")
(test-roundtrip :keyword "Keyword simples")
(test-roundtrip :namespaced/keyword "Keyword com namespace")

;; 2. Strings
(test-roundtrip "Ola Mundo" "String simples")
(test-roundtrip "Linha 1\nLinha 2" "String com newline")
(test-roundtrip "Com \"aspas\" internas" "String com aspas escapadas")
(test-roundtrip "Com \\ barra" "String com backslash")

;; 3. Coleções
(test-roundtrip [1 2 3] "Vetor de números")
(test-roundtrip [:a "b" 3] "Vetor misto")
(test-roundtrip {:a 1 :b 2} "Mapa simples")
(test-roundtrip {:a [1 2] :b {:c 3}} "Mapa aninhado")

;; 4. Listas (Nota: read-string lê listas como listas, avaliador executa se não quotar)
;; Aqui testamos a leitura estrutural, sem eval
(let [l (read-string "(1 2 3)")]
  (if (= (first l) 1)
    (println "PASS: Lista lida corretamente")
    (throw "FAIL: Lista")))

;; 5. Teste de prn (visual)
(println ">>> Teste visual de prn (deve imprimir [1 2] com quebra de linha):")
(prn [1 2])

(println ">>> Sucesso! Todos os testes passaram.")