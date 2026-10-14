#!/usr/bin/env bash

set -e

DEST_DIR="src/test"

mkdir -p "$DEST_DIR"

find src \
  -path "$DEST_DIR" -prune -o \
  -type f -name "*.test.ts" -print0 |
while IFS= read -r -d '' FILE; do
  echo "Moving: $FILE"
  mv "$FILE" "$DEST_DIR/"
done

echo "Test files moved to test folder"