# === DIAGNOSTIC PORT 8888 ===
# Ce script tente de récupérer des données sur le port 8888
# 1. En essayant de se connecter en TCP (Client)
# 2. En écoutant en UDP (Serveur)

Write-Host "=== DIAGNOSTIC PORT 8888 ===" -ForegroundColor Cyan
Write-Host "Ce script va tenter de détecter des données sur le port 8888."
Write-Host "Appuyez sur Ctrl+C pour arrêter à tout moment."
Write-Host ""

# --- TEST 1 : TCP CLIENT ---
Write-Host "[1/2] Tentative de connexion TCP sur 127.0.0.1:8888..." -ForegroundColor Yellow
$tcpSuccess = $false

try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $connect = $tcp.BeginConnect("127.0.0.1", 8888, $null, $null)
    # Timeout de 2 secondes
    $success = $connect.AsyncWaitHandle.WaitOne(2000, $false)
    
    if ($success) {
        try {
            $tcp.EndConnect($connect)
            Write-Host "SUCCÈS TCP ! Connexion établie." -ForegroundColor Green
            Write-Host "Lecture des données pendant 10 secondes..." -ForegroundColor Green
            
            $stream = $tcp.GetStream()
            $buffer = New-Object byte[] 1024
            $encoding = [System.Text.Encoding]::UTF8
            $startTime = Get-Date
            
            while ((Get-Date) -lt $startTime.AddSeconds(10)) {
                if ($stream.DataAvailable) {
                    $count = $stream.Read($buffer, 0, $buffer.Length)
                    if ($count -gt 0) {
                        $text = $encoding.GetString($buffer, 0, $count)
                        Write-Host "TCP REÇU: $text" -ForegroundColor White
                        $tcpSuccess = $true
                    }
                }
                Start-Sleep -Milliseconds 100
            }
        } catch {
            Write-Host "Erreur lors de la lecture TCP: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "Échec connexion TCP (Pas de réponse ou port fermé)." -ForegroundColor DarkGray
    }
    $tcp.Close()
} catch {
    Write-Host "Erreur TCP: $_" -ForegroundColor Red
}

if ($tcpSuccess) {
    Write-Host ""
    Write-Host "Des données ont été reçues en TCP. C'est probablement le bon protocole." -ForegroundColor Green
    Write-Host "Copiez les lignes 'TCP REÇU' pour que je puisse adapter le script." -ForegroundColor Cyan
    exit
}

Write-Host ""
Write-Host "[2/2] Passage en mode ÉCOUTE UDP sur le port 8888..." -ForegroundColor Yellow
Write-Host "En attente de paquets UDP... (Laissez tourner si rien ne s'affiche)" -ForegroundColor Yellow

try {
    $udp = New-Object System.Net.Sockets.UdpClient(8888)
    $endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
    
    while ($true) {
        if ($udp.Available -gt 0) {
            $bytes = $udp.Receive([ref]$endpoint)
            $msg = [System.Text.Encoding]::UTF8.GetString($bytes)
            Write-Host "UDP REÇU de $($endpoint.Address): $msg" -ForegroundColor Cyan
        }
        Start-Sleep -Milliseconds 100
    }
} catch {
    Write-Host "Erreur UDP (Port peut-être déjà utilisé ?): $_" -ForegroundColor Red
} finally {
    if ($udp) { $udp.Close() }
}
