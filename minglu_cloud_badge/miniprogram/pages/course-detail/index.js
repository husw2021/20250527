// minglu_cloud_badge/miniprogram/pages/course-detail/index.js
const app = getApp();
const { formatTime } = require('../../utils/util.js');

Page({
  data: {
    courseId: null,
    course: null,
    isLoading: true,
    isLoadingCheckIns: false,
    checkIns: [],
    isCheckedInToday: false,
    rewards: [], // New
    isLoadingRewards: false // New
  },

  onLoad: function (options) {
    if (options.courseId) {
      this.setData({ courseId: options.courseId });
    } else {
      wx.showToast({ title: 'Course ID missing', icon: 'none', duration: 2000 });
      this.setData({ isLoading: false, course: null, isLoadingCheckIns: false, isLoadingRewards: false });
    }
  },
  
  onShow: function() {
    if (this.data.courseId) {
        this.fetchCourseDetail(); 
    }
  },
  
  refreshData: function(options) {
    console.log('refreshData called on course-detail with options:', options);
    if (this.data.courseId) {
        this.fetchCourseDetail(); 
        // fetchCheckInHistory and fetchCourseRewards are called within fetchCourseDetail's success path
    }
  },

  fetchCourseDetail: function () {
    if (!this.data.courseId) return;
    this.setData({ isLoading: true, isLoadingCheckIns: true, isLoadingRewards: true }); // Set all loading true

    wx.cloud.callFunction({
      name: 'course',
      data: { action: 'getCourseById', payload: { courseId: this.data.courseId } },
      success: res => {
        if (res.result && res.result.code === 200 && res.result.data) {
          const courseData = this.processCourseData(res.result.data);
          this.setData({ course: courseData });
          this.fetchCheckInHistory(); 
          this.fetchCourseRewards();  
        } else {
          wx.showToast({ title: res.result.message || 'Failed to load course', icon: 'none' });
          this.setData({ course: null, isLoading: false, isLoadingCheckIns: false, isLoadingRewards: false });
        }
      },
      fail: err => {
        console.error("Fetch course detail error:", err);
        wx.showToast({ title: 'Error fetching details', icon: 'none' });
        this.setData({ course: null, isLoading: false, isLoadingCheckIns: false, isLoadingRewards: false });
      }
    });
  },

  processCourseData: function(courseData) {
    courseData.formattedStartDate = formatTime(new Date(courseData.startDate), 'YYYY-MM-DD');
    courseData.formattedEndDate = formatTime(new Date(courseData.endDate), 'YYYY-MM-DD');
    courseData.statusFormatted = courseData.status.charAt(0).toUpperCase() + courseData.status.slice(1);

    if (courseData.status === 'ongoing') {
        const startDate = new Date(courseData.startDate);
        const endDate = new Date(courseData.endDate);
        const today = new Date();
        today.setHours(0,0,0,0);

        const daysCompleted = Math.max(0, Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) +1);
        courseData.daysCompleted = Math.min(daysCompleted, courseData.period);
        courseData.progressPercent = Math.min(100, Math.max(0, (courseData.daysCompleted / courseData.period) * 100));
        const daysRemaining = Math.max(0, Math.floor((endDate - today) / (1000 * 60 * 60 * 24)));
        courseData.daysRemaining = daysRemaining;
    } else if (courseData.status === 'completed') {
        courseData.daysCompleted = courseData.period;
        courseData.progressPercent = 100;
        courseData.daysRemaining = 0;
    } else {
        courseData.daysCompleted = 0;
        courseData.progressPercent = 0;
        courseData.daysRemaining = courseData.period;
    }
    return courseData;
  },
  
  fetchCheckInHistory: function() {
    if (!this.data.courseId) return;
    // isLoadingCheckIns is already true from fetchCourseDetail
    wx.cloud.callFunction({
        name: 'punchcard',
        data: {
            action: 'getCheckInHistoryForCourse',
            payload: { courseId: this.data.courseId }
        },
        success: res => {
            if (res.result && res.result.code === 200) {
                const todayStr = formatTime(new Date(), 'YYYY-MM-DD');
                let isCheckedInToday = false;
                const history = res.result.data.map(item => {
                    item.formattedPunchDate = formatTime(new Date(item.punchDate), 'YYYY-MM-DD');
                    if (item.formattedPunchDate === todayStr) {
                        isCheckedInToday = true;
                    }
                    return item;
                });
                this.setData({ checkIns: history, isCheckedInToday: isCheckedInToday });
            } else {
                console.warn("Failed to get check-in history:", res.result ? res.result.message : 'No result');
                this.setData({ checkIns: [], isCheckedInToday: false });
            }
        },
        fail: err => {
            console.error("Fetch check-in history error:", err);
            this.setData({ checkIns: [], isCheckedInToday: false });
        },
        complete: () => {
            this.setData({ isLoadingCheckIns: false });
            if (!this.data.isLoadingRewards) this.setData({ isLoading: false });
        }
    });
  },

  fetchCourseRewards: function() {
    if (!this.data.courseId) return;
    // isLoadingRewards is already true from fetchCourseDetail
    wx.cloud.callFunction({
        name: 'reward',
        data: {
            action: 'getRewardsForCourse',
            payload: { courseId: this.data.courseId }
        },
        success: res => {
            if (res.result && res.result.code === 200) {
                const processedRewards = res.result.data.map(reward => {
                    reward.icon = reward.isClaimed ? 'success_circle' : 'info_circle'; 
                    reward.statusText = reward.isClaimed ? `Claimed on ${formatTime(new Date(reward.claimedAt), 'YYYY-MM-DD')}` : 'Pending';
                    return reward;
                });
                this.setData({ rewards: processedRewards });
            } else {
                console.warn("Failed to get course rewards:", res.result ? res.result.message : 'No result');
                this.setData({ rewards: [] });
            }
        },
        fail: err => {
            console.error("Fetch course rewards error:", err);
            this.setData({ rewards: [] });
        },
        complete: () => {
            this.setData({ isLoadingRewards: false });
            if (!this.data.isLoadingCheckIns) this.setData({ isLoading: false });
        }
    });
  },

  navigateToPunchcard: function() {
    if (this.data.course && this.data.course._id) {
      wx.navigateTo({
        url: `../punchcard/index?courseId=${this.data.course._id}&courseName=${encodeURIComponent(this.data.course.name)}`
      });
    }
  }
});
