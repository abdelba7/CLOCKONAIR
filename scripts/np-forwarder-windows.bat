@echo off
REM === CLOCK ONAIR - NP FORWARDER (Windows Launcher) ===
REM Lance le script bash via WSL

setlocal enabledelayedexpansion

echo ========================================
echo  CLOCK ONAIR - NP FORWARDER
echo ========================================
echo.

REM Vérifier que WSL est installé
wsl --status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] WSL n'est pas installe ou n'est pas configure.
    echo.
    echo Pour installer WSL :
    echo   1. Ouvrir PowerShell en administrateur
    echo   2. Executer : wsl --install
    echo   3. Redemarrer Windows
    echo.
    pause
    exit /b 1
)

REM Chemin du fichier log TopStudio (à adapter si nécessaire)
set "LOG_PATH=C:\Program Files (x86)\Radio France\TopStudioNowPlaying\log-status.txt"

REM Vérifier que le fichier existe
if not exist "%LOG_PATH%" (
    echo [ERREUR] Fichier log non trouve : %LOG_PATH%
    echo.
    echo Veuillez verifier le chemin dans le script .bat
    echo.
    pause
    exit /b 1
)

echo Fichier log   : %LOG_PATH%
echo.

REM Convertir le chemin Windows en chemin WSL
REM C:\Program Files (x86)\... -> /mnt/c/Program Files (x86)/...
set "WSL_PATH=%LOG_PATH%"
set "WSL_PATH=!WSL_PATH:C:\=/mnt/c/!"
set "WSL_PATH=!WSL_PATH:D:\=/mnt/d/!"
set "WSL_PATH=!WSL_PATH:E:\=/mnt/e/!"
set "WSL_PATH=!WSL_PATH:\=/!"

echo Chemin WSL    : !WSL_PATH!
echo.
echo Demarrage du script bash via WSL...
echo Appuyez sur Ctrl+C pour arreter
echo ========================================
echo.

REM Télécharger et lancer le script bash depuis GitHub
wsl bash -c "curl -sL https://raw.githubusercontent.com/abdelba7/CLOCKONAIR/main/scripts/np-forwarder.sh | bash -s '!WSL_PATH!'"

REM Si curl échoue, afficher le message
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] Impossible de lancer le script.
    echo.
    echo Solution alternative :
    echo   1. Cloner le repo : git clone https://github.com/abdelba7/CLOCKONAIR.git
    echo   2. Dans WSL, executer : ./scripts/np-forwarder.sh "!WSL_PATH!"
    echo.
    pause
)

endlocal
