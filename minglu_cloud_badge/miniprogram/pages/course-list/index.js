// minglu_cloud_badge/miniprogram/pages/course-list/index.js
const app = getApp();
const { formatTime } = require('../../utils/util.js'); // Create util.js if not exists

Page({
  data: {
    courses: [],
    isLoading: true,
    slideButtons: [ // For mp-slideview, actions handled by bindbuttontap on slideview
      // { type: 'default', text: 'Edit', extClass: 'edit-btn', data: 'edit'}, // Example
      // { type: 'warn', text: 'Delete', extClass: 'delete-btn', data: 'delete'} // Example
    ]
  },

  onLoad: function (options) {
    // Not fetching here, using onShow for better refresh behavior
  },

  onShow: function () {
    // This ensures the list refreshes if a new course was added or edited
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({
            selected: 0 // Assuming Course List is the first tab
        });
    }
    this.fetchCourses();
  },

  fetchCourses: function () {
    this.setData({ isLoading: true });
    wx.cloud.callFunction({
      name: 'course',
      data: {
        action: 'getCoursesByUser'
        // payload: { status: 'ongoing' } // Optional: filter by status
      },
      success: res => {
        if (res.result && res.result.code === 200) {
          const processedCourses = res.result.data.map(course => {
            course.formattedEndDate = course.endDate ? formatTime(new Date(course.endDate), 'YYYY-MM-DD') : 'N/A';
            // Basic progress calculation (can be enhanced)
            if (course.status === 'ongoing' && course.startDate && course.period) {
                const startDate = new Date(course.startDate);
                const today = new Date();
                // Ensure dates are compared correctly, ignoring time for 'daysPassed'
                const startOfDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                const todayStartOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                const daysPassed = Math.max(0, Math.floor((todayStartOfDay - startOfDay) / (1000 * 60 * 60 * 24)) +1) ;
                course.progressPercent = Math.min(100, Math.max(0, (daysPassed / course.period) * 100));
            } else if (course.status === 'completed') {
                course.progressPercent = 100;
            } else {
                course.progressPercent = 0;
            }
            return course;
          });
          this.setData({ courses: processedCourses });
        } else {
          wx.showToast({ title: res.result.message || 'Failed to load courses', icon: 'none' });
          this.setData({ courses: [] }); // Clear courses on error
        }
      },
      fail: err => {
        console.error("Fetch courses error:", err);
        wx.showToast({ title: 'Error fetching courses', icon: 'none' });
        this.setData({ courses: [] }); // Clear courses on error
      },
      complete: () => {
        this.setData({ isLoading: false });
        wx.stopPullDownRefresh();
      }
    });
  },

  navigateToCreateCourse: function () {
    wx.navigateTo({ url: '../course-create/index' });
  },

  navigateToCourseDetail: function (e) {
    const courseId = e.currentTarget.dataset.courseid;
    wx.navigateTo({ url: `../course-detail/index?courseId=${courseId}` });
  },
  
  onPullDownRefresh: function() {
     this.fetchCourses();
  },

  // handleSlideButtonTap: function(e) { // Example for slideview actions
  //   const {type, data} = e.detail.button.data; // data is courseId stored on button or cell
  //   const courseId = e.currentTarget.dataset.courseid; // Need to get courseId from the cell itself
  //   console.log('Slide button tap:', type, 'for courseId:', courseId);
  //   // if (type === 'delete') { this.deleteCourse(courseId); }
  // }
});
