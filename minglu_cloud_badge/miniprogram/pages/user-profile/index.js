// minglu_cloud_badge/miniprogram/pages/user-profile/index.js
const app = getApp();
const db = wx.cloud.database(); // For _.remove()
const _ = db.command;

Page({
  data: {
    userInfo: null, // User's own profile
    linkedFriendInfo: null, // Linked friend's profile
    friendOpenidInput: '',
    isLoading: false,
  },

  onShow: function () {
    this.loadUserProfile();
  },

  loadUserProfile: function() {
     this.setData({ isLoading: true });
     const globalUserInfo = app.globalData.userInfo;

     if (globalUserInfo && globalUserInfo._id) { // Check for _id to ensure it's a full record
         this.setData({ userInfo: globalUserInfo });
         if (globalUserInfo.linkedUserId) {
             this.fetchLinkedFriendProfile(globalUserInfo.linkedUserId);
         } else {
             this.setData({ linkedFriendInfo: null, isLoading: false });
         }
     } else {
         // Fallback if globalData is not populated or incomplete
         wx.cloud.callFunction({
             name: 'user',
             data: { action: 'getUserProfile' },
             success: res => {
                 if (res.result && res.result.code === 200) {
                     app.globalData.userInfo = res.result.data; // Update global
                     this.setData({ userInfo: res.result.data });
                     if (res.result.data.linkedUserId) {
                         this.fetchLinkedFriendProfile(res.result.data.linkedUserId);
                     } else {
                          this.setData({ linkedFriendInfo: null });
                     }
                 } else {
                     wx.showToast({ title: 'Failed to load profile', icon: 'none' });
                 }
             },
             fail: () => wx.showToast({ title: 'Profile fetch error', icon: 'none' }),
             complete: () => this.setData({ isLoading: false })
         });
     }
  },

  fetchLinkedFriendProfile: function (linkedUserId) {
     // Argument linkedUserId is optional, if not provided, uses from this.data.userInfo
     const targetUserId = linkedUserId || (this.data.userInfo ? this.data.userInfo.linkedUserId : null);
     if (!targetUserId) {
         this.setData({ linkedFriendInfo: null, isLoading: false }); // Ensure isLoading is off
         return;
     }
     
     // No need to set main isLoading for just friend profile if main profile is loaded
     // but we do need to ensure isLoading is eventually false if this is the last async op
     const isChainedCall = this.data.isLoading; // Check if this is part of the initial load chain

     wx.cloud.callFunction({
         name: 'user',
         data: { action: 'getLinkedFriendProfile' }, // This action internally uses current user's linkedUserId
         success: res => {
             if (res.result && res.result.code === 200 && res.result.data) {
                 this.setData({ linkedFriendInfo: res.result.data });
             } else {
                 this.setData({ linkedFriendInfo: null }); // Friend not found or error
                 // Optionally clear linkedUserId if friend was not found, indicating a broken link
                 if (res.result.code === 404 && this.data.userInfo && this.data.userInfo.linkedUserId) {
                     console.log("Linked friend not found (404), attempting to clear link.");
                     // this.unlinkFriend(true); // Pass true for silent unlink
                 }
             }
         },
         fail: () => this.setData({ linkedFriendInfo: null }),
         complete: () => {
            if(isChainedCall || !linkedUserId) { // Only turn off main isLoading if it was on for this chain
                this.setData({ isLoading: false });
            }
         }
     });
  },

  bindFriendOpenidInput: function(e) {
    this.setData({ friendOpenidInput: e.detail.value.trim() });
  },

  linkFriendAttempt: function() {
    if (!this.data.friendOpenidInput) {
      wx.showToast({ title: 'Enter Friend OpenID', icon: 'none' });
      return;
    }
    if (this.data.userInfo && this.data.friendOpenidInput === this.data.userInfo.openid) {
      wx.showToast({ title: 'Cannot link to yourself', icon: 'none' });
      return;
    }

    wx.showLoading({ title: 'Linking...' });
    wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'linkFriend',
        payload: { friendOpenidToLink: this.data.friendOpenidInput }
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.code === 200) {
          wx.showToast({ title: 'Friend Linked!', icon: 'success' });
          this.setData({ friendOpenidInput: '' }); // Clear input
          this.loadUserProfile(); // Refresh user and friend profile
        } else {
          wx.showToast({ title: res.result.message || 'Failed to link', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: 'Link request failed', icon: 'none' });
      }
    });
  },
  
  unlinkFriend: function(silent = false) { // silent parameter is not used by wx.showModal
     wx.showModal({
         title: 'Confirm Unlink',
         content: 'Are you sure you want to unlink this friend?',
         success: (modalRes) => {
             if (modalRes.confirm) {
                 wx.showLoading({ title: 'Unlinking...' });
                 wx.cloud.callFunction({
                     name: 'user',
                     data: { 
                         action: 'updateUserProfile', 
                         // To remove a field, we pass a command to remove it.
                         // The actual command might vary based on wx-server-sdk version.
                         // For newer versions, _.remove() is correct.
                         // If it's an older version, it might be { linkedUserId: db.command.remove() }
                         // or sending `null` if the backend is set up to interpret null as unlink.
                         // Assuming `_.remove()` from `const _ = db.command;`
                         payload: { linkedUserId: _.remove() } 
                     },
                     success: res => {
                         wx.hideLoading();
                         if (res.result && res.result.code === 200) {
                             wx.showToast({ title: 'Friend Unlinked', icon: 'success' });
                             app.globalData.userInfo = res.result.data; // Update global
                             this.setData({ userInfo: res.result.data, linkedFriendInfo: null });
                         } else {
                             wx.showToast({ title: res.result.message || 'Unlink failed', icon: 'none' });
                         }
                     },
                     fail: () => {
                         wx.hideLoading();
                         wx.showToast({ title: 'Unlink request error', icon: 'none' });
                     }
                 });
             }
         }
     });
  },

  navigateToFriendProfile: function() {
    if (this.data.linkedFriendInfo && this.data.linkedFriendInfo._id) { // Check for _id
      wx.navigateTo({ url: '../friend-profile/index?friendId=' + this.data.linkedFriendInfo._id });
    } else if (this.data.userInfo && this.data.userInfo.linkedUserId) {
      // Fallback if linkedFriendInfo is not populated but linkedUserId exists
      wx.navigateTo({ url: '../friend-profile/index?friendId=' + this.data.userInfo.linkedUserId });
    } else {
        wx.showToast({title: 'No friend linked or friend data missing.', icon: 'none'});
    }
  },
  
  copyOpenID: function() {
     if (this.data.userInfo && this.data.userInfo.openid) {
         wx.setClipboardData({
             data: this.data.userInfo.openid,
             success: () => wx.showToast({ title: 'OpenID Copied!' })
         });
     }
  },

  logout: function() {
     app.globalData.userInfo = null;
     app.globalData.userOpenid = null;
     // wx.removeStorageSync('userInfo'); // If using storage for persistence
     this.setData({ userInfo: null, linkedFriendInfo: null });
     wx.showToast({ title: 'Logged out', icon: 'info'});
     // Optional: navigate to index page or a login prompt page
     setTimeout(() => { // Delay to allow toast to show
        wx.reLaunch({ url: '/pages/index/index' }); 
     }, 1500);
  }
});
