// minglu_cloud_badge/miniprogram/pages/badge-list/index.js
const app = getApp();
const { formatTime } = require('../../utils/util.js');

Page({
  data: {
    badges: [],
    badgeCategoriesForFilter: [{ _id: 'all', name: 'All Categories' }], // For filter picker
    categoryFilterIndex: 0,
    selectedCategoryId: 'all', // 'all' or actual category _id
    selectedCategoryFilterName: 'All',
    isLoading: true,
  },

  onShow: function () { // Use onShow to refresh data when page is displayed
    this.fetchInitialData();
  },
  
  onPullDownRefresh: function() {
     this.fetchInitialData();
  },

  fetchInitialData: function() {
     this.setData({isLoading: true});
     Promise.all([
         this.fetchBadgeCategories(), 
         this.fetchBadges(this.data.selectedCategoryId) // Initial fetch uses current filter
     ]).then(() => {
         this.setData({isLoading: false});
         wx.stopPullDownRefresh();
     }).catch(err => {
         this.setData({isLoading: false});
         wx.stopPullDownRefresh();
         console.error("Error fetching initial data for badge list:", err);
         wx.showToast({title: 'Error loading data', icon: 'none'});
     });
  },

  fetchBadgeCategories: function() {
    return new Promise((resolve, reject) => {
         wx.cloud.callFunction({
             name: 'badge',
             data: { action: 'getBadgeCategories' },
             success: res => {
                 if (res.result && res.result.code === 200) {
                     const userCategories = res.result.data;
                     this.setData({ 
                         badgeCategoriesForFilter: [{ _id: 'all', name: 'All Categories' }].concat(userCategories)
                     });
                     resolve(userCategories);
                 } else {
                     wx.showToast({ title: 'Failed to load categories', icon: 'none' });
                     reject(new Error('Failed to load categories'));
                 }
             },
             fail: (err) => {
                 wx.showToast({ title: 'Error categories', icon: 'none' });
                 reject(err);
             }
         });
    });
  },

  fetchBadges: function(categoryId = 'all') {
    // isLoading is true from fetchInitialData or fetchBadgesData
    // No need to set it true here again unless this is called standalone
    if(!this.data.isLoading) this.setData({isLoading: true}); 

    return new Promise((resolve, reject) => {
         const payload = {};
         if (categoryId !== 'all') {
             payload.categoryId = categoryId;
         }
         wx.cloud.callFunction({
             name: 'badge',
             data: {
                 action: 'getBadgesByUser',
                 payload: payload
             },
             success: res => {
                 if (res.result && res.result.code === 200) {
                     const now = new Date();
                     const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                     const processedBadges = res.result.data.map(badge => {
                         badge.categoryName = this.getCategoryName(badge.categoryId); // Helper
                         if (badge.expiryDate) {
                             badge.formattedExpiryDate = formatTime(new Date(badge.expiryDate), 'YYYY-MM-DD');
                             const expiry = new Date(badge.expiryDate);
                             badge.isExpiringSoon = expiry >= now && expiry <= sevenDaysFromNow;
                         } else {
                             badge.formattedExpiryDate = null;
                             badge.isExpiringSoon = false;
                         }
                         return badge;
                     });
                     this.setData({ badges: processedBadges });
                     resolve(processedBadges);
                 } else {
                     wx.showToast({ title: res.result.message || 'Failed to load badges', icon: 'none' });
                     this.setData({badges: []}); // Clear on error
                     reject(new Error('Failed to load badges'));
                 }
             },
             fail: (err) => {
                 wx.showToast({ title: 'Error loading badges', icon: 'none' });
                 this.setData({badges: []}); // Clear on error
                 reject(err);
             },
             complete: () => {
                 // isLoading is set to false by the caller of this promise (fetchInitialData or fetchBadgesData)
             }
         });
     });
  },
  
  fetchBadgesData: function() { // For manual refresh button
     this.setData({isLoading: true});
     this.fetchBadges(this.data.selectedCategoryId)
         .then(() => this.setData({isLoading: false}))
         .catch(() => this.setData({isLoading: false}));
  },

  getCategoryName: function(categoryId) {
     const category = this.data.badgeCategoriesForFilter.find(cat => cat._id === categoryId);
     return category ? category.name : 'Uncategorized';
  },

  bindCategoryFilterChange: function(e) {
    const selectedIndex = e.detail.value;
    const newSelectedCategoryId = this.data.badgeCategoriesForFilter[selectedIndex]._id;
    this.setData({
      categoryFilterIndex: selectedIndex,
      selectedCategoryId: newSelectedCategoryId,
      selectedCategoryFilterName: this.data.badgeCategoriesForFilter[selectedIndex].name,
      isLoading: true // Set loading true before fetching new batch of badges
    });
    this.fetchBadges(newSelectedCategoryId)
        .then(() => this.setData({isLoading: false}))
        .catch(() => this.setData({isLoading: false}));
  },

  navigateToCreateBadge: function () {
    wx.navigateTo({ url: '../badge-create/index' });
  },

  navigateToBadgeDetail: function (e) {
    const badgeId = e.currentTarget.dataset.badgeid;
    wx.navigateTo({ url: `../badge-detail/index?badgeId=${badgeId}` });
  }
});
