#!/bin/bash
# Only rebuild if files in apps/web or packages/types changed
echo "Checking for changes in apps/web and packages/types..."

git diff HEAD^ HEAD --quiet apps/web/ packages/types/
if [ $? -eq 0 ]; then
  echo "No changes in web app or shared types. Skipping build."
  exit 0  # Skip build
else
  echo "Changes detected. Proceeding with build."
  exit 1  # Proceed with build
fi
