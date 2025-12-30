(print "--- Testes Avançados de DEFN ---")

;; 1. Função Básica: Soma
(defn somar [a b]
  (+ a b))

(print "1. Soma (2 + 3):")
(print (somar 2 3))

;; 2. Implicit DO: Múltiplas linhas no corpo
(defn log-e-quadrado [n]
  (print (str "Calculando quadrado de: " n)) ;; Efeito colateral
  (* n n)) ;; Retorno

(print "2. Teste de múltiplas linhas:")
(print (log-e-quadrado 4))

;; 3. Função sem argumentos (Vetor vazio)
(defn ola-mundo []
  "Olá, Mundo!")

(print "3. Função sem args:")
(print (ola-mundo))

;; 4. Recursão: O nome 'fatorial' deve existir dentro do corpo
(defn fatorial [n]
  (if (<= n 1)
      1
      (* n (fatorial (- n 1)))))

(print "4. Recursão (Fatorial de 5):")
(print (fatorial 5))

;; 5. Composição: Função chamando função
(defn dobro [x] (* x 2))
(defn quadruplo [x] (dobro (dobro x)))

(print "5. Composição (Quadruplo de 5):")
(print (quadruplo 5))

;; 6. Redefinição: Sobrescrever uma função existente
(defn mutavel [] "Versão 1")
(print "6a. Antes da redefinição:")
(print (mutavel))

(defn mutavel [] "Versão 2 (Atualizada)")
(print "6b. Depois da redefinição:")
(print (mutavel))

(print "--- Fim dos Testes ---")