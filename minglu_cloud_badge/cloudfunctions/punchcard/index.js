// cloudfunctions/punchcard/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const punchCardsCollection = db.collection('PunchCards'); // For course check-ins
const commonPunchCardsCollection = db.collection('CommonPunchCards'); // For general check-ins
const coursesCollection = db.collection('Courses');
const _ = db.command;
const $ = db.command.aggregate;

// Helper to normalize date to YYYY-MM-DD string for consistent querying/storage if needed
function normalizeDateStr(dateStrOrDate) {
    const d = new Date(dateStrOrDate);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
}


exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID; // This is the userId

  const { action, payload } = event;

  try {
    switch (action) {
      // --- Course Check-in Actions (Existing, with reward integration) ---
      case 'recordCourseCheckIn': {
        if (!payload || !payload.courseId || !payload.punchDate) {
          return { code: 400, message: 'courseId and punchDate are required.' };
        }

        const { courseId, punchDate, notes } = payload;
        const punchDateObj = new Date(normalizeDateStr(punchDate)); 

        let courseResult;
        try {
            courseResult = await coursesCollection.doc(courseId).get();
        } catch(err) {
            return { code: 404, message: 'Course not found (error fetching).' };
        }

        if (!courseResult.data) {
          return { code: 404, message: 'Course not found.' };
        }
        const course = courseResult.data;

        if (course.userId !== openid) {
          return { code: 403, message: 'Access denied. You do not own this course.' };
        }
        if (course.status !== 'ongoing') {
          return { code: 400, message: `Course is not ongoing (status: ${course.status}).` };
        }
        
        const courseStartDate = new Date(course.startDate);
        const courseEndDate = new Date(course.endDate);
        if (punchDateObj < courseStartDate || punchDateObj > courseEndDate) {
          return { code: 400, message: 'Punch date is outside the course duration.' };
        }

        const existingCheckIn = await punchCardsCollection.where({
          userId: openid,
          courseId: courseId,
          punchDate: punchDateObj 
        }).limit(1).get();

        if (existingCheckIn.data.length > 0) {
          return { code: 409, message: 'Already checked in for this course on this date.' };
        }

        const newCheckInData = {
          userId: openid,
          courseId: courseId,
          punchDate: punchDateObj,
          notes: notes || '',
          createdAt: new Date()
        };
        const addResult = await punchCardsCollection.add({ data: newCheckInData });

        // ** CRITICAL INTEGRATION: Call reward checking after successful check-in **
        if (addResult._id) {
           console.log(`Calling checkAndUnlockCourseRewards for user ${openid}, course ${courseId}`);
           // Intentionally not awaiting this, to not block the check-in response.
           // Error handling for this should be internal to the reward function or a separate monitoring mechanism.
           cloud.callFunction({
               name: 'reward', 
               data: {
                   action: 'checkAndUnlockCourseRewards',
                   payload: { userId: openid, courseId: courseId }
               }
           }).then(rewardRes => {
               console.log('Reward check result:', rewardRes.result);
           }).catch(rewardErr => {
               console.error('Error calling reward check:', rewardErr);
           });
        }

        return { code: 201, message: 'Check-in recorded successfully.', checkInId: addResult._id, data: newCheckInData };
      }

      case 'getCheckInHistoryForCourse': {
        if (!payload || !payload.courseId) {
          return { code: 400, message: 'courseId is required.' };
        }
        const checkIns = await punchCardsCollection.where({
          userId: openid,
          courseId: payload.courseId
        })
        .orderBy('punchDate', 'desc')
        .get();
        return { code: 200, data: checkIns.data };
      }
      
      case 'getCheckInsForDateRange': { 
        if (!payload || !payload.startDate || !payload.endDate) {
          return { code: 400, message: 'startDate and endDate are required.' };
        }
        const queryStartDate = new Date(normalizeDateStr(payload.startDate));
        const queryEndDate = new Date(normalizeDateStr(payload.endDate));
        
        const rangeCheckIns = await punchCardsCollection.where({
            userId: openid,
            punchDate: _.gte(queryStartDate).and(_.lte(queryEndDate))
        })
        .orderBy('punchDate', 'desc')
        .get();
        return { code: 200, data: rangeCheckIns.data };
      }

      // --- Common Check-in Actions (New) ---
      case 'recordCommonCheckIn': {
        if (!payload || !payload.checkInType) {
          return { code: 400, message: 'checkInType is required.' };
        }

        const {
          checkInType, textContent, imageFileId, audioFileId,
          mood, location, tags
        } = payload;

        const validTypes = ['log', 'photo', 'audio', 'mood'];
        if (!validTypes.includes(checkInType)) {
          return { code: 400, message: `Invalid checkInType. Must be one of: ${validTypes.join(', ')}` };
        }

        if (checkInType === 'photo' && !imageFileId) {
          return { code: 400, message: 'imageFileId is required for photo check-in.' };
        }
        if (checkInType === 'audio' && !audioFileId) {
          return { code: 400, message: 'audioFileId is required for audio check-in.' };
        }
        // Optional: Add more specific validation for 'log' or 'mood' textContent if desired.

        const newCommonCheckIn = {
          userId: openid,
          checkInType,
          textContent: textContent || null,
          imageFileId: imageFileId || null,
          audioFileId: audioFileId || null,
          mood: mood || null,
          location: location || null, // Consider validating location object structure if strict
          tags: Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string' && tag.trim() !== '') : [],
          punchDateTime: new Date(),
          createdAt: new Date()
        };

        const addResult = await commonPunchCardsCollection.add({ data: newCommonCheckIn });
        return { code: 201, message: 'Common check-in recorded.', checkInId: addResult._id, data: newCommonCheckIn };
      }

      case 'getCommonCheckInHistory': {
        const { page = 1, pageSize = 10, checkInType: typeFilter } = payload || {};
        const skip = (page - 1) * pageSize;

        let query = { userId: openid };
        if (typeFilter) {
            const validTypes = ['log', 'photo', 'audio', 'mood'];
            if (validTypes.includes(typeFilter)) {
                query.checkInType = typeFilter;
            } else {
                // Optionally ignore invalid filter or return error
                console.warn(`Invalid checkInType filter ignored: ${typeFilter}`);
            }
        }

        const historyQuery = commonPunchCardsCollection.where(query)
          .orderBy('punchDateTime', 'desc')
          .skip(skip)
          .limit(pageSize);
        
        const [historyResult, countResult] = await Promise.all([
            historyQuery.get(),
            commonPunchCardsCollection.where(query).count()
        ]);

        return { 
            code: 200, 
            data: historyResult.data,
            pagination: {
                currentPage: page,
                pageSize: pageSize,
                totalItems: countResult.total,
                totalPages: Math.ceil(countResult.total / pageSize)
            }
        };
      }

      default:
        return { code: 400, message: `Invalid action: ${action}` };
    }
  } catch (error) {
    console.error(`Error in punchcard function, action ${action}:`, error);
    return { code: 500, message: 'Operation failed.', error: error.message, details: error };
  }
};
