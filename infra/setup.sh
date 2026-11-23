#!/usr/bin/env bash
# One-time Azure setup for the group. Safe to re-run: existing resources are kept,
# and the database password is rotated and written to the Container Apps secrets.
#
# Usage: CLASS=3b GROUP=7 ./infra/setup.sh
# Requires: az (logged in with your IE account, IE Workspaces selected) and gh (logged in).

set -euo pipefail

: "${CLASS:?Set CLASS, e.g. CLASS=3b}"
: "${GROUP:?Set GROUP, e.g. GROUP=7}"

PREFIX="sdd-${CLASS}-g${GROUP}"
RG="rg-${PREFIX}"
SERVICES=(wardrobe outfit)
SQL_SERVER="${PREFIX}-sql"
SQL_ADMIN="sqladmin"
ENVIRONMENT="${PREFIX}-env"
WORKSPACE="${PREFIX}-logs"
UI="${PREFIX}-ui"
# Static Web Apps is only offered in a few regions.
SWA_LOCATIONS="westeurope westus2 centralus eastus2 eastasia"

exists() { "$@" --only-show-errors >/dev/null 2>&1; }

echo "Checking resource group ${RG}"
if ! LOCATION=$(az group show --name "$RG" --query location -o tsv 2>/dev/null); then
  echo "Resource group ${RG} not found or no access. It is created by the professor, not by this script." >&2
  exit 1
fi
echo "Location: ${LOCATION}"

az extension add --name containerapp --upgrade --only-show-errors

echo "Log Analytics workspace ${WORKSPACE}"
exists az monitor log-analytics workspace show -g "$RG" -n "$WORKSPACE" ||
  az monitor log-analytics workspace create -g "$RG" -n "$WORKSPACE" -l "$LOCATION" \
    --retention-time 30 --only-show-errors >/dev/null
WORKSPACE_ID=$(az monitor log-analytics workspace show -g "$RG" -n "$WORKSPACE" --query customerId -o tsv)

echo "Container Apps environment ${ENVIRONMENT}"
if ! exists az containerapp env show -g "$RG" -n "$ENVIRONMENT"; then
  WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n "$WORKSPACE" \
    --query primarySharedKey -o tsv)
  az containerapp env create -g "$RG" -n "$ENVIRONMENT" -l "$LOCATION" \
    --logs-workspace-id "$WORKSPACE_ID" --logs-workspace-key "$WORKSPACE_KEY" \
    --only-show-errors >/dev/null
fi

echo "SQL server ${SQL_SERVER}"
DB_PASSWORD="Sdd1-$(openssl rand -hex 16)"
if exists az sql server show -g "$RG" -n "$SQL_SERVER"; then
  az sql server update -g "$RG" -n "$SQL_SERVER" --admin-password "$DB_PASSWORD" \
    --only-show-errors >/dev/null
else
  az sql server create -g "$RG" -n "$SQL_SERVER" -l "$LOCATION" \
    --admin-user "$SQL_ADMIN" --admin-password "$DB_PASSWORD" --only-show-errors >/dev/null
fi
# 0.0.0.0 is Azure's rule for "allow Azure services", which lets the Container Apps connect.
exists az sql server firewall-rule show -g "$RG" -s "$SQL_SERVER" -n AllowAzureServices ||
  az sql server firewall-rule create -g "$RG" -s "$SQL_SERVER" -n AllowAzureServices \
    --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 --only-show-errors >/dev/null

for service in "${SERVICES[@]}"; do
  db="${PREFIX}-${service}-db"
  echo "Serverless database ${db}"
  exists az sql db show -g "$RG" -s "$SQL_SERVER" -n "$db" ||
    az sql db create -g "$RG" -s "$SQL_SERVER" -n "$db" \
      --edition GeneralPurpose --compute-model Serverless --family Gen5 --capacity 1 \
      --min-capacity 0.5 --auto-pause-delay 60 --backup-storage-redundancy Local \
      --only-show-errors >/dev/null
done

echo "Static Web App ${UI}"
if ! exists az staticwebapp show -g "$RG" -n "$UI"; then
  SWA_LOCATION="westeurope"
  [[ " $SWA_LOCATIONS " == *" $LOCATION "* ]] && SWA_LOCATION="$LOCATION"
  az staticwebapp create -g "$RG" -n "$UI" -l "$SWA_LOCATION" --sku Free --only-show-errors >/dev/null
fi
UI_ORIGIN="https://$(az staticwebapp show -g "$RG" -n "$UI" --query defaultHostname -o tsv)"

# The pipeline replaces the placeholder image with ours on the first deploy.
upsert_app() {
  local service=$1
  shift
  local app="${PREFIX}-${service}"
  local env_vars=(
    "DB_HOST=${SQL_SERVER}.database.windows.net"
    "DB_NAME=${PREFIX}-${service}-db"
    "DB_USER=${SQL_ADMIN}"
    "DB_PASSWORD=secretref:db-password"
    "ALLOWED_ORIGIN=${UI_ORIGIN}"
    "$@"
  )
  echo "Container App ${app}"
  if exists az containerapp show -g "$RG" -n "$app"; then
    az containerapp secret set -g "$RG" -n "$app" --secrets "db-password=${DB_PASSWORD}" \
      --only-show-errors >/dev/null
    az containerapp update -g "$RG" -n "$app" --set-env-vars "${env_vars[@]}" \
      --only-show-errors >/dev/null
  else
    az containerapp create -g "$RG" -n "$app" --environment "$ENVIRONMENT" \
      --image mcr.microsoft.com/k8se/quickstart:latest --target-port 80 --ingress external \
      --min-replicas 0 --max-replicas 1 --cpu 0.25 --memory 0.5Gi \
      --secrets "db-password=${DB_PASSWORD}" --env-vars "${env_vars[@]}" \
      --only-show-errors >/dev/null
  fi
}

upsert_app wardrobe
WARDROBE_URL="https://$(az containerapp show -g "$RG" -n "${PREFIX}-wardrobe" \
  --query properties.configuration.ingress.fqdn -o tsv)"
upsert_app outfit "WARDROBE_URL=${WARDROBE_URL}"

echo "GitHub variables for the pipeline"
gh variable set AZURE_PREFIX --body "$PREFIX"
gh variable set AZURE_RESOURCE_GROUP --body "$RG"

echo
echo "Done."
echo "UI:       ${UI_ORIGIN}"
echo "Wardrobe: ${WARDROBE_URL}"
echo "Outfit:   https://$(az containerapp show -g "$RG" -n "${PREFIX}-outfit" \
  --query properties.configuration.ingress.fqdn -o tsv)"
