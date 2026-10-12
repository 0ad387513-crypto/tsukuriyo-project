"""Inline the comparison viewer so local and future shared pages stay portable."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY = ROOT / 'kami_redesign'
css = (DIRECTORY / 'comparison-viewer.css').read_text(encoding='utf-8')
js = (DIRECTORY / 'comparison-viewer.js').read_text(encoding='utf-8')
style = f'<!-- comparison-viewer-style:start -->\n<style>\n{css}</style>\n<!-- comparison-viewer-style:end -->'
script = f'<!-- comparison-viewer-script:start -->\n<script>\n{js}</script>\n<!-- comparison-viewer-script:end -->'
for page in sorted(DIRECTORY.glob('*preview.html')):
    html = page.read_text(encoding='utf-8')
    html = re.sub(r'<!-- comparison-viewer-style:start -->.*?<!-- comparison-viewer-style:end -->\s*', '', html, flags=re.S)
    html = re.sub(r'<!-- comparison-viewer-script:start -->.*?<!-- comparison-viewer-script:end -->\s*', '', html, flags=re.S)
    html = html.replace('</head>', style + '\n</head>').replace('</body>', script + '\n</body>')
    page.write_text(html, encoding='utf-8')
    print(page.name)
