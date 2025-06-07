// minglu_cloud_badge/miniprogram/pages/common-punchcard/index.js
const app = getApp();
const { formatTime } = require('../../utils/util.js');

const recorderManager = wx.getRecorderManager();
const innerAudioContext = wx.createInnerAudioContext();

Page({
  data: {
    currentCheckInType: 'log', // 'log', 'photo', 'audio', 'mood'
    formData: { // Holds data for the current check-in being composed
      textContent: '',
      imageFileId: '',
      audioFileId: '',
      mood: '',
      tags: []
      // location: null 
    },
    tagsInput: '', // Temporary input for tags
    uploadedImageFiles: [], // For mp-uploader state
    uploadImageFuncForUploader: null, // For mp-uploader

    // Audio recording state
    isRecording: false,
    tempAudioFilePath: '',
    audioDuration: 0,
    audioDurationFormatted: '00:00',
    isPlayingAudio: false,

    moodOptions: ['😊 Happy', '😢 Sad', '😠 Angry', '🤔 Reflective', '🚀 Productive', '😩 Tired', '🎉 Excited'],
    
    isSubmitting: false,
    
    // History
    checkInHistory: [],
    pagination: {
        currentPage: 1,
        pageSize: 5, // Smaller page size for more frequent "load more"
        totalPages: 1,
        totalItems: 0
    },
    isLoadingHistory: true,
    // For celebration animation
    showSuccessAnimation: false,
    successMessage: "Entry Recorded!"
  },

  onLoad: function (options) {
    this.setData({
        uploadImageFuncForUploader: this.uploadImage.bind(this) // For mp-uploader
    });
    this.fetchHistory(true); // Initial load
    this.initRecorderManager();
  },
  
  onUnload: function() {
    // Clean up audio context if it's playing
    if (this.data.isPlayingAudio) {
        innerAudioContext.stop();
    }
    // Consider if recorderManager needs explicit cleanup, usually not critical
  },

  onPullDownRefresh: function() {
      this.fetchHistory(true).then(() => wx.stopPullDownRefresh());
  },
  
  // --- Type Selection ---
  onTypeChange: function(e) {
    const newType = e.currentTarget.dataset.type;
    this.setData({ 
        currentCheckInType: newType,
        // Reset form data when type changes to avoid carrying over unrelated fields
        formData: { textContent: '', imageFileId: '', audioFileId: '', mood: '', tags: [] },
        tagsInput: '',
        uploadedImageFiles: [],
        tempAudioFilePath: '', audioDuration: 0, audioDurationFormatted: '00:00', isRecording: false, isPlayingAudio: false
    });
    if (this.data.isPlayingAudio) innerAudioContext.stop(); // Stop audio if playing
    if (this.data.isRecording) recorderManager.stop(); // Stop recording if active
  },

  // --- Form Input Handlers ---
  bindFormInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },
  bindTagsInput: function(e) {
    this.setData({ tagsInput: e.detail.value });
  },
  onMoodSelect: function(e) {
    this.setData({ 'formData.mood': e.currentTarget.dataset.mood });
  },

  // --- Image Uploader --- (Similar to badge-create)
  uploadImage: function(wxFilePath) {
    return new Promise((resolve, reject) => {
        const cloudPath = `common_checkin_images/${Date.now()}_${Math.floor(Math.random()*1000)}${wxFilePath.match(/\.[^.]+?$/)[0]}`;
        wx.showLoading({ title: 'Uploading...' });
        wx.cloud.uploadFile({
            cloudPath: cloudPath, filePath: wxFilePath,
            success: res => { wx.hideLoading(); resolve({ urls: [res.fileID] }); },
            fail: err => { wx.hideLoading(); wx.showToast({ title: 'Img Upload Fail', icon: 'none' }); reject(err); }
        });
    });
  },
  onUploadSuccess: function(e) {
    if (e.detail.urls && e.detail.urls.length > 0) {
        this.setData({ 'formData.imageFileId': e.detail.urls[0], uploadedImageFiles: [{ url: e.detail.urls[0] }] });
    }
  },
  onUploadError: function(e) { this.setData({'formData.imageFileId': '', uploadedImageFiles: []}); },
  onUploadDelete: function(e) {
    const fileIDToDelete = this.data.formData.imageFileId;
    if (fileIDToDelete) { wx.cloud.deleteFile({ fileList: [fileIDToDelete] }); }
    this.setData({'formData.imageFileId': '', uploadedImageFiles: []});
  },

  // --- Audio Recording & Playback ---
  initRecorderManager: function() {
    recorderManager.onStart(() => {
      console.log('Recorder started');
      this.setData({ isRecording: true, tempAudioFilePath: '', audioDuration: 0, audioDurationFormatted: '00:00' });
    });
    recorderManager.onStop((res) => {
      console.log('Recorder stopped', res);
      this.setData({ isRecording: false });
      if (res && res.tempFilePath) {
        const duration = Math.round(res.duration / 1000); // ms to s
        this.setData({ 
            tempAudioFilePath: res.tempFilePath, 
            audioDuration: duration,
            audioDurationFormatted: `${String(Math.floor(duration/60)).padStart(2,'0')}:${String(duration%60).padStart(2,'0')}`
        });
      }
    });
    recorderManager.onError((res) => {
      console.error('Recorder error', res);
      this.setData({ isRecording: false });
      wx.showToast({ title: 'Recording Error', icon: 'none' });
    });

    innerAudioContext.onPlay(() => { this.setData({ isPlayingAudio: true }); });
    innerAudioContext.onEnded(() => { this.setData({ isPlayingAudio: false }); });
    innerAudioContext.onStop(() => { this.setData({ isPlayingAudio: false }); });
    innerAudioContext.onError((res) => { 
        this.setData({ isPlayingAudio: false }); 
        wx.showToast({title: 'Playback Error', icon: 'none'});
        console.error('Audio context error:', res);
    });
  },
  toggleRecording: function() {
    if (this.data.isRecording) {
      recorderManager.stop();
    } else {
      if (this.data.isPlayingAudio) innerAudioContext.stop();
      recorderManager.start({ duration: 60000, format: 'mp3' }); // Max 60s
    }
  },
  playAudio: function() {
    if (this.data.tempAudioFilePath) {
      innerAudioContext.src = this.data.tempAudioFilePath;
      innerAudioContext.play();
    }
  },
  stopAudio: function() {
    innerAudioContext.stop();
  },
  
  uploadAudioFile: function() { // Called before submitting form if audio exists
    return new Promise((resolve, reject) => {
        if (!this.data.tempAudioFilePath) return resolve(null); // No audio to upload

        const cloudPath = `common_checkin_audio/${Date.now()}_${Math.floor(Math.random()*1000)}.mp3`;
        wx.showLoading({ title: 'Uploading Audio...' });
        wx.cloud.uploadFile({
            cloudPath: cloudPath, filePath: this.data.tempAudioFilePath,
            success: res => { wx.hideLoading(); resolve(res.fileID); },
            fail: err => { wx.hideLoading(); wx.showToast({ title: 'Audio Upload Fail', icon: 'none' }); reject(err); }
        });
    });
  },

  // --- Submission ---
  async submitCommonCheckIn() {
    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });

    let payload = { ...this.data.formData, checkInType: this.data.currentCheckInType };
    
    // Process tags
    if (this.data.tagsInput) {
        payload.tags = this.data.tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
    } else {
        payload.tags = [];
    }

    // Handle audio upload if current type is audio and there's a temp file
    if (this.data.currentCheckInType === 'audio' && this.data.tempAudioFilePath && !this.data.formData.audioFileId) {
        try {
            const audioFileId = await this.uploadAudioFile();
            if (audioFileId) {
                payload.audioFileId = audioFileId;
            } else if (!audioFileId && this.data.tempAudioFilePath) { // Upload failed but there was audio
                 this.setData({ isSubmitting: false });
                 wx.showToast({title: 'Audio upload failed. Try again.', icon: 'none'});
                 return;
            }
        } catch (err) {
            this.setData({ isSubmitting: false });
            return; // Error toast already shown by uploadAudioFile
        }
    }
    
    // Basic validation before sending to backend
    if (payload.checkInType === 'photo' && !payload.imageFileId) {
        wx.showToast({title: 'Please upload a photo.', icon: 'none'});
        this.setData({ isSubmitting: false }); return;
    }
    if (payload.checkInType === 'audio' && !payload.audioFileId && this.data.tempAudioFilePath) { // if tempAudio but no fileID means upload failed or not attempted
        wx.showToast({title: 'Audio not uploaded yet.', icon: 'none'});
        this.setData({ isSubmitting: false }); return;
    }
     if (payload.checkInType === 'mood' && !payload.mood) {
        wx.showToast({title: 'Please select a mood.', icon: 'none'});
        this.setData({ isSubmitting: false }); return;
    }


    wx.showLoading({ title: 'Submitting...' });
    wx.cloud.callFunction({
      name: 'punchcard',
      data: { action: 'recordCommonCheckIn', payload: payload },
      success: res => {
        if (res.result && res.result.code === 201) {
          // wx.showToast({ title: 'Check-in Recorded!', icon: 'success' }); // Optional short toast
          let message = "Entry Recorded!";
          switch(this.data.currentCheckInType) {
              case 'photo': message = "Photo Saved!"; break;
              case 'audio': message = "Audio Recorded!"; break;
              case 'mood': message = "Mood Logged!"; break;
              case 'log': message = "Log Saved!"; break;
          }
          this.setData({
              showSuccessAnimation: true,
              successMessage: message
          });
          // this.resetFormAndFetchHistory(); // Now called from handleAnimationEnd
        } else {
          wx.showToast({ title: res.result.message || 'Submission Failed', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: 'Request Error', icon: 'none' }),
      complete: () => { wx.hideLoading(); this.setData({ isSubmitting: false }); }
    });
  },

  handleAnimationEnd: function() {
    console.log("Animation ended on common-punchcard page.");
    this.setData({ showSuccessAnimation: false });
    this.resetFormAndFetchHistory(); // Reset form and refresh history
    // For this page, we typically stay, not navigateBack, after a common check-in.
    // If navigation is desired, add wx.navigateBack();
  },

  resetFormAndFetchHistory: function() {
    this.setData({
        formData: { textContent: '', imageFileId: '', audioFileId: '', mood: '', tags: [] },
        tagsInput: '',
        uploadedImageFiles: [],
        tempAudioFilePath: '', audioDuration: 0, audioDurationFormatted: '00:00',
        // currentCheckInType: 'log', // Optionally reset type or keep current
    });
    if (this.data.isPlayingAudio) innerAudioContext.stop();
    if (this.data.isRecording) recorderManager.stop();
    this.fetchHistory(true); // Refresh history, resetting to page 1
  },

  // --- History ---
  fetchHistory: function(isRefresh = false) {
    this.setData({ isLoadingHistory: true });
    const page = isRefresh ? 1 : this.data.pagination.currentPage + 1;
    
    return wx.cloud.callFunction({
      name: 'punchcard',
      data: {
        action: 'getCommonCheckInHistory',
        payload: { page: page, pageSize: this.data.pagination.pageSize }
      }
    }).then(res => {
      if (res.result && res.result.code === 200) {
        const historyData = res.result.data.map(item => {
          item.formattedPunchDateTime = formatTime(new Date(item.punchDateTime), 'YYYY-MM-DD hh:mm');
          return item;
        });
        this.setData({
          checkInHistory: isRefresh ? historyData : this.data.checkInHistory.concat(historyData),
          'pagination.currentPage': res.result.pagination.currentPage,
          'pagination.totalPages': res.result.pagination.totalPages,
          'pagination.totalItems': res.result.pagination.totalItems,
        });
      } else {
        wx.showToast({ title: res.result.message || 'Failed to load history', icon: 'none' });
      }
    }).catch(err => {
      console.error("Fetch history error:", err);
      wx.showToast({ title: 'Error loading history', icon: 'none' });
    }).finally(() => {
      this.setData({ isLoadingHistory: false });
    });
  },
  loadMoreHistory: function() {
    if (this.data.pagination.currentPage < this.data.pagination.totalPages) {
      this.fetchHistory(false);
    }
  }
});
