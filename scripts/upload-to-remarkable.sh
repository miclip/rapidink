#!/bin/bash
# Upload a RapidInk document to reMarkable device
# Usage: ./upload-to-remarkable.sh <zip-file> [password]
# Or set REMARKABLE_PASSWORD environment variable

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

# Create temp directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Extracting $ZIP_FILE..."
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

# Find the document UUID from .metadata file
META_FILE=$(find "$TEMP_DIR" -name "*.metadata" | head -1)
if [ -z "$META_FILE" ]; then
    echo "Error: No .metadata file found in ZIP"
    exit 1
fi

DOC_UUID=$(basename "$META_FILE" .metadata)
META_DIR=$(dirname "$META_FILE")

echo "Found document: $DOC_UUID"
echo "Files located in: $META_DIR"

# Count .rm files
RM_FOLDER="$META_DIR/$DOC_UUID"
if [ -d "$RM_FOLDER" ]; then
    RM_COUNT=$(find "$RM_FOLDER" -name "*.rm" | wc -l)
    echo "Found $RM_COUNT .rm files to upload"
else
    echo "Warning: No .rm folder found at $RM_FOLDER"
    RM_COUNT=0
fi

echo "Uploading to $DEVICE_IP..."

# Upload the document folder (contains .rm files)
if [ -d "$RM_FOLDER" ] && [ "$RM_COUNT" -gt 0 ]; then
    echo "  Uploading .rm files folder..."
    sshpass -p "$PASSWORD" scp -r -o StrictHostKeyChecking=no \
        "$RM_FOLDER" \
        "root@$DEVICE_IP:$XOCHITL_PATH/"
fi

# Upload sibling files (.metadata, .content, .pdf)
for ext in metadata content pdf; do
    FILE="$META_DIR/$DOC_UUID.$ext"
    if [ -f "$FILE" ]; then
        echo "  Uploading $DOC_UUID.$ext..."
        sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no \
            "$FILE" \
            "root@$DEVICE_IP:$XOCHITL_PATH/"
    fi
done

# Optionally restart xochitl
if [ "$RESTART_XOCHITL" = "1" ]; then
    echo "Restarting xochitl service..."
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no \
        "root@$DEVICE_IP" "systemctl restart xochitl"
    echo "Your reMarkable should reload and show the new document."
else
    echo ""
    echo "Document uploaded. Pull down from top of screen to refresh, or restart device."
    echo "To auto-restart xochitl, run with: RESTART_XOCHITL=1 $0 ..."
fi

echo ""
echo "Done!"
