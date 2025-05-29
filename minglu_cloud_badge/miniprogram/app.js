// app.js
App({
  globalData: {
    userInfo: null, // Will store the complete user record from 'Users' collection
    userOpenid: null // Specifically the openid
    // You might also want an 'isLoggedIn' flag
  },
  onLaunch() {
    // Optional: Try to auto-login if user was previously logged in
    // wx.getStorage({ key: 'userInfo', success: res => { if (res.data) this.globalData.userInfo = res.data; /* ... */ }});
    
    if (wx.cloud) {
      wx.cloud.init({
        env: 'YOUR_CLOUD_ENV_ID', // Replace with your actual Cloud Env ID
        traceUser: true,
      });
    } else {
      console.error('Please update your WeChat version to use cloud capabilities.');
    }
  },
  // ... other app lifecycle methods
});
