"""Cut the 3D view's regional terrain from the engine's cap grid.

Input : data/cap_heights.bin (+ data/cap_meta.json): LOLA heights, 640 m, +/-304 km, Float32, row 0 = +y.
Output: data/region_heights.bin: the same 640 m heights, cut to x -150.4..120.96 km, y -79.9..190.08 km
        (the 3D map's "All four sites" view plus its shadow margin), rounded to whole metres, Int16 LE,
        row 0 = north edge (+y), NaN filled with the mean of the valid cells around them.
The page reads it with meta {nx: 424, ny: 422, px: 640, xmin: -150400, ymax: 190080}."""
import json, numpy as np, os
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
m = json.load(open(os.path.join(here, 'cap_meta.json')))
z = np.fromfile(os.path.join(here, 'cap_heights.bin'), '<f4').reshape(m['ny'], m['nx'])
px = m['pixel_m']
c0 = int(round((-150400 - m['x_min'])/px)); r0 = int(round((m['y_max'] - 190080)/px))
nx, ny = 424, 422
cut = z[r0:r0 + ny, c0:c0 + nx].astype(np.float64)
bad = np.isnan(cut)
if bad.any():
    k = 5
    pad = np.pad(np.where(bad, 0, cut), k); w = np.pad((~bad).astype(float), k)
    s = sum(np.roll(np.roll(pad, i, 0), j, 1) for i in range(-k, k + 1) for j in range(-k, k + 1))
    n = sum(np.roll(np.roll(w, i, 0), j, 1) for i in range(-k, k + 1) for j in range(-k, k + 1))
    fill = (s/np.maximum(n, 1))[k:-k, k:-k]
    cut = np.where(bad, fill, cut)
out = np.round(cut).astype('<i2')
out.tofile(os.path.join(here, 'region_heights.bin'))
print('region_heights.bin', out.shape, 'nan filled', int(bad.sum()), 'min', out.min(), 'max', out.max(),
      'x0', m['x_min'] + c0*px, 'ytop', m['y_max'] - r0*px)
