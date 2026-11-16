# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed by team AETHER.
"""Step 1 · Download NASA monthly files with earthaccess, then clip each one right away.

    python -m pipeline.download --dry-run                          # list what would be downloaded
    python -m pipeline.download --start 2000-01 --end 2026-10      # all products
    python -m pipeline.download --products MOD13C2 --keep-raw      # keep the global files

Every product comes as global files (the two MODIS products cannot be clipped on NASA's side), so each file
is downloaded, clipped to the Amazon box (pipeline.clip_clean), and deleted, one at a time. Disk use stays at
about one global file (~100 MB). Months already in data/interim/ are skipped, so an interrupted run resumes.
Each month is tried up to 3 times; months that still fail are listed at the end (run again to retry them).

Login (Earthdata account required, never put credentials in code):
  * local: a ~/.netrc (Windows: ~/_netrc) file, or the interactive prompt
  * environment variables EARTHDATA_USERNAME/EARTHDATA_PASSWORD or EARTHDATA_TOKEN, then strategy "environment"
"""
import argparse
import calendar
import os
import time
from pathlib import Path

import earthaccess

from .clip_clean import process_file
from .config import INTERIM, PRODUCTS, RAW

RETRIES = 3  # per month; a month that still fails is listed at the end and retried on the next run

def login():
    env = bool(os.environ.get("EARTHDATA_TOKEN") or os.environ.get("EARTHDATA_USERNAME"))
    for strategy in (["environment"] if env else ["netrc", "interactive"]):
        auth = earthaccess.login(strategy=strategy)
        if auth and auth.authenticated:
            return auth
    raise SystemExit("Earthdata login failed. See notebooks/README.md for how to provide credentials.")


def month_of(granule) -> str:
    return granule["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:7]


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--products", nargs="+", default=list(PRODUCTS), choices=list(PRODUCTS))
    p.add_argument("--start", default="2000-01", help="first month, YYYY-MM")
    p.add_argument("--end", default="2026-12", help="last month, YYYY-MM")
    p.add_argument("--dry-run", action="store_true", help="search only, download nothing")
    p.add_argument("--keep-raw", action="store_true", help="keep the global files in data/raw/")
    a = p.parse_args()

    y, m = map(int, a.end.split("-"))
    temporal = (f"{a.start}-01", f"{a.end}-{calendar.monthrange(y, m)[1]:02d}")
    if not a.dry_run:
        login()

    for product in a.products:
        cfg = PRODUCTS[product]
        granules = earthaccess.search_data(short_name=product, version=cfg["version"], temporal=temporal)
        todo = [g for g in granules if not (INTERIM / product / f"{month_of(g)}.nc").exists()]
        print(f"{product} v{cfg['version']}: {len(granules)} month(s) found, {len(todo)} to process")
        if a.dry_run:
            if todo:
                print(f"  first {month_of(todo[0])}, last {month_of(todo[-1])}")
            continue
        failed = []
        for g in todo:
            month = month_of(g)
            for attempt in range(1, RETRIES + 1):
                try:
                    paths = [Path(p) for p in earthaccess.download([g], local_path=str(RAW / product))]
                    if not paths:
                        raise RuntimeError("download returned no file")
                    for path in paths:
                        process_file(product, path)
                        if not a.keep_raw:
                            path.unlink()
                    break
                except Exception as e:  # network errors, corrupt files, failed checks
                    print(f"  {month} attempt {attempt}/{RETRIES} failed: {e}", flush=True)
                    time.sleep(15 * attempt)
            else:
                failed.append(month)
        print(f"{product}: finished. {len(todo) - len(failed)} processed, {len(failed)} failed: {failed}",
              flush=True)


if __name__ == "__main__":
    main()
