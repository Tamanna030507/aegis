"""
AEGIS Pre-Demo Health Checklist
Run: python scripts/preflight.py
Every item must be OK before demoing to judges.
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv()


def check(label: str, passed: bool, fix: str = "") -> bool:
    icon = "OK " if passed else "FAIL"
    print(f"  [{icon}]  {label}")
    if not passed and fix:
        print(f"         -> {fix}")
    return passed


async def run():
    print("\n  AEGIS Pre-Demo Preflight Checklist\n")
    results = []

    # 1. Env vars
    print("-- Environment -----------------------------------------")
    results.append(check("GEMINI_API_KEY set",
        bool(os.getenv("GEMINI_API_KEY")),
        "Set GEMINI_API_KEY in .env — get it at aistudio.google.com"))
    results.append(check("ECDSA private key set",
        bool(os.getenv("AEGIS_ECDSA_PRIVATE_KEY")),
        "Run: python scripts/gen_ecdsa_keys.py"))
    has_callmebot = bool(os.getenv("CALLMEBOT_PHONE")) and bool(os.getenv("CALLMEBOT_APIKEY"))
    has_twilio    = bool(os.getenv("TWILIO_ACCOUNT_SID")) and bool(os.getenv("TWILIO_AUTH_TOKEN"))
    results.append(check("WhatsApp provider configured (CallMeBot or Twilio)",
        has_callmebot or has_twilio,
        "Set CALLMEBOT_PHONE + CALLMEBOT_APIKEY in .env (free) or Twilio creds"))

    # 2. Gemini API
    print("\n-- AI API ----------------------------------------------")
    try:
        import google.generativeai as genai
        from backend.config import GEMINI_MODEL
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel(GEMINI_MODEL)
        resp  = model.generate_content("Reply with exactly the word: AEGIS_OK")
        results.append(check(f"Gemini API live ({GEMINI_MODEL})",
            "AEGIS_OK" in resp.text,
            "Check API key at aistudio.google.com"))
    except Exception as e:
        results.append(check(f"Gemini API ({str(e)[:60]})", False,
            "Check GEMINI_API_KEY and GEMINI_MODEL in .env / config.py"))

    # 3. Database + Patient 0047
    print("\n-- Data ------------------------------------------------")
    try:
        # Must import ALL models before querying to resolve SQLAlchemy relationships
        from backend.database import SessionLocal
        import backend.models.patient   # noqa
        import backend.models.checkin   # noqa
        import backend.models.risk      # noqa
        import backend.models.passport  # noqa
        from backend.models.patient import Patient
        db = SessionLocal()
        p = db.query(Patient).filter(Patient.id == "0047").first()
        results.append(check("Patient 0047 in database", p is not None,
            "Run: python scripts/seed_demo.py"))
        db.close()
    except Exception as e:
        results.append(check(f"Database accessible ({str(e)[:60]})", False,
            "Check DATABASE_URL in .env"))

    # 4. ML model
    print("\n-- ML Model --------------------------------------------")
    pkl = Path("ml/cascade_model/model.pkl")
    results.append(check("model.pkl exists", pkl.exists(),
        "Run: python -m ml.cascade_model.train"))
    if pkl.exists():
        try:
            import pickle, numpy as np
            with open(pkl, "rb") as f:
                m = pickle.load(f)
            x = np.array([[1.14, -8.0, 6.8, 5.0, 1, 0.3]])
            probs = [e.predict_proba(x)[0][1] for e in m.estimators_]
            results.append(check(
                f"model.pkl predicts (SSI={probs[3]:.2f})",
                all(0 <= p2 <= 1 for p2 in probs),
                "Retrain: python -m ml.cascade_model.train"))
        except Exception as e:
            results.append(check(f"model.pkl valid ({str(e)[:40]})", False))

    # 5. Demo assets
    print("\n-- Demo Assets -----------------------------------------")
    qr_files = list(Path("static/qr").glob("passport_0047_*.png"))
    results.append(check(f"Patient 0047 QR code ({len(qr_files)} file(s))",
        len(qr_files) > 0,
        "Run: python scripts/seed_demo.py"))

    # 6. Audio deps
    print("\n-- Audio Dependencies ----------------------------------")
    try:
        import librosa, soundfile
        results.append(check(f"librosa {librosa.__version__} + soundfile {soundfile.__version__}", True))
    except ImportError as e:
        results.append(check(f"Audio deps ({e})", False,
            "pip install librosa soundfile"))

    # Summary
    passed = sum(results)
    total  = len(results)
    print(f"\n{'='*52}")
    print(f"  {passed}/{total} checks passed")
    if passed == total:
        print("  ALL SYSTEMS GO -- ready to demo\n")
    else:
        print(f"  {total - passed} issue(s) need fixing before demo\n")
    return passed == total


if __name__ == "__main__":
    ok = asyncio.run(run())
    sys.exit(0 if ok else 1)
