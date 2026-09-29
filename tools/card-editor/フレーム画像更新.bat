@echo off
echo.
echo ============================================================
echo  [START] frames.js update starting...
echo ============================================================
echo.

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "generate_frames.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ============================================================
    echo  [ERROR] Update failed. See messages above.
    echo ============================================================
    echo.
    set /p dummy=[Press Enter to close]
    exit /b 1
)

echo.
echo ============================================================
echo  [DONE] Update complete.
echo ============================================================
echo.
set /p dummy=[Press Enter to close]
