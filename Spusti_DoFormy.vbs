Set WshShell = CreateObject("WScript.Shell")
' Najskôr rázne vypne akýkoľvek už bežiaci DoFormy server (ak tam zostal visieť)
WshShell.Run "taskkill /F /IM python.exe /T", 0, True
' Potom spustí náš server (2 = Minimized window)
WshShell.Run "python server.py", 2, False
