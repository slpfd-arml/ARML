@echo off
setlocal enabledelayedexpansion
title ARML Launcher -- Build
echo.
echo  ============================================
echo   ARML Portable Launcher ^| Build Script
echo  ============================================
echo.
:: ---- 1. Locate csc.exe (built into .NET Framework) ----
set "CSC="
for %%V in (v4.0.30319 v4.8 v4.7.2 v4.7.1 v4.7 v4.6.2 v4.6.1 v4.6 v4.5.2 v4.5) do (
    if not defined CSC (
        if exist "%WINDIR%\Microsoft.NET\Framework64\%%V\csc.exe" (
            set "CSC=%WINDIR%\Microsoft.NET\Framework64\%%V\csc.exe"
        )
    )
)
if not defined CSC (
    for %%V in (v4.0.30319 v4.8 v4.7.2 v4.7.1 v4.7 v4.6.2 v4.6.1 v4.6 v4.5.2 v4.5) do (
        if not defined CSC (
            if exist "%WINDIR%\Microsoft.NET\Framework\%%V\csc.exe" (
                set "CSC=%WINDIR%\Microsoft.NET\Framework\%%V\csc.exe"
            )
        )
    )
)
if not defined CSC (
    echo  [ERROR] csc.exe not found -- .NET Framework 4.x required.
    pause ^& exit /b 1
)
echo  [OK] Compiler : %CSC%

:: ---- 2. Locate slp-patch.ico ----
set "ICOFILE="
set "S1=%~dp0ARML\ARML v2.7.0\icons\slp-patch.ico"
set "S2=%~dp0ARML v2.7.0\icons\slp-patch.ico"
set "S3=%~dp0icons\slp-patch.ico"
set "S4=%~dp0slp-patch.ico"
if exist "!S1!" set "ICOFILE=!S1!"
if not defined ICOFILE if exist "!S2!" set "ICOFILE=!S2!"
if not defined ICOFILE if exist "!S3!" set "ICOFILE=!S3!"
if not defined ICOFILE if exist "!S4!" set "ICOFILE=!S4!"
if not defined ICOFILE (
    echo  [WARN] slp-patch.ico not found -- EXE will use default icon.
    echo         Copy slp-patch.ico next to this .bat and re-run to embed it.
    set "ICONARG="
) else (
    echo  [OK] Icon     : !ICOFILE!
    set "ICONARG=/win32icon:"!ICOFILE!""
)

:: ---- 3. Extract embedded launcher.cs (base64 -> certutil decode) ----
set "TMPB64=%TEMP%\arml_src_%RANDOM%.b64"
set "TMPCS=%TEMP%\arml_launcher_%RANDOM%.cs"
(
echo Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09
echo PT09PT09PT09PT09PT09Ci8vICBBUk1MIFBvcnRhYmxlIExhdW5jaGVyICDigJQg
echo IGxhdW5jaGVyLmNzCi8vICBDb21waWxlIHdpdGggYnVpbGQuYmF0ICh1c2VzIGJ1
echo aWx0LWluIGNzYy5leGUgb24gV2luZG93cykKLy8gPT09PT09PT09PT09PT09PT09
echo PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ci8vICBC
echo ZWhhdmlvdXI6Ci8vICAgIDEuIFJlc29sdmVzIHRoZSBkaXJlY3RvcnkgdGhhdCBj
echo b250YWlucyBUSElTIEVYRQovLyAgICAgICAodXNlcyBrZXJuZWwzMiBHZXRNb2R1
echo bGVGaWxlTmFtZVcgZm9yIFVTQiByZWxpYWJpbGl0eSkKLy8gICAgMi4gQXBwZW5k
echo cyAiQVJNTCB2Mi43LjBcaW5kZXguaHRtbCIKLy8gICAgMy4gVmVyaWZpZXMgdGhl
echo IGZpbGUgZXhpc3RzLCB0aGVuIG9wZW5zIGl0IHdpdGggdGhlCi8vICAgICAgIHN5
echo c3RlbSBkZWZhdWx0IGJyb3dzZXIgdmlhIFNoZWxsRXhlY3V0ZSAvIFByb2Nlc3Mu
echo U3RhcnQKLy8gICAgNC4gU2hvd3MgYSBmcmllbmRseSBlcnJvciBNZXNzYWdlQm94
echo IG9uIGFueSBmYWlsdXJlCi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09
echo PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQoKdXNpbmcgU3lzdGVtOwp1
echo c2luZyBTeXN0ZW0uRGlhZ25vc3RpY3M7CnVzaW5nIFN5c3RlbS5JTzsKdXNpbmcg
echo U3lzdGVtLlJlZmxlY3Rpb247CnVzaW5nIFN5c3RlbS5SdW50aW1lLkludGVyb3BT
echo ZXJ2aWNlczsKdXNpbmcgU3lzdGVtLlRleHQ7CnVzaW5nIFN5c3RlbS5XaW5kb3dz
echo LkZvcm1zOwoKLy8gLS0tLSBWZXJzaW9uIGluZm8gZW1iZWRkZWQgaW50byB0aGUg
echo RVhFIFBFIGhlYWRlciAtLS0tClthc3NlbWJseTogQXNzZW1ibHlUaXRsZSgiQVJN
echo TCBQb3J0YWJsZSBMYXVuY2hlciIpXQpbYXNzZW1ibHk6IEFzc2VtYmx5RGVzY3Jp
echo cHRpb24oIk9wZW5zIEFSTUwgdjIuNy4wIGluIHRoZSBkZWZhdWx0IGJyb3dzZXIi
echo KV0KW2Fzc2VtYmx5OiBBc3NlbWJseUNvbXBhbnkoIkFSTUwiKV0KW2Fzc2VtYmx5
echo OiBBc3NlbWJseVByb2R1Y3QoIkFSTUwgdjIuNy4wIildClthc3NlbWJseTogQXNz
echo ZW1ibHlDb3B5cmlnaHQoIiIpXQpbYXNzZW1ibHk6IEFzc2VtYmx5VmVyc2lvbigi
echo Mi43LjAuMCIpXQpbYXNzZW1ibHk6IEFzc2VtYmx5RmlsZVZlcnNpb24oIjIuNy4w
echo LjAiKV0KCnN0YXRpYyBjbGFzcyBQcm9ncmFtCnsKICAgIC8vIC0tLS0tLS0tLS0t
echo LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0t
echo LS0tLS0tLQogICAgLy8gIFAvSW52b2tlOiBHZXRNb2R1bGVGaWxlTmFtZVcg4oCU
echo IHJvY2stc29saWQgRVhFIHBhdGggb24gYW55IGRyaXZlCiAgICAvLyAtLS0tLS0t
echo LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0t
echo LS0tLS0tLS0tLS0KICAgIFtEbGxJbXBvcnQoImtlcm5lbDMyLmRsbCIsIENoYXJT
echo ZXQgPSBDaGFyU2V0LlVuaWNvZGUsIFNldExhc3RFcnJvciA9IHRydWUpXQogICAg
echo cHJpdmF0ZSBzdGF0aWMgZXh0ZXJuIHVpbnQgR2V0TW9kdWxlRmlsZU5hbWUoCiAg
echo ICAgICAgSW50UHRyICBoTW9kdWxlLAogICAgICAgIFN0cmluZ0J1aWxkZXIgbHBG
echo aWxlbmFtZSwKICAgICAgICB1aW50ICAgIG5TaXplKTsKCiAgICBwcml2YXRlIHN0
echo YXRpYyBzdHJpbmcgR2V0RXhlUGF0aCgpCiAgICB7CiAgICAgICAgdmFyIHNiICA9
echo IG5ldyBTdHJpbmdCdWlsZGVyKDMyNzY4KTsKICAgICAgICB1aW50IG4gID0gR2V0
echo TW9kdWxlRmlsZU5hbWUoSW50UHRyLlplcm8sIHNiLCAodWludClzYi5DYXBhY2l0
echo eSk7CiAgICAgICAgaWYgKG4gPT0gMCkKICAgICAgICAgICAgdGhyb3cgbmV3IElu
echo dmFsaWRPcGVyYXRpb25FeGNlcHRpb24oCiAgICAgICAgICAgICAgICAiR2V0TW9k
echo dWxlRmlsZU5hbWUgZmFpbGVkIChXaW4zMiBlcnJvciAiICsKICAgICAgICAgICAg
echo ICAgIE1hcnNoYWwuR2V0TGFzdFdpbjMyRXJyb3IoKSArICIpLiIpOwogICAgICAg
echo IHJldHVybiBzYi5Ub1N0cmluZygwLCAoaW50KW4pOwogICAgfQoKICAgIC8vIC0t
echo LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0t
echo LS0tLS0tLS0tLS0tLS0tLQogICAgLy8gIEVudHJ5IHBvaW50ICAobm8gY29uc29s
echo ZSB3aW5kb3cg4oCUIGNvbXBpbGVkIC90YXJnZXQ6d2luZXhlKQogICAgLy8gLS0t
echo LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0t
echo LS0tLS0tLS0tLS0tLS0tCiAgICBbU1RBVGhyZWFkXQogICAgc3RhdGljIHZvaWQg
echo TWFpbigpCiAgICB7CiAgICAgICAgdHJ5CiAgICAgICAgewogICAgICAgICAgICAv
echo LyAxLiBEaXJlY3RvcnkgdGhhdCBjb250YWlucyB0aGlzIEVYRSAoZHJpdmUtbGV0
echo dGVyLWFnbm9zdGljKQogICAgICAgICAgICBzdHJpbmcgZXhlUGF0aCA9IEdldEV4
echo ZVBhdGgoKTsKICAgICAgICAgICAgc3RyaW5nIGV4ZURpciAgPSBQYXRoLkdldERp
echo cmVjdG9yeU5hbWUoZXhlUGF0aCkKICAgICAgICAgICAgICAgICAgICAgICAgICAg
echo ICA/PyBBcHBEb21haW4uQ3VycmVudERvbWFpbi5CYXNlRGlyZWN0b3J5OwoKICAg
echo ICAgICAgICAgLy8gMi4gVGFyZ2V0IEhUTUwgZmlsZQogICAgICAgICAgICBzdHJp
echo bmcgaHRtbFBhdGggPSBQYXRoLkNvbWJpbmUoZXhlRGlyLCAiQVJNTCB2Mi43LjAi
echo LCAiaW5kZXguaHRtbCIpOwoKICAgICAgICAgICAgLy8gMy4gRXhpc3RlbmNlIGNo
echo ZWNrIOKAlCBmcmllbmRseSBlcnJvciBpZiBhcHAgZm9sZGVyIGlzIG1pc3NpbmcK
echo ICAgICAgICAgICAgaWYgKCFGaWxlLkV4aXN0cyhodG1sUGF0aCkpCiAgICAgICAg
echo ICAgIHsKICAgICAgICAgICAgICAgIE1lc3NhZ2VCb3guU2hvdygKICAgICAgICAg
echo ICAgICAgICAgICAiQVJNTCBjb3VsZCBub3QgYmUgZm91bmQgYXQ6XHJcblxyXG4i
echo ICsKICAgICAgICAgICAgICAgICAgICAiICAgICIgKyBodG1sUGF0aCArICJcclxu
echo XHJcbiIgKwogICAgICAgICAgICAgICAgICAgICJNYWtlIHN1cmUgQVJNTC5leGUg
echo aXMgaW4gdGhlIHNhbWUgZm9sZGVyIHRoYXRcclxuIiArCiAgICAgICAgICAgICAg
echo ICAgICAgImNvbnRhaW5zIHRoZSBcdTIwMWNBUk1MIHYyLjcuMFx1MjAxZCBmb2xk
echo ZXIuIiwKICAgICAgICAgICAgICAgICAgICAiQVJNTCBMYXVuY2hlciBcdTIwMTQg
echo Tm90IEZvdW5kIiwKICAgICAgICAgICAgICAgICAgICBNZXNzYWdlQm94QnV0dG9u
echo cy5PSywKICAgICAgICAgICAgICAgICAgICBNZXNzYWdlQm94SWNvbi5FcnJvcik7
echo CiAgICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KCiAgICAgICAg
echo ICAgIC8vIDQuIE9wZW4gaW4gZGVmYXVsdCBicm93c2VyIHZpYSBTaGVsbEV4ZWN1
echo dGUKICAgICAgICAgICAgdmFyIHBzaSA9IG5ldyBQcm9jZXNzU3RhcnRJbmZvCiAg
echo ICAgICAgICAgIHsKICAgICAgICAgICAgICAgIEZpbGVOYW1lICAgICAgICAgPSBo
echo dG1sUGF0aCwKICAgICAgICAgICAgICAgIFVzZVNoZWxsRXhlY3V0ZSAgPSB0cnVl
echo LAogICAgICAgICAgICAgICAgV29ya2luZ0RpcmVjdG9yeSA9IGV4ZURpcgogICAg
echo ICAgICAgICB9OwogICAgICAgICAgICBQcm9jZXNzLlN0YXJ0KHBzaSk7CiAgICAg
echo ICAgfQogICAgICAgIGNhdGNoIChFeGNlcHRpb24gZXgpCiAgICAgICAgewogICAg
echo ICAgICAgICBNZXNzYWdlQm94LlNob3coCiAgICAgICAgICAgICAgICAiQW4gdW5l
echo eHBlY3RlZCBlcnJvciBvY2N1cnJlZDpcclxuXHJcbiIgKyBleC5NZXNzYWdlLAog
echo ICAgICAgICAgICAgICAgIkFSTUwgTGF1bmNoZXIgXHUyMDE0IEVycm9yIiwKICAg
echo ICAgICAgICAgICAgIE1lc3NhZ2VCb3hCdXR0b25zLk9LLAogICAgICAgICAgICAg
echo ICAgTWVzc2FnZUJveEljb24uRXJyb3IpOwogICAgICAgIH0KICAgIH0KfQo=
) > "%TMPB64%"
certutil -decode "%TMPB64%" "%TMPCS%" >nul 2>&1
del "%TMPB64%" >nul 2>&1
if not exist "%TMPCS%" (
    echo  [ERROR] Failed to extract launcher source.
    pause ^& exit /b 1
)
echo  [OK] Source   : extracted OK

:: ---- 4. Compile ----
echo.
echo  Compiling ...
echo.
"%CSC%" /target:winexe /out:"%~dp0ARML.exe" !ICONARG! /optimize+ /nowarn:1701,1702 /reference:System.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "%TMPCS%"
set "RESULT=%ERRORLEVEL%"
del "%TMPCS%" >nul 2>&1
if %RESULT% NEQ 0 (
    echo.
    echo  [ERROR] Compilation failed. See messages above.
    pause ^& exit /b %RESULT%
)

echo.
echo  ============================================
echo   SUCCESS  --  ARML.exe has been created!
echo  ============================================
echo.
echo   Deployment layout:
echo.
echo     [USB root or any folder]
echo     ^|
echo     +-- ARML.exe            ^<-- the launcher
echo     +-- ARML v2.7.0\         ^<-- your app folder
echo              +-- index.html
echo.
echo   ARML.exe opens ARML v2.7.0\index.html in your
echo   default browser. Works on any drive letter.
echo.
pause