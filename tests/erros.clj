(print "--- Teste de Try / Catch ---")

(print "1. Teste de erro capturado:")
(try
  (print "Vou lançar um erro agora...")
  (throw "ERRO PROPOSITADO")
  (print "Isto NAO deve aparecer.")
  (catch e
    (print (str "Capturei: " e))))

(print "----------------------------")

(print "2. Teste sem erro:")
(try
  (print "Tudo normal aqui.")
  (+ 1 2)
  (catch e
    (print "Isto NAO deve aparecer.")))

(print "----------------------------")
(print "Fim dos testes de erro.")