# Despliega cambios a producción (Railway redespliega solo al hacer push).
# Uso:  ./deploy.ps1 "mensaje del cambio"
# Hace: git add -A  ->  commit  ->  push a origin/main.
param([Parameter(Mandatory = $true)][string]$m)

# Trabaja siempre en la carpeta del propio script (la raíz del repo), sin importar
# desde dónde se invoque.
Set-Location -LiteralPath $PSScriptRoot

git add -A
git commit -m $m
if ($LASTEXITCODE -ne 0) { Write-Host "Nada que commitear (o falló el commit)."; exit 1 }
git push
if ($LASTEXITCODE -eq 0) {
  Write-Host "`nListo. Railway detectará el push y redeplegará en 1-2 min." -ForegroundColor Green
} else {
  Write-Host "`nEl push falló. Revisa tu conexión / credenciales de GitHub." -ForegroundColor Red
}
