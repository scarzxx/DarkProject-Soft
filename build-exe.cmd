@echo off
setlocal EnableExtensions DisableDelayedExpansion
pushd "%~dp0"
if errorlevel 1 exit /b 1

echo Building Dark Control for Windows x64...
echo.

for %%T in (node.exe npm.cmd cargo.exe rustc.exe) do (
    where %%T >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Required tool %%T was not found in PATH.
        echo Install the prerequisites listed in README.md, then reopen this script.
        echo https://v2.tauri.app/start/prerequisites/
        goto failed
    )
)

echo Installing frontend dependencies...
if exist package-lock.json (
    call npm.cmd ci --include=dev --no-audit --no-fund
) else (
    call npm.cmd install --include=dev --no-audit --no-fund
)
if errorlevel 1 goto failed

set "CARGO_TARGET_DIR=%CD%\src-tauri\target"
echo.
echo Compiling the application. The first build may take several minutes.
call npm.cmd run tauri:build -- --no-bundle --target x86_64-pc-windows-msvc
if errorlevel 1 goto failed

set "BUILD_EXE=%CARGO_TARGET_DIR%\x86_64-pc-windows-msvc\release\dark-control.exe"
if not exist "%BUILD_EXE%" (
    echo ERROR: The build did not produce the expected executable.
    goto failed
)

if not exist output mkdir output
if errorlevel 1 goto failed
copy /y "%BUILD_EXE%" "output\Dark Control.exe" >nul
if errorlevel 1 goto failed

echo.
echo Build complete: "%CD%\output\Dark Control.exe"
set "BUILD_EXIT_CODE=0"
goto finish

:failed
echo.
echo Build failed. Review the error above.
set "BUILD_EXIT_CODE=1"

:finish
popd
if /i not "%~1"=="--no-pause" pause
exit /b %BUILD_EXIT_CODE%
