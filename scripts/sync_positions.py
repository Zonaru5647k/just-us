"""Turn positions/*.txt into position cards in Supabase.

File name decides who sees the cards (not case-sensitive):
  he.txt, he (1).txt, he 2.txt ...   -> only Shima
  she.txt, she (1).txt, she2.txt ... -> only Tima
  anything else                      -> both

Inside a file: every line in quotes becomes a card, and the last short
heading line above it becomes the card title. If a file has no quoted
lines, every non-empty line becomes a card titled after the file.
"""
import glob
import json
import os
import re
import urllib.request

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SECRET_KEY"]
HEADERS = {"apikey": KEY, "Content-Type": "application/json", "Prefer": "return=minimal"}
if KEY.startswith("eyJ"):  # legacy service_role JWT
    HEADERS["Authorization"] = "Bearer " + KEY

QUOTED = re.compile(r'^["“](.+?)["”]$')


def audience(filename):
    n = os.path.basename(filename).lower()
    if re.match(r"^she(?![a-z])", n):
        return "she"
    if re.match(r"^he(?![a-z])", n):
        return "he"
    return "both"


def parse(text, fallback):
    cards, heading = [], fallback
    lines = [l.strip() for l in text.splitlines()]
    for line in lines:
        if not line:
            continue
        m = QUOTED.match(line)
        if m:
            cards.append((heading, m.group(1).strip()))
        elif len(line) <= 48 and not re.search(r"[.?!:]$", line) and not line.lower().startswith("http"):
            heading = line
    if not cards:
        cards = [(fallback, l) for l in lines if l and not l.lower().startswith("http")]
    return cards


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req) as r:
        r.read()


rows = []
for f in sorted(glob.glob("positions/**/*.txt", recursive=True)):
    title = os.path.splitext(os.path.basename(f))[0]
    with open(f, encoding="utf-8", errors="replace") as fh:
        for head, body in parse(fh.read(), title):
            rows.append({"audience": audience(f), "title": head[:80], "body": body[:1000],
                         "source": "repo", "sort": len(rows)})

call("DELETE", "/rest/v1/positions?source=eq.repo")
for i in range(0, len(rows), 500):
    call("POST", "/rest/v1/positions", rows[i:i + 500])

counts = {a: sum(r["audience"] == a for r in rows) for a in ("he", "she", "both")}
print(f"Synced {len(rows)} cards: {counts}")
