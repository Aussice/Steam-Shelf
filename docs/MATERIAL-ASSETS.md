# Room material assets

The room and shelf use local 1K JPG PBR maps from [Poly Haven](https://polyhaven.com/textures). Poly Haven publishes its assets under [CC0](https://polyhaven.com/license), so attribution is optional; the credits below are retained for provenance. All downloaded files were checked against the MD5 values returned by Poly Haven's files API.

| Use | Poly Haven asset | Author | Physical scan size | Local files |
| --- | --- | --- | --- | --- |
| Wall | [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall) | Amal Kumar | 2 × 2 m | `wall-painted-plaster-*` |
| Metal shelf | [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate) | Rob Tuytel | 2.5 × 2.5 m | `shelf-blue-metal-*` |
| Walnut shelf | [Smoked Walnut Veneer](https://polyhaven.com/a/smoked_walnut_veneer) | Jenelle van Heerden | 1 × 1 m | `shelf-smoked-walnut-*` |
| Floor | [Concrete Floor Worn 001](https://polyhaven.com/a/concrete_floor_worn_001) | Dimitrios Savva and Rico Cilliers | 3 × 3 m | `floor-worn-concrete-*` |

Each set contains diffuse/color, OpenGL normal, and roughness maps. Only the color maps use the sRGB color space; normal and roughness maps remain linear. The twelve files total about 4.70 MB. Runtime loads only three sets (the active shelf theme plus wall and floor).

## Scene integration

Import `createRoomMaterials` and optionally `applyWorldUV` from `src/roomMaterials.js`.

```js
const roomMaterials = createRoomMaterials({ wood, anisotropy, invalidate, alive: () => live });
const { metal, backMat, wall: roomWallMat, floor: roomFloorMat } = roomMaterials;
```

The returned `ready` promise resolves to `true` after the local images decode and the materials are updated. It resolves to `false` if loading fails or `alive` becomes false. Dispose `metal`, `backMat`, `wall`, `floor`, and every item in `textures` with the rest of the scene resources. The factory does not own the renderer or render loop.

The wall is 100 × 70 scene units and repeats a 2 m scan 50 × 35 times. The floor is 100 × 100 and repeats a 3 m scan 33.33 times on each axis. Those repeats preserve the source scale; lowering them makes pores and scratches too large for the rack.

The rack uses box profiles from roughly 0.14 to 0.20 units thick and boards up to about 9.5 units long. Default box UVs stretch one image over every face, which makes scratches unnaturally wide on long boards. After constructing each rack mesh that uses `metal` or `backMat`, call:

```js
applyWorldUV(mesh, wood ? 1 : 2.5);
```

This maps the walnut scan at 1 m per tile and painted metal at 2.5 m per tile using each face's dominant local axis. It mutates the geometry, so clone shared geometries first. Use it only on box-like rack parts; the wall and floor already have correct repeats. Rounded profile corners may show a small UV seam where the dominant axis changes, but at the current 0.02–0.03 corner radius it remains below the normal shelf camera distance.
