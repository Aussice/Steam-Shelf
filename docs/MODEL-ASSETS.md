# 收藏室摆件素材

现成模型随应用打包，本地载入，无需在运行时访问素材网站。泰迪熊已从场景、读取白名单和运行素材中删除，保留手柄及金银铜奖杯。

| 文件 | 原模型与作者 | 来源与许可 | 应用内调整 |
| --- | --- | --- | --- |
| `public/models/gamepad.glb` | PS5 Controller / DualSense · Taohid Animation | [作者原发布页](https://sketchfab.com/3d-models/ps5-controller-b7bb9c5102a04cb0b1966c6d02bad7d6) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 使用完整现成 GLB，保留原有网格、材质、七张内嵌贴图；只调整陈列大小、角度与环境反射强度 |

模型内部 `asset.extras` 保留作者、原链接与 CC-BY-4.0 信息。原作者 Sketchfab API 同样确认公开下载及署名授权，快照保存在 `asset-sources/dualsense/source.json`。GLB 来自作者素材的公开分发镜像：[Playstation-Revamp](https://github.com/Manav-Sonawane/Playstation-Revamp/blob/dcd20aabd063b2c20de1edfecb886be9d84def9c/public/ps5_controller.glb)。SHA-256：`b988a018d0e6e504fe6fe5c6157138a125e68dc4d51f4cf4e60cf6d89a533c36`。可运行 `scripts/fetch-decor-assets.ps1` 下载并校验，再运行 `python scripts/pack-models.py` 复制现成模型。没有重新建模或生成替代模型。

Steam Awards 装饰由 `src/steamAward.js` 按用户提供的实体奖杯照片重建。Steam 圆形标志使用 Valve 官方 SVG 的原始三条轮廓，同时用于游戏盒、架前条和奖杯浮雕，来源：https://store.akamai.steamstatic.com/public/shared/images/header/logo_steam.svg 。原始文件保存在 `asset-sources/steam-logo-original.svg`，构建脚本为 `scripts/prepare-steam-logo.mjs`。

奖杯是收藏室装饰，不代表账号已获得任何特定 Steam 成就或官方奖项。Steam 标识归 Valve 所有，PlayStation 与 DualSense 名称归 Sony 所有，本项目为个人独立应用。

已退役的泰迪熊、复古手柄及主机只保存在 `asset-sources` 下，不随程序打包。房间材质来源见 [MATERIAL-ASSETS.md](MATERIAL-ASSETS.md)。
