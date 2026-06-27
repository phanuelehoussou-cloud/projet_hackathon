import os
import re
from flask import Flask, request, jsonify, Response
from openai import OpenAI
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

ROOT = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)

# ── CLÉ API ───────────────────────────────────────────────────────────────
# Priorité à la variable d'environnement. Sinon, colle ta clé ci-dessous.
GROQ_API_KEY_FALLBACK = ""          # ← (optionnel) colle ici ta NOUVELLE clé gsk_...
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", GROQ_API_KEY_FALLBACK)

BASE_URL = "https://api.groq.com/openai/v1"
MODEL    = "llama-3.3-70b-versatile"

client = OpenAI(api_key=GROQ_API_KEY, base_url=BASE_URL) if GROQ_API_KEY else None


@app.route("/")
def home():
    """Sert index.html en basculant le frontend en mode 'backend'."""
    with open(os.path.join(ROOT, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
    html = re.sub(r'mode:\s*"direct"', 'mode: "backend"', html)
    return Response(html, mimetype="text/html")


@app.route("/api/message", methods=["POST"])
def message():
    """Proxy sécurisé vers l'API Groq (format OpenAI)."""
    if not client:
        return jsonify({"error": "Clé API manquante. Définis GROQ_API_KEY dans le fichier .env."}), 500

    data = request.get_json(force=True)

    # Le frontend envoie {system, messages}. Groq (format OpenAI) attend
    # le system comme premier message du tableau.
    messages = []
    if data.get("system"):
        messages.append({"role": "system", "content": data["system"]})
    messages += data.get("messages", [])

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_tokens=int(data.get("max_tokens", 1000)),
            temperature=0.6,
        )
        return jsonify({"text": resp.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 502


if __name__ == "__main__":
    if not GROQ_API_KEY:
        print("⚠️  GROQ_API_KEY non définie dans le fichier .env — l'IA ne répondra pas.")
    print("➡  Mon École IA → http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
