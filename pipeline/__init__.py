# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
# 2026-11-15: set HDF5_PLUGIN_PRELOAD="::" (see the comment below) to speed up netCDF reads ~15x.
import os

# Stop HDF5 from searching/loading dynamic compression plugins. Without this, every variable
# opened through xarray/netCDF4 triggered a plugin search (~90 ms each), making exports ~15x slower.
# Safe: every file the pipeline reads uses built-in zlib/gzip; if a future file needed a plugin
# filter, reading it would fail with a clear error, not return wrong values.
# setdefault lets a user override it by setting the variable beforehand. Must run before netCDF4/h5py import.
os.environ.setdefault("HDF5_PLUGIN_PRELOAD", "::")
