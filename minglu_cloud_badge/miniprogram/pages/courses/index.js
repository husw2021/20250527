// pages/courses/index.js
Page({
  data: {
    courses: [] // To hold the list of courses
  },
  onLoad: function (options) {
    // Fetch courses later
  },
  navigateToCreate: function() {
    wx.navigateTo({
      url: '/pages/courses/create/index'
    });
  }
});
