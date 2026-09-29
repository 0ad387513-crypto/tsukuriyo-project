"""画像を容量制限付きWebPへ変換し、ゲームが参照するURLを更新する。"""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PROFILES = {
    "cutin": {"size": (1600, 900), "maxBytes": 300000},
    "sprite": {"size": (720, 720), "maxBytes": 120000},
    "atlas": {"size": (1600, 1600), "maxBytes": 160000},
    "scene": {"size": (1600, 1600), "maxBytes": 300000},
}


def encode_image(source, profile, grid=(1, 1)):
    policy = PROFILES[profile]
    if min(grid) < 1:
        raise ValueError("スプライトの列数・行数は1以上にしてください")
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
        if profile == "cutin":
            if abs(image.width / image.height - 16 / 9) > .01:
                raise ValueError("カットインは16:9の画像を指定してください。自動で切り抜きません")
            image = image.resize(policy["size"], Image.Resampling.LANCZOS)
        else:
            if image.width % grid[0] or image.height % grid[1]:
                raise ValueError("画像サイズがスプライトの列数・行数で割り切れません")
            image.thumbnail(policy["size"], Image.Resampling.LANCZOS)
            size = (image.width // grid[0] * grid[0], image.height // grid[1] * grid[1])
            if min(size) < 1:
                raise ValueError("スプライトのセルが小さすぎます")
            if size != image.size:
                image = image.resize(size, Image.Resampling.LANCZOS)
        for quality in (82, 78, 74, 70, 66, 62):
            buffer = io.BytesIO()
            image.save(buffer, "WEBP", quality=quality, method=6, exact=True)
            data = buffer.getvalue()
            if len(data) <= policy["maxBytes"]:
                return data, image.size, quality
    raise ValueError("画質の下限でも容量制限を超えました。用途に合う解像度・構成を見直してください")


def workspace_path(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("保存先・更新対象はプロジェクト内を指定してください")
    return path


def update_metadata(value, replacements):
    # 生成指示・元画像・旧版の履歴は残し、現行の参照だけ更新する。
    if isinstance(value, dict):
        return {key: item if key.startswith("previous") or key in ("reference", "references", "prompt")
                else update_metadata(item, replacements) for key, item in value.items()}
    if isinstance(value, list):
        return [update_metadata(item, replacements) for item in value]
    return replacements.get(value, value) if isinstance(value, str) else value


def import_asset(source, output, profile, replace=(), grid=(1, 1), root=ROOT):
    root = Path(root).resolve()
    source = Path(source).resolve()
    target = workspace_path(root, output)
    if target.suffix.lower() != ".webp":
        raise ValueError("保存先の拡張子は.webpを指定してください")
    data, size, quality = encode_image(source, profile, grid)
    # 内容を含むURLで、旧画像のキャッシュと混ざらないようにする。
    stem = re.sub(r"-[a-f0-9]{12}$", "", target.stem)
    target = target.with_name(stem + "-" + hashlib.sha256(data).hexdigest()[:12] + ".webp")
    relative = target.relative_to(root).as_posix()
    manifest_file = root / "optimized_assets.json"
    manifest = json.loads(manifest_file.read_text(encoding="utf-8")) if manifest_file.exists() else {}
    key = "import:" + target.parent.relative_to(root).as_posix() + "/" + stem
    old_urls = set(replace)
    if key in manifest:
        old_urls.add(manifest[key]["file"])
    if source.is_relative_to(root):
        old_urls.add(source.relative_to(root).as_posix())
    replacements = {url: relative for url in old_urls if url != relative}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    # 読み込み元・先読み・確認ページを同じURLに揃え、改行コードを保つ。
    references = [*root.glob("*.html"), *root.glob("*.js"), *root.glob("*.css"), root / "_headers",
                  root / "kami_cutin/preview.html"]
    for path in references:
        if not path.is_file():
            continue
        before = path.read_bytes()
        after = before
        for old, new in replacements.items():
            after = after.replace(old.encode("utf-8"), new.encode("utf-8"))
        if after != before:
            path.write_bytes(after)
    metadata_file = root / "kami_cutin/genesis-generation.json"
    if metadata_file.exists():
        before = metadata_file.read_bytes()
        value = update_metadata(json.loads(before), replacements)
        text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        metadata_file.write_bytes(text.replace("\n", "\r\n").encode("utf-8") if b"\r\n" in before else text.encode("utf-8"))
    asset = {"file": relative, "sourceBytes": source.stat().st_size, "bytes": len(data),
             "width": size[0], "height": size[1], "profile": profile, "quality": quality,
             "maxBytes": PROFILES[profile]["maxBytes"], "grid": list(grid),
             "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest()}
    manifest[key] = asset
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return asset


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", required=True, help="保存先の相対パス。内容ハッシュは自動で追加")
    parser.add_argument("--profile", required=True, choices=PROFILES)
    parser.add_argument("--replace", action="append", default=[], help="旧URL。指定した参照を自動更新")
    parser.add_argument("--grid", default="1x1", help="アトラスの列x行。セル境界を維持")
    args = parser.parse_args()
    try:
        grid = tuple(int(n) for n in args.grid.split("x"))
        if len(grid) != 2:
            raise ValueError("--gridは3x2など列x行で指定してください")
        asset = import_asset(args.source, args.output, args.profile, args.replace, grid)
    except (OSError, ValueError) as error:
        parser.exit(1, str(error) + "\n")
    print(json.dumps(asset, ensure_ascii=False))


if __name__ == "__main__":
    main()
