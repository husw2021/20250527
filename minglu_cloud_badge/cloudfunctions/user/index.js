// cloudfunctions/user/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('Users');
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, payload } = event;

  try {
    let currentUserResult = await usersCollection.where({ openid }).limit(1).get();
    let user;

    // If user doesn't exist, and action is not 'createUserPlaceholder' (which is more of an internal/login helper)
    // Attempt to call login function to create/retrieve user.
    // This ensures that by the time actions are processed, a user record should exist.
    if (!currentUserResult.data.length && action !== 'createUserPlaceholder') {
        console.log(`User with openid ${openid} not found directly. Attempting login to create/retrieve.`);
        // The CloudApiService name changed in later SDK versions.
        // For older SDKs it might be `cloud.callFunction`.
        // Assuming a modern SDK where `cloud.callFunction` is the standard way.
        const loginResult = await cloud.callFunction({
            name: 'login', // Name of the login cloud function
            data: { 
              action: 'userLogin', 
              userInfo: payload && payload.userInfo ? payload.userInfo : {} // Pass userInfo if available
            }
        });

        if (loginResult.result && (loginResult.result.code === 201 || loginResult.result.code === 200) && loginResult.result.data) {
            user = loginResult.result.data; // Use data from login function
            console.log('User record obtained/created via login function:', user);
        } else {
            console.error('User not found and login function failed to create/retrieve.', loginResult.result);
            return { code: 404, message: 'User not found. Please login first.' };
        }
    } else if (currentUserResult.data.length) {
        user = currentUserResult.data[0];
    } else if (action === 'createUserPlaceholder' && payload && payload.userInfo) {
        // This case is now primarily handled by the login function.
        // If login is called and user doesn't exist, login creates it.
        // This direct 'createUserPlaceholder' might be redundant or for specific scenarios.
        // For simplicity, we'll assume login function does its job.
        // If user is still null here, it means login failed.
        return { code: 500, message: 'User creation should be handled by login.' };
    } else {
        // Should not happen if login is effective
        return { code: 404, message: 'User not found and unable to create.' };
    }
    
    // Ensure user object is valid before proceeding
    if (!user || !user._id) {
        console.error('User object is invalid after initial fetch/creation attempt.', user);
        return { code: 500, message: 'Failed to establish user session.'};
    }


    switch (action) {
      case 'getUserProfile':
        return { code: 200, message: 'User profile fetched.', data: user };

      case 'updateUserProfile':
        if (!payload) return { code: 400, message: 'Payload is required for update.' };
        const updateData = { ...payload };
        // Prevent modification of critical fields
        delete updateData.openid; 
        delete updateData._id;    
        delete updateData.linkedUserId; // Friend linking should use 'linkFriend' action
        delete updateData.createdAt;    // Should not be changed

        updateData.updatedAt = new Date();
        
        await usersCollection.doc(user._id).update({ data: updateData });
        const updatedUser = await usersCollection.doc(user._id).get();
        return { code: 200, message: 'User profile updated.', data: updatedUser.data };

      case 'linkFriend':
        if (!payload || !payload.friendOpenidToLink) {
          return { code: 400, message: 'friendOpenidToLink is required in payload.' };
        }
        if (payload.friendOpenidToLink === openid) {
          return { code: 400, message: 'Cannot link to oneself.'};
        }

        const friendQuery = await usersCollection.where({ openid: payload.friendOpenidToLink }).limit(1).get();
        if (!friendQuery.data.length) {
          return { code: 404, message: 'Friend user to link not found.' };
        }
        const friendToLink = friendQuery.data[0];
        
        await usersCollection.doc(user._id).update({
          data: {
            linkedUserId: friendToLink._id, // Store the friend's _id
            updatedAt: new Date()
          }
        });
        // To make it mutual immediately for simplicity in this version:
        // (In a real-world scenario, this might require an acceptance flow)
        await usersCollection.doc(friendToLink._id).update({
            data: {
                linkedUserId: user._id,
                updatedAt: new Date()
            }
        });
        return { code: 200, message: `Successfully linked with friend.` };

      case 'getLinkedFriendProfile':
        if (!user.linkedUserId) {
          return { code: 200, message: 'No friend linked.', data: null }; // Return 200 with null data if no link
        }
        const friendProfileResult = await usersCollection.doc(user.linkedUserId).get();
        if (!friendProfileResult || !friendProfileResult.data) {
          // This might happen if the linked user was deleted or _id is stale
          // Optionally, clear the linkedUserId for the current user
          await usersCollection.doc(user._id).update({
            data: {
              linkedUserId: _.remove(), // Or set to null
              updatedAt: new Date()
            }
          });
          return { code: 404, message: 'Linked friend profile not found. Link cleared.' };
        }
        // For privacy, you might want to return only specific fields of the friend's profile
        // const safeFriendProfile = { nickName: friendProfileResult.data.nickName, avatarUrl: friendProfileResult.data.avatarUrl, /* other safe fields */ };
        return { code: 200, message: 'Linked friend profile fetched.', data: friendProfileResult.data };

      case 'getUserById': // New action
        // This action is intended to be called by other cloud functions or trusted client actions
        // if needing to fetch a specific user's profile by their _id.
        // Security: Ensure this is not overly permissive if called from client directly without checks.
        // For friend profile page, this is fine as friendId is opaque.
        if (!payload || !payload.userId) {
          return { code: 400, message: 'userId (_id) is required in payload.' };
        }
        try {
          const userProfile = await usersCollection.doc(payload.userId).get();
          if (!userProfile.data) {
            return { code: 404, message: 'User not found by ID.' };
          }
          // Return only necessary, non-sensitive fields for a friend's profile context
          const { nickName, avatarUrl, openid } = userProfile.data; // Include openid for course fetching by targetUserOpenid
          return { code: 200, message: 'User profile fetched by ID.', data: { _id: userProfile.data._id, nickName, avatarUrl, openid } };
        } catch (e) {
          console.error('Error fetching user by ID:', e);
          return { code: 500, message: 'Error fetching user by ID.' };
        }
      
      default:
        return { code: 400, message: `Invalid action: ${action}` };
    }
  } catch (error) {
    console.error(`Error in user function, action ${action}:`, error);
    console.error('Error details:', error.message, error.stack); // Log more details
    return { code: 500, message: 'Operation failed.', error: error.message };
  }
};
