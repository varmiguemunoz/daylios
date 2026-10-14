#!/usr/bin/env bash

find src \
  -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec perl -0777 -i -pe 's{/\*\*.*?\*/}{}gs' {} +

echo "Multilineal Documentation deleted"