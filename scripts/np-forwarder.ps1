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
# Ajout capture fin de ligne pour Intro/Outro
$pattern = '^\[(.+?)\]\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s+>\s+Now Playing\s*:\s*(.+?)\s*-\s*(.+?)\s*\((\d+)\)(.*)$'

Write-Host "Monitoring du fichier..." -ForegroundColor Green
Write-Host "En attente de nouvelles lignes 'Now Playing'..." -ForegroundColor Yellow
Write-Host ""
Write-Host "DEBUG: Le script va afficher TOUTES les lignes reçues pour diagnostic..." -ForegroundColor Magenta
Write-Host ""

$lineCount = 0
$lastNP = @{}  # Stocker le dernier NP envoyé pour éviter les doublons

# Lecture "en streaming" du fichier de log (Tail 0 pour ne pas relire le passé, Wait pour le temps réel)
Get-Content -Path $LogFile -Encoding UTF8 -Tail 0 -Wait | ForEach-Object {
    $lineCount++
    $line = $_.Trim()
    
    # DEBUG: Afficher toutes les lignes (même vides) pour diagnostic
    Write-Host "[Ligne $lineCount] " -NoNewline -ForegroundColor DarkGray
    if ([string]::IsNullOrWhiteSpace($line)) {
        Write-Host "(vide)" -ForegroundColor DarkGray
        continue
    } else {
        Write-Host "$line" -ForegroundColor DarkGray
    }

    # Detection STOP / ARRET
    if ($line -match "Stop" -or $line -match "Arrêt" -or $line -match "End") {
        Write-Host "  → Arrêt détecté" -ForegroundColor Yellow
        $payload = @{
            station    = "45a"
            title      = ""
            artist     = ""
            durationMs = 0
            source     = "TopStudioNowPlaying"
        } | ConvertTo-Json -Depth 2 -Compress
        
        try {
             $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $payload -ContentType "application/json; charset=utf-8" -TimeoutSec 5
             Write-Host "  → Envoi STOP OK" -ForegroundColor Green
        } catch {
             Write-Host "  → Erreur envoi STOP" -ForegroundColor Red
        }
        continue
    }

    # On ne traite que les lignes "Now Playing"
    if ($line -notmatch "Now Playing") { 
        Write-Host "  → Pas de 'Now Playing' dans cette ligne" -ForegroundColor DarkGray
        continue 
    }

    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Ligne détectée : $line" -ForegroundColor White

    $m = [regex]::Match($line, $pattern)
    if (-not $m.Success) {
        Write-Host "  → Ligne ignorée (ne matche pas le pattern NP)" -ForegroundColor Yellow
        continue
    }

    $Station     = $m.Groups[1].Value.Trim()
    $Title       = $m.Groups[2].Value.Trim()
    $Artist      = $m.Groups[3].Value.Trim()
    $DurationMs  = [int]$m.Groups[4].Value
    $Extra       = $m.Groups[5].Value.Trim()

    # Parsing Intro / Outro (supposés en secondes dans le log)
    $Intro = 0
    $Outro = 0
    # Formats supportés: "Intro: 12", "Intro=12", "Intro (12)", "Intro : 12"
    if ($Extra -match 'Intro\s*[:=\(]?\s*(\d+)') { $Intro = [int]$matches[1] }
    if ($Extra -match 'Outro\s*[:=\(]?\s*(\d+)') { $Outro = [int]$matches[1] }

    Write-Host "  Station    : $Station" -ForegroundColor Green
    Write-Host "  Titre      : $Title" -ForegroundColor Green
    Write-Host "  Artiste    : $Artist" -ForegroundColor Green
    Write-Host "  Durée (ms) : $DurationMs" -ForegroundColor Green
    if ($Intro -gt 0) { Write-Host "  Intro (s)  : $Intro" -ForegroundColor Cyan }
    if ($Outro -gt 0) { Write-Host "  Outro (s)  : $Outro" -ForegroundColor Cyan }

    # Ignorer les lignes vides ou avec durée 0
    if ([string]::IsNullOrWhiteSpace($Title) -or [string]::IsNullOrWhiteSpace($Artist) -or $DurationMs -eq 0) {
        Write-Host "  → Ignoré (titre/artiste vide ou durée = 0)" -ForegroundColor Yellow
        Write-Host ""
        continue
    }

    # Créer une clé unique pour ce NP
    $npKey = "$Station|$Title|$Artist"
    
    # NOTE: Suppression du debounce de 10s pour garantir le temps réel
    # Si le log envoie une mise à jour rapide (ex: correction durée), on la prend.

    # Payload JSON optimisé (uniquement les infos nécessaires)
    $payload = @{
        station    = $Station
        title      = $Title
        artist     = $Artist
        durationMs = $DurationMs
        introMs    = $Intro * 1000
        outroMs    = $Outro * 1000
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
        
        # Mémoriser ce NP pour éviter les doublons
        $lastNP[$npKey] = Get-Date
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
