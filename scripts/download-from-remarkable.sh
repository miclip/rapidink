#!/bin/bash
# Download a reMarkable document by UUID
# Usage: ./download-from-remarkable.sh <uuid> [password]
# Or set REMARKABLE_PASSWORD environment variable

set -e

DOC_UUID="$1"
PASSWORD="${2:-$REMARKABLE_PASSWORD}"
DEVICE_IP="${REMARKABLE_IP:-10.11.99.1}"
XOCHITL_PATH="/home/root/.local/share/remarkable/xochitl"
OUTPUT_DIR="${3:-.}"

if [ -z "$DOC_UUID" ]; then
    echo "Usage: $0 <uuid> [password] [output-dir]"
    echo "  Or set REMARKABLE_PASSWORD environment variable"
    echo ""
    echo "Find document UUIDs by running:"
    echo "  $0 --list"
    echo ""
    echo "Example:"
    echo "  export REMARKABLE_PASSWORD='your-password'"
    echo "  $0 abc123-def456-..."
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

# List documents mode
if [ "$DOC_UUID" = "--list" ]; then
    echo "Listing documents on device..."
    $SSH_CMD "cd $XOCHITL_PATH && for f in *.metadata; do echo -n \"\${f%.metadata}: \"; grep visibleName \$f | cut -d'\"' -f4; done" | sort -t: -k2
    exit 0
fi

# Create temp directory for download
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Downloading document $DOC_UUID from $DEVICE_IP..."

# Check if document exists
if ! $SSH_CMD "test -f $XOCHITL_PATH/$DOC_UUID.metadata"; then
    echo "Error: Document not found: $DOC_UUID"
    echo ""
    echo "Use --list to see available documents:"
    echo "  $0 --list"
    exit 1
fi

# Get document name
DOC_NAME=$($SSH_CMD "grep visibleName $XOCHITL_PATH/$DOC_UUID.metadata" | cut -d'"' -f4)
echo "Document name: $DOC_NAME"

# Download metadata and content files
echo "  Downloading .metadata..."
$SCP_CMD "root@$DEVICE_IP:$XOCHITL_PATH/$DOC_UUID.metadata" "$TEMP_DIR/"

echo "  Downloading .content..."
$SCP_CMD "root@$DEVICE_IP:$XOCHITL_PATH/$DOC_UUID.content" "$TEMP_DIR/" 2>/dev/null || echo "  (no .content file)"

# Download PDF if exists
if $SSH_CMD "test -f $XOCHITL_PATH/$DOC_UUID.pdf"; then
    echo "  Downloading .pdf..."
    $SCP_CMD "root@$DEVICE_IP:$XOCHITL_PATH/$DOC_UUID.pdf" "$TEMP_DIR/"
fi

# Download .rm folder if exists
if $SSH_CMD "test -d $XOCHITL_PATH/$DOC_UUID"; then
    RM_COUNT=$($SSH_CMD "find $XOCHITL_PATH/$DOC_UUID -name '*.rm' | wc -l")
    echo "  Downloading .rm folder ($RM_COUNT files)..."
    $SCP_CMD -r "root@$DEVICE_IP:$XOCHITL_PATH/$DOC_UUID" "$TEMP_DIR/"
else
    echo "  (no .rm folder - document may have no handwriting)"
fi

# Create ZIP file
SAFE_NAME=$(echo "$DOC_NAME" | tr ' /' '_-' | tr -cd '[:alnum:]_-')
OUTPUT_FILE="$(cd "$OUTPUT_DIR" && pwd)/${SAFE_NAME}-${DOC_UUID:0:8}.zip"

echo ""
echo "Creating ZIP archive..."
cd "$TEMP_DIR"
zip -r "$OUTPUT_FILE" .

echo ""
echo "Downloaded to: $OUTPUT_FILE"
echo ""

# Show summary
if [ -d "$TEMP_DIR/$DOC_UUID" ]; then
    RM_FILES=$(find "$TEMP_DIR/$DOC_UUID" -name "*.rm" | wc -l)
    echo "Summary:"
    echo "  Document: $DOC_NAME"
    echo "  UUID: $DOC_UUID"
    echo "  Handwriting pages: $RM_FILES"
    if [ -f "$TEMP_DIR/$DOC_UUID.pdf" ]; then
        PDF_SIZE=$(du -h "$TEMP_DIR/$DOC_UUID.pdf" | cut -f1)
        echo "  PDF size: $PDF_SIZE"
    fi
fi
