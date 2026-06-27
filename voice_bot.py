from openai import OpenAI
import speech_recognition as sr
import edge_tts
import asyncio
import pygame
import os
import sys
import tempfile
import threading
import time
from dotenv import load_dotenv

# Configurer l'encodage de la console sous Windows en UTF-8 pour éviter les UnicodeEncodeError
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

# ==============================
# CONFIG
# ==============================
API_KEY  = os.environ.get("GROQ_API_KEY")  
BASE_URL = "https://api.groq.com/openai/v1"
MODEL    = "llama-3.3-70b-versatile"
SEUIL_VOIX = 300  # sensibilité micro (augmente si trop sensible)

DEMO_MODE = False
if not API_KEY:
    DEMO_MODE = True
    print("⚠️  GROQ_API_KEY non définie dans le fichier .env — Mode démo activé.")
    print("   Pour activer l'IA réelle, ajoutez votre clé dans le fichier .env (GROQ_API_KEY=gsk_...)")
    client = None
else:
    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

SYSTEM_PROMPT = """Tu es EduIA, un professeur virtuel intelligent dédié aux élèves du système éducatif ivoirien.

TON RÔLE :
Tu es un professeur complet, bienveillant et pédagogue. Tu maîtrises toutes les matières du programme scolaire et tu enrichis toujours tes réponses avec de la culture générale.

TES MATIÈRES DISPONIBLES :
1. Mathématiques
2. Physique-Chimie
3. SVT
4. Philosophie
5. Français
6. Culture Générale

SYSTÈME DE SALLE DE CLASSE (TRÈS IMPORTANT) :
Au début de chaque conversation, tu demandes à l'élève de choisir sa matière.
Une fois la matière choisie, tu BLOQUES toute question hors de cette matière.

Exemple de blocage :
- Élève en FRANÇAIS qui pose une question de maths → tu réponds :
"Tu es actuellement en cours de Français. Les questions de Mathématiques ne sont pas autorisées ici.
Dis ou tape 'changer' pour changer de matière."

CHANGER DE MATIÈRE :
Si l'élève dit ou tape 'changer', tu affiches à nouveau le menu et tu réinitialises la session.

TA MÉTHODE DE RÉPONSE (toujours dans cet ordre) :
- Explication — claire et simple
- Exemple concret — contexte ivoirien si possible
- Exercice — une question pour s'entraîner
- Le savais-tu ? — un fait de culture générale
- Conseil — une astuce pour progresser

TES RÈGLES :
- À chaque début, affiche le menu des matières
- Tu réponds TOUJOURS en français
- Tu bloques STRICTEMENT toute question hors matière choisie
- Tes réponses vocales sont courtes et claires
- Tu encourage toujours l'élève à la fin"""


# ==============================
# ÉTAT GLOBAL
# ==============================
ia_parle = threading.Event()  # True quand l'IA parle
interrompu = threading.Event()  # True quand l'élève coupe la parole


# ==============================
# SURVEILLANCE DU MICRO (thread)
# ==============================
def surveiller_micro():
    """Écoute en permanence le micro et coupe l'IA si une voix est détectée"""
    recognizer = sr.Recognizer()
    recognizer.energy_threshold = SEUIL_VOIX
    recognizer.dynamic_energy_threshold = False

    with sr.Microphone() as source:
        while True:
            if ia_parle.is_set():
                try:
                    # écoute courte pour détecter une voix
                    audio = recognizer.listen(source, timeout=0.5, phrase_time_limit=1)
                    # si on arrive ici, une voix a été détectée → on coupe
                    pygame.mixer.music.stop()
                    interrompu.set()
                    print("\n[Interruption détectée]")
                except:
                    pass
            else:
                time.sleep(0.1)


# ==============================
# PARLER AVEC COUPURE
# ==============================
async def _generer_audio(texte, chemin):
    """Génère le fichier audio avec edge-tts"""
    communicate = edge_tts.Communicate(texte, voice="fr-FR-DeniseNeural")
    await communicate.save(chemin)

def parler(texte):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            chemin = f.name

        # génération audio (edge-tts)
        asyncio.run(_generer_audio(texte, chemin))

        interrompu.clear()
        ia_parle.set()

        pygame.mixer.music.load(chemin)
        pygame.mixer.music.play()

        # attendre fin ou interruption
        while pygame.mixer.music.get_busy():
            if interrompu.is_set():
                pygame.mixer.music.stop()
                break
            pygame.time.Clock().tick(10)

        ia_parle.clear()
        pygame.mixer.music.unload()
        os.remove(chemin)

    except Exception as e:
        ia_parle.clear()
        print(f"[Erreur voix] {e}")


# ==============================
# ÉCOUTER L'ÉLÈVE
# ==============================
def ecouter():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("🎤 Parle maintenant...")
        recognizer.adjust_for_ambient_noise(source, duration=1)
        try:
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
            texte = recognizer.recognize_google(audio, language="fr-FR")
            print(f"Toi : {texte}")
            return texte
        except sr.WaitTimeoutError:
            print("⏱ Aucune voix détectée.")
            return ""
        except sr.UnknownValueError:
            print("❓ Voix non comprise, réessaie.")
            return ""
        except Exception as e:
            print(f"[Erreur micro] {e}")
            return ""


# ==============================
# ENVOYER À L'IA
# ==============================
def envoyer(question):
    global historique

    if question.lower() == "changer":
        historique.clear()
        historique.append({"role": "system", "content": SYSTEM_PROMPT})

    historique.append({"role": "user", "content": question})

    if DEMO_MODE:
        demo = (
            f"Salut ! Je suis Akwaba, ton tuteur IA. "
            f"Je suis en maintenance pour le moment et je ne peux pas te répondre. "
            f"En attendant, tu peux lire les cours et faire les exercices. "
            f"Je serai bientôt de retour pour t'aider !"
        )
        historique.append({"role": "assistant", "content": demo})
        return demo

    try:
        response = client.chat.completions.create(model=MODEL, messages=historique)
        reponse_ia = response.choices[0].message.content
        historique.append({"role": "assistant", "content": reponse_ia})
        return reponse_ia
    except Exception as e:
        return f"Erreur : {e}"


# ==============================
# DÉMARRAGE
# ==============================
pygame.mixer.init()
historique = [{"role": "system", "content": SYSTEM_PROMPT}]

print("\n" + "=" * 50)
print("        EduIA — Professeur virtuel")
print("=" * 50)
print("\nComment veux-tu interagir ?")
print("  1 — Clavier (taper)")
print("  2 — Microphone (parler + coupure de parole)")

while True:
    choix = input("\nTon choix [1 ou 2] : ").strip()
    if choix in ("1", "2"):
        break
    print("Tape 1 ou 2.")

MODE_VOCAL = choix == "2"
print(f"\n✅ Mode {'vocal (tu peux couper la parole à tout moment)' if MODE_VOCAL else 'clavier'} activé.")
print("Dis ou tape 'quitter' pour arrêter.\n")
print("=" * 50 + "\n")

# Lancer la surveillance micro en arrière-plan (mode vocal uniquement)
if MODE_VOCAL:
    t = threading.Thread(target=surveiller_micro, daemon=True)
    t.start()

# Premier message
reponse_ia = envoyer("Bonjour")
print(f"IA : {reponse_ia}\n")
if MODE_VOCAL:
    parler(reponse_ia)


# ==============================
# BOUCLE PRINCIPALE
# ==============================
while True:
    if MODE_VOCAL:
        # si interruption → écouter directement sans attendre
        if interrompu.is_set():
            interrompu.clear()
        question = ecouter()
    else:
        question = input("Toi : ").strip()

    if not question:
        continue

    if question.lower() in ("quitter", "quit", "exit", "q"):
        msg = "Au revoir ! Bon courage dans tes études."
        print(f"\nIA : {msg}")
        if MODE_VOCAL:
            parler(msg)
        break

    reponse_ia = envoyer(question)
    print(f"\nIA : {reponse_ia}\n")
    if MODE_VOCAL:
        parler(reponse_ia)
