# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
"""Reproducibility check: compare the pipeline outputs on disk with a reference copy.

The reference is, by default, the version committed in git HEAD (extracted with `git archive`, so the working tree is
not touched). Run it after re-running the pipeline (locally or in Colab) to see whether the same results came out.

    python -m pipeline.verify                         # compare with the files committed in git HEAD
    python -m pipeline.verify --ref /path/to/SIGNO    # compare with another copy of the repository
    python -m pipeline.verify --report verify.json    # also save every difference found

Compared: every JSON file in web/server/data/ and web/public/data/, and the PNG map layers in web/public/data/maps/.
Ignored: the run timestamps (generatedUtc, generated_utc, generatedAt).

Result per file:
  IDENTICAL         same content.
  ROUNDING          only numbers differ, and by less than the tolerance (--rtol, default 0.1 %); expected between
                    machines (Windows vs Linux, other library builds).
  TEXT              numbers and yes/no values match; only texts differ (for example a method description that was
                    reworded). Read the examples.
  DIFFERENT         numbers beyond the tolerance, a yes/no value that flips (for example a cell that becomes
                    significant), a missing value, a list of another length or a missing file.
Exit code 0 when no file is DIFFERENT, 1 otherwise.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = ("web/server/data", "web/public/data")
IGNORED_KEYS = {"generatedUtc", "generated_utc", "generatedAt"}
MAX_EXAMPLES = 5


class Diff:
    def __init__(self, rtol: float, atol: float):
        self.rtol, self.atol = rtol, atol
        self.numbers = self.numbers_equal = self.numbers_rounding = 0
        self.max_rel = 0.0
        self.issues: dict[str, list[str]] = {"number": [], "flag": [], "text": [], "structure": []}
        self.counts = {k: 0 for k in self.issues}

    def add(self, kind: str, text: str):
        self.counts[kind] += 1
        if len(self.issues[kind]) < MAX_EXAMPLES:
            self.issues[kind].append(text)

    def walk(self, a, b, path: str):
        if isinstance(a, bool) or isinstance(b, bool):
            if a is not b:
                self.add("flag" if isinstance(a, bool) and isinstance(b, bool) else "structure", f"{path}: {b} -> {a}")
        elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
            self.numbers += 1
            if a == b or (isinstance(a, float) and isinstance(b, float) and math.isnan(a) and math.isnan(b)):
                self.numbers_equal += 1
                return
            rel = abs(a - b) / max(abs(b), 1e-12)
            self.max_rel = max(self.max_rel, rel)
            if abs(a - b) <= self.atol + self.rtol * abs(b):
                self.numbers_rounding += 1
            else:
                self.add("number", f"{path}: {b} -> {a}")
        elif isinstance(a, dict) and isinstance(b, dict):
            for k in sorted(set(a) | set(b)):
                if k in IGNORED_KEYS:
                    continue
                if k not in a or k not in b:
                    self.add("structure", f"{path}.{k}: only in {'new' if k in a else 'reference'}")
                else:
                    self.walk(a[k], b[k], f"{path}.{k}")
        elif isinstance(a, list) and isinstance(b, list):
            if len(a) != len(b):
                self.add("structure", f"{path}: list of {len(b)} -> {len(a)} items")
            for i, (x, y) in enumerate(zip(a, b)):
                self.walk(x, y, f"{path}[{i}]")
        elif isinstance(a, str) and isinstance(b, str):
            if a != b:  # show the part where the two texts start to differ
                i = next((k for k, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
                s = max(0, i - 30)
                self.add("text", f"{path}: ...{short(b[s:s + 80])} -> ...{short(a[s:s + 80])}")
        elif a != b:  # None vs value, or type change
            self.add("structure", f"{path}: {short(b)} -> {short(a)}")

    def verdict(self) -> str:
        if self.counts["number"] or self.counts["flag"] or self.counts["structure"]:
            return "DIFFERENT"
        if self.counts["text"]:
            return "TEXT"
        return "ROUNDING" if self.numbers_rounding else "IDENTICAL"


def short(x, n: int = 90) -> str:
    s = json.dumps(x, ensure_ascii=False) if not isinstance(x, str) else repr(x)
    return s if len(s) <= n else s[: n - 3] + "..."


def reference_from_git(tmp: Path) -> Path:
    """Extract the committed versions of the output folders into tmp (the working tree is not touched)."""
    out = subprocess.run(["git", "-C", str(ROOT), "archive", "HEAD", "--", *FOLDERS], capture_output=True, check=True)
    with tarfile.open(fileobj=io.BytesIO(out.stdout)) as tar:
        try:
            tar.extractall(tmp, filter="data")
        except TypeError:  # Python < 3.12
            tar.extractall(tmp)
    return tmp


def compare_png(new: Path, ref: Path) -> dict:
    with Image.open(new) as im_a, Image.open(ref) as im_b:
        if im_a.mode != im_b.mode:
            return {"verdict": "DIFFERENT", "detail": f"image mode {im_b.mode} -> {im_a.mode}"}
        if im_a.mode == "P":  # compare the colours, not the palette indices
            im_a, im_b = im_a.convert("RGBA"), im_b.convert("RGBA")
        a, b = np.asarray(im_a), np.asarray(im_b)
    if a.shape != b.shape:
        return {"verdict": "DIFFERENT", "detail": f"size {b.shape} -> {a.shape}"}
    d = np.abs(a.astype(np.int32) - b.astype(np.int32))
    n = int((d > 0).any(axis=-1).sum() if d.ndim == 3 else (d > 0).sum())
    if n == 0:
        return {"verdict": "IDENTICAL", "detail": ""}
    pixels = a.shape[0] * a.shape[1]
    verdict = "ROUNDING" if int(d.max()) <= 1 else "DIFFERENT"
    return {"verdict": verdict, "detail": f"{n} of {pixels} pixels differ ({100 * n / pixels:.3f} %), max {int(d.max())}"}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ref", type=Path, help="root of another copy of the repository (default: git HEAD)")
    p.add_argument("--rtol", type=float, default=1e-3, help="relative tolerance for numbers (default 0.001 = 0.1 %%)")
    p.add_argument("--atol", type=float, default=1e-9, help="absolute tolerance for numbers")
    p.add_argument("--report", type=Path, help="write every result to this JSON file")
    a = p.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):  # a cp1252 console cannot print every character of the texts
        sys.stdout.reconfigure(errors="backslashreplace")

    with tempfile.TemporaryDirectory() as tmp:
        ref_root = a.ref.resolve() if a.ref else reference_from_git(Path(tmp))
        print(f"Reference: {'git HEAD' if not a.ref else ref_root}\nNew:       {ROOT}\n")
        files = sorted({f.relative_to(base).as_posix()
                        for base in (ROOT, ref_root) for folder in FOLDERS
                        for f in (base / folder).rglob("*") if f.is_file() and f.suffix in (".json", ".png")})
        results, totals = {}, {}
        for rel in files:
            new, ref = ROOT / rel, ref_root / rel
            if not new.exists() or not ref.exists():
                res = {"verdict": "DIFFERENT", "detail": "missing in " + ("new run" if not new.exists() else "reference")}
            elif rel.endswith(".png"):
                res = compare_png(new, ref)
            else:
                d = Diff(a.rtol, a.atol)
                d.walk(json.loads(new.read_text(encoding="utf-8")), json.loads(ref.read_text(encoding="utf-8")), "$")
                res = {"verdict": d.verdict(), "numbers": d.numbers, "numbersIdentical": d.numbers_equal,
                       "numbersRounding": d.numbers_rounding, "maxRelativeDifference": d.max_rel,
                       "counts": d.counts, "examples": {k: v for k, v in d.issues.items() if v}}
            results[rel] = res
            totals[res["verdict"]] = totals.get(res["verdict"], 0) + 1

    for rel, res in results.items():
        if res["verdict"] == "IDENTICAL":
            continue
        print(f"{res['verdict']:<10} {rel}")
        if "detail" in res:
            print(f"           {res['detail']}")
            continue
        c = res["counts"]
        print(f"           numbers: {res['numbers']} ({res['numbersIdentical']} identical, {res['numbersRounding']} rounding, "
              f"{c['number']} beyond tolerance; max relative difference {res['maxRelativeDifference']:.2e}); "
              f"flags changed: {c['flag']}; texts changed: {c['text']}; structure: {c['structure']}")
        for kind, ex in res["examples"].items():
            for e in ex:
                print(f"             [{kind}] {e}")

    print("\nSummary: " + ", ".join(f"{totals.get(k, 0)} {k}" for k in ("IDENTICAL", "ROUNDING", "TEXT", "DIFFERENT"))
          + f" (of {len(results)} files)")
    if a.report:
        a.report.write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"Report: {a.report}")
    return 1 if totals.get("DIFFERENT") else 0


if __name__ == "__main__":
    sys.exit(main())
