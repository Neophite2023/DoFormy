Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "python server.py", 0, False
MsgBox "FitnessPal server beží na pozadí." & vbCrLf & "Otvorte http://localhost:8000/mobile v prehliadači.", vbInformation, "FitnessPal"
