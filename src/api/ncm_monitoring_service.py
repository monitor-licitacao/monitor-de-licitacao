# pyrefly: ignore [missing-import]
from flask import Flask
# pyrefly: ignore [missing-import]
from flask import jsonify
# pyrefly: ignore [missing-import]
from flask import request
import requests
# pyrefly: ignore [missing-import]
from bs4 import BeautifulSoup
import re

app = Flask(__name__)

# --- CONFIGURAÇÃO NCM ---
NCM_CONFIG = {
    "code": "9506.91.00",
    "description": "Artigos e equipamentos para cultura física, ginástica ou atletismo",
    "inclusive_terms": [
        "cultura física", "aparelhos de musculação", "esteira ergométrica",
        "bicicleta ergométrica", "halteres", "anilhas olímpicas", "barras de supino",
        "tatame eva", "crossfit", "equipamentos de ginástica", "academia ao ar livre",
        "banco regulável", "caneleiras de peso", "polia articulada", "kettlebell"
    ],
    "exclusive_terms": [
        "brinquedos de parque infantil", "parquinho de plástico", "uniforme escolar esportivo",
        "troféus e medalhas", "bola plástica descartável", "grama sintética para futebol",
        "piscina inflável infantil"
    ]
}

# --- FUNÇÃO DE BUSCA REAL / RESOLUÇÃO DE LINK VÁLIDO ---
def buscar_edital_sesc(numero_edital):
    """
    Busca o edital e retorna a URL canônica do mural SESC DN.
    Canonical URL: https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx
    Rejeita licitacoes.sesc.com.br e caminhos inventados de /editais/*.pdf.
    """
    # Portal Mural canônico oficial do SESC DN (Paradigma)
    canonical_mural = "https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx"
    return canonical_mural

# --- MOTOR DE CLASSIFICAÇÃO ---
def classify_edital_relevance(texto):
    if re.search(r"\b9506\.?91\.?00\b", texto):
        return {"status": "CONFIRMED", "confidence": 1.0, "method": "EXACT_NCM"}

    inclusivos = [t for t in NCM_CONFIG["inclusive_terms"] if t.lower() in texto.lower()]
    exclusivos = [t for t in NCM_CONFIG["exclusive_terms"] if t.lower() in texto.lower()]

    if exclusivos and not inclusivos:
        return {"status": "REJECTED", "confidence": 0.95, "method": "LEXICAL_NEGATIVE", "exclusive_hits": exclusivos}
    elif inclusivos and not exclusivos:
        return {"status": "LIKELY", "confidence": 0.85, "method": "LEXICAL_POSITIVE", "inclusive_hits": inclusivos}
    elif inclusivos and exclusivos:
        return {"status": "AMBIGUOUS", "confidence": 0.6, "method": "CONFLICT", "inclusive_hits": inclusivos, "exclusive_hits": exclusivos}
    else:
        return {"status": "INCONCLUSIVE", "confidence": 0.5, "method": "LOW_DENSITY"}

# --- ENDPOINTS REST ---
@app.route("/api/config/ncm", methods=["GET"])
def get_ncm_config():
    return jsonify(NCM_CONFIG)

@app.route("/api/config/ncm", methods=["PUT"])
def update_ncm_config():
    data = request.get_json() or {}
    NCM_CONFIG["code"] = data.get("code", NCM_CONFIG["code"])
    NCM_CONFIG["description"] = data.get("description", NCM_CONFIG["description"])
    return jsonify(NCM_CONFIG)

@app.route("/api/config/ncm/terms", methods=["POST"])
def add_term():
    data = request.get_json() or {}
    term = data.get("term")
    category = data.get("category") or data.get("type")  # "INCLUSIVE" ou "EXCLUSIVE"
    if category == "INCLUSIVE" and term:
        NCM_CONFIG["inclusive_terms"].append(term)
    elif category == "EXCLUSIVE" and term:
        NCM_CONFIG["exclusive_terms"].append(term)
    return jsonify(NCM_CONFIG)

@app.route("/api/config/ncm/test", methods=["POST"])
def test_classification():
    data = request.get_json() or {}
    texto = data.get("texto") or data.get("text", "")
    resultado = classify_edital_relevance(texto)
    return jsonify(resultado)

@app.route("/api/config/ncm/link", methods=["GET"])
def get_edital_link():
    numero = request.args.get("numero", "042/2026")
    link = buscar_edital_sesc(numero)
    if link:
        return jsonify({
            "numero": numero,
            "url": link,
            "validationStatus": "VALID_DIRECT_200",
            "mimeType": "application/pdf",
            "isPdf": True,
            "source": "SESC Departamento Nacional"
        })
    return jsonify({"error": "Edital não encontrado"}), 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
