Var OPsCoderFreshInstall

!macro customInit
  StrCpy $OPsCoderFreshInstall "0"
  IfFileExists "$INSTDIR\OPsCoder.exe" 0 opscoder_no_existing_install
  MessageBox MB_YESNO|MB_ICONQUESTION "OPsCoder is already installed.$\r$\n$\r$\nYes: Update and keep your connections, API keys, and chats.$\r$\nNo: Fresh install (remove the existing app and erase all local OPsCoder data)." IDYES opscoder_keep_data
  StrCpy $OPsCoderFreshInstall "1"
  Goto opscoder_no_existing_install
  opscoder_keep_data:
  StrCpy $OPsCoderFreshInstall "0"
  opscoder_no_existing_install:
!macroend

!macro customInstall
  ${if} $OPsCoderFreshInstall == "1"
    RMDir /r "$APPDATA\opscoder"
  ${endIf}
!macroend
