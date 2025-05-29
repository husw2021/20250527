// cloudfunctions/reminder/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const badgesCollection = db.collection('Badges');
// Users collection might be needed if userId in Badges is not openid, but it should be.
const _ = db.command;

// Helper function to format date for display in messages
function formatDateForDisplay(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${('0' + (d.getMonth() + 1)).slice(-2)}-${('0' + d.getDate()).slice(-2)}`;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // openid here might be admin's if manually triggered, or undefined if system-scheduled
  const { action, payload } = event;

  try {
    switch (action) {
      case 'getExpiringBadges': {
        // Define "nearing expiry" window (e.g., badges expiring in the next 7 days)
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const expiryWindowStart = todayStart; // From today
        const expiryWindowEnd = new Date(todayStart.getTime() + (payload.daysInAdvance || 7) * 24 * 60 * 60 * 1000); // Default 7 days

        const expiringBadgesQuery = await badgesCollection.where({
          reminderEnabled: true,
          expiryDate: _.gte(expiryWindowStart).and(_.lt(expiryWindowEnd)) // Use _.lt for end to avoid including start of 8th day
        }).get();

        let results = [];
        for (const badge of expiringBadgesQuery.data) {
          const daysUntilExpiry = Math.ceil((new Date(badge.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          results.push({
            openid: badge.userId, // Assuming userId in Badges is the openid
            badgeId: badge._id,
            badgeTitle: badge.title,
            formattedExpiryDate: formatDateForDisplay(badge.expiryDate),
            daysUntilExpiry: daysUntilExpiry > 0 ? daysUntilExpiry : 0, // ensure non-negative
          });
        }
        return { code: 200, message: `Found ${results.length} badges nearing expiry.`, data: results };
      }

      case 'sendSingleExpiryReminder': { // Renamed for clarity, as it sends one message
        if (!payload || !payload.openid || !payload.templateId || !payload.page || !payload.dataForTemplate) {
          return { code: 400, message: 'openid, templateId, page, and dataForTemplate are required.' };
        }
        
        try {
          const sendResult = await cloud.openapi.subscribeMessage.send({
            touser: payload.openid,
            page: payload.page, // e.g., 'pages/badge-detail/index?badgeId=' + payload.badgeId
            data: payload.dataForTemplate, // e.g., { thing1: { value: 'Badge Title' }, time2: { value: 'Expiry Date' } }
            templateId: payload.templateId,
            // miniprogramState: 'developer' // 'developer', 'trial', 'formal'
          });
          console.log('Subscription message send result:', sendResult);
          if (sendResult.errCode === 0) {
            return { code: 200, message: 'Subscription message sent successfully.', result: sendResult };
          } else {
            // Log error but don't necessarily stop a batch process
            console.error('Failed to send subscription message:', sendResult);
            return { code: 500, message: `Failed to send message: ${sendResult.errMsg}`, error: sendResult };
          }
        } catch (e) {
          console.error('Error calling subscribeMessage.send:', e);
          return { code: 500, message: 'Error sending subscription message.', error: e.message };
        }
      }
      
      // Example of an orchestrating function that could be scheduled
      case 'triggerDailyExpiryChecks': {
        // 1. Get all badges expiring soon (e.g. in 7 days, 3 days, 1 day)
        // This would call 'getExpiringBadges' with different 'daysInAdvance' or have more complex query
        // For simplicity, let's assume we call getExpiringBadges for a 7-day window.
        const badgesToNotifyResult = await exports.main({ action: 'getExpiringBadges', payload: { daysInAdvance: 7 } }, context);

        if (badgesToNotifyResult.code !== 200 || !badgesToNotifyResult.data || badgesToNotifyResult.data.length === 0) {
            return { code: 200, message: 'No badges require notification today.', details: badgesToNotifyResult };
        }
        
        let successCount = 0;
        let failCount = 0;
        const YOUR_TEMPLATE_ID = payload.templateId || "YOUR_BADGE_EXPIRY_TEMPLATE_ID"; // Should be configured

        for (const badgeInfo of badgesToNotifyResult.data) {
            // Customize message data based on your template
            const messageData = {
                // Example: assuming your template has {{thing1.DATA}} and {{date2.DATA}}
                thing1: { value: badgeInfo.badgeTitle.slice(0,20) }, // Max 20 chars for thing type
                date2: { value: badgeInfo.formattedExpiryDate },
                // thing3: { value: `Expires in ${badgeInfo.daysUntilExpiry} day(s)!`.slice(0,20) }
            };

            const sendPayload = {
                openid: badgeInfo.openid,
                templateId: YOUR_TEMPLATE_ID, 
                page: `pages/badge-detail/index?badgeId=${badgeInfo.badgeId}`,
                dataForTemplate: messageData
            };
            
            const singleSendResult = await exports.main({ action: 'sendSingleExpiryReminder', payload: sendPayload }, context);
            if (singleSendResult.code === 200) {
                successCount++;
            } else {
                failCount++;
            }
        }
        return { code: 200, message: `Reminder process complete. Sent: ${successCount}, Failed: ${failCount}.`};
      }

      default:
        return { code: 400, message: `Invalid action: ${action}` };
    }
  } catch (error) {
    console.error(`Error in reminder function, action ${action}:`, error);
    return { code: 500, message: 'Operation failed.', error: error.message, details: error };
  }
};
