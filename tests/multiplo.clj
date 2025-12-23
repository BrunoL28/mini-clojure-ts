(print "--- Teste do DO e Strings ---")

(def cumprimento (fn (nome)
  (do
    (print (str "Olá, " nome "!"))
    (print "Vou calcular o quadrado do teu nome (tamanho):")
    (* (count nome) (count nome)))))

(print "Resultado:")
(print (cumprimento "Bruno"))

(print "--- Teste Lógico ---")
(print (not false))  ;; true
(print (not true))   ;; false