// minglu_cloud_badge/miniprogram/pages/course-create/index.js
const app = getApp();

Page({
  data: {
    formData: {
      name: '',
      description: '',
      instructor: '',
      period: null, // Store the numeric value
      startDate: '' // Store as 'YYYY-MM-DD'
    },
    periodOptions: [
      { value: 7, label: '7 days' },
      { value: 10, label: '10 days' },
      { value: 15, label: '15 days' },
      { value: 21, label: '21 days' },
      { value: 30, label: '30 days' },
      { value: 60, label: '60 days' },
      { value: 90, label: '90 days' },
      { value: 100, label: '100 days' }
    ],
    periodIndex: null, // Will hold the index for the picker
    formRules: [ // Optional: for WeUI mp-form validation
      { name: 'name', rules: { required: true, message: 'Course name is required.' } },
      { name: 'startDate', rules: { required: true, message: 'Start date is required.' } },
      { name: 'period', rules: { required: true, message: 'Duration is required.' } }
    ]
  },

  onLoad: function (options) {
    // If editing, options.courseId would be passed, but this is for create
  },

  bindInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: e.detail.value
    });
  },

  bindDateChange: function(e) {
    this.setData({
      'formData.startDate': e.detail.value
    });
  },

  bindPeriodChange: function(e) {
    const selectedIndex = e.detail.value;
    this.setData({
      periodIndex: selectedIndex,
      'formData.period': this.data.periodOptions[selectedIndex].value
    });
  },

  submitCourse: function() {
    this.selectComponent('#form').validate((valid, errors) => {
      if (!valid) {
        const firstError = Object.keys(errors).map(key => errors[key])[0];
        if (firstError && firstError.message) {
             wx.showToast({ title: firstError.message, icon: 'none' });
        } else {
             wx.showToast({ title: 'Please check your input.', icon: 'none' });
        }
        return;
      }

      // Additional manual validation if needed
      if (!this.data.formData.name || !this.data.formData.startDate || !this.data.formData.period) {
         wx.showToast({ title: 'Please fill all required fields.', icon: 'none' });
         return;
      }

      wx.showLoading({ title: 'Creating...' });
      wx.cloud.callFunction({
        name: 'course',
        data: {
          action: 'createCourse',
          payload: this.data.formData
        },
        success: res => {
          wx.hideLoading();
          if (res.result && res.result.code === 201) {
            wx.showToast({ title: 'Course Created!', icon: 'success' });
            // Navigate back or to course list/detail
            // Consider eventChannel for passing data back if needed by course list
            wx.navigateBack(); 
            // Or wx.redirectTo({ url: `/pages/course-detail/index?courseId=${res.result.courseId}` });
          } else {
            wx.showToast({ title: res.result.message || 'Creation failed', icon: 'none' });
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error("Create course CF error:", err);
          wx.showToast({ title: 'Request Failed', icon: 'none' });
        }
      });
    });
  }
});
