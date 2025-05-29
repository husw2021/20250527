// minglu_cloud_badge/miniprogram/components/card/index.js
Component({
  options: {
    multipleSlots: true // Enable multiple slots
  },
  properties: {
    title: {
      type: String,
      value: ''
    },
    hasHeaderBorder: {
      type: Boolean,
      value: true
    },
    customClass: {
      type: String,
      value: ''
    },
    bodyStyle: {
      type: String,
      value: ''
    }
  },
  data: {
    // No need for hasFooterSlot data property with simpler WXML
  },
  methods: {
    // Component methods
  }
});
