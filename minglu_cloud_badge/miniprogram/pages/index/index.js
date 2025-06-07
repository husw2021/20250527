// pages/index/index.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    canIUseGetUserProfile: wx.canIUse('getUserProfile') // Check for API availability
  },
  onLoad: function() {
    // Try to load user info from global data on page load
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
    }
  },
  onShow: function() {
     // Update user info on page show, in case it changed elsewhere (e.g. app.js onLaunch)
     if (app.globalData.userInfo) {
         this.setData({
             userInfo: app.globalData.userInfo
         });
     } else {
         // If no global userInfo, ensure local page data is also clear
         this.setData({
             userInfo: null
         });
     }
  },
  handleUserLogin: function(e) {
    if (!this.data.canIUseGetUserProfile) {
      // Fallback for older WeChat versions if needed, though getUserProfile is standard now
      // For this example, we'll rely on canIUse to gate the feature or prompt update
      wx.showModal({
        title: 'Hint',
        content: 'Current WeChat version is too low, please upgrade to use this feature.',
        showCancel: false
      });
      return;
    }

    wx.getUserProfile({
      desc: 'For user profile display and login', // This description is shown to the user
      success: (res) => {
        console.log('wx.getUserProfile success:', res);
        const detailedUserInfo = res.userInfo; // Contains nickName, avatarUrl, gender, etc.

        wx.showLoading({ title: 'Logging in...' });
        wx.cloud.callFunction({
          name: 'login',
          data: {
            action: 'userLogin',
            userInfo: detailedUserInfo // Pass the fetched user info to the cloud function
          },
          success: cfnRes => {
            wx.hideLoading();
            console.log('Login cloud function success:', cfnRes);
            if (cfnRes.result && (cfnRes.result.code === 200 || cfnRes.result.code === 201)) {
              app.globalData.userInfo = cfnRes.result.data;
              app.globalData.userOpenid = cfnRes.result.data.openid;
              this.setData({
                userInfo: cfnRes.result.data
              });
              // Optional: Store in local storage for persistence across app closes
              // wx.setStorage({ key: 'userInfo', data: cfnRes.result.data });
              wx.showToast({ title: 'Login Successful!', icon: 'success' });
            } else {
              wx.showToast({ title: cfnRes.result.message || 'Login Failed', icon: 'none' });
            }
          },
          fail: cfnErr => {
            wx.hideLoading();
            console.error('Login cloud function error:', cfnErr);
            wx.showToast({ title: 'Login Call Failed', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('wx.getUserProfile error:', err);
        wx.showToast({ title: 'Failed to get user profile', icon: 'none' });
      }
    });
  },
  navigateToUserProfile: function() {
     wx.navigateTo({ url: '/pages/user-profile/index' });
  },
  navigateToFriendProfile: function() {
     if (this.data.userInfo && this.data.userInfo.linkedUserId) {
         wx.navigateTo({ url: '/pages/friend-profile/index' });
     } else {
         wx.showToast({ title: 'No friend linked', icon: 'none'});
     }
  },
  promptLinkFriend: function() {
     // This could navigate to a search page or a dedicated linking page
     // For now, just a placeholder or navigate to user-profile where such UI might exist
     wx.navigateTo({ url: '/pages/user-profile/index?action=promptLinkFriend' });
  },
  navigateToCourseList: function() { wx.navigateTo({ url: '/pages/course-list/index'}); },
  navigateToBadgeList: function() { wx.navigateTo({ url: '/pages/badge-list/index'}); },
  navigateToCommonPunchcard: function() { wx.navigateTo({ url: '/pages/common-punchcard/index'}); }
});
