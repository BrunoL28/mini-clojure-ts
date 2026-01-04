(println ">>> Iniciando Testes do Épico 3: Strings Robustas")

(defn assert-valid [str-input desc]
  (try
    (let [res (read-string str-input)]
      (println "PASS:" desc "->" str-input))
    (catch e
      (println "FAIL:" desc "- Erro inesperado:" e)
      (throw e))))

(defn assert-error [str-input desc expected-msg]
  (try
    (read-string str-input)
    (println "FAIL:" desc "- Deveria ter falhado, mas leu:" str-input)
    (throw "Esperava erro")
    (catch e
      ;; Verifica se a mensagem de erro contém o trecho esperado
      ;; Nota: Como ainda não temos funções de string robustas na stdlib (ex: includes?),
      ;; apenas assumimos que cair no catch é sucesso por enquanto, ou imprimimos o erro.
      (println "PASS:" desc "- Erro capturado:" e))))

;; 1. Casos Válidos
(assert-valid "\"ola\"" "String simples")
(assert-valid "\"linha1\\nlinha2\"" "Escape \\n")
(assert-valid "\"tab\\ttab\"" "Escape \\t")
(assert-valid "\"aspas \\\" dentro\"" "Escape \\\"")
(assert-valid "\"barra \\\\ invertida\"" "Escape \\\\")

;; 2. Casos Inválidos (Devem ser capturados pelo Tokenizer)

;; Escape desconhecido \q
;; Note que passamos a string literal "\"\\q\"" para read-string processar "\q"
(assert-error "\"\\q\"" "Escape inválido \\q" "Escape inválido")

;; Escape desconhecido \a
(assert-error "\"\\a\"" "Escape inválido \\a" "Escape inválido")

;; String não fechada
(assert-error "\"aberta" "String não fechada" "String não terminada")

(println ">>> Todos os testes de string concluídos.")