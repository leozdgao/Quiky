@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\node_modules\Quiky\bin\quiky" %*
) ELSE (
  node  "%~dp0\node_modules\Quiky\bin\quiky" %*
)