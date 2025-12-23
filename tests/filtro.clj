(print "--- Implementando Filter em 'Mini-Clojure' ---")

;; Definindo a nossa própria função FILTER
;; Ela recebe uma função de teste (pred) e uma lista (lst)
(def meu-filter (fn (pred lst)
  (if (empty? lst)
      '() ;; Se vazia, retorna lista vazia
      (if (pred (first lst))
          ;; Se verdadeiro: Mantém o item (cons) e continua
          (cons (first lst) (meu-filter pred (rest lst)))
          ;; Se falso: Ignora o item e continua
          (meu-filter pred (rest lst))))))

;; --- TESTES ---

(def numeros '(1 2 3 4 5 6 7 8 9 10))
(print "Lista original:")
(print numeros)

;; Teste 1: Apenas números maiores que 5
(def maiores-que-cinco (fn (n) (> n 5)))

(print "Maiores que 5:")
(print (meu-filter maiores-que-cinco numeros))

;; Teste 2: Apenas números pares (usando matemática: n/2 * 2 == n)
;; Nota: Como não temos operador de módulo %, improvisamos a checagem de par
(def eh-par (fn (n) (= (% n 2) 0))) ;; Se divisão inteira * 2 for igual, é par (assumindo inteiros)
  ;; OBS: No JS divisão pode dar decimal, mas para este exemplo simples serve.
  ;; O ideal seria implementar '%' no TS.

;; Vamos adicionar o operador de resto (%) no TS rapidinho para o teste ficar bonito?
;; Se não quiseres, o teste acima pode falhar com decimais.