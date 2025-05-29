// minglu_cloud_badge/miniprogram/pages/badge-detail/index.js
const app = getApp();
const { formatTime } = require('../../utils/util.js');

// IMPORTANT: Developer must replace this with their actual template ID
const BADGE_EXPIRY_TEMPLATE_ID = 'YOUR_BADGE_EXPIRY_TEMPLATE_ID'; 

Page({
  data: {
    badgeId: null,
    badge: null,
    isLoading: true,
    badgeCategories: [], // To resolve categoryId to name
    isUpdatingReminder: false // To prevent multiple updates
  },

  onLoad: function (options) {
    if (options.badgeId) {
      this.setData({ badgeId: options.badgeId });
      this.fetchBadgeCategoriesAndThenDetail();
    } else {
      wx.showToast({ title: 'Badge ID missing', icon: 'none', duration: 2000 });
      this.setData({ isLoading: false });
      // wx.navigateBack();
    }
  },
  
  onShow: function() {
     if (this.data.badgeId && !this.data.isLoading && this.data.badge === null) {
         this.fetchBadgeCategoriesAndThenDetail();
     }
     if (app.globalData.refreshBadgeDetail) {
         console.log("Refreshing badge detail due to app.globalData.refreshBadgeDetail flag.");
         this.fetchBadgeCategoriesAndThenDetail();
         app.globalData.refreshBadgeDetail = false; 
     }
  },
  
  fetchBadgeCategoriesAndThenDetail: function() {
     this.setData({ isLoading: true });
     wx.cloud.callFunction({
         name: 'badge',
         data: { action: 'getBadgeCategories' },
         success: res => {
             if (res.result && res.result.code === 200) {
                 this.setData({ badgeCategories: res.result.data });
                 this.fetchBadgeDetail(); 
             } else {
                 wx.showToast({ title: 'Failed to load categories', icon: 'none' });
                 this.setData({ isLoading: false }); 
             }
         },
         fail: () => {
             wx.showToast({ title: 'Error loading categories', icon: 'none' });
             this.setData({ isLoading: false });
         }
     });
  },

  fetchBadgeDetail: function () {
    if (!this.data.badgeId) return;

    wx.cloud.callFunction({
      name: 'badge',
      data: {
        action: 'getBadgeById',
        payload: { badgeId: this.data.badgeId }
      },
      success: res => {
        if (res.result && res.result.code === 200 && res.result.data) {
          const badgeData = res.result.data;
          this.processBadgeData(badgeData);
        } else {
          wx.showToast({ title: res.result.message || 'Failed to load badge', icon: 'none' });
          this.setData({ badge: null });
        }
      },
      fail: err => {
        console.error("Fetch badge detail error:", err);
        wx.showToast({ title: 'Error fetching details', icon: 'none' });
        this.setData({ badge: null });
      },
      complete: () => {
        this.setData({ isLoading: false });
      }
    });
  },

  processBadgeData: function(badgeData) {
     badgeData.formattedIssueDate = formatTime(new Date(badgeData.issueDate), 'YYYY-MM-DD');
     if (badgeData.expiryDate) {
         badgeData.formattedExpiryDate = formatTime(new Date(badgeData.expiryDate), 'YYYY-MM-DD');
         const now = new Date();
         const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
         const expiry = new Date(badgeData.expiryDate);
         badgeData.isExpiringSoon = expiry >= now && expiry <= sevenDaysFromNow;
     } else {
         badgeData.isExpiringSoon = false;
         badgeData.formattedExpiryDate = null; 
     }
     const category = this.data.badgeCategories.find(cat => cat._id === badgeData.categoryId);
     badgeData.categoryName = category ? category.name : 'Uncategorized';
     this.setData({ badge: badgeData });
  },

  editBadge: function() {
    if (this.data.badge && this.data.badge._id) {
         app.globalData.badgeToEdit = this.data.badge; 
         wx.navigateTo({
             url: `../badge-create/index?badgeId=${this.data.badge._id}` 
         });
    }
  },

  deleteBadgeConfirm: function() {
    if (!this.data.badge || !this.data.badge._id) return;
    wx.showModal({
      title: 'Confirm Delete',
      content: `Are you sure you want to delete the badge "${this.data.badge.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      confirmColor: '#e64340',
      success: (res) => {
        if (res.confirm) {
          this.deleteBadge();
        }
      }
    });
  },

  deleteBadge: function() {
    wx.showLoading({ title: 'Deleting...' });
    wx.cloud.callFunction({
      name: 'badge',
      data: {
        action: 'deleteBadge',
        payload: { badgeId: this.data.badgeId }
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.code === 200) {
          wx.showToast({ title: 'Badge Deleted', icon: 'success' });
          const pages = getCurrentPages();
          if (pages.length >= 2) { 
            const prevPage = pages[pages.length - 2]; 
            if (prevPage && prevPage.route === 'pages/badge-list/index' && typeof prevPage.fetchInitialData === 'function') {
               prevPage.fetchInitialData(); 
            }
          }
          wx.navigateBack();
        } else {
          wx.showToast({ title: res.result.message || 'Deletion failed', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: 'Deletion request error', icon: 'none' });
      }
    });
  },

  onReminderSwitchChange: function(e) {
    if (!this.data.badge || this.data.isUpdatingReminder) {
      return;
    }
    const newReminderStatus = e.detail.value;
    const oldReminderStatus = this.data.badge.reminderEnabled;

    this.setData({
      'badge.reminderEnabled': newReminderStatus,
      isUpdatingReminder: true
    });

    wx.cloud.callFunction({
      name: 'badge',
      data: {
        action: 'updateBadge',
        payload: {
          badgeId: this.data.badgeId,
          reminderEnabled: newReminderStatus
        }
      },
      success: res => {
        if (res.result && res.result.code === 200) {
          wx.showToast({ title: `Reminder ${newReminderStatus ? 'Enabled' : 'Disabled'}`, icon: 'success' });
          if (newReminderStatus) {
             // Only prompt if the actual template ID is set (not the placeholder)
             if (BADGE_EXPIRY_TEMPLATE_ID !== 'YOUR_BADGE_EXPIRY_TEMPLATE_ID') {
                 this.promptForReminderSubscription();
             } else {
                 console.warn("Subscription message template ID is not configured. Skipping prompt.");
                 wx.showModal({
                     title: 'Reminder Enabled',
                     content: 'Developer: Subscription message template ID needs to be configured to activate notifications.',
                     showCancel: false
                 });
             }
          }
        } else {
          wx.showToast({ title: 'Update failed', icon: 'none' });
          this.setData({ 'badge.reminderEnabled': oldReminderStatus }); 
        }
      },
      fail: err => {
        wx.showToast({ title: 'Update error', icon: 'none' });
        this.setData({ 'badge.reminderEnabled': oldReminderStatus }); 
        console.error("Reminder update error:", err);
      },
      complete: () => {
        this.setData({ isUpdatingReminder: false });
      }
    });
  },

  promptForReminderSubscription: function() {
    if (!BADGE_EXPIRY_TEMPLATE_ID || BADGE_EXPIRY_TEMPLATE_ID === 'YOUR_BADGE_EXPIRY_TEMPLATE_ID') {
      console.error("Badge expiry template ID is not configured.");
      // Optionally inform user that notifications cannot be set up yet.
      // wx.showModal({...}); 
      return;
    }

    wx.requestSubscribeMessage({
      tmplIds: [BADGE_EXPIRY_TEMPLATE_ID],
      success: (res) => {
        console.log('Subscription request result:', res);
        if (res[BADGE_EXPIRY_TEMPLATE_ID] === 'accept') {
          wx.showToast({
            title: 'Reminder activated!',
            icon: 'success',
            duration: 2000
          });
          // (Optional) Could make a backend call here to record user's subscription preference explicitly if needed,
          // though reminderEnabled=true on the badge already implies desire for reminders.
        } else if (res[BADGE_EXPIRY_TEMPLATE_ID] === 'reject') {
          wx.showModal({
            title: 'Subscription Denied',
            content: 'You have denied reminder notifications. You can enable them later in Mini Program settings if you change your mind.',
            showCancel: false
          });
        } else { // 'ban', 'filter', or other states
          wx.showModal({
            title: 'Subscription Issue',
            content: 'Could not complete subscription. Please check your Mini Program settings for notification permissions.',
            showCancel: false
          });
        }
      },
      fail: (err) => {
        console.error('wx.requestSubscribeMessage failed:', err);
        wx.showModal({
          title: 'Subscription Error',
          content: 'There was an error requesting reminder subscription. Please try again.',
          showCancel: false
        });
      }
    });
  }
});
