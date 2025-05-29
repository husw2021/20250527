// minglu_cloud_badge/miniprogram/components/celebration-animation/index.js
   Component({
     properties: {
       show: {
         type: Boolean,
         value: false,
         observer: function(newVal) {
           if (newVal) {
             // Optional: If animation needs JS trigger or reset, do it here
             // For CSS-only triggered by class/visibility, this might not be needed for start
             // But good for emitting end event
             // Simulate animation duration (CSS animation should match this)
             setTimeout(() => {
               if (this.data.show) { // Check if still shown (parent might hide it early)
                 this.triggerEvent('animationend');
               }
             }, 2500); // Duration of the animation in ms
           }
         }
       },
       type: { // For future expansion (e.g., 'confetti', 'balloons')
         type: String,
         value: 'default' 
       },
       message: { // Optional message to display during animation
         type: String,
         value: 'Great Job!'
       }
     },
     data: {
       // Internal component data
     },
     methods: {
       // No methods needed for this basic version if CSS handles all animation
     }
   });
