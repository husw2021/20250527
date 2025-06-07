// cloudfunctions/badge/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const badgesCollection = db.collection('Badges');
const categoriesCollection = db.collection('BadgeCategories');
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, payload } = event;

  try {
    switch (action) {
      // Badge Category Actions
      case 'createBadgeCategory': {
        if (!payload || !payload.name) {
          return { code: 400, message: 'Category name is required.' };
        }
        const newCategory = {
          userId: openid,
          name: payload.name,
          icon: payload.icon || '',
          isDefault: false, // User-created categories are not default
          createdAt: new Date()
        };
        const addResult = await categoriesCollection.add({ data: newCategory });
        return { code: 201, message: 'Category created.', categoryId: addResult._id, data: { _id: addResult._id, ...newCategory} };
      }

      case 'getBadgeCategories': {
        const categories = await categoriesCollection.where(
          _.or([
            { isDefault: true },
            { userId: openid }
          ])
        ).orderBy('isDefault', 'desc').orderBy('name', 'asc').get();
        return { code: 200, data: categories.data };
      }

      // Badge Actions
      case 'createBadge': {
        if (!payload || !payload.title || !payload.categoryId || !payload.imageFileId) {
          return { code: 400, message: 'title, categoryId, and imageFileId are required.' };
        }
        const newBadge = {
          userId: openid,
          title: payload.title,
          categoryId: payload.categoryId,
          imageFileId: payload.imageFileId, // Storing File ID from client upload
          description: payload.description || '',
          issueDate: payload.issueDate ? new Date(payload.issueDate) : new Date(),
          expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
          reminderEnabled: payload.reminderEnabled || false,
          customProperties: payload.customProperties || {},
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const addResult = await badgesCollection.add({ data: newBadge });
        return { code: 201, message: 'Badge created.', badgeId: addResult._id, data: { _id: addResult._id, ...newBadge } };
      }

      case 'getBadgesByUser': {
        const query = { userId: openid };
        if (payload && payload.categoryId) {
          query.categoryId = payload.categoryId;
        }
        const badges = await badgesCollection.where(query)
          .orderBy('issueDate', 'desc')
          .orderBy('createdAt', 'desc')
          .get();
        return { code: 200, data: badges.data };
      }

      case 'getBadgeById': {
        if (!payload || !payload.badgeId) return { code: 400, message: 'badgeId required.' };
        const badgeResult = await badgesCollection.doc(payload.badgeId).get();
        if (!badgeResult.data) return { code: 404, message: 'Badge not found.' };
        if (badgeResult.data.userId !== openid) return { code: 403, message: 'Access denied.' };
        return { code: 200, data: badgeResult.data };
      }

      case 'updateBadge': {
        if (!payload || !payload.badgeId) return { code: 400, message: 'badgeId required.' };
        const { badgeId, ...updateFields } = payload;
        
        const existingBadgeResult = await badgesCollection.doc(badgeId).get(); // Renamed for clarity
        if (!existingBadgeResult.data) return { code: 404, message: 'Badge not found.' };
        if (existingBadgeResult.data.userId !== openid) return { code: 403, message: 'Access denied.' };

        delete updateFields.userId; // Cannot change owner
        delete updateFields.createdAt;
        // To prevent accidental overwrite of imageFileId if not explicitly provided for update.
        // If image update is a separate flow, this field might not be in typical update payloads.
        // If it can be updated, this delete line should be removed or conditional.
        if (updateFields.imageFileId === undefined) { // Or specific logic for image update
             delete updateFields.imageFileId;
        }


        updateFields.updatedAt = new Date();
        if (updateFields.issueDate) updateFields.issueDate = new Date(updateFields.issueDate);
        if (updateFields.expiryDate) updateFields.expiryDate = new Date(updateFields.expiryDate);
        // Ensure reminderEnabled and customProperties are handled correctly if they can be 'nulled' or emptied
        if (updateFields.reminderEnabled === undefined) delete updateFields.reminderEnabled;
        if (updateFields.customProperties === undefined) delete updateFields.customProperties;


        await badgesCollection.doc(badgeId).update({ data: updateFields });
        const updatedDoc = await badgesCollection.doc(badgeId).get();
        return { code: 200, message: 'Badge updated.', data: updatedDoc.data };
      }

      case 'deleteBadge': {
        if (!payload || !payload.badgeId) return { code: 400, message: 'badgeId required.' };
        const badgeToDelete = await badgesCollection.doc(payload.badgeId).get();
        if (!badgeToDelete.data) return { code: 404, message: 'Badge not found.' };
        if (badgeToDelete.data.userId !== openid) return { code: 403, message: 'Access denied.' };

        // Delete image from Cloud Storage
        if (badgeToDelete.data.imageFileId) {
          try {
            const deleteFileResult = await cloud.deleteFile({
              fileList: [badgeToDelete.data.imageFileId],
            });
            // Check status in deleteFileResult.fileList[0].status; 0 is success
            if (deleteFileResult.fileList && deleteFileResult.fileList.length > 0 && deleteFileResult.fileList[0].status !== 0) {
                console.warn('Failed to delete file from cloud storage:', deleteFileResult.fileList[0]);
                // Consider if this should be a critical error or just a warning
            } else if (!deleteFileResult.fileList || deleteFileResult.fileList.length === 0) {
                console.warn('Cloud storage delete response was empty or unexpected for file:', badgeToDelete.data.imageFileId);
            }
          } catch (e) {
            console.error('Error deleting file from cloud storage:', e);
            // Potentially return an error here if file deletion is critical and needs to halt process
          }
        }
        await badgesCollection.doc(payload.badgeId).remove();
        return { code: 200, message: 'Badge deleted successfully.' };
      }

      default:
        return { code: 400, message: `Invalid action: ${action}` };
    }
  } catch (error) {
    console.error(`Error in badge function, action ${action}:`, error);
    return { code: 500, message: 'Operation failed.', error: error.message, details: error };
  }
};
