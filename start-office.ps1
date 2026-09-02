# ===== مكتبنا - تشغيل تلقائي عند فتح الجهاز =====
$projectDir = "C:\Users\GEBREEL\Documents\Default Project\firstcode"
$node = "C:\Program Files\nodejs\node.exe"
$cloudflared = Join-Path $env:LOCALAPPDATA "cloudflared\cloudflared.exe"
$log = Join-Path $env:TEMP "office-start.log"
$cfLog = Join-Path $env:TEMP "cf-tunnel.log"
$publicUrlFile = Join-Path $projectDir "public-url.txt"
$serverLog = Join-Path $env:TEMP "server-out.log"
$serverErr = Join-Path $env:TEMP "server-err.log"

Set-Location $projectDir
"[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] office start" | Out-File -Append -FilePath $log

# 1) تأكد أن السيرفر شغال على المنفذ 3000
$listening = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  "starting node server" | Out-File -Append -FilePath $log
  Start-Process -FilePath $node -ArgumentList "src\server.js" -WorkingDirectory $projectDir `
    -RedirectStandardOutput $serverLog -RedirectStandardError $serverErr -WindowStyle Hidden
  Start-Sleep -Seconds 4
}

# 2) أوقف أي نفق قديم ثم ابدأ نفق جديد (لتعريف اللينك القادم)
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Remove-Item -LiteralPath $cfLog -ErrorAction SilentlyContinue
Write-Output "starting cloudflared tunnel" | Out-File -Append -FilePath $log
if (-not (Test-Path $cloudflared)) {
  Write-Output "cloudflared NOT FOUND at $cloudflared" | Out-File -Append -FilePath $log
} else {
  Start-Process -FilePath $cloudflared -ArgumentList "tunnel","--url","http://127.0.0.1:3000","--no-autoupdate","--logfile","$cfLog" -WindowStyle Hidden
}

# 3) انتظر ظهور اللينك العام من سجل cloudflare (حتى 60 ثانية)
$public = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Path $cfLog) {
    $m = Select-String -Path $cfLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches -ErrorAction SilentlyContinue |
          ForEach-Object { $_.Matches.Value } | Select-Object -Last 1
    if ($m) { $public = $m; break }
  }
}
if ($public) {
  $public | Out-File -FilePath $publicUrlFile -Force
  Write-Output "public url: $public" | Out-File -Append -FilePath $log
} else {
  Write-Output "public url NOT found yet" | Out-File -Append -FilePath $log
}

# 4) فتح المتصفح على الموقع المحلي
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:3000/"