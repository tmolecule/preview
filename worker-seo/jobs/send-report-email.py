#!/usr/bin/env python3
"""Send a markdown report as an HTML email via Resend.

Usage:
    send-report-email.py <markdown-path> <subject> [preamble]

Required env:
    RESEND_API_KEY       Resend API key (re_...)

Optional env:
    REPORT_TO_EMAIL      Recipient (default: support@tmolecule.com)
    REPORT_FROM_EMAIL    From address (default: support@tmolecule.com)
    REPORT_FROM_NAME     From display name (default: TMolecule Insights)
    DRY_RUN              If "1" or "true", print payload instead of sending
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request


def md_to_html(md: str) -> str:
    """Lossy markdown -> HTML for plain reports.

    Highlights any 'Action Items' / 'Next moves' / 'Recommended next moves'
    section in a yellow callout block.
    """
    md = re.sub(
        r'(?ms)^(#{2,3}\s+(?:Action Items?|Recommended next moves?|Next moves?)\b.*?)(?=^#{1,3}\s|\Z)',
        lambda m: (
            '<div style="background:#fff8e1;border-left:4px solid #f0ad4e;'
            'padding:14px 18px;margin:18px 0;border-radius:4px;">'
            + m.group(1) +
            '</div>'
        ),
        md,
    )

    html = md
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.M)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.M)
    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.M)
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'(?<!\*)\*([^\*\n]+?)\*(?!\*)', r'<em>\1</em>', html)
    html = re.sub(r'`([^`\n]+?)`', r'<code>\1</code>', html)
    html = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', html)

    def wrap_list(match: re.Match[str]) -> str:
        items = [line[2:].strip() for line in match.group(0).strip().split('\n') if line.startswith('- ')]
        return '<ul>' + ''.join(f'<li>{item}</li>' for item in items) + '</ul>\n'

    html = re.sub(r'(?:^- .+\n?)+', wrap_list, html, flags=re.M)

    def wrap_table(match: re.Match[str]) -> str:
        lines = [ln for ln in match.group(0).strip().split('\n') if ln.strip()]
        if len(lines) < 2:
            return match.group(0)
        rows = [[c.strip() for c in ln.strip().strip('|').split('|')] for ln in lines]
        if not re.match(r'^[\s\-:|]+$', '|'.join(rows[1])):
            return match.group(0)
        head = rows[0]
        body = rows[2:]
        thead = '<thead><tr>' + ''.join(f'<th style="text-align:left;border-bottom:2px solid #1a1a17;padding:8px 10px;">{c}</th>' for c in head) + '</tr></thead>'
        tbody = '<tbody>' + ''.join(
            '<tr>' + ''.join(f'<td style="border-bottom:1px solid #e8e1d2;padding:8px 10px;">{c}</td>' for c in r) + '</tr>'
            for r in body
        ) + '</tbody>'
        return f'<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;">{thead}{tbody}</table>'

    html = re.sub(r'(?m)(^\|.+\|$\n^\|[\s\-:|]+\|$\n(?:^\|.+\|$\n?)+)', wrap_table, html)

    parts: list[str] = []
    for chunk in re.split(r'\n{2,}', html):
        if re.match(r'\s*<(h\d|ul|ol|li|div|p|table|blockquote|pre)', chunk):
            parts.append(chunk)
        elif chunk.strip():
            parts.append(f'<p>{chunk.strip()}</p>')
    return '\n'.join(parts)


def build_email(
    md_path: str,
    subject: str,
    preamble: str,
    from_email: str,
    from_name: str,
    to_email: str,
) -> dict:
    with open(md_path, 'r', encoding='utf-8') as fh:
        md = fh.read()

    body_html = md_to_html(md)

    preamble_html = ''
    if preamble:
        preamble_html = (
            '<div style="color:#555;font-size:14px;line-height:1.6;'
            'border-bottom:1px solid #e8e1d2;padding-bottom:14px;margin-bottom:22px;">'
            f'{preamble}</div>'
        )

    full_html = (
        '<html><body style="font-family:-apple-system,BlinkMacSystemFont,'
        'Segoe UI,sans-serif;max-width:680px;margin:0 auto;padding:28px;'
        'color:#1a1a17;line-height:1.6;background:#faf7f0;">'
        f'{preamble_html}{body_html}'
        '<hr style="margin:32px 0 16px;border:0;border-top:1px solid #e8e1d2;">'
        '<p style="color:#999;font-size:12px;">'
        'Sent automatically by the TMolecule insights pipeline.'
        '</p>'
        '</body></html>'
    )

    return {
        'from': f'{from_name} <{from_email}>',
        'to': [to_email],
        'subject': subject,
        'html': full_html,
    }


def send(payload: dict, api_key: str) -> None:
    req = urllib.request.Request(
        'https://api.resend.com/emails',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f'Sent: HTTP {resp.status} {resp.read().decode("utf-8")}')
    except urllib.error.HTTPError as exc:
        print(f'Resend error: HTTP {exc.code} {exc.read().decode("utf-8")}', file=sys.stderr)
        sys.exit(2)
    except urllib.error.URLError as exc:
        print(f'Network error: {exc}', file=sys.stderr)
        sys.exit(2)


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(64)

    md_path = sys.argv[1]
    subject = sys.argv[2]
    preamble = sys.argv[3] if len(sys.argv) > 3 else ''

    if not os.path.isfile(md_path):
        print(f'Report file not found: {md_path}', file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get('RESEND_API_KEY')
    if not api_key:
        print(
            'RESEND_API_KEY not set. Add it to ~/.env.resend as:\n'
            '    RESEND_API_KEY=re_...\n'
            'or export it before running.',
            file=sys.stderr,
        )
        sys.exit(1)

    payload = build_email(
        md_path=md_path,
        subject=subject,
        preamble=preamble,
        from_email=os.environ.get('REPORT_FROM_EMAIL', 'support@tmolecule.com'),
        from_name=os.environ.get('REPORT_FROM_NAME', 'TMolecule Insights'),
        to_email=os.environ.get('REPORT_TO_EMAIL', 'support@tmolecule.com'),
    )

    if os.environ.get('DRY_RUN', '').lower() in ('1', 'true'):
        print(json.dumps(payload, indent=2))
        return

    send(payload, api_key)


if __name__ == '__main__':
    main()
