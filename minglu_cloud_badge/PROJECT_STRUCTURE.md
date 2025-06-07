# Project Structure

This document outlines the directory structure and key files of the Minglu Cloud Badge WeChat Mini Program, aligned with the detailed user specification.

## Root Directory (`minglu_cloud_badge/`)

- **`miniprogram/`**: Contains all the frontend code for the Mini Program.
  - **`app.js`**: Global logic for the Mini Program.
  - **`app.json`**: Global configuration (pages, window, etc.). Updated with new page structure.
  - **`app.wxss`**: Global styles.
  - **`project.config.json`**: WeChat DevTools project configuration.
  - **`sitemap.json`**: Sitemap configuration.
  - **`images/`**: Static image assets.
  - **`style/`**: (As per user spec, though not yet explicitly created, good to list)
    - `weui.wxss` (If WeUI is added manually or via npm build, its styles would be referenced or located here/`miniprogram_npm`)
  - **`pages/`**: Contains all the pages of the Mini Program.
    - **`index/`**: Main landing/home page. (Verified)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`course-list/`**: Course listing page. (Renamed from `courses/index`)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`course-detail/`**: Course details page. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`course-create/`**: Course creation page. (Renamed from `courses/create`)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`punchcard/`**: Page for course-specific daily check-ins. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`badge-list/`**: Badge listing page. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`badge-detail/`**: Badge details page. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`badge-create/`**: Badge creation page. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`common-punchcard/`**: Page for general-purpose check-ins. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`user-profile/`**: User's profile page. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`friend-profile/`**: Linked friend's profile page. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
  - **`components/`**: Contains reusable custom components.
    - **`celebration-animation/`**: For displaying celebratory animations. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - **`card/`**: Reusable card component for UI consistency. (New)
      - `index.js`, `index.json`, `index.wxml`, `index.wxss`
    - *(Other components will be added here as developed)*
  - **`utils/`**: Contains utility functions.
    - `util.js` (As per user spec, not yet explicitly created, but good to list)
  - **`miniprogram_npm/`**: (If npm is used) Auto-generated directory for npm packages.

- **`cloudfunctions/`**: Contains all backend Cloud Functions, restructured as per user spec.
  - **`login/`**: Handles user login and authentication. (New)
    - `index.js`, `package.json`
  - **`user/`**: Manages user information. (New)
    - `index.js`, `package.json`
  - **`course/`**: Manages course data (CRUD operations). (Renamed from `courseService`)
    - `index.js`, `package.json`
  - **`punchcard/`**: Handles both course-specific and common punchcards. (Renamed from `checkinService`, `generalCheckinService` functionality merged)
    - `index.js`, `package.json`
  - **`badge/`**: Manages badge data and categories. (Renamed from `badgeService`)
    - `index.js`, `package.json`
  - **`reward/`**: Manages the reward system. (New)
    - `index.js`, `package.json`
  - **`reminder/`**: Handles reminder logic, especially for badges. (New)
    - `index.js`, `package.json`

- **Documentation Files (Root Directory):**
  - **`README.md`**: Main project overview.
  - **`FUNCTIONAL_INTRODUCTION.md`**: Detailed application features.
  - **`TECH_STACK.md`**: Technologies and libraries used.
  - **`PROJECT_STRUCTURE.md`**: This file.
  - **`DATABASE_SCHEMA.md`**: Cloud Database collection structures (already updated).
  - **`DEPLOYMENT.md`**: Setup, configuration, and deployment instructions.
  - **`FEATURE_HIGHLIGHTS.md`**: Key unique selling points.
```
