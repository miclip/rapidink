#!/bin/bash
# Upload a RapidInk document to reMarkable device
# Usage: ./upload-to-remarkable.sh <zip-file> [password]
# Or set REMARKABLE_PASSWORD environment variable
#
# This script stops xochitl, unpacks the ZIP directly into the xochitl folder,
# and restarts xochitl. This preserves page UUIDs and stroke mappings.

set -e

ZIP_FILE="$1"
PASSWORD="${2:-$REMARKABLE_PASSWORD}"
DEVICE_IP="${REMARKABLE_IP:-10.11.99.1}"
XOCHITL_PATH="/home/root/.local/share/remarkable/xochitl"

if [ -z "$ZIP_FILE" ]; then
    echo "Usage: $0 <zip-file> [password]"
    echo "  Or set REMARKABLE_PASSWORD environment variable"
    echo ""
    echo "Example:"
    echo "  export REMARKABLE_PASSWORD='your-password'"
    echo "  $0 ~/Downloads/remarkable-document.zip"
    exit 1
fi

if [ ! -f "$ZIP_FILE" ]; then
    echo "Error: File not found: $ZIP_FILE"
    exit 1
fi

if [ -z "$PASSWORD" ]; then
    echo "Error: Password required. Set REMARKABLE_PASSWORD or pass as second argument."
    echo "  Find your password in Settings > General > Software > GPLv3 compliance"
    exit 1
fi

# Check for sshpass
if ! command -v sshpass &> /dev/null; then
    echo "Error: sshpass not installed. Install with:"
    echo "  sudo apt install sshpass"
    exit 1
fi

SSH_CMD="sshpass -p $PASSWORD ssh -o StrictHostKeyChecking=no root@$DEVICE_IP"
SCP_CMD="sshpass -p $PASSWORD scp -o StrictHostKeyChecking=no"

# Get document info from ZIP
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

unzip -q "$ZIP_FILE" -d "$TEMP_DIR"
META_FILE=$(find "$TEMP_DIR" -name "*.metadata" | head -1)
if [ -z "$META_FILE" ]; then
    echo "Error: No .metadata file found in ZIP"
    exit 1
fi

DOC_UUID=$(basename "$META_FILE" .metadata)
DOC_NAME=$(grep -o '"visibleName"[[:space:]]*:[[:space:]]*"[^"]*"' "$META_FILE" | cut -d'"' -f4)

echo "Document: $DOC_NAME"
echo "UUID: $DOC_UUID"

# Count files
RM_FOLDER="$TEMP_DIR/$DOC_UUID"
if [ -d "$RM_FOLDER" ]; then
    RM_COUNT=$(find "$RM_FOLDER" -name "*.rm" 2>/dev/null | wc -l)
else
    RM_COUNT=0
fi
echo "Stroke files: $RM_COUNT"

# Upload ZIP to device
echo ""
echo "Uploading ZIP to device..."
$SCP_CMD "$ZIP_FILE" "root@$DEVICE_IP:/tmp/upload.zip"

# Unzip directly into xochitl folder, then restart
echo "Extracting to xochitl folder..."
$SSH_CMD "cd $XOCHITL_PATH && unzip -o /tmp/upload.zip && rm /tmp/upload.zip"

echo "Restarting xochitl..."
$SSH_CMD "systemctl restart xochitl"

echo ""
echo "Done! Document '$DOC_NAME' uploaded."
echo "Pull down from top of screen to refresh if needed."
