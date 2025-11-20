#requires -Version 5.1

<#
.SYNOPSIS
    Forwarder XML -> HTTPS pour Clock OnAir.

.DESCRIPTION
    Ce script se connecte au flux TCP local (port 8888) qui diffuse les balises
    <ONAIR ... />, extrait les informations Now Playing utiles (Titre, Auteur,
    Intro, Outro, durée en cours, temps restant) et les transmet en JSON léger
    à l'API sécurisée du backend (via Nginx 443).

    Une seule requête est envoyée à chaque nouveau titre (IDITEM différent) pour
    limiter la latence tout en garantissant la précision du chrono grâce au
    timestamp de départ transmis.

.CONFIGURATION
    - CLOCK_XML_HOST        (défaut : 127.0.0.1)
    - CLOCK_XML_PORT        (défaut : 8888)
    - CLOCK_STATION         (défaut : 45a)
    - CLOCK_API_BASE        (défaut : https://clock-onair.duckdns.org/api/nowplaying)
    - CLOCK_RECONNECT_DELAY (défaut : 3 secondes)

    Chaque variable peut être définie via $env:VARNAME ou en éditant les valeurs
    par défaut ci-dessous.
#>

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
try {
    if (-not [Console]::IsOutputRedirected) {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    }
} catch {
    # Certains hôtes PowerShell (ex: ISE) n'exposent pas la console classique
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-ConfigValue {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][object]$Default
    )

    $val = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($val)) {
        return $Default
    }
    return $val
}

$script:SourceHost = Get-ConfigValue -Name 'CLOCK_XML_HOST' -Default '10.156.209.57'
$script:SourcePort = [int](Get-ConfigValue -Name 'CLOCK_XML_PORT' -Default '8888')
$script:StationId  = (Get-ConfigValue -Name 'CLOCK_STATION' -Default '45a').ToLower()
$apiBase = Get-ConfigValue -Name 'CLOCK_API_BASE' -Default 'https://clock-onair.duckdns.org/api/nowplaying'
$script:ApiUrl = ("{0}/{1}" -f $apiBase.TrimEnd('/'), $script:StationId)
$script:ReconnectDelaySeconds = [int](Get-ConfigValue -Name 'CLOCK_RECONNECT_DELAY' -Default '3')

$script:buffer = ''
$script:lastSentTrackId = $null
$script:encoding = [System.Text.Encoding]::UTF8
$script:tagRegex = [regex]'(?is)<ONAIR\s+.*?(?:\/>|><\/ONAIR>)'
$script:attrRegex = [regex]'(\w+)="([^"]*)"'
$script:culture = [System.Globalization.CultureInfo]::InvariantCulture

Write-Host "=== CLOCK ONAIR - XML NP FORWARDER ===" -ForegroundColor Cyan
Write-Host ("Source : {0}:{1}" -f $script:SourceHost, $script:SourcePort)
Write-Host ("API    : {0}" -f $script:ApiUrl)
Write-Host ("Station: {0}" -f $script:StationId.ToUpper())
Write-Host "---------------------------------------------"

function ConvertTo-Milliseconds {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return 0
    }
    try {
        $ts = [TimeSpan]::ParseExact($Value, "hh\:mm\:ss", $script:culture)
        return [int][Math]::Round($ts.TotalMilliseconds)
    } catch {
        return 0
    }
}

function Get-StartDateTime {
    param(
        [string]$AirDate,
        [string]$Start
    )
    if ([string]::IsNullOrWhiteSpace($AirDate) -or [string]::IsNullOrWhiteSpace($Start)) {
        return Get-Date
    }

    try {
        $pattern = "ddMMyyyy HH:mm:ss"
        return [DateTime]::ParseExact("$AirDate $Start", $pattern, $script:culture)
    } catch {
        return Get-Date
    }
}

function Parse-OnairAttributes {
    param([string]$Tag)

    $result = @{}
    foreach ($m in $script:attrRegex.Matches($Tag)) {
        $result[$m.Groups[1].Value] = $m.Groups[2].Value
    }
    return $result
}

function Get-TrackId {
    param([hashtable]$Attrs)

    foreach ($key in @('IDITEM', 'ID', 'ID_log')) {
        if ($Attrs.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($Attrs[$key])) {
            return $Attrs[$key]
        }
    }

    $title  = $Attrs['Title'];  if ($null -eq $title)  { $title  = '' }
    $artist = $Attrs['Author']; if ($null -eq $artist) { $artist = '' }
    $start  = $Attrs['Start'];  if ($null -eq $start)  { $start  = '' }

    return "{0}|{1}|{2}" -f $title, $artist, $start
}

function Build-NowPlayingPayload {
    param([hashtable]$Attrs)

    $title  = $Attrs['Title']
    $artist = $Attrs['Author']
    if ([string]::IsNullOrWhiteSpace($title) -and [string]::IsNullOrWhiteSpace($artist)) {
        return $null
    }

    $startDate = Get-StartDateTime -AirDate $Attrs['AirDate'] -Start $Attrs['Start']
    $now = Get-Date

    $remainMs = ConvertTo-Milliseconds -Value $Attrs['Remain']
    $introMs  = ConvertTo-Milliseconds -Value $Attrs['Intro']
    $outroMs  = ConvertTo-Milliseconds -Value $Attrs['Outro']

    $elapsedMs = [Math]::Max(0, ($now - $startDate).TotalMilliseconds)
    $durationMs = [Math]::Round($elapsedMs + $remainMs)
    if ($durationMs -lt $remainMs) {
        $durationMs = $remainMs
    }

    $elapsedComputed = [Math]::Max(0, $durationMs - $remainMs)

    return @{
        station        = $script:StationId
        title          = $title
        artist         = $artist
        durationMs     = [int]$durationMs
        elapsedMs      = [int][Math]::Round($elapsedComputed)
        remainingMs    = [int][Math]::Round($remainMs)
        introMs        = [int][Math]::Round($introMs)
        outroMs        = [int][Math]::Round($outroMs)
        startTimestamp = $startDate.ToString("o")
        source         = "XML-TCP-Forwarder"
        meta           = @{
            channel = $Attrs['Channel']
            id      = $Attrs['ID']
            idItem  = $Attrs['IDITEM']
            idLog   = $Attrs['ID_log']
            next    = $Attrs['Next']
        }
    }
}

function Send-NowPlaying {
    param([hashtable]$Payload)

    $json = $Payload | ConvertTo-Json -Depth 5 -Compress
    try {
        Invoke-RestMethod `
            -Uri $script:ApiUrl `
            -Method Post `
            -Body $json `
            -ContentType "application/json; charset=utf-8" `
            -TimeoutSec 5 | Out-Null

        $remain = [TimeSpan]::FromMilliseconds([Math]::Max(0, $Payload.remainingMs))
        Write-Host ("[API] {0} - {1} (reste {2:mm\:ss})" -f $Payload.title, $Payload.artist, $remain) -ForegroundColor Green
        return $true
    } catch {
        Write-Host ("[API] ERREUR : {0}" -f $_.Exception.Message) -ForegroundColor Red
        return $false
    }
}

function Process-OnairTag {
    param([string]$Tag)

    $attrs = Parse-OnairAttributes -Tag $Tag
    if ($attrs.Count -eq 0) {
        return
    }

    $trackId = Get-TrackId -Attrs $attrs
    if ([string]::IsNullOrWhiteSpace($trackId)) {
        return
    }

    if ($script:lastSentTrackId -eq $trackId) {
        return
    }

    $payload = Build-NowPlayingPayload -Attrs $attrs
    if (-not $payload) {
        return
    }

    Write-Host ("[SRC] {0} - {1} (Intro {2}, Outro {3})" -f $payload.title, $payload.artist, $attrs['Intro'], $attrs['Outro']) -ForegroundColor DarkGray

    if (Send-NowPlaying -Payload $payload) {
        $script:lastSentTrackId = $trackId
    }
}

function Drain-Buffer {
    while ($true) {
        if ([string]::IsNullOrEmpty($script:buffer)) {
            return
        }

        $startIndex = $script:buffer.IndexOf("<ONAIR")
        if ($startIndex -gt 0) {
            $script:buffer = $script:buffer.Substring($startIndex)
        } elseif ($startIndex -lt 0) {
            # Aucun début de balise complet pour l'instant, on garde la fin pour reconstituer
            if ($script:buffer.Length -gt 16) {
                $script:buffer = $script:buffer.Substring($script:buffer.Length - 16)
            }
            return
        }

        $match = $script:tagRegex.Match($script:buffer)
        if (-not $match.Success -or $match.Index -ne 0) {
            return
        }

        $tag = $match.Value
        $script:buffer = $script:buffer.Substring($match.Length)
        Process-OnairTag -Tag $tag
    }
}

while ($true) {
    $client = $null
    try {
        Write-Host ""
        Write-Host ("Connexion au flux {0}:{1}..." -f $script:SourceHost, $script:SourcePort) -ForegroundColor Yellow
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect($script:SourceHost, $script:SourcePort)
        Write-Host "Connecté. Attente des balises <ONAIR/> ..." -ForegroundColor Green

        $stream = $client.GetStream()
        $bufferBytes = New-Object byte[] 4096

        while ($client.Connected) {
            if (-not $stream.DataAvailable) {
                Start-Sleep -Milliseconds 5
                continue
            }

            $read = $stream.Read($bufferBytes, 0, $bufferBytes.Length)
            if ($read -le 0) {
                break
            }

            $chunk = $script:encoding.GetString($bufferBytes, 0, $read)
            $script:buffer += $chunk
            Drain-Buffer
        }
    } catch {
        Write-Host ("[ERREUR] $($_.Exception.Message)") -ForegroundColor Red
    } finally {
        if ($client) {
            $client.Close()
        }
        $script:buffer = ''
        Write-Host ("Connexion fermée. Nouvelle tentative dans {0}s..." -f $script:ReconnectDelaySeconds) -ForegroundColor DarkYellow
        Start-Sleep -Seconds $script:ReconnectDelaySeconds
    }
}
