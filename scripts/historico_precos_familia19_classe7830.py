#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Coletor de histórico de preços (compras.rj.gov.br) para
Família 19 / Classe 7830 (Banco de Preço Histórico).

Correções aplicadas em relação à primeira versão:
- TLS habilitado (sem `verify=False`) — a Regra de Ouro 6 do projeto exige
  TLS ativo em qualquer chamada a endpoint externo.
- Timeout e retry com backoff em toda requisição HTTP.
- Checkpoint incremental (salva progresso a cada N artigos), para não
  perder tudo já coletado se o processo cair no meio do run.
- try/except por artigo: uma falha isolada é logada e pulada, não derruba
  o script inteiro.
- Falha de rede/parsing é distinguida de "sem transação real" — não usa
  mais o mesmo `origem_dado` para os dois casos.
- Pausa entre requisições para não martelar o servidor.
- Caminho de saída relativo à raiz do repo em vez de caminho absoluto do
  Windows.
- As três tabelas (Compras Diretas, Licitações, Atas) são extraídas por
  uma única função, em vez de três blocos quase idênticos.

Uso:
  python scripts/historico_precos_familia19_classe7830.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.compras.rj.gov.br"
URL_CATALOGO_ARTIGO = f"{BASE_URL}/Catalogo/carregaArtigo.action"
URL_PAGINATE_HISTORICO = f"{BASE_URL}/BancoDePrecoHistorico/paginate.action"
URL_DETALHAR_HISTORICO = f"{BASE_URL}/BancoDePrecoHistorico/detalhar.action"

ID_TIPO = "1"
ID_FAMILIA = "19"
ID_CLASSE = "7830"
NOME_SISTEMA_ORIGEM = "Compras Públicas Sistema Integrado de Gestão de Aquisições"

TIMEOUT = 60
MAX_TENTATIVAS = 3
BACKOFF_INICIAL_S = 2
DELAY_ENTRE_REQUISICOES_S = 0.3
CHECKPOINT_A_CADA = 20
COLUNAS_MINIMAS_TRANSACAO = 7

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
JSON_PATH = REPO_ROOT / "itens_precos_2025.json"
CSV_PATH = REPO_ROOT / "historico_precos_2025.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
}


def criar_sessao() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)
    return session


def requisicao_com_retry(
    session: requests.Session,
    method: str,
    url: str,
    *,
    contexto: str,
    falhas: List[Dict[str, Any]],
    **kwargs: Any,
) -> Optional[requests.Response]:
    """GET/POST com timeout e retry exponencial. Retorna None (e loga em
    `falhas`) se todas as tentativas falharem, em vez de derrubar o script."""
    kwargs.setdefault("timeout", TIMEOUT)
    for tentativa in range(1, MAX_TENTATIVAS + 1):
        try:
            resp = session.request(method, url, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as exc:
            if tentativa == MAX_TENTATIVAS:
                msg = f"Falha definitiva em {method} {url} ({contexto}): {exc}"
                print(f"[ERRO] {msg}", flush=True)
                falhas.append({"contexto": contexto, "erro": msg})
                return None
            espera = BACKOFF_INICIAL_S * (2 ** (tentativa - 1))
            print(
                f"[AVISO] Tentativa {tentativa}/{MAX_TENTATIVAS} falhou em {contexto} "
                f"({exc}). Retentando em {espera}s...",
                flush=True,
            )
            time.sleep(espera)
    return None


def obter_json(
    resp: Optional[requests.Response], *, contexto: str, falhas: List[Dict[str, Any]]
) -> Optional[Any]:
    if resp is None:
        return None
    try:
        return resp.json()
    except ValueError as exc:
        msg = f"Resposta não é JSON válido ({contexto}): {exc}"
        print(f"[ERRO] {msg}", flush=True)
        falhas.append({"contexto": contexto, "erro": msg})
        return None


def extrair_linhas_tabela(
    soup: BeautifulSoup,
    table_id: str,
    origem_dado: str,
    contexto_linha: Dict[str, Any],
    *,
    contexto_log: str,
    falhas: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    tabela = soup.find("table", {"id": table_id})
    if not tabela or not tabela.find("tbody"):
        return []

    linhas: List[Dict[str, Any]] = []
    for tr in tabela.find("tbody").find_all("tr"):
        tds = [td.get_text(strip=True) for td in tr.find_all("td")]
        if not tds or "nenhum" in tds[0].lower():
            continue
        if len(tds) < COLUNAS_MINIMAS_TRANSACAO:
            msg = (
                f"Linha com {len(tds)} colunas (esperado >= {COLUNAS_MINIMAS_TRANSACAO}) "
                f"em {table_id} - {contexto_log}. Pulando para não misturar campos."
            )
            print(f"[AVISO] {msg}", flush=True)
            falhas.append({"contexto": contexto_log, "erro": msg})
            continue

        linhas.append(
            {
                **contexto_linha,
                "origem_dado": origem_dado,
                "numero_processo": tds[0],
                "modalidade_tipo": tds[1],
                "orgao": tds[2],
                "fornecedor": tds[3],
                "dt_registro": tds[4],
                "quantidade": tds[5],
                "valor_unitario": tds[6],
                "numero_contratacao": tds[7] if len(tds) > 7 else "",
            }
        )
    return linhas


def salvar_saida(dados: List[Dict[str, Any]], *, parcial: bool) -> None:
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

    df = pd.DataFrame(dados)
    df.to_csv(CSV_PATH, index=False, encoding="utf-8-sig")

    rotulo = "[CHECKPOINT]" if parcial else "[OK]"
    print(f"{rotulo} {len(dados)} registros salvos em {JSON_PATH.name} e {CSV_PATH.name}", flush=True)


def main() -> None:
    session = criar_sessao()
    falhas: List[Dict[str, Any]] = []
    dados_finais: List[Dict[str, Any]] = []

    print(f"1. Carregando catálogo de artigos para Família {ID_FAMILIA} - Classe {ID_CLASSE}...", flush=True)
    resp_art = requisicao_com_retry(
        session,
        "GET",
        URL_CATALOGO_ARTIGO,
        params={
            "ramoAtividade.idTipo": ID_TIPO,
            "ramoAtividade.idFamilia": ID_FAMILIA,
            "ramoAtividade.idClasse": ID_CLASSE,
        },
        contexto="carregaArtigo",
        falhas=falhas,
    )
    catalogo = obter_json(resp_art, contexto="carregaArtigo", falhas=falhas)
    if catalogo is None:
        raise SystemExit(
            "Não foi possível carregar o catálogo de artigos — abortando "
            "(veja o [ERRO] acima). Nada foi escrito em disco."
        )

    artigos = catalogo.get("listarArtigo", [])
    print(f"Total de artigos encontrados no catálogo: {len(artigos)}", flush=True)

    for idx, art in enumerate(artigos, 1):
        try:
            art_id = str(art["idArtigo"])
            art_nome = art.get("artigo", "")
        except KeyError as exc:
            msg = f"Artigo {idx} sem campo esperado: {exc}"
            print(f"[ERRO] {msg}", flush=True)
            falhas.append({"contexto": f"artigo idx={idx}", "erro": msg})
            continue

        try:
            resp_pag = requisicao_com_retry(
                session,
                "POST",
                URL_PAGINATE_HISTORICO,
                data={
                    "draw": "1",
                    "start": "0",
                    "length": "100",
                    "orderColumn": "0",
                    "orderDirection": "asc",
                    "idTipo": ID_TIPO,
                    "idFamilia": ID_FAMILIA,
                    "idClasse": ID_CLASSE,
                    "idArtigo": art_id,
                },
                contexto=f"paginate artigo={art_id}",
                falhas=falhas,
            )
            time.sleep(DELAY_ENTRE_REQUISICOES_S)

            pagina = obter_json(resp_pag, contexto=f"paginate artigo={art_id}", falhas=falhas)
            falha_ao_buscar_itens = resp_pag is None or pagina is None
            items = pagina.get("data", []) if pagina else []

            artigo_tem_transacao = False

            for it in items:
                item_id = str(it[0])
                item_desc = it[2] if len(it) > 2 else ""

                resp_det = requisicao_com_retry(
                    session,
                    "POST",
                    URL_DETALHAR_HISTORICO,
                    data={
                        "filtro.idTipo": ID_TIPO,
                        "filtro.idFamilia": ID_FAMILIA,
                        "filtro.idClasse": ID_CLASSE,
                        "filtro.idArtigo": art_id,
                        "filtro.idItem": item_id,
                        "filtro.dtInicioStr": "",
                        "filtro.dtFimStr": "",
                    },
                    contexto=f"detalhar artigo={art_id} item={item_id}",
                    falhas=falhas,
                )
                time.sleep(DELAY_ENTRE_REQUISICOES_S)

                if resp_det is None:
                    continue

                soup = BeautifulSoup(resp_det.text, "html.parser")
                contexto_linha = {
                    "id_familia": ID_FAMILIA,
                    "id_classe": ID_CLASSE,
                    "id_artigo": art_id,
                    "id_item": item_id,
                    "coluna_1": art_id,
                    "coluna_2": ID_CLASSE,
                    "coluna_3": NOME_SISTEMA_ORIGEM,
                    "descricao_artigo": art_nome,
                    "descricao_item": item_desc,
                }

                for table_id, origem in (
                    ("dataTableComprasDiretas", "Compras Diretas"),
                    ("dataTableLicitacoes", "Licitações"),
                    ("dataTableAtas", "Atas de Registro de Preço"),
                ):
                    linhas = extrair_linhas_tabela(
                        soup,
                        table_id,
                        origem,
                        contexto_linha,
                        contexto_log=f"artigo={art_id} item={item_id}",
                        falhas=falhas,
                    )
                    if linhas:
                        artigo_tem_transacao = True
                        dados_finais.extend(linhas)

            if not artigo_tem_transacao:
                first_item_id = str(items[0][0]) if items else art_id
                first_item_desc = items[0][2] if items and len(items[0]) > 2 else art_nome
                dados_finais.append(
                    {
                        "id_familia": ID_FAMILIA,
                        "id_classe": ID_CLASSE,
                        "id_artigo": art_id,
                        "id_item": first_item_id,
                        "coluna_1": art_id,
                        "coluna_2": ID_CLASSE,
                        "coluna_3": NOME_SISTEMA_ORIGEM,
                        "descricao_artigo": art_nome,
                        "descricao_item": first_item_desc,
                        "origem_dado": "Falha ao Consultar Itens" if falha_ao_buscar_itens else "Catálogo SIAP",
                        "numero_processo": "N/A",
                        "modalidade_tipo": "N/A",
                        "orgao": "N/A",
                        "fornecedor": "N/A",
                        "dt_registro": "N/A",
                        "quantidade": "0",
                        "valor_unitario": "R$ 0,00",
                        "numero_contratacao": "N/A",
                    }
                )
        except Exception as exc:  # noqa: BLE001 - não deixar um artigo derrubar o run inteiro
            msg = f"Falha inesperada no artigo {art_id}: {exc}"
            print(f"[ERRO] {msg}", flush=True)
            falhas.append({"contexto": f"artigo={art_id}", "erro": msg})
            continue

        print(
            f"[{idx}/{len(artigos)}] Artigo ID {art_id} ({art_nome[:25]}) | "
            f"Total de registros acumulados: {len(dados_finais)}",
            flush=True,
        )

        if idx % CHECKPOINT_A_CADA == 0:
            salvar_saida(dados_finais, parcial=True)

    print(f"\n[SUCESSO] Total final de registros extraídos: {len(dados_finais)}", flush=True)
    if falhas:
        print(f"[AVISO] {len(falhas)} falhas registradas durante o run (ver abaixo).", flush=True)
        for f in falhas:
            print(f"  - {f['contexto']}: {f['erro']}", flush=True)

    salvar_saida(dados_finais, parcial=False)


if __name__ == "__main__":
    main()
