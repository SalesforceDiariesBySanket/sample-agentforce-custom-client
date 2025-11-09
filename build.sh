#!/bin/bash

# Install dependencies
pnpm install

# Build the client
cd client
pnpm build
cd ..

# Build the server
cd server
pnpm build
cd ..

echo "Build completed successfully!"