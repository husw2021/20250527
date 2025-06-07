// cloudfunctions/reward/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const rewardsCollection = db.collection('Rewards');
const coursesCollection = db.collection('Courses');
const punchCardsCollection = db.collection('PunchCards');
const _ = db.command;

// Define standard milestones
const MILESTONES = [
    { percent: 25, name: "Stage 1 Completion", type: 'digital_badge_unlock', valuePrefix: "Bronze Badge: " },
    { percent: 50, name: "Stage 2 Completion", type: 'digital_badge_unlock', valuePrefix: "Silver Badge: " },
    { percent: 75, name: "Stage 3 Completion", type: 'digital_badge_unlock', valuePrefix: "Gold Badge: " },
    { percent: 100, name: "Course Complete!", type: 'digital_badge_unlock', valuePrefix: "Completion Medal: " }
    // { percent: 100, name: "Bonus Points", type: 'virtual_currency', value: "100 Points" } // Example of another type
];

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, payload } = event;

  try {
    switch (action) {
      case 'generateCourseRewards': { // Called by course function or admin
        if (!payload || !payload.courseId || !payload.coursePeriod || !payload.courseName) {
          return { code: 400, message: 'courseId, coursePeriod, and courseName are required.' };
        }
        const { courseId, coursePeriod, courseName, userIdForCourse } = payload; // userIdForCourse should be course creator's openid
        const courseCreatorOpenId = userIdForCourse || openid; // If not passed, assume current user is creator

        const existingRewards = await rewardsCollection.where({ userId: courseCreatorOpenId, courseId }).count();
        if (existingRewards.total > 0) {
            return { code: 409, message: 'Rewards for this course already generated for this user.' };
        }

        const rewardsToCreate = MILESTONES.map(milestone => ({
          userId: courseCreatorOpenId,
          courseId: courseId,
          rewardType: milestone.type,
          rewardValue: milestone.valuePrefix ? `${milestone.valuePrefix}${courseName}` : milestone.value,
          description: `${milestone.name} - ${courseName} (${milestone.percent}%)`,
          isClaimed: false,
          claimedAt: null,
          milestonePercent: milestone.percent,
          issuedAt: new Date(), // Or use course.startDate from payload if available and desired
          createdAt: new Date()
        }));

        for (const reward of rewardsToCreate) {
          await rewardsCollection.add({ data: reward });
        }
        return { code: 201, message: `${rewardsToCreate.length} rewards generated for course ${courseId}.` };
      }

      case 'checkAndUnlockCourseRewards': { // Called after a successful punchcard
        if (!payload || !payload.courseId) {
          return { code: 400, message: 'courseId is required.' };
        }
        const currentUserId = payload.userId || openid; // Use payload.userId if provided (e.g. by punchcard function)
        const { courseId } = payload;

        let courseResult;
        try {
            courseResult = await coursesCollection.doc(courseId).get();
        } catch (err) {
            console.error("Error fetching course in checkAndUnlockCourseRewards:", err);
            return { code: 404, message: 'Course not found (fetch error).' };
        }
        
        if (!courseResult.data) return { code: 404, message: 'Course not found (no data).' };
        const course = courseResult.data;

        if (course.userId !== currentUserId) { // Ensure user owns the course to get its rewards
            return { code: 403, message: 'User does not own this course for reward checking.' };
        }

        const punchCardCountResult = await punchCardsCollection.where({
          userId: currentUserId,
          courseId: courseId
        }).count();
        const daysCheckedIn = punchCardCountResult.total;
        const completionPercent = course.period > 0 ? (daysCheckedIn / course.period) * 100 : 0;

        const unclaimedRewards = await rewardsCollection.where({
          userId: currentUserId,
          courseId: courseId,
          isClaimed: false,
          milestonePercent: _.lte(completionPercent) // Unlock if milestone <= current progress
        }).get();

        let unlockedRewardsInfo = [];
        if (unclaimedRewards.data.length > 0) {
          for (const reward of unclaimedRewards.data) {
            await rewardsCollection.doc(reward._id).update({
              data: {
                isClaimed: true,
                claimedAt: new Date()
              }
            });
            unlockedRewardsInfo.push({ rewardId: reward._id, description: reward.description, rewardValue: reward.rewardValue });
          }
        }
        
        // Check if course is fully completed and update status if needed
        if (completionPercent >= 100 && course.status === 'ongoing') {
            await coursesCollection.doc(courseId).update({
                data: { status: 'completed', updatedAt: new Date() }
            });
             console.log(`Course ${courseId} marked as completed for user ${currentUserId}.`);
        }

        return { 
            code: 200, 
            message: 'Rewards checked.', 
            unlockedCount: unlockedRewardsInfo.length, 
            unlockedRewards: unlockedRewardsInfo, 
            completionPercent: parseFloat(completionPercent.toFixed(2)) // Return completion %
        };
      }

      case 'getRewardsByUser': {
        const query = { userId: openid };
        if (payload && payload.isClaimed !== undefined) {
          query.isClaimed = payload.isClaimed;
        }
        const userRewards = await rewardsCollection.where(query).orderBy('createdAt', 'desc').get();
        return { code: 200, data: userRewards.data };
      }

      case 'getRewardsForCourse': {
        if (!payload || !payload.courseId) {
            return { code: 400, message: 'courseId is required.' };
        }
        const courseRewards = await rewardsCollection.where({
            userId: openid, // User should only see their own rewards for a course
            courseId: payload.courseId
        }).orderBy('milestonePercent', 'asc').get();
        return { code: 200, data: courseRewards.data };
      }

      default:
        return { code: 400, message: `Invalid action: ${action}` };
    }
  } catch (error) {
    console.error(`Error in reward function, action ${action}:`, error);
    return { code: 500, message: 'Operation failed.', error: error.message, details: error };
  }
};
