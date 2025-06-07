// minglu_cloud_badge/miniprogram/pages/badge-create/index.js
const app = getApp();
const { formatTime } = require('../../utils/util.js');

Page({
  data: {
    formData: {
      title: '',
      categoryId: '',
      description: '',
      imageFileId: '', // Will hold the File ID from cloud storage
      expiryDate: null,
      reminderEnabled: false,
      // customProperties: {} 
    },
    badgeCategories: [],
    categoryIndex: null,
    selectedCategoryName: '',
    uploadedFiles: [], // For mp-uploader component state
    isSubmitting: false,
    todayDate: formatTime(new Date(), 'YYYY-MM-DD'), // For expiry date picker start
    
    formRules: [
      { name: 'title', rules: { required: true, message: 'Badge title is required.' } },
      { name: 'categoryId', rules: { required: true, message: 'Category is required.' } },
      // imageFileId is validated manually before submission
    ],
    // This is a reference to the uploader's upload function
    uploadImageFuncForUploader: null 
  },

  onLoad: function (options) {
    this.fetchBadgeCategories();
    // For mp-uploader, we need to provide a function that handles the actual upload logic
    this.setData({
        uploadImageFuncForUploader: this.uploadImage.bind(this)
    });
    // If options.badgeId, it's edit mode (handle later)
  },

  fetchBadgeCategories: function() {
    wx.cloud.callFunction({
      name: 'badge',
      data: { action: 'getBadgeCategories' },
      success: res => {
        if (res.result && res.result.code === 200) {
          this.setData({ badgeCategories: res.result.data });
        } else {
          wx.showToast({ title: 'Failed to load categories', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: 'Error loading categories', icon: 'none' })
    });
  },

  bindInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  bindCategoryChange: function(e) {
    const selectedIndex = e.detail.value;
    this.setData({
      categoryIndex: selectedIndex,
      'formData.categoryId': this.data.badgeCategories[selectedIndex]._id,
      selectedCategoryName: this.data.badgeCategories[selectedIndex].name
    });
  },

  bindDateChange: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  bindSwitchChange: function(e) {
     const field = e.currentTarget.dataset.field;
     this.setData({ [`formData.${field}`]: e.detail.value });
  },
  
  // --- Uploader Event Handlers ---
  // This function is passed to mp-uploader's `upload` prop
  // It must return a Promise that resolves with {urls: [fileLink]} or rejects
  uploadImage: function(wxFilePath) {
     return new Promise((resolve, reject) => {
         const timestamp = Date.now();
         const randomSuffix = Math.floor(Math.random() * 1000);
         const cloudPath = `badge_images/${timestamp}_${randomSuffix}${wxFilePath.match(/\.[^.]+?$/)[0]}`;
         
         wx.showLoading({ title: 'Uploading...' });
         wx.cloud.uploadFile({
             cloudPath: cloudPath,
             filePath: wxFilePath,
             success: res => {
                 wx.hideLoading();
                 console.log('Upload success:', res);
                 // We need to store the File ID, not the tempFilePath or cloudPath directly for permanent access
                 // This is handled by onUploadSuccess, but we must resolve the promise for mp-uploader
                 resolve({ urls: [res.fileID] }); // mp-uploader expects an object with a urls array
             },
             fail: err => {
                 wx.hideLoading();
                 console.error('Upload failed:', err);
                 wx.showToast({ title: 'Upload Failed', icon: 'none' });
                 reject(err);
             }
         });
     });
  },

 onUploadSuccess: function(e) {
     // This event is from mp-uploader after its internal upload (or our custom one) succeeds
     // The `e.detail.urls` should contain the fileID if `uploadImage` resolved correctly
     console.log('onUploadSuccess from uploader:', e);
     if (e.detail.urls && e.detail.urls.length > 0) {
         this.setData({
             'formData.imageFileId': e.detail.urls[0], // Assuming single file, urls[0] is the fileID
              uploadedFiles: [{ url: e.detail.urls[0], name: 'badge_image' }] // Keep uploader component in sync
         });
     }
 },

 onUploadError: function(e) {
     console.error('onUploadError from uploader:', e);
     wx.showToast({ title: 'Image upload error', icon: 'none' });
     this.setData({'formData.imageFileId': '', uploadedFiles: []});
 },

 onUploadDelete: function(e) {
     // If user deletes image from uploader, clear our fileID
     // And also delete from cloud storage if it was already uploaded
     const fileIDToDelete = this.data.formData.imageFileId;
     if (fileIDToDelete) {
         wx.cloud.deleteFile({
             fileList: [fileIDToDelete]
         }).then(res => {
             console.log('Deleted temp uploaded file from storage', res.fileList);
         }).catch(err => {
             console.error('Failed to delete temp uploaded file', err);
         });
     }
     this.setData({
         'formData.imageFileId': '',
         uploadedFiles: []
     });
 },
 // --- End Uploader ---

  submitBadge: function() {
    this.selectComponent('#badgeForm').validate((valid, errors) => {
      if (!valid) {
        const firstError = Object.keys(errors).map(key => errors[key])[0];
        wx.showToast({ title: firstError.message || 'Please check input', icon: 'none' });
        return;
      }
      if (!this.data.formData.imageFileId) {
        wx.showToast({ title: 'Please upload badge image.', icon: 'none' });
        return;
      }

      this.setData({ isSubmitting: true });
      wx.showLoading({ title: 'Creating Badge...' });

      let dataToSubmit = { ...this.data.formData };
      // Ensure dates are null if not set, or valid Date objects
      if (!dataToSubmit.expiryDate) {
          delete dataToSubmit.expiryDate; // Or set to null, backend handles null
      }

      wx.cloud.callFunction({
        name: 'badge',
        data: {
          action: 'createBadge',
          payload: dataToSubmit
        },
        success: res => {
          wx.hideLoading();
          this.setData({ isSubmitting: false });
          if (res.result && res.result.code === 201) {
            wx.showToast({ title: 'Badge Created!', icon: 'success' });
            // TODO: Notify badge list page to refresh if it exists
            // Example: const pages = getCurrentPages(); if (pages.length > 1) { const prevPage = pages[pages.length - 2]; if (prevPage.route === 'path/to/badge-list') { prevPage.refreshData(); }}
            setTimeout(() => wx.navigateBack(), 1500);
          } else {
            wx.showToast({ title: res.result.message || 'Creation Failed', icon: 'none' });
          }
        },
        fail: err => {
          wx.hideLoading();
          this.setData({ isSubmitting: false });
          console.error("Create badge CF error:", err);
          wx.showToast({ title: 'Request Failed', icon: 'none' });
        }
      });
    });
  }
});
