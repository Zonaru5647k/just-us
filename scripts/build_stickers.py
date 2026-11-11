"""Copy stickers/<Tab name>/* into the built site and write stickers/manifest.json.
Each subfolder becomes a tab in the sticker picker. Loose files go under "More".
Usage: python3 scripts/build_stickers.py stickers _site/stickers
"""
import json
import os
import shutil
import sys
from urllib.parse import quote

EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
manifest = {}


def add(tab, folder, files):
    files = sorted(f for f in files if os.path.splitext(f)[1].lower() in EXT)
    if not files:
        return
    dest = os.path.join(out, tab)
    os.makedirs(dest, exist_ok=True)
    for f in files:
        shutil.copy2(os.path.join(folder, f), os.path.join(dest, f))
    manifest.setdefault(tab, []).extend(f"stickers/{quote(tab)}/{quote(f)}" for f in files)


if os.path.isdir(src):
    loose = []
    for name in sorted(os.listdir(src)):
        path = os.path.join(src, name)
        if os.path.isdir(path):
            add(name, path, os.listdir(path))
        else:
            loose.append(name)
    add("More", src, loose)

with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=False)
print("Sticker tabs:", {k: len(v) for k, v in manifest.items()})
