// minglu_cloud_badge/miniprogram/pages/friend-profile/index.js
const app = getApp();
const { formatTime } = require('../../utils/util.js');

Page({
  data: {
    friendId: null, // This is the _id of the friend in Users collection
    friendInfo: null,
    friendCourses: [],
    isLoadingProfile: true,
    isLoadingCourses: true,
  },

  onLoad: function (options) {
    if (options.friendId) {
      this.setData({ friendId: options.friendId });
      this.fetchFriendAllDetails();
    } else {
      wx.showToast({ title: 'Friend ID missing', icon: 'none' });
      this.setData({ isLoadingProfile: false, isLoadingCourses: false });
    }
  },

  fetchFriendAllDetails: function() {
    if (!this.data.friendId) return;
    this.setData({ isLoadingProfile: true, isLoadingCourses: true }); // Set both true initially

    // 1. Fetch Friend's Basic Profile (using their _id)
    wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'getUserById', 
        payload: { userId: this.data.friendId }
      },
      success: res => {
        if (res.result && res.result.code === 200 && res.result.data) {
          this.setData({ friendInfo: res.result.data });
          // 2. Fetch Friend's Courses using their _id.
          // The 'getCoursesByTargetUser' cloud function is designed to accept friend's _id.
          this.fetchFriendCourses(this.data.friendId); 
        } else {
          wx.showToast({ title: res.result.message || 'Friend profile not found.', icon: 'none' });
          this.setData({ isLoadingProfile: false, isLoadingCourses: false, friendInfo: null });
        }
      },
      fail: err => {
        wx.showToast({ title: 'Error loading friend profile.', icon: 'none' });
        this.setData({ isLoadingProfile: false, isLoadingCourses: false, friendInfo: null });
      }
      // isLoadingProfile will be set to false after courses are fetched (or fail)
    });
  },

  fetchFriendCourses: function(targetUserId) { // targetUserId is friend's _id
     wx.cloud.callFunction({
         name: 'course',
         data: {
             action: 'getCoursesByTargetUser', 
             payload: { targetUserId: targetUserId } // Pass friend's _id
         },
         success: res => {
             if (res.result && res.result.code === 200) {
                 const processedCourses = res.result.data.map(course => {
                     course.statusFormatted = course.status.charAt(0).toUpperCase() + course.status.slice(1);
                     course.formattedEndDate = course.endDate ? formatTime(new Date(course.endDate), 'YYYY-MM-DD') : 'N/A';
                     if (course.status === 'ongoing' && course.startDate && course.period) {
                         const startDate = new Date(course.startDate);
                         const today = new Date();
                         today.setHours(0,0,0,0); // Normalize today
                         const startOfDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()); // Normalize start date
                         const daysPassed = Math.max(0, Math.floor((today - startOfDay) / (1000 * 60 * 60 * 24)) + 1);
                         course.progressPercent = Math.min(100, Math.max(0, (daysPassed / course.period) * 100));
                     } else if (course.status === 'completed') {
                         course.progressPercent = 100;
                     } else {
                         course.progressPercent = 0;
                     }
                     return course;
                 });
                 this.setData({ friendCourses: processedCourses });
             } else {
                 this.setData({ friendCourses: [] });
                 // Optionally show a toast if desired, but often silent failure for friend's courses is fine
                 // wx.showToast({ title: res.result.message || "Couldn't load courses", icon: 'none' });
             }
         },
         fail: err => {
             this.setData({ friendCourses: [] });
             console.error("Error fetching friend's courses:", err);
             // wx.showToast({ title: "Error loading courses", icon: 'none' });
         },
         complete: () => {
             // Both profile and courses (or their attempts) are done now
             this.setData({ isLoadingProfile: false, isLoadingCourses: false });
         }
     });
  }
});
