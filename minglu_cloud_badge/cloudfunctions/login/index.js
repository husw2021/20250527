// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV 
});

const db = cloud.database();
const usersCollection = db.collection('Users'); // As per DATABASE_SCHEMA.md
const _ = db.command;

// Main entry point for the cloud function
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID; // Reliably get openid from WXContext

  const { action, userInfo } = event; // userInfo might be passed from client on first login with authorization

  switch (action) {
    case 'userLogin':
      try {
        // Check if user exists
        const userQueryResult = await usersCollection.where({ openid }).limit(1).get();
        let userRecord;

        if (userQueryResult.data.length > 0) {
          // User exists
          userRecord = userQueryResult.data[0];
          const updateData = {
            updatedAt: new Date()
          };
          // Optionally update user info if provided and different
          // This part is more relevant if user explicitly updates profile later
          // or if initial login passes more details beyond basic openid.
          if (userInfo) {
            if (userInfo.nickName && userInfo.nickName !== userRecord.nickName) {
              updateData.nickName = userInfo.nickName;
            }
            if (userInfo.avatarUrl && userInfo.avatarUrl !== userRecord.avatarUrl) {
              updateData.avatarUrl = userInfo.avatarUrl;
            }
            if (userInfo.gender !== undefined && userInfo.gender !== userRecord.gender) {
              updateData.gender = userInfo.gender;
            }
          }
          
          if (Object.keys(updateData).length > 1) { // if more than just updatedAt
            await usersCollection.doc(userRecord._id).update({
              data: updateData
            });
            // Re-fetch to get the merged data
             const updatedUser = await usersCollection.doc(userRecord._id).get();
             userRecord = updatedUser.data;
          }
           console.log('User logged in:', userRecord);
          return {
            code: 200,
            message: 'User logged in successfully.',
            data: userRecord
          };
        } else {
          // User does not exist, create new user
          const newUser = {
            openid: openid,
            nickName: userInfo && userInfo.nickName ? userInfo.nickName : 'New User', // Default or from client
            avatarUrl: userInfo && userInfo.avatarUrl ? userInfo.avatarUrl : '', // Default or from client
            gender: userInfo && userInfo.gender !== undefined ? userInfo.gender : 0, // Default or from client
            linkedUserId: null, // Initialize as null
            createdAt: new Date(),
            updatedAt: new Date()
          };
          const addUserResult = await usersCollection.add({
            data: newUser
          });
          // Fetch the newly created user record to include _id
          const createdUser = await usersCollection.doc(addUserResult._id).get();
          console.log('New user created:', createdUser.data);
          return {
            code: 201, // 201 for created resource
            message: 'New user created successfully.',
            data: createdUser.data 
          };
        }
      } catch (error) {
        console.error('Login error:', error);
        return {
          code: 500,
          message: 'Login failed.',
          error: error.message
        };
      }
    default:
      return {
        code: 400,
        message: `Invalid action: ${action}`
      };
  }
};
