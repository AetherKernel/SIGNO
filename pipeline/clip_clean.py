# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed by team AETHER.
"""Step 2 · Clip every downloaded global file to the Amazon box and clean it.

    python -m pipeline.clip_clean                 # all products, skip months already done
    python -m pipeline.clip_clean --force         # redo everything
    python -m pipeline.clip_clean --delete-raw    # delete each global file once its clip is written

Output: data/interim/<PRODUCT>/<YYYY-MM>.nc (compressed NetCDF, one month per file).
Each file is checked before it is written: a wrong grid or clip size stops that month; values outside the
physical plausibility ranges are only counted and reported (kept as they are, for the team to decide, P-020).
"""
import argparse
from pathlib import Path

import numpy as np

from .config import BBOX, INTERIM, PRODUCTS, RAW
from .readers import READERS

# Physical plausibility limits (checked on the clipped month; NaN ignored).
RANGES = {
    "ndvi": (-0.2, 1.0), "evi": (-0.2, 1.0),
    "lst_day": (-40, 80), "lst_night": (-50, 50),
    "et": (-10, 400),  # small negative ET = condensation/dew in the model, physically valid "soil_moisture_0_10cm": (0, 100), "rain_gldas": (0, 3000),
    "precip": (0, 3000),
}
EXPECTED_STEP = {"MOD13C2": 0.05, "MOD11C3": 0.05, "GLDAS_NOAH025_M": 0.25, "GPM_3IMERGM": 0.1}


def check(product: str, ds) -> None:
    step = float(ds.lat[1] - ds.lat[0])
    assert np.isclose(step, EXPECTED_STEP[product]), f"{product}: unexpected grid step {step}"
    rows = (BBOX["lat_max"] - BBOX["lat_min"]) / step
    cols = (BBOX["lon_max"] - BBOX["lon_min"]) / step
    assert abs(ds.lat.size - rows) <= 2 and abs(ds.lon.size - cols) <= 2, \
        f"{product}: clip is {ds.lat.size}x{ds.lon.size}, expected about {rows:.0f}x{cols:.0f}"
    # Values outside the plausibility range are NOT removed (the product's own valid range was already applied
    # when reading). They are counted, printed and stored in the file attributes so the team can decide (P-020).
    for var, (lo, hi) in RANGES.items():
        if var in ds:
            v = ds[var].values
            ok = np.isfinite(v)
            assert ok.any(), f"{product}: {var} is empty after clipping"
            tol = 1e-4  # float32 rounding at the documented limits (e.g. NDVI -0.2)
            n_out = int(((v[ok] < lo - tol) | (v[ok] > hi + tol)).sum())
            ds[var].attrs["n_outside_plausible_range"] = n_out
            ds[var].attrs["plausible_range"] = [lo, hi]
            if n_out:
                print(f"  WARNING {product} {str(ds.time.values[0])[:7]}: {n_out} cell(s) of {var} outside "
                      f"[{lo}, {hi}] (min {float(v[ok].min()):.2f}, max {float(v[ok].max()):.2f}); kept as is",
                      flush=True)


def process_file(product: str, f: Path, force: bool = False) -> Path:
    """Clip + clean one global file and write its month to data/interim/<PRODUCT>/<YYYY-MM>.nc."""
    ds = READERS[product](f)
    month = str(ds.time.values[0])[:7]
    out = INTERIM / product / f"{month}.nc"
    if out.exists() and not force:
        print(f"  {month} exists, skipped")
        return out
    check(product, ds)
    out.parent.mkdir(parents=True, exist_ok=True)
    ds.attrs = {"source_file": f.name, "product": product,
                "doi": PRODUCTS[product]["doi"], "processing": "clipped to box, cleaned"}
    ds.to_netcdf(out, encoding={v: {"zlib": True, "complevel": 4} for v in ds.data_vars})
    print(f"  {month} -> {out.relative_to(INTERIM.parent)} "
          f"({ds.lat.size}x{ds.lon.size}, {out.stat().st_size / 1e6:.1f} MB)")
    return out


def run(products, force=False, delete_raw=False) -> None:
    for product in products:
        files = sorted(RAW.rglob(PRODUCTS[product]["pattern"]))
        print(f"{product}: {len(files)} raw file(s)")
        for f in files:
            process_file(product, f, force)
            if delete_raw:
                f.unlink()
                print(f"  deleted raw {f.name}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--products", nargs="+", default=list(PRODUCTS), choices=list(PRODUCTS))
    p.add_argument("--force", action="store_true")
    p.add_argument("--delete-raw", action="store_true")
    a = p.parse_args()
    run(a.products, a.force, a.delete_raw)


if __name__ == "__main__":
    main()
