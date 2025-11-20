# === TCP SNIFFER PERSISTANT ===
# Ce script se connecte au serveur de diffusion et affiche tout ce qu'il reçoit en continu.
# Utile pour analyser le protocole (XML, JSON, Texte...) avant de créer le forwarder définitif.

# --- CONFIGURATION ---
# Remplacez par l'IP du serveur qui diffuse les infos (celle que vous avez utilisée avec succès)
$ServerIP = "192.168.1.100" 
$Port = 8888

Write-Host "=== TCP SNIFFER ===" -ForegroundColor Cyan
Write-Host "Cible : $ServerIP : $Port"
Write-Host "Appuyez sur Ctrl+C pour arrêter."
Write-Host ""

try {
    Write-Host "Tentative de connexion..." -ForegroundColor Yellow
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect($ServerIP, $Port)
    $stream = $tcp.GetStream()
    $buffer = New-Object byte[] 8192
    # On tente l'UTF-8, si les accents sont bizarres on pourra essayer ASCII ou Default
    $encoding = [System.Text.Encoding]::UTF8 

    Write-Host "CONNECTÉ !" -ForegroundColor Green
    Write-Host "En attente de données... (Lancez un titre pour voir ce qui arrive)" -ForegroundColor Cyan
    Write-Host "---------------------------------------------------------------"

    while ($tcp.Connected) {
        if ($stream.DataAvailable) {
            $count = $stream.Read($buffer, 0, $buffer.Length)
            if ($count -gt 0) {
                $rawText = $encoding.GetString($buffer, 0, $count)
                
                # Affichage brut
                Write-Host $rawText -NoNewline -ForegroundColor White
            }
        }
        # Petite pause pour ne pas surcharger le CPU
        Start-Sleep -Milliseconds 50
    }
} catch {
    Write-Host ""
    Write-Host "ERREUR : $_" -ForegroundColor Red
    Write-Host "Vérifiez l'adresse IP et que le serveur est bien accessible." -ForegroundColor Red
} finally {
    if ($tcp) { $tcp.Close() }
    Write-Host ""
    Write-Host "Connexion fermée." -ForegroundColor DarkGray
}
