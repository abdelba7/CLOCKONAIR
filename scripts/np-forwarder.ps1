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
Write-Host "DEBUG: Le script va afficher TOUTES les lignes reçues pour diagnostic..." -ForegroundColor Magenta
Write-Host ""

$lineCount = 0
$lastNP = @{}  # Stocker le dernier NP envoyé pour éviter les doublons

# Lecture "en streaming" du fichier de log
Get-Content -Path $LogFile -Encoding UTF8 -Tail 0 -Wait | ForEach-Object {
    $lineCount++
    $line = $_.Trim()
    
    # DEBUG: Afficher toutes les lignes (même vides) pour diagnostic
    Write-Host "[Ligne $lineCount] " -NoNewline -ForegroundColor DarkGray
    if ([string]::IsNullOrWhiteSpace($line)) {
        Write-Host "(vide)" -ForegroundColor DarkGray
        return
    } else {
        Write-Host "$line" -ForegroundColor DarkGray
    }

    # On ne traite que les lignes "Now Playing"
    if ($line -notmatch "Now Playing") { 
        Write-Host "  → Pas de 'Now Playing' dans cette ligne" -ForegroundColor DarkGray
        return 
    }

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

    # Ignorer uniquement les lignes complètement vides
    if ([string]::IsNullOrWhiteSpace($Title) -and [string]::IsNullOrWhiteSpace($Artist)) {
        Write-Host "  → Ignoré (titre et artiste vides)" -ForegroundColor Yellow
        Write-Host ""
        return
    }

    # Créer une clé unique pour ce NP
    $npKey = "$Station|$Title|$Artist"
    
    # Déterminer si c'est un nouveau titre ou une mise à jour
    $isNewTrack = $true
    $updateType = "NOUVEAU"
    $totalDuration = $DurationMs
    $elapsed = 0
    
    if ($lastNP.ContainsKey($npKey)) {
        $isNewTrack = $false
        $updateType = "MAJ durée"
        # La durée initiale est stockée, DurationMs actuel est le temps restant
        $totalDuration = $lastNP[$npKey].InitialDuration
        $elapsed = $totalDuration - $DurationMs
    }
    
    Write-Host "  Type       : $updateType" -ForegroundColor $(if ($isNewTrack) { "Cyan" } else { "Yellow" })
    if (!$isNewTrack) {
        Write-Host "  Temps écoulé : $elapsed ms" -ForegroundColor Gray
    }

    # Payload JSON avec indication de mise à jour
    $payload = @{
        station       = $Station
        title         = $Title
        artist        = $Artist
        durationMs    = $totalDuration
        remainingMs   = $DurationMs
        elapsedMs     = $elapsed
        isUpdate      = !$isNewTrack
        source        = "TopStudioNowPlaying"
        timestamp     = (Get-Date).ToString("o")
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
        
        # Mémoriser ce NP avec sa durée initiale
        if ($isNewTrack) {
            $lastNP[$npKey] = @{
                Timestamp = Get-Date
                InitialDuration = $DurationMs
            }
        } else {
            $lastNP[$npKey].Timestamp = Get-Date
        }
        
        # Si la durée est 0, le titre a été arrêté
        if ($DurationMs -eq 0) {
            Write-Host "  ⚠ Titre arrêté (durée = 0)" -ForegroundColor Yellow
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
