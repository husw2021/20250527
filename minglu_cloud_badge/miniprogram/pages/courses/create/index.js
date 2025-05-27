// pages/courses/create/index.js
Page({
  data: {
    title: '',
    description: '',
    instructor: '',
    courseCycleDays: 10, // Default
    startDate: '', // Will be a string like 'YYYY-MM-DD'
    cycleOptions: [10, 15, 30, 60, 90, 100]
  },
  onLoad: function (options) {
    // Initialize form data if needed
  },
  bindInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [field]: e.detail.value
    });
  },
  bindDateChange: function(e) {
    this.setData({
      startDate: e.detail.value
    });
  },
  bindCycleChange: function(e) {
     this.setData({
         courseCycleDays: this.data.cycleOptions[e.detail.value]
     });
  },
  submitCourse: function() {
    // Validate and submit course data later
    console.log('Form data:', this.data);
    // wx.cloud.callFunction({ name: 'courseService', data: { action: 'createCourse', payload: this.data }})
  }
});
