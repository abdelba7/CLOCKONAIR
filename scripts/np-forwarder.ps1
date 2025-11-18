# === CLOCK ONAIR - NP FORWARDER ===
# Script PowerShell pour monitorer log-status.txt et envoyer les infos NP à l'API

$LogFile = "C:\Program Files (x86)\Radio France\TopStudioNowPlaying\log-status.txt"
$ApiUrl  = "https://clock-onair.duckdns.org/api/nowplaying/45a"

Write-Host "=== CLOCK ONAIR - NP FORWARDER ===" -ForegroundColor Cyan
Write-Host "Log      : $LogFile"
Write-Host "API      : $ApiUrl"
Write-Host "------------------------------------"
Write-Host ""

# Vérifier que le fichier existe
if (-not (Test-Path $LogFile)) {
    Write-Host "ERREUR: Le fichier n'existe pas : $LogFile" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

# Sécurité TLS
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Regex pour lignes du type :
# [45A] 17/11/2025 13:00:03 > Now Playing : Titre - Artiste (83000) - 24 Mo
$pattern = '^\[(.+?)\]\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s+>\s+Now Playing\s*:\s*(.+?)\s*-\s*(.+?)\s*\((\d+)\)'

Write-Host "Monitoring du fichier..." -ForegroundColor Green
Write-Host "En attente de nouvelles lignes 'Now Playing'..." -ForegroundColor Yellow
Write-Host ""

# Lecture "en streaming" du fichier de log
Get-Content -Path $LogFile -Encoding UTF8 -Tail 0 -Wait | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { return }

    # On ne traite que les lignes "Now Playing"
    if ($line -notmatch "Now Playing") { return }

    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Ligne détectée : $line" -ForegroundColor White

    $m = [regex]::Match($line, $pattern)
    if (-not $m.Success) {
        Write-Host "  → Ligne ignorée (ne matche pas le pattern NP)" -ForegroundColor Yellow
        return
    }

    $Station     = $m.Groups[1].Value.Trim()
    $Title       = $m.Groups[2].Value.Trim()
    $Artist      = $m.Groups[3].Value.Trim()
    $DurationMs  = [int]$m.Groups[4].Value

    Write-Host "  Station    : $Station" -ForegroundColor Green
    Write-Host "  Titre      : $Title" -ForegroundColor Green
    Write-Host "  Artiste    : $Artist" -ForegroundColor Green
    Write-Host "  Durée (ms) : $DurationMs" -ForegroundColor Green

    # Payload JSON optimisé (uniquement les infos nécessaires)
    $payload = @{
        station    = $Station
        title      = $Title
        artist     = $Artist
        durationMs = $DurationMs
        source     = "TopStudioNowPlaying"
    } | ConvertTo-Json -Depth 2 -Compress

    Write-Host "  JSON : $payload" -ForegroundColor Gray

    try {
        $response = Invoke-RestMethod `
            -Uri $ApiUrl `
            -Method Post `
            -Body $payload `
            -ContentType "application/json; charset=utf-8" `
            -TimeoutSec 5

        Write-Host "  → Envoi OK" -ForegroundColor Green
        if ($response) {
            Write-Host "  → Réponse : $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "  → ERREUR envoi API" -ForegroundColor Red
        Write-Host "  → $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $respBody = $reader.ReadToEnd()
                Write-Host "  → Détails: $respBody" -ForegroundColor Red
            }
            catch {
                Write-Host "  → Impossible de lire la réponse d'erreur" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
}
