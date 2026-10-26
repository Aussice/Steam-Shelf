"""Verify and bundle the ready-made DualSense GLB without rebuilding its mesh."""
from pathlib import Path
import hashlib, json, shutil, struct

project = Path(__file__).resolve().parent.parent
source = project / 'asset-sources/dualsense/ps5_controller.glb'
data = source.read_bytes()
assert hashlib.sha256(data).hexdigest() == 'b988a018d0e6e504fe6fe5c6157138a125e68dc4d51f4cf4e60cf6d89a533c36'
assert struct.unpack_from('<III', data) == (0x46546c67, 2, len(data))
doc = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
assert doc['asset']['extras']['title'] == 'PS5 Controller'
target = project / 'public/models/gamepad.glb'
target.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, target)
print('Ready-made PS5 DualSense:', len(data), 'bytes; original geometry, materials and embedded textures retained.')
