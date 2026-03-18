#!/bin/bash
set -e

APP_DIR="/Users/johnfoval/Desktop/Nurik/gtd-app"
PLIST_NAME="com.foval.gtd.plist"
PLIST_SRC="$APP_DIR/scripts/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "=== Foval GTD Auto-Start Setup ==="

# Build the app
echo "Building app..."
cd "$APP_DIR"
export PATH="/opt/homebrew/bin:$PATH"
npm run build

# Create log directory
mkdir -p "$APP_DIR/data/logs"

# Create backup directory
mkdir -p "$APP_DIR/data/backups"

# Unload existing if present
if launchctl list | grep -q com.foval.gtd 2>/dev/null; then
  echo "Unloading existing service..."
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# Copy plist
echo "Installing launch agent..."
cp "$PLIST_SRC" "$PLIST_DEST"

# Load it
launchctl load "$PLIST_DEST"

echo ""
echo "=== Done! ==="
echo "GTD app will now start automatically on login."
echo "Access at: http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  Stop:    launchctl unload ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Start:   launchctl load ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Rebuild: npm run deploy  (from gtd-app directory)"
echo "  Logs:    tail -f $APP_DIR/data/logs/gtd-stdout.log"
