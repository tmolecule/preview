#!/usr/bin/env python3
"""TMolecule WCAG 2.1 AA audit via axe-core.
Saves a dated JSON report to ~/tmolecule/audits/axe-YYYY-MM-DD.json and prints a summary to stdout.
"""
import sys, json, os
from datetime import date
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'https://tmolecule.com'
PAGES = [
    ('/', 'Home'),
    ('/collections/all', 'Shop'),
    ('/products/spice-rush-collagen-black-tea', 'Product'),
    ('/cart', 'Cart'),
    ('/pages/about', 'About'),
    ('/pages/contact', 'Contact'),
    ('/pages/accessibility', 'Accessibility'),
]
AXE_CDN = 'https://cdn.jsdelivr.net/npm/axe-core@4.10.0/axe.min.js'

today = date.today().isoformat()
out_dir = Path.home() / 'tmolecule' / 'audits'
out_dir.mkdir(parents=True, exist_ok=True)
out_path = out_dir / f'axe-{today}.json'

result = {'date': today, 'base': BASE, 'pages': {}, 'totals': {'critical':0, 'serious':0, 'moderate':0, 'minor':0}}

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width':1280, 'height':900})
    page = ctx.new_page()
    for path, name in PAGES:
        url = BASE + path
        try:
            page.goto(url, wait_until='domcontentloaded', timeout=45000)
            page.wait_for_timeout(1500)
            page.add_script_tag(url=AXE_CDN)
            page.wait_for_function("typeof axe !== 'undefined'", timeout=10000)
            axe = page.evaluate("""() => axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] }
            })""")
        except Exception as e:
            result['pages'][name] = {'url': url, 'error': str(e)[:200]}
            continue
        v = axe.get('violations', [])
        page_totals = {'critical':0, 'serious':0, 'moderate':0, 'minor':0}
        for item in v:
            imp = item.get('impact') or 'minor'
            count = len(item.get('nodes', []))
            page_totals[imp] = page_totals.get(imp, 0) + count
            result['totals'][imp] = result['totals'].get(imp, 0) + count
        result['pages'][name] = {
            'url': url,
            'totals': page_totals,
            'violations': [{
                'id': i['id'],
                'impact': i.get('impact'),
                'help': i['help'],
                'helpUrl': i.get('helpUrl'),
                'count': len(i.get('nodes', [])),
                'sample_targets': [n.get('target') for n in i.get('nodes', [])[:3]],
            } for i in v],
        }
    b.close()

with open(out_path, 'w') as f:
    json.dump(result, f, indent=2, default=str)

# Print summary
t = result['totals']
print(f"TMolecule accessibility audit — {today}")
print(f"{'Page':20} {'critical':10} {'serious':10} {'moderate':10} {'minor':8}")
for name, data in result['pages'].items():
    if 'error' in data:
        print(f"  {name:20} ERROR: {data['error']}")
        continue
    pt = data['totals']
    print(f"  {name:20} {pt['critical']:<10} {pt['serious']:<10} {pt['moderate']:<10} {pt['minor']:<8}")
print(f"\nTOTAL                {t['critical']:<10} {t['serious']:<10} {t['moderate']:<10} {t['minor']:<8}")
print(f"\nReport saved: {out_path}")

# Exit code: 1 if any critical/serious, else 0
sys.exit(1 if t['critical'] + t['serious'] > 0 else 0)
