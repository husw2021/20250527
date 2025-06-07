// minglu_cloud_badge/miniprogram/pages/punchcard/index.js
const app = getApp();
const { formatTime } = require('../../utils/util.js'); // Ensure util.js is present

Page({
  data: {
    courseId: null,
    courseName: 'N/A',
    punchDate: '', // Stores 'YYYY-MM-DD'
    punchDateFormatted: '', // Stores user-friendly display
    notes: '',
    showSuccessAnimation: false,
    successMessage: "Checked In!", // Default message
    isLoading: false
  },

  onLoad: function (options) {
    const today = new Date();
    const todayFormatted = formatTime(today, 'YYYY-MM-DD');
    const displayDate = formatTime(today, 'YYYY-MM-DD'); // Or any other format like 'Month D, YYYY'

    this.setData({
      courseId: options.courseId || null,
      courseName: options.courseName ? decodeURIComponent(options.courseName) : 'Course Check-in',
      punchDate: todayFormatted,
      punchDateFormatted: displayDate 
    });

    if (!options.courseId) {
      wx.showToast({ title: 'Course ID missing!', icon: 'none', duration: 2000 });
      // Consider wx.navigateBack();
    }
  },

  bindDateChange: function(e) {
    const selectedDate = e.detail.value;
    this.setData({
      punchDate: selectedDate, // YYYY-MM-DD
      punchDateFormatted: selectedDate // Or format it differently if needed
    });
  },

  bindNotesInput: function(e) {
    this.setData({
      notes: e.detail.value
    });
  },

  submitCheckIn: function() {
    if (!this.data.punchDate) {
      wx.showToast({ title: 'Please select a check-in date.', icon: 'none' });
      return;
    }
    if (!this.data.courseId) {
      wx.showToast({ title: 'Error: Course ID is missing.', icon: 'none' });
      return;
    }
    
    this.setData({ isLoading: true });
    wx.showLoading({ title: 'Submitting...' });

    wx.cloud.callFunction({
      name: 'punchcard',
      data: {
        action: 'recordCourseCheckIn',
        payload: {
          courseId: this.data.courseId,
          punchDate: this.data.punchDate,
          notes: this.data.notes
        }
      },
      success: res => {
        wx.hideLoading();
        this.setData({ isLoading: false });
        if (res.result && res.result.code === 201) {
          this.setData({ showSuccessAnimation: true });
          wx.showToast({ title: 'Check-in Successful!', icon: 'success', duration: 1500 });
          
          // Notify previous page (course-detail) to refresh
          const pages = getCurrentPages();
          if (pages.length >= 2) {
             const prevPage = pages[pages.length - 2];
             // Check if prevPage is course-detail and has a refreshData method
             // The check for prevPage.route is a good idea if there are multiple potential previous pages
             if (prevPage.route === 'pages/course-detail/index' && typeof prevPage.refreshData === 'function') {
                 prevPage.refreshData({ fromPunchcard: true, date: this.data.punchDate }); 
             }
          }

          // wx.showToast({ title: 'Check-in Successful!', icon: 'success', duration: 1500 }); // Optional
          
          // Notify previous page (course-detail) to refresh
          const pages = getCurrentPages();
          if (pages.length >= 2) {
             const prevPage = pages[pages.length - 2];
             if (prevPage.route === 'pages/course-detail/index' && typeof prevPage.refreshData === 'function') {
                 prevPage.refreshData({ fromPunchcard: true, date: this.data.punchDate }); 
             }
          }
          
          this.setData({ 
              showSuccessAnimation: true,
              successMessage: this.data.courseName ? `Checked into ${this.data.courseName}!` : "Check-in Recorded!" 
          });
          // Navigation back is now handled by handleAnimationEnd
        } else {
          wx.showToast({ title: res.result.message || 'Check-in failed.', icon: 'none', duration: 2500 });
        }
      },
      fail: err => {
        wx.hideLoading();
        this.setData({ isLoading: false });
        console.error("Submit check-in error:", err);
        wx.showToast({ title: 'Submission Failed', icon: 'none', duration: 2500 });
      }
    });
  },

  handleAnimationEnd: function() {
    console.log("Animation ended on punchcard page, navigating back.");
    this.setData({ showSuccessAnimation: false });
    wx.navigateBack();
  }
});
