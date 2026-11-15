# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
"""Tiled MODIS products (sinusoidal grid) → our 0.05 degree Amazon grid.

    python -m pipeline.tiles --product MOD44B  --start 2000 --end 2025        # yearly tree cover, 250 m
    python -m pipeline.tiles --product MCD64A1 --start 2000-11 --end 2026-10  # monthly burned area, 500 m

For each period (a year for MOD44B, a month for MCD64A1) all tiles over the Amazon box are downloaded,
every fine pixel is placed in the 0.05 degree cell that contains its center, the cell statistics are written
to data/interim/<PRODUCT>/<period>.nc, and the tiles are deleted. Finished periods are skipped (resumable).
Nothing is thresholded: outputs are cell means / fractions.
"""
import argparse
import re
import time
from pathlib import Path

import earthaccess
import numpy as np
import pandas as pd
import xarray as xr
from pyhdf.SD import SD, SDC

from .config import BBOX, INTERIM, RAW
from .download import login

R_EARTH = 6371007.181          # MODIS sinusoidal sphere radius (m)
TILE_M = 1111950.5197665       # tile width/height (m)
STEP = 0.05
SEARCH_BOX = (BBOX["lon_min"], BBOX["lat_min"], BBOX["lon_max"], BBOX["lat_max"])


def grid_coords():
    """Pixel-center coordinates (ascending) of the 0.05 degree clip grid, identical to readers._cmg_window."""
    r0 = int(np.floor((90 - BBOX["lat_max"]) / STEP)); r1 = int(np.ceil((90 - BBOX["lat_min"]) / STEP))
    c0 = int(np.floor((BBOX["lon_min"] + 180) / STEP)); c1 = int(np.ceil((BBOX["lon_max"] + 180) / STEP))
    lat = 90 - STEP / 2 - STEP * np.arange(r0, r1)
    lon = -180 + STEP / 2 + STEP * np.arange(c0, c1)
    return np.sort(lat), lon


LAT, LON = grid_coords()
NY, NX = LAT.size, LON.size


def tile_cell_index(path: Path, n: int):
    """Flat index into the 0.05 grid for every pixel of a sinusoidal tile (-1 outside the clip box)."""
    h, v = map(int, re.search(r"\.h(\d\d)v(\d\d)\.", path.name).groups())
    pix = TILE_M / n
    x = (h - 18) * TILE_M + (np.arange(n) + 0.5) * pix
    y = (9 - v) * TILE_M - (np.arange(n) + 0.5) * pix
    lat = np.degrees(y / R_EARTH)[:, None]
    lon = np.degrees(x[None, :] / (R_EARTH * np.cos(np.radians(lat))))
    iy = np.floor((lat - (LAT[0] - STEP / 2)) / STEP).astype(np.int64)
    ix = np.floor((lon - (LON[0] - STEP / 2)) / STEP).astype(np.int64)
    inside = (iy >= 0) & (iy < NY) & (ix >= 0) & (ix < NX)
    return np.where(inside, iy * NX + ix, -1)


def _acc(idx, valid, values=None):
    sel = (idx >= 0) & valid
    w = None if values is None else values[sel].astype("float64")
    return np.bincount(idx[sel], weights=w, minlength=NY * NX)


# ---------- MOD44B: Vegetation Continuous Fields (yearly, 250 m) ----------

def aggregate_mod44b(paths):
    s = {k: np.zeros(NY * NX) for k in ("tree", "tree_sd", "nontree", "nonveg", "n_land", "n_water")}
    for p in paths:
        sd = SD(str(p), SDC.READ)
        tree = sd.select("Percent_Tree_Cover")[:]
        idx = tile_cell_index(p, tree.shape[0])
        land = tree <= 100          # 200 = water, 253 = fill
        s["n_land"] += _acc(idx, land)
        s["n_water"] += _acc(idx, tree == 200)
        s["tree"] += _acc(idx, land, tree)
        s["tree_sd"] += _acc(idx, land, sd.select("Percent_Tree_Cover_SD")[:] * 0.01)
        s["nontree"] += _acc(idx, land, sd.select("Percent_NonTree_Vegetation")[:])
        s["nonveg"] += _acc(idx, land, sd.select("Percent_NonVegetated")[:])
        sd.end()
    n = np.where(s["n_land"] > 0, s["n_land"], np.nan)
    shape = (NY, NX)
    out = {
        "tree_cover": (s["tree"] / n).reshape(shape),
        "tree_cover_sd": (s["tree_sd"] / n).reshape(shape),
        "nontree_veg": (s["nontree"] / n).reshape(shape),
        "nonvegetated": (s["nonveg"] / n).reshape(shape),
        "n_250m_land": s["n_land"].reshape(shape),
        "water_share": (s["n_water"] / np.maximum(s["n_land"] + s["n_water"], 1)).reshape(shape),
    }
    ds = xr.Dataset({k: (("lat", "lon"), v.astype("float32")) for k, v in out.items()},
                    coords={"lat": LAT, "lon": LON})
    for k, u in [("tree_cover", "%"), ("tree_cover_sd", "%"), ("nontree_veg", "%"), ("nonvegetated", "%")]:
        ds[k].attrs["units"] = u
    ds.attrs["note"] = "Mean of MOD44B 250 m land pixels whose center falls in the 0.05 deg cell; water pixels excluded."
    return ds


# ---------- MCD64A1: Burned Area (monthly, 500 m) ----------

def aggregate_mcd64a1(paths):
    burned = np.zeros(NY * NX); mapped = np.zeros(NY * NX); doy = np.zeros(NY * NX)
    for p in paths:
        sd = SD(str(p), SDC.READ)
        bd = sd.select("Burn Date")[:]           # 0 unburned land, 1-366 burn day, -1 unmapped, -2 water
        sd.end()
        idx = tile_cell_index(p, bd.shape[0])
        mapped += _acc(idx, bd >= 0)
        burned += _acc(idx, bd > 0)
        doy += _acc(idx, bd > 0, bd)
    shape = (NY, NX)
    frac = np.where(mapped > 0, burned / np.maximum(mapped, 1), np.nan)
    mean_doy = np.where(burned > 0, doy / np.maximum(burned, 1), np.nan)
    ds = xr.Dataset({"burned_share": (("lat", "lon"), frac.reshape(shape).astype("float32")),
                     "burn_day_mean": (("lat", "lon"), mean_doy.reshape(shape).astype("float32")),
                     "n_500m_mapped": (("lat", "lon"), mapped.reshape(shape).astype("float32"))},
                    coords={"lat": LAT, "lon": LON})
    ds["burned_share"].attrs = {"units": "1", "long_name": "share of mapped 500 m land pixels burned in the month"}
    ds["burn_day_mean"].attrs = {"units": "day of year", "long_name": "mean burn date of burned pixels"}
    return ds


SPECS = {
    "MOD44B": {"version": "061", "aggregate": aggregate_mod44b, "freq": "Y"},
    "MCD64A1": {"version": "061", "aggregate": aggregate_mcd64a1, "freq": "M"},
}


def periods(freq, start, end):
    if freq == "Y":
        return [str(y) for y in range(int(start[:4]), int(end[:4]) + 1)]
    return [str(p) for p in pd.period_range(start, end, freq="M")]


def granules_for(product, version, period, freq):
    if freq == "Y":  # yearly files start in March; keep only granules labelled with this year
        g = earthaccess.search_data(short_name=product, version=version, bounding_box=SEARCH_BOX,
                                    temporal=(f"{period}-03-01", f"{period}-03-31"))
        return [x for x in g if f".A{period}" in x["umm"]["GranuleUR"]]
    y, m = map(int, period.split("-"))
    last = pd.Period(period, "M").days_in_month
    g = earthaccess.search_data(short_name=product, version=version, bounding_box=SEARCH_BOX,
                                temporal=(f"{period}-01", f"{period}-{last:02d}"))
    doy = pd.Timestamp(year=y, month=m, day=1).day_of_year
    return [x for x in g if f".A{y}{doy:03d}." in x["umm"]["GranuleUR"]]


def run(product, start, end):
    spec = SPECS[product]
    login()
    failed = []
    for period in periods(spec["freq"], start, end):
        out = INTERIM / product / f"{period}.nc"
        if out.exists():
            continue
        for attempt in range(1, 4):
            try:
                g = granules_for(product, spec["version"], period, spec["freq"])
                if not g:
                    raise RuntimeError("no granules found")
                folder = RAW / product / period
                paths = [Path(p) for p in earthaccess.download(g, local_path=str(folder))]
                if len(paths) != len(g):
                    raise RuntimeError(f"downloaded {len(paths)} of {len(g)} tiles")
                ds = spec["aggregate"](paths)
                ds.attrs.update({"product": product, "period": period, "tiles": len(paths)})
                out.parent.mkdir(parents=True, exist_ok=True)
                ds.to_netcdf(out, encoding={v: {"zlib": True, "complevel": 4} for v in ds.data_vars})
                for p in paths:
                    p.unlink()
                folder.rmdir()
                print(f"  {period}: {len(paths)} tiles -> {out.name}", flush=True)
                break
            except Exception as e:
                print(f"  {period} attempt {attempt}/3 failed: {e}", flush=True)
                time.sleep(15 * attempt)
        else:
            failed.append(period)
    print(f"{product}: finished, failed: {failed}", flush=True)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--product", required=True, choices=list(SPECS))
    p.add_argument("--start", required=True)
    p.add_argument("--end", required=True)
    a = p.parse_args()
    run(a.product, a.start, a.end)


if __name__ == "__main__":
    main()
