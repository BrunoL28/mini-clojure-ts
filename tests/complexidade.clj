(print "=== INICIO TESTE DE COMPLEXIDADE ===")

;; 1. Definição de Dados Complexos
(def loja
  {:nome "Tech Store"
   :estoque [{:id 101 :item "Notebook" :preco 2500 :qtd 5}
             {:id 102 :item "Mouse"    :preco 50   :qtd 20}
             {:id 103 :item "Teclado"  :preco 150  :qtd 10}
             {:id 104 :item "Monitor"  :preco 800  :qtd 0}]})

(print "1. Loja carregada:")
(println loja)

;; 2. Função de Venda (Imutabilidade com assoc/update simulado)
(defn vender [db id-produto qtd-venda]
  (let [produtos (get db :estoque)]
    ;; Como não temos 'map' com lambda complexo fácil ainda na stdlib,
    ;; vamos fazer um loop manual recursivo para atualizar o estoque
    (defn atualizar-lista [lista]
      (if (empty? lista)
          []
          (let [prod (first lista)
                resto (rest lista)]
            (if (= (get prod :id) id-produto)
                ;; Se achou, atualiza quantidade
                (let [nova-qtd (- (get prod :qtd) qtd-venda)]
                  (if (< nova-qtd 0)
                      (do (print "Erro: Estoque insuficiente") (cons prod resto))
                      (cons (assoc prod :qtd nova-qtd) resto)))
                ;; Se não, continua
                (cons prod (atualizar-lista resto))))))
    
    (assoc db :estoque (atualizar-lista produtos))))

;; 3. Executando Vendas
(print "\n2. Vendendo 2 Notebooks...")
(def loja-pos-venda (vender loja 101 2))

;; Verifica o item 101 na nova loja
(defn buscar-qtd [db id]
  (let [prods (get db :estoque)]
    (defn acha [l]
      (if (empty? l) 
          0
          (if (= (get (first l) :id) id)
              (get (first l) :qtd)
              (acha (rest l)))))
    (acha prods)))

(print (str "Qtd Notebook Original: " (buscar-qtd loja 101)))       ;; Deve ser 5
(print (str "Qtd Notebook Novo:     " (buscar-qtd loja-pos-venda 101))) ;; Deve ser 3

;; 4. Teste de Keywords Dinâmicas e Destructuring com :as
(print "\n3. Relatório de item:")
(defn relatorio [{:keys [item preco qtd] :as tudo}]
  (print "--- ITEM ---")
  (print (str "Produto: " item))
  (print (str "Valor Total em Estoque: " (* preco qtd)))
  (print (str "Dados Brutos: " tudo)))

(relatorio (first (get loja-pos-venda :estoque)))

(print "\n=== FIM TESTE ===")