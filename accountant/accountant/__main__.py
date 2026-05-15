"""CLI: parse receipts, append to Sheets, or run the local web UI."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _run_add(args: argparse.Namespace) -> int:
    from accountant.gemini import parse_receipt_image
    from accountant.sheets_ops import add_record_to_sheet, check_duplicate

    record = parse_receipt_image(args.image)
    if args.dry_run:
        print(json.dumps(record, ensure_ascii=False, indent=2))
        return 0

    dup, existing_date = check_duplicate(record["place"], record["total"])
    if dup and not args.force:
        print(
            f"Duplicate: same place and total already on {existing_date}. "
            "Use --force to append anyway.",
            file=sys.stderr,
        )
        return 1

    add_record_to_sheet(record)
    print(json.dumps(record, ensure_ascii=False, indent=2))
    print("Appended to sheet.")
    return 0


def _run_serve(args: argparse.Namespace) -> int:
    import uvicorn

    uvicorn.run(
        "accountant.server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Receipt parser → Google Sheet.")
    sub = parser.add_subparsers(dest="command", required=False, metavar="command")

    p_add = sub.add_parser("add", help="Parse an image and append one row")
    p_add.add_argument("image", type=Path, help="Path to receipt image (JPEG/PNG/WebP)")
    p_add.add_argument(
        "--dry-run",
        action="store_true",
        help="Only call Gemini and print JSON; do not touch the sheet.",
    )
    p_add.add_argument(
        "--force",
        action="store_true",
        help="Append even if the same place+total already exists.",
    )
    p_add.set_defaults(_run=_run_add)

    p_serve = sub.add_parser(
        "serve",
        help="Start API (default :8765). Run frontend separately: cd frontend && npm run dev",
    )
    p_serve.add_argument(
        "--host",
        default="0.0.0.0",
        help="Bind address (default: 0.0.0.0 — all interfaces; use 127.0.0.1 for local only)",
    )
    p_serve.add_argument("--port", type=int, default=8765, help="Port (default: 8765)")
    p_serve.add_argument(
        "--reload",
        action="store_true",
        help="Auto-reload on code changes (dev only)",
    )
    p_serve.set_defaults(_run=_run_serve)

    args = parser.parse_args(argv)
    if args.command is None:
        parser.print_help()
        return 0
    return args._run(args)


if __name__ == "__main__":
    raise SystemExit(main())
