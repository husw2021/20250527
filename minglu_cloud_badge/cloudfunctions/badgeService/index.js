// cloudfunctions/badgeService/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// Main entry point for the cloud function
exports.main = async (event, context) => {
  const { action, payload } = event;
  // Example:
  // switch (action) {
  //   case 'createBadge':
  //     return await createBadge(payload);
  //   case 'getBadges':
  //     return await getBadges(payload);
  //   default:
  //     return { code: 400, message: 'Invalid action' };
  // }
  return { code: 200, message: 'badgeService called', event };
};
