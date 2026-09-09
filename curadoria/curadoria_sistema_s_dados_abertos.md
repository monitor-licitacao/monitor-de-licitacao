# Curadoria nacional: fontes de dados abertos/compras do Sistema S (SESI, SENAI, SESC, SEST/SENAT)  
  
Acompanha o arquivo `sistema_s_fontes_dados_abertos.csv` (26 linhas, uma por entidade/UF) para importar direto no seu Conectores ou na base do RAG.  
  
## 3 achados estruturais (mais importantes que qualquer URL isolada)  
  
**1. Nenhum dos 4 sistemas tem API nacional única — exceto SEST/SENAT, que já nasce nacional.**  
SESI e SENAI são geridos por federação estadual (FIESP, FIEMG, FIERGS, Sistema FIEP, FIEB, FIEPE...), cada uma com seu próprio subdomínio de transparência. SESC segue o mesmo padrão por Federação do Comércio estadual. Existe uma camada "Departamento Nacional" para SESI e SENAI em `portaldaindustria.com.br` (CNI) e para o SESC em `sesc.com.br` — mas ela cobre as compras feitas pelo *órgão nacional*, não substitui os 27 portais estaduais.  
  
**2. Achado mais valioso para o seu scraper: consolidação de fornecedor de tecnologia.**  
Pelo menos estes portais transacionais de compras rodam sobre a mesma plataforma que você já reverse-engenheirou nesta conversa para o SEST SENAT (Paradigma Business Solutions — `Mural.aspx`, postback ASP.NET, `trListaMuralProcesso_Click`, `btAcao_Click`, `btBaixaAnexo(idProcesso, idAnexo)`):  
- SEST/SENAT nacional — `compras.sestsenat.org.br`  
- SESC Departamento Nacional — `egov-br.paradigmabs.com.br/sescdn`  
- SESC-SP — `scr360.paradigmabs.com.br/sescsp`  
- SESC+SENAC-RS (portal conjunto) — `egov.paradigmabs.com.br/sesc_senac_rs`  
- SESI+SENAI-RS (FIERGS) — `compras.sistemafiergs.org.br`  
  
Isso significa que o mesmo módulo Playwright que você já tem para SEST SENAT provavelmente funciona nesses outros 4 com troca só do tenant/domínio — é o maior ganho de produtividade que essa curadoria trouxe. Vale rodar o "Testar Conector" da sua própria ferramenta contra cada um antes de assumir 100% de compatibilidade.  
  
**3. "Dados Abertos" nem sempre significa "dados de compras".**  
Testei ao vivo a API de dados abertos do SESC-CE (`transparencia-ce.sesc.com.br/.../dados_abertos/177/webservice`) — é uma API JSON real, paginada, funcional — mas o dataset 177 é "vagas e atividades gratuitas", não licitação/despesa. Já a do SESI Santa Catarina (`transparencia.sesisc.org.br/dados-abertos`) confirma catálogo com "despesas por processos de compra", "processos licitatórios" e "contratos" — essa sim relevante. Conclusão prática: cada domínio "dados abertos" tem seu próprio catálogo de datasets com IDs próprios; não dá para presumir cobertura, é preciso listar o catálogo de cada um antes de plugar no RAG.  
  
## Nota sobre PNCP  
Sistema S não é obrigado por lei a publicar no PNCP (regem-se pelo próprio Regulamento de Licitações e Contratos, não pela Lei 14.133) — confirmamos isso também na análise do texto do edital SEST SENAT nesta conversa ("havendo divergência entre o descritivo do PNCP e o edital, prevalecerá a regra editalícia"). Trate o PNCP como fonte cruzada/complementar quando o próprio edital citar um número PNCP, nunca como fonte primária para Sistema S.  
  
## Limitação desta rodada  
Fetch direto (WebFetch) e navegação de browser ficaram temporariamente indisponíveis por limite de infraestrutura durante a pesquisa (janela de ~1h). As linhas marcadas "confiança: Média" no CSV vieram de snippet de busca, não de inspeção direta do HTML/JSON — antes de cadastrar como conector definitivo, rode uma checagem HTTP real (como o seu próprio "Testar Conector") em cada uma. As linhas "Alta" foram testadas ao vivo nesta sessão (SEST SENAT, SESC-SP, SESC-CE).  
