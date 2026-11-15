# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
"""Hansen/UMD Global Forest Change v1.13 (30 m, 2000-2025) → our 0.05 degree Amazon grid.

    python -m pipeline.hansen

Independent reference for the MOD44B tree cover: Landsat-based, 30 m, not affected by Terra's orbit drift.
For each 10x10 degree tile over the Amazon box: download `treecover2000` and `lossyear`, aggregate the
200 x 200 Landsat pixels of every 0.05 degree cell, save the tile result, delete the GeoTIFFs. Resumable.

Output data/interim/HANSEN/gfc_v1.13.nc:
  treecover2000 (lat, lon)      mean canopy cover in 2000 (%), all pixels of the cell
  loss_share (year, lat, lon)   share of the cell area with stand-replacing tree cover loss in that year
  canopy_loss (year, lat, lon)  canopy lost that year, percentage points of the cell (pixel-weighted by 2000 cover)
  tree_cover (year, lat, lon)   treecover2000 minus cumulative canopy_loss = tree cover at the end of the year
                                (regrowth / gain after loss is NOT counted, so it can only go down)

Source: Hansen et al. 2013, Science 342:850-853, doi:10.1126/science.1244693. Data: CC BY 4.0,
"Source: Hansen/UMD/Google/USGS/NASA".
"""
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window
import xarray as xr

from .config import BBOX, INTERIM, RAW
from .tiles import LAT, LON, NX, NY, STEP

URL = "https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/Hansen_GFC-2025-v1.13_{layer}_{tile}.tif"
YEARS = np.arange(2001, 2026)
PX = 0.00025              # Landsat pixel, degrees
CELL = int(round(STEP / PX))  # 200 pixels per 0.05 degree cell side
LAT_TOPS = [10, 0, -10, -20]
LON_LEFTS = [-80, -70, -60, -50]


def tile_name(top, left):
    return f"{abs(top):02d}{'N' if top >= 0 else 'S'}_{abs(left):03d}{'W' if left < 0 else 'E'}"


def fetch(layer, tile, folder: Path) -> Path:
    path = folder / f"{layer}_{tile}.tif"
    if not path.exists():
        tmp = path.with_suffix(".part")
        urllib.request.urlretrieve(URL.format(layer=layer, tile=tile), tmp)
        tmp.rename(path)
    return path


def process_tile(top, left):
    tile = tile_name(top, left)
    out = INTERIM / "HANSEN" / "tiles" / f"{tile}.npz"
    if out.exists():
        return out
    # part of the tile inside the clip box, in degrees
    lat_hi, lat_lo = min(top, BBOX["lat_max"]), max(top - 10, BBOX["lat_min"])
    lon_lo, lon_hi = max(left, BBOX["lon_min"]), min(left + 10, BBOX["lon_max"])
    if lat_hi <= lat_lo or lon_hi <= lon_lo:
        return None
    folder = RAW / "HANSEN"; folder.mkdir(parents=True, exist_ok=True)
    tc_path, ly_path = fetch("treecover2000", tile, folder), fetch("lossyear", tile, folder)
    col0 = int(round((lon_lo - left) / PX)); ncols = int(round((lon_hi - lon_lo) / PX))
    row_start = int(round((top - lat_hi) / PX)); nrows_cells = int(round((lat_hi - lat_lo) / STEP))
    ncx = ncols // CELL
    tc_mean = np.zeros((nrows_cells, ncx), "float32")
    loss = np.zeros((len(YEARS), nrows_cells, ncx), "float32")
    closs = np.zeros((len(YEARS), nrows_cells, ncx), "float32")
    with rasterio.open(tc_path) as tc_src, rasterio.open(ly_path) as ly_src:
        for r in range(nrows_cells):  # one row of 0.05 cells at a time (200 x width pixels)
            win = Window(col0, row_start + r * CELL, ncols, CELL)
            tc = tc_src.read(1, window=win).astype("float32")
            ly = ly_src.read(1, window=win)
            tc_mean[r] = tc.reshape(CELL, ncx, CELL).mean(axis=(0, 2))
            key = (np.arange(ncols) // CELL)[None, :] * 26 + ly          # cell column x loss year (0 = no loss)
            counts = np.bincount(key.ravel(), minlength=ncx * 26).reshape(ncx, 26)
            loss[:, r, :] = (counts[:, 1:26] / (CELL * CELL)).T
            # canopy lost: each lost pixel counts with its own 2000 canopy cover (percentage points of the cell)
            canopy = np.bincount(key.ravel(), weights=tc.ravel(), minlength=ncx * 26).reshape(ncx, 26)
            closs[:, r, :] = (canopy[:, 1:26] / (CELL * CELL)).T
    # place in the 0.05 grid (LAT ascending): cell row r of this tile is centered at lat_hi - (r + 0.5) * STEP
    iy = np.rint((lat_hi - (np.arange(nrows_cells) + 0.5) * STEP - LAT[0]) / STEP).astype(int)
    ix = np.rint((lon_lo + (np.arange(ncx) + 0.5) * STEP - LON[0]) / STEP).astype(int)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, iy=iy, ix=ix, tc=tc_mean, loss=loss, closs=closs)
    tc_path.unlink(); ly_path.unlink()
    print(f"  {tile}: {nrows_cells}x{ncx} cells", flush=True)
    return out


def main():
    tc = np.full((NY, NX), np.nan, "float32")
    loss = np.full((len(YEARS), NY, NX), np.nan, "float32")
    closs = np.full((len(YEARS), NY, NX), np.nan, "float32")
    for top in LAT_TOPS:
        for left in LON_LEFTS:
            for attempt in range(1, 4):
                try:
                    f = process_tile(top, left)
                    break
                except Exception as e:
                    print(f"  {tile_name(top, left)} attempt {attempt}/3 failed: {e}", flush=True)
                    f = None
            if f is None:
                continue
            d = np.load(f)
            tc[np.ix_(d["iy"], d["ix"])] = d["tc"]
            loss[:, d["iy"][:, None], d["ix"][None, :]] = d["loss"]
            closs[:, d["iy"][:, None], d["ix"][None, :]] = d["closs"]
    # Tree cover at the end of each year = 2000 cover minus canopy lost since 2001 (gain is not counted).
    tree_cover = tc[None] - np.cumsum(closs, axis=0)
    ds = xr.Dataset({"treecover2000": (("lat", "lon"), tc), "loss_share": (("year", "lat", "lon"), loss),
                     "canopy_loss": (("year", "lat", "lon"), closs),
                     "tree_cover": (("year", "lat", "lon"), tree_cover.astype("float32"))},
                    coords={"year": YEARS, "lat": LAT, "lon": LON})
    ds["canopy_loss"].attrs = {"units": "%", "long_name": "canopy cover lost in the year, percentage points of the "
                                                         "cell (each lost 30 m pixel weighted by its 2000 cover)"}
    ds["tree_cover"].attrs = {"units": "%", "long_name": "tree cover at the end of the year: treecover2000 minus "
                                                        "cumulative canopy_loss; regrowth/gain not counted"}
    ds["treecover2000"].attrs = {"units": "%", "long_name": "mean Landsat canopy cover in 2000 (Hansen)"}
    ds["loss_share"].attrs = {"units": "1", "long_name": "share of cell area with stand-replacing loss in year"}
    ds.attrs = {"source": "Hansen/UMD/Google/USGS/NASA, GFC-2025-v1.13, CC BY 4.0", "doi": "10.1126/science.1244693"}
    out = INTERIM / "HANSEN" / "gfc_v1.13.nc"
    ds.to_netcdf(out, encoding={v: {"zlib": True, "complevel": 4} for v in ds.data_vars})
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
