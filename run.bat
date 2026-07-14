@echo off
:loop
node index.js
echo Bot çöktü veya durdu. 5 saniye içinde yeniden başlayacak...
timeout /t 5
goto loop
