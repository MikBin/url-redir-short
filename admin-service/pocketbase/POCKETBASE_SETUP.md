# PocketBase Setup

This document provides instructions on how to set up PocketBase for the Admin Service locally.

## Downloading PocketBase

1. Go to the [PocketBase Releases](https://github.com/pocketbase/pocketbase/releases) page on GitHub.
2. Download the appropriate binary for your operating system and architecture (e.g., `pocketbase_0.22.x_linux_amd64.zip`, `pocketbase_0.22.x_darwin_arm64.zip`, or `pocketbase_0.22.x_windows_amd64.zip`).
3. Extract the downloaded zip file into a dedicated directory.

## Starting the PocketBase Server

1. Open your terminal and navigate to the directory where you extracted the `pocketbase` executable.
2. Run the following command to start the server:

   ```bash
   ./pocketbase serve
   ```
   *(On Windows, run `pocketbase.exe serve`)*

3. The server will start and provide a local address (usually `http://127.0.0.1:8090`).

## Creating an Admin Account

1. While the server is running, open a web browser and navigate to the Admin UI:
   `http://127.0.0.1:8090/_/`
2. You will be prompted to create your first admin account.
3. Enter a valid email address and a secure password.
4. Click **Create and login** to complete the setup and access the dashboard.
