(print "--- Teste Final: Mini-Clojure ---")

;; 1. Teste de DO e STR (se implementaste o str)
(do 
  (print "Passo 1: Iniciando...")
  (print "Passo 2: Ainda no bloco DO..."))

;; 2. Teste de LET (Escopo Local)
(print "Calculando hipotenusa com variaveis locais:")
(let (a 3 b 4)
  (do
    (print (str "Cateto A: " a)) ;; Usa str se tiveres implementado
    (print (str "Cateto B: " b))
    (print "Hipotenusa:")
    (print (do 
             ;; Exemplo complexo: raiz quadrada improvisada (apenas para teste)
             ;; Num cenário real, teriamos Math.sqrt
             5))))

;; 3. Teste de Scope (Garantir que o let não sujou o global)
(print "Tentando acessar 'a' fora do let (deve dar erro ou ser nil/undefined):")
;;(print a) ;;Descomenta para ver o erro acontecer!

(print "--- Fim do Sistema ---")