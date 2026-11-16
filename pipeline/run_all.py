# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
"""Run the whole pipeline with one command: parallel downloads, then the exports, the trend test and the check.

    python -m pipeline.run_all                    # everything (same dates as the published results)
    python -m pipeline.run_all --only downloads   # only the downloads (resume a stopped run)
    python -m pipeline.run_all --only exports     # only exports + trend test + verify, from data/interim/
    python -m pipeline.run_all --dry-run          # print the plan and the checks, run nothing
    python -m pipeline.run_all --latest           # download up to the newest month NASA has (results will differ)
    python -m pipeline.run_all --jobs 2           # fewer downloads at the same time (default 4)

What it does:
  1. Checks before starting: Python version, Earthdata credentials (only that they exist, never their content), the
     RAISG zip and the free disk space.
  2. Downloads the 8 sources in parallel (at most --jobs at a time, longest first). Each one writes its own log in
     data/interim/logs/<SOURCE>.log; the progress is printed every few minutes.
  3. Checks every log: download.py and tiles.py list their failed periods at the end, hansen.py prints failed tiles.
     If something failed it stops: run the same command again, finished periods are skipped.
  4. Runs export_json, export_maps, export_api, export_cover, validate, test_trends, trends, export_borders in order.
  5. Runs pipeline.verify (compares every output with the committed version) and prints the time of every step.
     Report: data/interim/logs/verify_report.json. Times: data/interim/logs/run_summary.json.

Dates: by default each source ends at the last month of the published run (15 Nov 2026), so verify compares the same
data. With --latest, months NASA published later are downloaded too and verify will show longer monthly lists.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path

from .config import BOUNDARY_FILES, INTERIM, RAW

ROOT = Path(__file__).resolve().parents[1]
LOGS = INTERIM / "logs"

# Sources of the published run (15 Nov 2026): last period, files kept in data/interim/ and minutes on Windows
# (from the logs of that run; the four monthly products and the tile products ran in parallel).
SOURCES = [
    # name,              module,             args before the dates,         start,     end (published), interim folder, files, minutes
    ("MOD13C2",          "pipeline.download", ["--products", "MOD13C2"],          "2000-01", "2026-10", "MOD13C2",          321, 80),
    ("MCD64A1",          "pipeline.tiles",    ["--product", "MCD64A1"],           "2000-11", "2026-09", "MCD64A1",          311, 61),
    ("HANSEN",           "pipeline.hansen",   [],                                 None,      None,      "HANSEN",           17,  40),
    ("MOD11C3",          "pipeline.download", ["--products", "MOD11C3"],          "2000-01", "2026-10", "MOD11C3",          321, 32),
    ("MOD44B",           "pipeline.tiles",    ["--product", "MOD44B"],            "2000",    "2025",    "MOD44B",           26,  28),
    ("GLDAS_NOAH025_M",  "pipeline.download", ["--products", "GLDAS_NOAH025_M"],  "2000-01", "2026-07", "GLDAS_NOAH025_M",  319, 26),
    ("GPM_3IMERGM",      "pipeline.download", ["--products", "GPM_3IMERGM"],      "2000-01", "2025-09", "GPM_3IMERGM",      309, 23),
    ("GRACE",            "pipeline.grace",    [],                                 None,      None,      "GRACE",            1,   1),
]
EXPORTS = ["export_json", "export_maps", "export_api", "export_cover", "validate", "test_trends", "trends",
           "export_borders"]
MIN_PYTHON = (3, 12)   # the versions pinned in pipeline/requirements.txt need Python 3.12 or later
MIN_FREE_GB = 20


def hms(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}"


def latest_month() -> str:
    """Last complete calendar month."""
    t = date.today()
    y, m = (t.year, t.month - 1) if t.month > 1 else (t.year - 1, 12)
    return f"{y}-{m:02d}"


def command(src, latest: bool) -> list[str]:
    name, module, args, start, end = src[:5]
    if start is None:
        return [sys.executable, "-u", "-m", module, *args]
    if latest:
        end = latest_month() if len(end) == 7 else str(int(latest_month()[:4]) - 1)
    return [sys.executable, "-u", "-m", module, *args, "--start", start, "--end", end]


def files_in(folder: str) -> int:
    p = INTERIM / folder
    return sum(1 for f in p.rglob("*") if f.is_file()) if p.exists() else 0


def check_log(name: str, text: str, code: int) -> str | None:
    """None when the source finished cleanly, otherwise a short reason."""
    if code != 0:
        return f"exit code {code}"
    if name == "HANSEN":
        bad = re.findall(r"(\S+) attempt 3/3 failed", text)
        return f"tiles failed: {bad}" if bad else (None if "wrote " in text else "no 'wrote' line")
    if name == "GRACE":
        return None if "wrote " in text else "no 'wrote' line"
    m = re.findall(r"finished(?:\. \d+ processed, \d+|,) failed: (\[.*?\])", text)
    if not m:
        return "no 'finished' line"
    return None if m[-1] == "[]" else f"failed periods: {m[-1]}"


def preflight(only: str | None) -> list[str]:
    """Problems that would make the run fail later. Prints what it checked."""
    problems = []
    v = sys.version_info
    print(f"Python {v.major}.{v.minor}.{v.micro}: {'ok' if v >= MIN_PYTHON else 'too old'}")
    if v < MIN_PYTHON:
        problems.append(f"Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]} or later is needed (pipeline/requirements.txt).")
    if only != "exports":
        env = bool(os.environ.get("EARTHDATA_TOKEN")) or (bool(os.environ.get("EARTHDATA_USERNAME"))
                                                           and bool(os.environ.get("EARTHDATA_PASSWORD")))
        netrc = any((Path.home() / n).is_file() for n in (".netrc", "_netrc"))
        print(f"Earthdata credentials: {'environment variables' if env else 'netrc file' if netrc else 'NOT FOUND'}")
        if not (env or netrc):
            problems.append("No Earthdata credentials: create the netrc file (pipeline/README.md, Login) or set "
                            "the environment variables EARTHDATA_TOKEN, or EARTHDATA_USERNAME and EARTHDATA_PASSWORD.")
    if only != "downloads":
        raisg = sorted(RAW.rglob(BOUNDARY_FILES["raisg_biome"])) if RAW.exists() else []
        print(f"RAISG zip ({BOUNDARY_FILES['raisg_biome']}): {'found' if raisg else 'NOT FOUND'}")
        if not raisg:
            problems.append(f"Put {BOUNDARY_FILES['raisg_biome']} in data/raw/boundaries/ (manual download, see "
                            f"data/README.md). The exports need it to draw the Amazon.")
    free = shutil.disk_usage(ROOT).free / 1e9
    print(f"Free disk: {free:.0f} GB{'' if free >= MIN_FREE_GB else ' (less than %d GB: risky)' % MIN_FREE_GB}")
    return problems


def run_downloads(jobs: int, latest: bool, every: int, summary: dict) -> bool:
    LOGS.mkdir(parents=True, exist_ok=True)
    queue = list(SOURCES)  # already ordered longest first
    running = {}  # name -> (process, log handle, log offset, start time, source)
    t0 = time.time()
    last_print = 0.0
    print(f"\nDownloads: {len(queue)} sources, {jobs} at a time. Logs in {LOGS}")
    try:
        while queue or running:
            while queue and len(running) < jobs:
                src = queue.pop(0)
                log_path = LOGS / f"{src[0]}.log"
                offset = log_path.stat().st_size if log_path.exists() else 0
                fh = open(log_path, "a", encoding="utf-8")
                fh.write(f"\n=== run_all {datetime.now().isoformat(timespec='seconds')}: {' '.join(command(src, latest)[1:])}\n")
                fh.flush()
                proc = subprocess.Popen(command(src, latest), cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT,
                                        env={**os.environ, "PYTHONIOENCODING": "utf-8"})
                running[src[0]] = (proc, fh, offset, time.time(), src)
                print(f"  started {src[0]} (published run: about {src[7]} min)", flush=True)
            for name, (proc, fh, offset, start, src) in list(running.items()):
                code = proc.poll()
                if code is None:
                    continue
                fh.close()
                with open(LOGS / f"{name}.log", "rb") as f:  # bytes: the offset is a byte count
                    f.seek(offset)
                    text = f.read().decode("utf-8", errors="replace")
                problem = check_log(name, text, code)
                took = time.time() - start
                summary["downloads"][name] = {"seconds": round(took), "ok": problem is None, "problem": problem,
                                              "files": files_in(src[5])}
                print(f"  {'done  ' if problem is None else 'FAILED'} {name} in {hms(took)}"
                      f"{'' if problem is None else ': ' + problem}", flush=True)
                del running[name]
            if running and time.time() - last_print >= every:
                last_print = time.time()
                print(f"[{hms(time.time() - t0)}] running:", flush=True)
                for name, (_, _, _, start, src) in running.items():
                    print(f"    {name:<16} {hms(time.time() - start)}  files {files_in(src[5]):>4} "
                          f"(published run: {src[6]})", flush=True)
            time.sleep(5)
    except KeyboardInterrupt:
        for proc, fh, *_ in running.values():
            proc.terminate()
        for proc, fh, *_ in running.values():
            try:
                proc.wait(timeout=20)
            except subprocess.TimeoutExpired:
                proc.kill()
            fh.close()
        print("\nStopped. Run the same command again: finished months and tiles are skipped.")
        raise
    summary["downloadSeconds"] = round(time.time() - t0)
    failed = [n for n, r in summary["downloads"].items() if not r["ok"]]
    print(f"Downloads finished in {hms(time.time() - t0)}." + (f" FAILED: {failed}" if failed else ""))
    return not failed


def run_exports(summary: dict) -> bool:
    print("\nExports, trend test and borders (in order):")
    for step in EXPORTS:
        start = time.time()
        print(f"\n--- pipeline.{step}", flush=True)
        code = subprocess.call([sys.executable, "-u", "-m", f"pipeline.{step}"], cwd=ROOT)
        summary["exports"][step] = {"seconds": round(time.time() - start), "ok": code == 0}
        if code != 0:
            print(f"pipeline.{step} FAILED (exit code {code}). Fix it and run: python -m pipeline.run_all --only exports")
            return False
    return True


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--only", choices=["downloads", "exports"], help="run only one part")
    p.add_argument("--jobs", type=int, default=4, help="downloads at the same time (default 4)")
    p.add_argument("--latest", action="store_true", help="download up to the last complete month (not the published dates)")
    p.add_argument("--every", type=int, default=120, help="seconds between progress lines (default 120)")
    p.add_argument("--dry-run", action="store_true", help="print the checks and the plan, run nothing")
    a = p.parse_args(argv)

    print("SIGNO pipeline: checks before starting")
    problems = preflight(a.only)
    print("\nPlan:")
    if a.only != "exports":
        for src in SOURCES:
            print("  " + " ".join(command(src, a.latest)[3:]))
    if a.only != "downloads":
        print("  then: " + ", ".join(EXPORTS) + ", verify")
    if problems:
        print("\nCannot start:\n- " + "\n- ".join(problems))
        return 2
    if a.dry_run:
        return 0

    LOGS.mkdir(parents=True, exist_ok=True)
    summary = {"started": datetime.now().isoformat(timespec="seconds"), "latest": a.latest, "jobs": a.jobs,
               "downloads": {}, "exports": {}}
    t0 = time.time()
    ok = True
    if a.only != "exports":
        ok = run_downloads(a.jobs, a.latest, a.every, summary)
        if not ok:
            print("Run the same command again: finished periods are skipped and only the failed ones are retried.")
    if ok and a.only != "downloads":
        ok = run_exports(summary)
        if ok:
            print("\n--- pipeline.verify", flush=True)
            start = time.time()
            code = subprocess.call([sys.executable, "-u", "-m", "pipeline.verify", "--report",
                                    str(LOGS / "verify_report.json")], cwd=ROOT)
            summary["verify"] = {"seconds": round(time.time() - start), "exitCode": code,
                                 "result": "no DIFFERENT file" if code == 0 else "some files DIFFERENT: read the report"}
    summary["totalSeconds"] = round(time.time() - t0)
    (LOGS / "run_summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")

    print("\nTime per step:")
    for name, r in summary["downloads"].items():
        print(f"  {name:<16} {hms(r['seconds'])}  {'ok' if r['ok'] else 'FAILED'}")
    for name, r in summary["exports"].items():
        print(f"  {name:<16} {hms(r['seconds'])}  {'ok' if r['ok'] else 'FAILED'}")
    if "verify" in summary:
        print(f"  {'verify':<16} {hms(summary['verify']['seconds'])}  {summary['verify']['result']}")
    print(f"  {'TOTAL':<16} {hms(summary['totalSeconds'])}")
    print(f"Summary: {LOGS / 'run_summary.json'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
