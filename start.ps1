$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$config = Join-Path $root "config.json"
$example = Join-Path $root "config.example.json"

if (-not (Test-Path $config)) {
    Copy-Item $example $config
    Write-Host "已创建 config.json，请先补齐 OpenObserve 连接配置和 Cookie / Basic Auth。"
}

Set-Location $root
python .\server.py
