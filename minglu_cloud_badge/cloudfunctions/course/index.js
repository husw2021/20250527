// cloudfunctions/course/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const coursesCollection = db.collection('Courses');
const _ = db.command;

// Helper function to calculate end date
function calculateEndDate(startDate, periodInDays) {
  const date = new Date(startDate);
  date.setDate(date.getDate() + periodInDays);
  return date;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID; // This is the userId for courses

  const { action, payload } = event;

  try {
    switch (action) {
      case 'createCourse': {
        if (!payload || !payload.name || !payload.period || !payload.startDate) {
          return { code: 400, message: 'Missing required fields (name, period, startDate).' };
        }
        const newCourse = {
          userId: openid,
          name: payload.name,
          description: payload.description || '',
          instructor: payload.instructor || '',
          period: Number(payload.period),
          startDate: new Date(payload.startDate),
          endDate: calculateEndDate(payload.startDate, Number(payload.period)),
          status: 'ongoing', // Default status
          coverImageFileId: payload.coverImageFileId || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const addResult = await coursesCollection.add({ data: newCourse });
        // TODO: Call reward function to generate initial rewards for this course if applicable
        return { code: 201, message: 'Course created successfully.', courseId: addResult._id, data: { _id: addResult._id, ...newCourse } };
      }

      case 'getCourseById': {
        if (!payload || !payload.courseId) {
          return { code: 400, message: 'courseId is required.' };
        }
        const courseResult = await coursesCollection.doc(payload.courseId).get();
        if (!courseResult.data) {
          return { code: 404, message: 'Course not found.' };
        }
        // Security: Ensure the user owns this course (or is shared with them, if that's a feature)
        if (courseResult.data.userId !== openid) {
          return { code: 403, message: 'Access denied to this course.' };
        }
        return { code: 200, data: courseResult.data };
      }

      case 'getCoursesByUser': {
        const query = { userId: openid };
        if (payload && payload.status) {
          query.status = payload.status;
        }
        const courses = await coursesCollection.where(query).orderBy('createdAt', 'desc').get();
        return { code: 200, data: courses.data };
      }

      case 'updateCourse': {
        if (!payload || !payload.courseId) {
          return { code: 400, message: 'courseId is required for update.' };
        }
        const { courseId, ...updateFields } = payload;

        // Fetch the course to verify ownership and get existing data
        const existingCourseResult = await coursesCollection.doc(courseId).get();
        if (!existingCourseResult.data) {
          return { code: 404, message: 'Course not found.' };
        }
        if (existingCourseResult.data.userId !== openid) {
          return { code: 403, message: 'Access denied to update this course.' };
        }
        
        const dataToUpdate = { ...updateFields };
        delete dataToUpdate.userId; // Prevent changing owner
        delete dataToUpdate.createdAt; // Prevent changing creation date
        dataToUpdate.updatedAt = new Date();

        // Recalculate endDate if startDate or period changes
        const currentStartDate = dataToUpdate.startDate ? new Date(dataToUpdate.startDate) : existingCourseResult.data.startDate;
        const currentPeriod = dataToUpdate.period !== undefined ? Number(dataToUpdate.period) : existingCourseResult.data.period;
        if (dataToUpdate.startDate || dataToUpdate.period !== undefined) {
            dataToUpdate.startDate = currentStartDate; // Ensure it's a Date object
            dataToUpdate.period = currentPeriod;
            dataToUpdate.endDate = calculateEndDate(currentStartDate, currentPeriod);
        }

        await coursesCollection.doc(courseId).update({ data: dataToUpdate });
        const updatedDoc = await coursesCollection.doc(courseId).get();
        return { code: 200, message: 'Course updated successfully.', data: updatedDoc.data };
      }

      case 'deleteCourse': {
        if (!payload || !payload.courseId) {
          return { code: 400, message: 'courseId is required for deletion.' };
        }
        const courseToDelete = await coursesCollection.doc(payload.courseId).get();
        if (!courseToDelete.data) {
          return { code: 404, message: 'Course not found.' };
        }
        if (courseToDelete.data.userId !== openid) {
          return { code: 403, message: 'Access denied to delete this course.' };
        }
        await coursesCollection.doc(payload.courseId).remove();
        // Consider deleting associated PunchCards and Rewards here or via a cleanup trigger
        return { code: 200, message: 'Course deleted successfully.' };
      }

      case 'getCoursesByTargetUser': { // New action
        if (!payload || !payload.targetUserId) { // Expecting targetUserId which is friend's _id
          return { code: 400, message: 'targetUserId is required.' };
        }
        
        // 1. Fetch the target user's document to get their openid (which is stored as userId in Courses)
        let targetUserOpenid;
        try {
          const userLookupResult = await cloud.callFunction({
            name: 'user', // Assuming 'user' is the name of your user management cloud function
            data: {
              action: 'getUserById',
              payload: { userId: payload.targetUserId }
            }
          });

          if (userLookupResult.result && userLookupResult.result.code === 200 && userLookupResult.result.data && userLookupResult.result.data.openid) {
            targetUserOpenid = userLookupResult.result.data.openid;
          } else {
            console.error("Failed to get target user's openid:", userLookupResult.result);
            return { code: 404, message: "Target user not found or openid missing." };
          }
        } catch (e) {
          console.error("Error calling user function to get openid:", e);
          return { code: 500, message: "Failed to retrieve target user's details." };
        }

        // 2. Fetch courses using the targetUserOpenid
        // For friends, we might only want to show 'ongoing' or 'completed' courses, not 'archived'.
        // Or, only show courses explicitly marked as 'public' by the friend (more complex, not in current schema).
        // For now, let's fetch all for simplicity of this step, assuming friend relationship implies consent.
        const query = { userId: targetUserOpenid }; 
        // if (payload && payload.status) { query.status = payload.status; } // Could add status filter

        const courses = await coursesCollection.where(query).orderBy('createdAt', 'desc').get();
        // Return a subset of fields if necessary for privacy or brevity
        const sanitizedCourses = courses.data.map(c => ({
            _id: c._id,
            name: c.name,
            status: c.status,
            period: c.period,
            startDate: c.startDate, // Needed for progress calculation on client
            endDate: c.endDate     // Needed for display on client
            // description: c.description, // Optional
            // instructor: c.instructor, // Optional
        }));
        return { code: 200, data: sanitizedCourses };
      }

      default:
        return { code: 400, message: `Invalid action: ${action}` };
    }
  } catch (error) {
    console.error(`Error in course function, action ${action}:`, error);
    return { code: 500, message: 'Operation failed.', error: error.message, details: error };
  }
};
