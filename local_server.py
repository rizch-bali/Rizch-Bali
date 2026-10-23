#!/usr/bin/env python3
"""Server lokal RizchBali dengan dukungan rewrite dari vercel.json.
Menjaga URL di address bar, seperti rewrite Vercel, tanpa mengubah CMS.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, unquote
import json
import re
import sys

ROOT = Path(__file__).resolve().parent
PORT = 8000


def load_rules():
    config_path = ROOT / "vercel.json"
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
        return config.get("rewrites", [])
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Peringatan: vercel.json tidak dapat dibaca ({exc}).", file=sys.stderr)
        return []


def apply_rewrite(request_target):
    parts = urlsplit(request_target)
    path = parts.path or "/"
    rules = load_rules()
    for rule in rules:
        source = rule.get("source", "")
        destination = rule.get("destination", "")
        if not source or not destination:
            continue
        names = re.findall(r":([A-Za-z_][A-Za-z0-9_]*)", source)
        regex = re.escape(source)
        for name in names:
            regex = regex.replace(":" + name, f"(?P<{name}>[^/]+)")
        match = re.fullmatch(regex, path)
        if not match:
            continue
        target = destination
        for name, value in match.groupdict().items():
            target = target.replace(":" + name, value)
        dest = urlsplit(target)
        # Query dari destination (mis. ?slug=:slug) menjadi query tujuan.
        # Jika destination tidak menetapkan query, pertahankan query pengguna.
        query = dest.query if dest.query else parts.query
        return urlunsplit(("", "", dest.path or path, query, ""))
    return request_target


class RizchBaliHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _rewrite_unless_static_file(self, request_target):
        """Serve existing assets first; only rewrite non-file URLs such as content slugs."""
        parts = urlsplit(request_target)
        path = unquote(parts.path or "/")
        candidate = (ROOT / path.lstrip("/ ")).resolve()
        try:
            candidate.relative_to(ROOT)
            is_static_file = candidate.is_file()
        except ValueError:
            is_static_file = False
        if is_static_file:
            return request_target
        return apply_rewrite(request_target)

    def do_GET(self):
        original = self.path
        rewritten = self._rewrite_unless_static_file(original)
        self.path = rewritten
        if rewritten != original:
            print(f"[rewrite] {urlsplit(original).path} -> {rewritten}")
        try:
            super().do_GET()
        finally:
            self.path = original

    def do_HEAD(self):
        original = self.path
        rewritten = self._rewrite_unless_static_file(original)
        self.path = rewritten
        try:
            super().do_HEAD()
        finally:
            self.path = original

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), RizchBaliHandler)
    except OSError as exc:
        print(f"Gagal menjalankan server di port {PORT}: {exc}")
        print("Tutup server lokal lama yang memakai port 8000, lalu jalankan kembali file ini.")
        input("Tekan Enter untuk keluar...")
        raise SystemExit(1)
    print(f"RizchBali berjalan di http://localhost:{PORT}")
    print("Routing dari vercel.json aktif. Tekan Ctrl+C untuk menghentikan server.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer RizchBali dihentikan.")
    finally:
        server.server_close()
