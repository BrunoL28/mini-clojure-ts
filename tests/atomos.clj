(print "--- Teste de Átomos (Estado Mutável) ---")

;; 1. Criar um átomo
(def contador (atom 0))
(print "Valor inicial:")
(print @contador) ;; Teste do leitor @

;; 2. Resetar valor (reset!)
(print "Reset para 10:")
(reset! contador 10)
(print (deref contador)) ;; Teste do deref explícito

;; 3. Modificar valor com função (swap!)
(print "Incrementando (swap! inc):")
(swap! contador + 1)
(print @contador)

;; 4. Swap com função customizada
(print "Multiplicando por 2 (função custom):")
(swap! contador (fn (x) (* x 2)))
(print @contador)

;; 5. Exemplo Real: Histórico
(def historico (atom []))
(def registar (fn (msg)
  (swap! historico conj msg))) ;; conj é o cons/push (espera, temos cons, vamos usar cons)

(swap! historico conj "Login efetuado")
(swap! historico conj "Erro detectado")

(print "Histórico de Logs:")
(print @historico)