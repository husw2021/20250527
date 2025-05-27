# Installation and Deployment Guide

## Cloud Development Setup
- Open the project in WeChat DevTools.
- Click on the 'Cloud Development' (云开发) button in the toolbar.
- If it's the first time, you'll be prompted to activate it. Choose a name for your cloud environment (e.g., 'minglu-env').
- Once initialized, you will get a Cloud Environment ID. This ID is crucial for accessing cloud resources from your Mini Program and Cloud Functions.
- Note down your Environment ID. You will need to configure it in `miniprogram/app.js` or a similar configuration file (e.g., `miniprogram/env.js`). Example: `wx.cloud.init({ env: 'YOUR_CLOUD_ENV_ID' })`.

### Accessing Cloud Resources
- Cloud Database: Accessed via `wx.cloud.database()`.
- Cloud Storage: Accessed via `wx.cloud.uploadFile()`, `wx.cloud.downloadFile()`, etc.
- Cloud Functions: Called using `wx.cloud.callFunction({ name: 'functionName', data: {} })`.

## WeUI Integration
WeUI is a UI library that provides a set of styles and components consistent with WeChat's native visual experience.

**Method 1: Using npm (Recommended for WeUI WXSS)**
- Initialize npm in your miniprogram root if you haven't already: `npm init -y` (Run this command in the `miniprogram/` directory).
- Install WeUI WXSS: `npm install weui-wxss`.
- In WeChat DevTools, click 'Tools' -> 'Build npm'.
- In your `app.wxss`, import the base WeUI styles: `@import 'miniprogram_npm/weui-wxss/dist/style/weui.wxss';` (Adjust path if necessary after npm build).

**Method 2: Manual Import (For WeUI Components or older versions)**
- Download the WeUI library from its official repository (e.g., GitHub).
- Copy the relevant WeUI component directories (e.g., `weui-miniprogram/miniprogram_dist/`) into your `miniprogram/components/` directory or a dedicated `weui/` directory within `miniprogram/`.
- Reference the specific components you need in your page's `.json` file under `usingComponents`.

Choose the method that best suits your project needs. For this project, we'll primarily rely on the WeUI WXSS for styling and may use specific WeUI components if needed.
