#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Coletor paginado de resultados de licitações (compras.rj.gov.br)

Fluxo implementado:
1) Captura/valida padrão obrigatório do catálogo:
   - Tipo (idTipoRamoAtividade)
   - Família (idFamilia)
   - Classe (idClasse)
   - Artigo (idArtigo)
   - Tipo de Pesquisa (tipoPesquisa_1)
   - Termo do Item (termoPesquisaItem_1)
   - Itens sustentáveis (inSustentavel)

2) Consulta endpoint paginate.action com paginação (até 100 por página)
3) Monta saída no formato esperado (lista de objetos de tabela)

Uso:
  python scripts/resultado_licitacoes_paginado.py --config scripts/catalogo_exemplo.json
"""

from __future__ import annotations

import argparse
import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests

BASE_URL_LISTAR = "https://www.compras.rj.gov.br/EditaisLicitacoes/listar.action?origemIndex=true"
URL_PAGINATE = "https://www.compras.rj.gov.br/EditaisLicitacoes/paginate.action"
TIMEOUT = 60
MAX_PAGE_SIZE = 100

CAMPOS_CATALOGO: Dict[str, str] = {
    "Tipo": "idTipoRamoAtividade",
    "Família": "idFamilia",
    "Classe": "idClasse",
    "Artigo": "idArtigo",
    "Tipo de Pesquisa": "tipoPesquisa_1",
    "Termo do Item": "termoPesquisaItem_1",
    "Itens sustentáveis": "inSustentavel",
}

COLUNAS_TABELA = [
    "Identificador\n\n",
    "Unidade\n\n",
    "Processo\n\n",
    "Objeto\n\n",
    "Modalidade\n\n",
    "Data de Publicação\n\n",
    "Status\n\n",
    "Valor Homologado\n\n",
    "PNCP\n\n",
    "Anexo\n\n",
]


@dataclass
class CatalogoValidacao:
    catalogo: Dict[str, Any]
    valido: bool
    faltando: List[str]


def build_headers() -> Dict[str, str]:
    return {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": BASE_URL_LISTAR,
        "Origin": "https://www.compras.rj.gov.br",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }


def make_base_payload(page_size: int) -> Dict[str, str]:
    payload: Dict[str, str] = {
        "draw": "1",
        "start": "0",
        "length": str(page_size),
        "search[value]": "",
        "search[regex]": "false",
        "order[0][column]": "0",
        "order[0][dir]": "asc",
        "orderColumn": "0",
        "orderDirection": "asc",

        "idLic": "",
        "nuLic": "",
        "objetoLic": "",
        "idStatus": "",
        "processoLic": "",
        "idModalidade": "",
        "idModoDisputa": "",
        "centroCusto": "",
        "idFormaLicitacao": "",
        "dtIniProp": "",
        "dtFimProp": "",
        "dtFimHomol": "",
        "dtIniHomol": "",
        "dtIniPublic": "",
        "dtFimPublic": "",
        "mpe": "",
        "srp": "",

        "idTipoRamoAtividade": "",
        "idFamilia": "",
        "idClasse": "",
        "idArtigo": "",
        "item": "",
        "inSustentavel": "false",
        "tipoPesquisa_1": "",
        "campoPesquisa_1": "",
        "termoPesquisaItem_1": "",
        "tipoPesquisa_2": "",
        "campoPesquisa_2": "",
        "termoPesquisaItem_2": "",
        "condicao_2": "",
        "tipoPesquisa_3": "",
        "campoPesquisa_3": "",
        "termoPesquisaItem_3": "",
        "condicao_3": "",

        "filtroLicitacao": "",
        "filtroUnidade": "",
        "filtroUrlPncp": "",
        "filtroValorHomolog": "",
        "filtroProcesso": "",
        "filtroObjeto": "",
        "filtroModalidade": "",
        "filtroStatus": "",
        "idAndamento": "2",
        "filtroDtPublicacao": "",
    }

    for i in range(10):
        payload[f"columns[{i}][data]"] = str(i)
        payload[f"columns[{i}][name]"] = ""
        payload[f"columns[{i}][searchable]"] = "true"
        payload[f"columns[{i}][orderable]"] = "true"
        payload[f"columns[{i}][search][value]"] = ""
        payload[f"columns[{i}][search][regex]"] = "false"

    return payload


def normalize_bool_str(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    s = str(value).strip().lower()
    if s in {"true", "1", "sim", "yes"}:
        return "true"
    return "false"


def validar_catalogo(payload: Dict[str, Any]) -> CatalogoValidacao:
    faltando: List[str] = []
    catalogo: Dict[str, Any] = {}

    for nome, chave in CAMPOS_CATALOGO.items():
        val = payload.get(chave, "")
        if nome == "Itens sustentáveis":
            val_norm = normalize_bool_str(val)
            catalogo[nome] = val_norm
            if val_norm not in {"true", "false"}:
                faltando.append(nome)
        else:
            val_str = "" if val is None else str(val).strip()
            catalogo[nome] = val_str
            if val_str == "":
                faltando.append(nome)

    return CatalogoValidacao(
        catalogo=catalogo,
        valido=len(faltando) == 0,
        faltando=faltando,
    )


def row_to_obj(row: List[Any]) -> Dict[str, Any]:
    safe = list(row or []) + [""] * max(0, 10 - len(row or []))
    return {
        COLUNAS_TABELA[i]: ("" if safe[i] is None else safe[i])
        for i in range(10)
    }


def fetch_page(session: requests.Session, payload: Dict[str, str], start: int, page_size: int) -> Dict[str, Any]:
    req = deepcopy(payload)
    req["start"] = str(start)
    req["length"] = str(page_size)

    resp = session.post(URL_PAGINATE, data=req, headers=build_headers(), timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def coletar_todas_paginas(payload: Dict[str, str], page_size: int) -> Tuple[List[List[Any]], Dict[str, Any]]:
    session = requests.Session()
    session.get(BASE_URL_LISTAR, headers={"User-Agent": "Mozilla/5.0"}, timeout=TIMEOUT)

    primeira = fetch_page(session, payload, start=0, page_size=page_size)
    total = int(primeira.get("recordsFiltered") or primeira.get("recordsTotal") or 0)

    todas = list(primeira.get("data") or [])

    start = page_size
    while start < total:
        pagina = fetch_page(session, payload, start=start, page_size=page_size)
        bloco = pagina.get("data") or []
        if not bloco:
            break
        todas.extend(bloco)
        start += page_size

    return todas, {
        "recordsFiltered": primeira.get("recordsFiltered"),
        "recordsTotal": primeira.get("recordsTotal"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extrai resultados paginados de licitações")
    parser.add_argument("--config", required=True, help="Caminho do JSON com campos do catálogo")
    parser.add_argument("--output", default="scripts/resultado_paginado.json", help="Arquivo de saída JSON")
    parser.add_argument("--page-size", type=int, default=100, help="Itens por página (máx 100)")
    args = parser.parse_args()

    page_size = min(max(args.page_size, 1), MAX_PAGE_SIZE)

    config_path = Path(args.config)
    if not config_path.exists():
        raise SystemExit(f"Arquivo de config não encontrado: {config_path}")

    cfg = json.loads(config_path.read_text(encoding="utf-8"))
    payload = make_base_payload(page_size)

    # aplica config sobre payload base
    for k, v in cfg.items():
        if k == "inSustentavel":
            payload[k] = normalize_bool_str(v)
        else:
            payload[k] = "" if v is None else str(v)

    validacao = validar_catalogo(payload)
    if not validacao.valido:
        erro = {
            "erro": "Catálogo inválido. O site só aceita pesquisa com todos os campos preenchidos.",
            "catalogo": {
                **validacao.catalogo,
                "_valido": False,
                "_faltando": validacao.faltando,
            },
            "resultado_formatado": [],
        }
        Path(args.output).write_text(json.dumps(erro, ensure_ascii=False, indent=2), encoding="utf-8")
        print("ERRO: catálogo inválido")
        print("Faltando:", ", ".join(validacao.faltando))
        print(f"Saída: {args.output}")
        return

    rows, totals = coletar_todas_paginas(payload, page_size)

    resultado = [{c: "" for c in COLUNAS_TABELA}]  # linha vazia inicial (compatível com esperado)
    resultado.extend(row_to_obj(r) for r in rows)

    saida = {
        "catalogo": {
            **validacao.catalogo,
            "_valido": True,
            "_faltando": [],
        },
        "paginacao": {
            "page_size": page_size,
            "recordsFiltered": totals.get("recordsFiltered"),
            "recordsTotal": totals.get("recordsTotal"),
        },
        "total_registros_extraidos": len(rows),
        "resultado_formatado": resultado,
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(saida, ensure_ascii=False, indent=2), encoding="utf-8")

    print("OK: extração concluída")
    print(f"Registros extraídos: {len(rows)}")
    print(f"Saída: {out_path}")


if __name__ == "__main__":
    main()
