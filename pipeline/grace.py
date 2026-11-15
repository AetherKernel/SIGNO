# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
"""GRACE / GRACE-FO JPL mascons RL06.3 v04 (CRI) → terrestrial water storage anomaly over the Amazon box.

    python -m pipeline.grace

One global NetCDF (all months, 0.5 degree grid, ~44 MB) is downloaded with earthaccess, clipped to the box,
and written to data/interim/GRACE/tws.nc with one entry per calendar month (YYYY-MM of the solution's
mid-date). Months without a solution (e.g. the gap between GRACE and GRACE-FO, 2017-2018) are simply absent.

Units: equivalent water thickness anomaly, cm (relative to the product's 2004.0-2009.999 baseline).
Note: the JPL land "scale factors" (CLM-based) are not applied; values are the mascon estimates as published.
Source: NASA JPL, doi:10.5067/TEMSC-3JC634 (Watkins et al. 2015, doi:10.1002/2014JB011547).
"""
from pathlib import Path

import earthaccess
import numpy as np
import pandas as pd
import xarray as xr

from .config import BBOX, INTERIM, RAW
from .download import login

SHORT_NAME = "TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4"


def main():
    login()
    g = earthaccess.search_data(short_name=SHORT_NAME)
    folder = RAW / "GRACE"
    paths = [Path(p) for p in earthaccess.download(g, local_path=str(folder))]
    nc = next(p for p in paths if p.suffix == ".nc")
    with xr.open_dataset(nc) as ds:
        ds = ds[["lwe_thickness", "uncertainty"]].load()
    ds = ds.assign_coords(lon=((ds.lon + 180) % 360) - 180).sortby("lon").sortby("lat")
    ds = ds.sel(lat=slice(BBOX["lat_min"], BBOX["lat_max"]), lon=slice(BBOX["lon_min"], BBOX["lon_max"]))
    months = pd.to_datetime(ds.time.values).to_period("M").astype(str)
    keep = ~pd.Index(months).duplicated()  # one solution per calendar month (first one)
    ds = ds.isel(time=np.where(keep)[0])
    ds = ds.assign_coords(time=[np.datetime64(m + "-01") for m in months[keep]])
    ds = ds.rename({"lwe_thickness": "tws", "uncertainty": "tws_uncertainty"})
    ds["tws"].attrs = {"units": "cm", "long_name": "terrestrial water storage anomaly (equivalent water thickness)"}
    ds.attrs = {"source": SHORT_NAME, "source_file": nc.name, "product": "GRACE"}
    out = INTERIM / "GRACE" / "tws.nc"
    out.parent.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(out)
    for p in paths:
        p.unlink()
    print(f"wrote {out}: {ds.time.size} months {str(ds.time.values[0])[:7]}..{str(ds.time.values[-1])[:7]}, "
          f"grid {ds.lat.size}x{ds.lon.size}", flush=True)


if __name__ == "__main__":
    main()
