#!/bin/bash
# deploy.sh — build and deploy backgammon to AWS Lightsail
set -e

HOST="bitnami@18.134.39.172"
REMOTE_DIR="/home/bitnami/backgammon"
PM2="/home/bitnami/.nvm/versions/node/v20.20.0/bin/pm2"

# Get SSH key from AWS (avoids storing it permanently)
KEY=$(mktemp)
trap "rm -f $KEY" EXIT
aws lightsail download-default-key-pair --query 'privateKeyBase64' --output text > "$KEY"
chmod 600 "$KEY"

echo "==> Building production bundle..."
npm run build

echo "==> Uploading dist/ to $HOST:$REMOTE_DIR/dist/"
scp -i "$KEY" -r dist/* "$HOST:$REMOTE_DIR/dist/"

echo "==> Restarting PM2 process..."
ssh -i "$KEY" "$HOST" "export PATH=\"/home/bitnami/.nvm/versions/node/v20.20.0/bin:\$PATH\" && $PM2 restart backgammon"

echo "==> Verifying..."
sleep 2
STATUS=$(curl -s https://backgammon.playtakethat.com/test)
echo "Health check: $STATUS"

echo "==> Deploy complete!"
