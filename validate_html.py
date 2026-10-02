import os
import re
from html.parser import HTMLParser

project_dir = os.path.dirname(os.path.abspath(__file__))

class SimpleHTMLValidator(HTMLParser):
    def __init__(self, file_path):
        super().__init__()
        self.file_path = file_path
        self.ids = []
        self.srcs = []
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if 'id' in attr_dict:
            self.ids.append(attr_dict['id'])
        if tag in ['img', 'script'] and 'src' in attr_dict:
            self.srcs.append(attr_dict['src'])
        if tag in ['a', 'link'] and 'href' in attr_dict:
            self.hrefs.append(attr_dict['href'])

def validate_html_files():
    html_files = []
    for root, _, files in os.walk(project_dir):
        # Skip .git, node_modules, and dist
        if '.git' in root or 'node_modules' in root or 'dist' in root or '.ai-session' in root:
            continue
        for file in files:
            if file.endswith('.html'):
                html_files.append(os.path.join(root, file))

    issues = []

    for file_path in html_files:
        rel_path = os.path.relpath(file_path, project_dir)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(f"[{rel_path}] Could not read file: {e}")
            continue

        parser = SimpleHTMLValidator(file_path)
        parser.feed(content)

        # Check duplicate IDs
        duplicates = set([x for x in parser.ids if parser.ids.count(x) > 1])
        if duplicates:
            issues.append(f"[{rel_path}] Duplicate IDs found: {', '.join(duplicates)}")

        # Check src attributes
        for src in parser.srcs:
            if src and not src.startswith(('http:', 'https:', '//', 'data:', 'mailto:', 'tel:')):
                clean_src = src.split('?')[0].split('#')[0]
                if clean_src.startswith('/'):
                    asset_path = os.path.join(project_dir, clean_src.lstrip('/'))
                else:
                    asset_path = os.path.join(os.path.dirname(file_path), clean_src)
                if not os.path.exists(asset_path):
                    issues.append(f"[{rel_path}] Missing asset (src): {src}")

        # Check href attributes
        for href in parser.hrefs:
            if href and not href.startswith(('http:', 'https:', '//', 'mailto:', 'tel:', '#', 'javascript:')):
                clean_href = href.split('?')[0].split('#')[0]
                if not clean_href:
                    continue
                if clean_href.startswith('/'):
                    asset_path = os.path.join(project_dir, clean_href.lstrip('/'))
                else:
                    asset_path = os.path.join(os.path.dirname(file_path), clean_href)
                if not os.path.exists(asset_path):
                    issues.append(f"[{rel_path}] Broken link (href): {href}")

    if not issues:
        print("[SUCCESS] HTML validation passed successfully (No duplicate IDs, missing assets, or broken links).")
        return 0
    else:
        print("[ERROR] HTML validation found issues:")
        for issue in issues:
            print(" -", issue)
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(validate_html_files())
