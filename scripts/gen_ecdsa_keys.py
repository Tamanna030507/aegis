"""
ECDSA Key Generation Script for Surgical Passport signing.
Run once before deployment: python scripts/gen_ecdsa_keys.py
Outputs base64-encoded PEM keys ready to paste into .env
"""
import base64
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend


def generate_keys():
    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    private_b64 = base64.b64encode(private_pem).decode()
    public_b64 = base64.b64encode(public_pem).decode()

    print("=" * 60)
    print("AEGIS ECDSA Key Pair Generated")
    print("Copy the following into your .env file:")
    print("=" * 60)
    print(f"AEGIS_ECDSA_PRIVATE_KEY={private_b64}")
    print(f"AEGIS_ECDSA_PUBLIC_KEY={public_b64}")
    print("=" * 60)
    print("IMPORTANT: Keep AEGIS_ECDSA_PRIVATE_KEY secret. Never commit to git.")


if __name__ == "__main__":
    generate_keys()
