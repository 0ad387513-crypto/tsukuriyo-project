"""配信用WebPを作成する。元のPNG・解像度・透過を保持し、内容のハッシュをURLに使う。"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "optimized_assets.json"


def main():
    previous = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    sources = sorted((ROOT / "divine_assets").glob("*.png"))
    sources += sorted((ROOT / "ui_cinematics").glob("*.png"))
    sources += [ROOT / "top_mode_icons" / "construct2p-battle.png"]
    sources += [ROOT / "kami_cutin" / "susanoo-resolve.png"]
    # 個別の更新でも全体の記録を残す。引数なしなら全素材を再生成する。
    if len(sys.argv) > 1:
        sources = [source for source in sources if source.stem in sys.argv[1:]]
    assets = dict(previous)
    for source in sources:
        source_key = source.relative_to(ROOT).as_posix()
        with Image.open(source) as image:
            # スプライトのセル境界と透過を変えない。縮小は行わない。
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            target = source.with_suffix(".webp")
            image.save(target, "WEBP", quality=90, method=6, exact=True)
            digest = hashlib.sha256(target.read_bytes()).hexdigest()[:12]
            hashed_target = target.with_name(f"{target.stem}-{digest}.webp")
            target.replace(hashed_target)
            assets[source_key] = {
                "file": hashed_target.relative_to(ROOT).as_posix(),
                "sourceBytes": source.stat().st_size,
                "bytes": hashed_target.stat().st_size,
                "width": image.width,
                "height": image.height,
                "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            }
    # 以前の軽量化URLも置き換えるので、元画像を更新した場合に旧キャッシュを参照しない。
    for filename in ["index.html", "divine_effects.js", "divine_effects.css", "effects_preview.html", "tests/asset_contract.test.js", "tests/index_contract.test.js"]:
        path = ROOT / filename
        original = path.read_bytes().decode("utf-8")
        updated = original
        for source, asset in assets.items():
            if source in previous:
                updated = updated.replace(previous[source]["file"], asset["file"])
            updated = updated.replace(source, asset["file"])
        if updated != original:
            path.write_bytes(updated.encode("utf-8"))
    MANIFEST.write_text(json.dumps(assets, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    before = sum(asset["sourceBytes"] for asset in assets.values())
    after = sum(asset["bytes"] for asset in assets.values())
    print(f"{len(assets)} images: {before:,} -> {after:,} bytes ({100 * (1-after/before):.1f}% reduction)")


if __name__ == "__main__":
    main()
