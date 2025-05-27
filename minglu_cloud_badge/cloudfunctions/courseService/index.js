// cloudfunctions/courseService/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// Main entry point for the cloud function
exports.main = async (event, context) => {
  const { action, payload } = event;
  // Example: Implement logic based on 'action'
  // switch (action) {
  //   case 'createCourse':
  //     return await createCourse(payload);
  //   case 'getCourse':
  //     return await getCourse(payload);
  //   default:
  //     return { code: 400, message: 'Invalid action' };
  // }
  return { code: 200, message: 'courseService called', event };
};
