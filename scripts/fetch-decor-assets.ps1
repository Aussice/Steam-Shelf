$ErrorActionPreference='Stop'
$sourceRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\asset-sources\dualsense'))
New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
$target=Join-Path $sourceRoot 'ps5_controller.glb'
$expected='B988A018D0E6E504FE6FE5C6157138A125E68DC4D51F4CF4E60CF6D89A533C36'
$source='https://raw.githubusercontent.com/Manav-Sonawane/Playstation-Revamp/dcd20aabd063b2c20de1edfecb886be9d84def9c/public/ps5_controller.glb'
if(-not (Test-Path -LiteralPath $target) -or (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $expected){Invoke-WebRequest -Uri $source -OutFile $target}
if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $expected){throw 'DualSense model checksum mismatch'}
Write-Output 'Taohid Animation PS5 DualSense model downloaded and verified. Run python scripts/pack-models.py to copy the ready-made GLB.'
