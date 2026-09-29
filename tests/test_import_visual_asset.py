"""画像追加時の容量・透過・参照更新を確認する。"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location("import_visual_asset", Path(__file__).resolve().parent.parent / "scripts/import_visual_asset.py")
optimizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optimizer)


class VisualImportTest(unittest.TestCase):
    def test_transparency_and_live_references_survive_import(self):
        with tempfile.TemporaryDirectory(prefix="tsukuriyo-image-import-test-") as directory:
            root = Path(directory)
            source = root / "fan.png"
            image = Image.new("RGBA", (960, 960), (0, 0, 0, 0))
            image.paste((240, 215, 170, 150), (200, 200, 760, 760))
            image.save(source)
            (root / "divine_effects.js").write_bytes(b"url='divine_assets/old.webp';\r\n")
            (root / "kami_cutin").mkdir()
            metadata = {"assets": {"6": "divine_assets/old.webp"}, "revisions": [{"asset": "divine_assets/old.webp", "reference": "divine_assets/old.webp", "previousRevisions": [{"asset": "divine_assets/old.webp"}]}]}
            (root / "kami_cutin/genesis-generation.json").write_text(json.dumps(metadata))
            result = optimizer.import_asset(source, "divine_assets/fan.webp", "sprite", ["divine_assets/old.webp"], root=root)
            self.assertLessEqual(result["bytes"], 120000)
            with Image.open(root / result["file"]) as output:
                self.assertEqual(output.size, (720, 720))
                self.assertEqual(output.getpixel((0, 0))[3], 0)
                self.assertGreater(output.getpixel((360, 360))[3], 0)
                self.assertLess(output.getpixel((360, 360))[3], 255)
            self.assertIn(result["file"].encode(), (root / "divine_effects.js").read_bytes())
            self.assertTrue((root / "divine_effects.js").read_bytes().endswith(b"\r\n"))
            updated = json.loads((root / "kami_cutin/genesis-generation.json").read_text())
            self.assertEqual(updated["assets"]["6"], result["file"])
            self.assertEqual(updated["revisions"][0]["asset"], result["file"])
            self.assertEqual(updated["revisions"][0]["reference"], "divine_assets/old.webp")
            self.assertEqual(updated["revisions"][0]["previousRevisions"][0]["asset"], "divine_assets/old.webp")

    def test_atlas_cells_stay_aligned(self):
        with tempfile.TemporaryDirectory(prefix="tsukuriyo-image-import-test-") as directory:
            source = Path(directory) / "atlas.png"
            Image.new("RGBA", (2048, 1536), (220, 200, 170, 100)).save(source)
            data, size, quality = optimizer.encode_image(source, "atlas", (4, 3))
            self.assertEqual(size, (1600, 1200))
            self.assertLessEqual(len(data), 160000)
            self.assertGreaterEqual(quality, 62)

    def test_rejects_outside_output_and_wrong_cutin_shape(self):
        with tempfile.TemporaryDirectory(prefix="tsukuriyo-image-import-test-") as directory:
            root = Path(directory)
            source = root / "square.png"
            Image.new("RGB", (320, 320), "red").save(source)
            with self.assertRaises(ValueError):
                optimizer.import_asset(source, "../outside.webp", "sprite", root=root)
            with self.assertRaises(ValueError):
                optimizer.encode_image(source, "cutin")
            self.assertFalse((root / "optimized_assets.json").exists())


if __name__ == "__main__":
    unittest.main()
