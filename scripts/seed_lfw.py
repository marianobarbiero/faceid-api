"""Seed the face DB with one photo per person from LFW (Labeled Faces in the Wild).

Each person is registered through POST /register under a made-up name and email, so
the real LFW identities are never stored. The pick is random but reproducible (--seed).

Usage (backend running):
    python scripts/seed_lfw.py --lfw-dir path/to/lfw_funneled --count 1000

Download LFW first, e.g. https://ndownloader.figshare.com/files/5976015 (lfw-funneled.tgz).
"""

import argparse
import base64
import json
import random
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

FIRST_NAMES = [
    "Sofía", "Mateo", "Valentina", "Santiago", "Isabella", "Benjamín", "Camila", "Lucas", "Martina", "Joaquín",
    "Lucía", "Tomás", "Emilia", "Thiago", "Victoria", "Bautista", "Catalina", "Felipe", "Julieta", "Agustín",
    "Mía", "Nicolás", "Renata", "Facundo", "Florencia", "Ignacio", "Abril", "Lautaro", "Paula", "Franco",
    "Carolina", "Gonzalo", "Antonella", "Matías", "Delfina", "Federico", "Agustina", "Ramiro", "Milagros", "Pablo",
    "Daniela", "Andrés", "Mariana", "Diego", "Gabriela", "Sebastián", "Laura", "Javier", "Natalia", "Esteban",
]
LAST_NAMES = [
    "González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "García", "Sánchez",
    "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Acosta", "Benítez", "Medina",
    "Suárez", "Herrera", "Aguirre", "Pereyra", "Gutiérrez", "Giménez", "Molina", "Silva", "Castro", "Rojas",
    "Ortiz", "Núñez", "Luna", "Juárez", "Cabrera", "Ríos", "Ferreyra", "Godoy", "Morales", "Domínguez",
    "Moreno", "Peralta", "Vega", "Carrizo", "Quiroga", "Ponce", "Vera", "Ledesma", "Figueroa", "Ojeda",
]


def ascii_slug(text: str) -> str:
    table = str.maketrans("áéíóúüñÁÉÍÓÚÜÑ", "aeiouunAEIOUUN")
    return text.translate(table).lower().replace(" ", "")


def read_api_key(env_path: Path) -> str:
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"API_KEY not found in {env_path}")


def pick_people(lfw_dir: Path, count: int, rng: random.Random) -> list[Path]:
    people = sorted(p for p in lfw_dir.iterdir() if p.is_dir())
    if len(people) < count:
        raise SystemExit(f"LFW has only {len(people)} people, asked for {count}")
    chosen = rng.sample(people, count)
    # One photo per person (randomly chosen among theirs)
    return [rng.choice(sorted(person.glob("*.jpg"))) for person in chosen]


def fake_identity(index: int, rng: random.Random, used: set[str]) -> tuple[str, str]:
    while True:
        first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        full_name = f"{first} {last}"
        email = f"{ascii_slug(first)}.{ascii_slug(last)}.{index:04d}@example.com"
        if email not in used:
            used.add(email)
            return full_name, email


def register(api_url: str, api_key: str, payload: dict) -> tuple[int, str]:
    req = urllib.request.Request(
        f"{api_url}/register",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "X-API-Key": api_key},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, ""
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")[:200]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--lfw-dir", type=Path, required=True)
    parser.add_argument("--count", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--api-url", default="http://127.0.0.1:8000")
    parser.add_argument("--env", type=Path, default=Path(".env"))
    args = parser.parse_args()

    api_key = read_api_key(args.env)
    rng = random.Random(args.seed)
    photos = pick_people(args.lfw_dir, args.count, rng)
    used: set[str] = set()

    ok, failed = 0, []
    start = time.perf_counter()
    for i, photo in enumerate(photos, 1):
        full_name, email = fake_identity(i, rng, used)
        payload = {
            "img": base64.b64encode(photo.read_bytes()).decode(),
            "full_name": full_name,
            "email": email,
            "external_id": f"seed-{i:04d}",
        }
        status, detail = register(args.api_url, api_key, payload)
        if status == 201:
            ok += 1
        else:
            failed.append((i, status, detail))
        if i % 50 == 0 or i == len(photos):
            elapsed = time.perf_counter() - start
            print(f"{i}/{len(photos)}  ok={ok}  failed={len(failed)}  {elapsed:.0f}s  ({elapsed / i:.2f}s/each)", flush=True)

    for i, status, detail in failed:
        print(f"  #{i}: HTTP {status} {detail}", file=sys.stderr)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
