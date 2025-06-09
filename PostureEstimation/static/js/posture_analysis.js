/**
 * Posture Analysis Module
 * Handles webcam access, posture detection using TensorFlow.js and drawing posture guidelines
 */

class PostureAnalyzer {
    constructor() {
        // DOM elements
        this.videoElement = document.getElementById('webcam');
        this.canvasElement = document.getElementById('overlay');
        this.canvasCtx = this.canvasElement.getContext('2d');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.noCameraDiv = document.getElementById('no-camera');
        this.alertElement = document.getElementById('posture-alert');
        this.alertMessage = document.getElementById('alert-message');
        
        // Posture analysis variables
        this.isRunning = false;
        this.poseDetection = null;
        this.pose = null;
        this.thresholds = {
            neckAngle: 35,    // Default neck angle threshold (degrees)
            torsoAngle: 10,   // Default torso angle threshold (degrees)
            alignment: 30,    // Default shoulder alignment threshold (pixels)
            forwardHead: 0.2  // Default forward head threshold (ratio)
        };
        
        // Timing variables
        this.goodPostureFrames = 0;
        this.badPostureFrames = 0;
        this.lastFrameTime = 0;
        this.goodPostureTime = 0;
        this.badPostureTime = 0;
        
        // Performance settings
        this.frameSkip = 0; // Process every frame (set to 1 to skip every other frame, etc.)
        this.frameCount = 0;
        this.processingTimeLog = [];
        
        // Load thresholds from server
        this.loadThresholds();
    }
    
    /**
     * Load posture threshold values from server
     */
    async loadThresholds() {
        try {
            const response = await fetch('/api/posture_thresholds');
            const data = await response.json();
            
            // Update thresholds with server values
            this.thresholds.neckAngle = data.neck_angle_threshold;
            this.thresholds.torsoAngle = data.torso_angle_threshold;
            this.thresholds.alignment = data.alignment_threshold;
            this.thresholds.forwardHead = data.forward_head_threshold || 0.2;
            
            console.log('Loaded thresholds:', this.thresholds);
        } catch (error) {
            console.error('Error loading thresholds:', error);
        }
    }
    
    /**
     * Initialize webcam and posture detection
     */
    async start() {
        this.isRunning = true;
        this.loadingOverlay.classList.remove('d-none');
        this.noCameraDiv.classList.add('d-none');
        
        try {
            // Access webcam with higher quality settings
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1280, min: 640 },
                    height: { ideal: 720, min: 480 },
                    facingMode: 'user',
                    frameRate: { ideal: 30, min: 24 },
                    aspectRatio: { ideal: 1.7777777778 }, // 16:9
                },
                audio: false
            });
            
            // Apply stream to video element
            this.videoElement.srcObject = stream;
            
            // Set video properties for better quality
            this.videoElement.width = 1280;
            this.videoElement.height = 720;
            
            // Wait for video to be ready
            await new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => {
                    // Apply additional settings for better quality
                    this.videoElement.play().then(() => {
                        // Attempt to improve webcam clarity with CSS
                        this.videoElement.style.filter = 'contrast(1.05) brightness(1.05) saturate(1.05)';
                        resolve();
                    });
                };
            });
            
            // Resize canvas to match video dimensions
            this.resizeCanvas();
            
            // Load pose detection model
            await this.loadPoseDetection();
            
            // Start analysis loop
            this.analyzePosture();
            
            // Hide loading overlay
            this.loadingOverlay.classList.add('d-none');
            
            console.log('Camera started with resolution:', 
                this.videoElement.videoWidth, 'x', this.videoElement.videoHeight,
                'at', stream.getVideoTracks()[0].getSettings().frameRate, 'fps');
        } catch (error) {
            console.error('Error starting camera:', error);
            this.loadingOverlay.classList.add('d-none');
            this.noCameraDiv.classList.remove('d-none');
            this.showAlert('Error: Could not access webcam. Please check camera permissions.', 'danger');
            this.isRunning = false;
        }
    }
    
    /**
     * Load TensorFlow.js PoseNet model
     */
    async loadPoseDetection() {
        // Load TensorFlow.js models
        this.poseDetection = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        );
    }
    
    /**
     * Resize canvas to match video dimensions
     */
    resizeCanvas() {
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;
        
        this.canvasElement.width = videoWidth;
        this.canvasElement.height = videoHeight;
    }
    
    /**
     * Stop posture analysis and release camera
     */
    stop() {
        this.isRunning = false;
        
        // Stop all video tracks
        if (this.videoElement.srcObject) {
            const tracks = this.videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
        
        // Clear canvas
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // Show no camera div
        this.noCameraDiv.classList.remove('d-none');
    }
    
    /**
     * Main posture analysis loop
     */
    async analyzePosture() {
        if (!this.isRunning) return;
        
        const now = performance.now();
        const elapsed = now - this.lastFrameTime;
        this.lastFrameTime = now;
        
        // Frame skipping for performance - increment counter
        this.frameCount++;
        
        // Process this frame if it's not a skipped frame
        const shouldProcessThisFrame = this.frameCount % (this.frameSkip + 1) === 0;
        
        // Only process frame if video is playing and not skipped
        if (this.videoElement.readyState === 4 && shouldProcessThisFrame) {
            try {
                const processingStart = performance.now();
                
                // Detect pose
                this.pose = await this.poseDetection.estimatePoses(this.videoElement);
                
                // Clear canvas
                this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
                
                // If pose detected, analyze it
                if (this.pose && this.pose.length > 0) {
                    const posture = this.analyzePostureFromKeypoints(this.pose[0]);
                    this.drawPoseAnnotations(posture);
                    this.updateMetrics(posture);
                    
                    // Update posture timing
                    if (posture.isGoodPosture) {
                        this.goodPostureFrames++;
                        this.badPostureFrames = 0;
                        this.goodPostureTime += elapsed / 1000;
                    } else {
                        this.badPostureFrames++;
                        this.goodPostureFrames = 0;
                        this.badPostureTime += elapsed / 1000;
                    }
                    
                    // Check if bad posture warning is needed
                    if (this.badPostureFrames > 300) { // About 10 seconds at 30fps
                        this.showAlert('Warning: You have maintained poor posture for too long. Please adjust your position.', 'warning');
                    } else {
                        this.hideAlert();
                    }
                    
                    // Update time displays
                    document.getElementById('good-posture-time').textContent = `${Math.round(this.goodPostureTime)}s`;
                    document.getElementById('bad-posture-time').textContent = `${Math.round(this.badPostureTime)}s`;
                    
                    // Update posture chart
                    if (window.updatePostureChart) {
                        window.updatePostureChart(posture.isGoodPosture);
                    }
                } else {
                    this.showAlert('No pose detected. Please make sure your upper body is visible in the frame.', 'info');
                }
                
                // Track performance
                const processingTime = performance.now() - processingStart;
                this.processingTimeLog.push(processingTime);
                
                // Keep only the last 30 measurements
                if (this.processingTimeLog.length > 30) {
                    this.processingTimeLog.shift();
                    
                    // Calculate average processing time
                    const avgTime = this.processingTimeLog.reduce((a, b) => a + b, 0) / this.processingTimeLog.length;
                    
                    // Adjust frame skip based on performance (auto-tune)
                    if (avgTime > 100) { // If processing takes > 100ms, skip more frames
                        this.frameSkip = Math.min(3, this.frameSkip + 1);
                        console.log(`Performance optimization: Increasing frame skip to ${this.frameSkip}`);
                    } else if (avgTime < 50 && this.frameSkip > 0) { // If fast enough, reduce skipping
                        this.frameSkip = Math.max(0, this.frameSkip - 1);
                        console.log(`Performance optimization: Decreasing frame skip to ${this.frameSkip}`);
                    }
                }
            } catch (error) {
                console.error('Error analyzing posture:', error);
            }
        } else {
            // For skipped frames, still update the canvas to prevent flickering
            if (this.pose && this.pose.length > 0 && this.videoElement.readyState === 4) {
                // Just redraw last pose without re-analyzing
                const lastPose = this.analyzePostureFromKeypoints(this.pose[0]);
                this.drawPoseAnnotations(lastPose);
            }
        }
        
        // Continue the analysis loop
        if (this.isRunning) {
            requestAnimationFrame(() => this.analyzePosture());
        }
    }
    
    /**
     * Analyze posture from detected keypoints
     */
    analyzePostureFromKeypoints(pose) {
        const keypoints = pose.keypoints;
        
        // Get relevant keypoints
        const leftShoulder = this.getKeypoint(keypoints, 'left_shoulder');
        const rightShoulder = this.getKeypoint(keypoints, 'right_shoulder');
        const leftEar = this.getKeypoint(keypoints, 'left_ear');
        const rightEar = this.getKeypoint(keypoints, 'right_ear');
        const nose = this.getKeypoint(keypoints, 'nose');
        const leftHip = this.getKeypoint(keypoints, 'left_hip');
        const rightHip = this.getKeypoint(keypoints, 'right_hip');
        
        // Skip if minimum required keypoints are missing
        if (!leftShoulder || !rightShoulder || !leftEar || !leftHip) {
            return {
                hasKeypoints: false,
                message: 'Missing required keypoints'
            };
        }
        
        // Calculate shoulder alignment (distance)
        const shoulderOffset = this.findDistance(
            leftShoulder.x, leftShoulder.y,
            rightShoulder.x, rightShoulder.y
        );
        
        // Calculate neck inclination (angle)
        const neckInclination = this.findAngle(
            leftShoulder.x, leftShoulder.y,
            leftEar.x, leftEar.y
        );
        
        // Calculate torso inclination (angle)
        const torsoInclination = this.findAngle(
            leftHip.x, leftHip.y,
            leftShoulder.x, leftShoulder.y
        );
        
        // Calculate forward head posture
        let forwardHeadRatio = 0;
        
        // Method 1: If ear and nose are available, measure forward positioning
        if (leftEar && nose) {
            // Horizontal distance from ear to nose
            const earToNose = Math.abs(leftEar.x - nose.x);
            // Use shoulder width as reference for normalization
            const shoulderWidth = this.findDistance(
                leftShoulder.x, leftShoulder.y,
                rightShoulder.x, rightShoulder.y
            );
            
            forwardHeadRatio = earToNose / (shoulderWidth || 1); // Avoid div by zero
        }
        // Method 2: Alternative using both ears if available
        else if (leftEar && rightEar && leftShoulder && rightShoulder) {
            // Midpoint of ears
            const earMidX = (leftEar.x + rightEar.x) / 2;
            const earMidY = (leftEar.y + rightEar.y) / 2;
            
            // Midpoint of shoulders
            const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
            const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
            
            // Horizontal offset between ear and shoulder midpoints (normalized by shoulder width)
            const horizontalOffset = Math.abs(earMidX - shoulderMidX);
            const shoulderWidth = this.findDistance(
                leftShoulder.x, leftShoulder.y,
                rightShoulder.x, rightShoulder.y
            );
            
            forwardHeadRatio = horizontalOffset / (shoulderWidth || 1);
        }
        
        // Determine if posture is good
        const isAligned = shoulderOffset < this.thresholds.alignment;
        const isForwardHead = forwardHeadRatio > this.thresholds.forwardHead;
        
        const isGoodPosture = 
            neckInclination < this.thresholds.neckAngle && 
            torsoInclination < this.thresholds.torsoAngle &&
            !isForwardHead;
        
        return {
            hasKeypoints: true,
            shoulderOffset,
            neckInclination,
            torsoInclination,
            forwardHeadRatio,
            isForwardHead,
            isAligned,
            isGoodPosture,
            keypoints: {
                leftShoulder,
                rightShoulder,
                leftEar,
                rightEar,
                nose,
                leftHip,
                rightHip
            }
        };
    }
    
    /**
     * Find a specific keypoint by name
     */
    getKeypoint(keypoints, name) {
        const keypoint = keypoints.find(kp => kp.name === name);
        if (keypoint && keypoint.score > 0.5) {
            return {
                x: keypoint.x,
                y: keypoint.y,
                score: keypoint.score
            };
        }
        return null;
    }
    
    /**
     * Calculate distance between two points
     */
    findDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    
    /**
     * Calculate angle between two points (relative to vertical)
     */
    findAngle(x1, y1, x2, y2) {
        try {
            // Calculate vertical line
            const vertX = x1;
            const vertY = y1 - 100; // 100px up from point 1
            
            // Calculate vectors
            const v1x = vertX - x1;
            const v1y = vertY - y1;
            const v2x = x2 - x1;
            const v2y = y2 - y1;
            
            // Calculate dot product
            const dot = v1x * v2x + v1y * v2y;
            
            // Calculate magnitudes
            const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
            const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
            
            // Calculate angle in radians
            const angleRad = Math.acos(dot / (mag1 * mag2));
            
            // Convert to degrees
            return Math.round(angleRad * 180 / Math.PI);
        } catch (error) {
            console.error('Error calculating angle:', error);
            return 0;
        }
    }
    
    /**
     * Draw pose annotations on canvas
     */
    drawPoseAnnotations(posture) {
        if (!posture.hasKeypoints) return;
        
        const { leftShoulder, rightShoulder, leftEar, rightEar, nose, leftHip, rightHip } = posture.keypoints;
        const ctx = this.canvasCtx;
        
        // Set line style based on posture
        const color = posture.isGoodPosture ? '#4caf50' : '#f44336';
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        
        // Draw shoulder line
        ctx.beginPath();
        ctx.moveTo(leftShoulder.x, leftShoulder.y);
        ctx.lineTo(rightShoulder.x, rightShoulder.y);
        ctx.stroke();
        
        // Draw neck line (shoulder to ear)
        ctx.beginPath();
        ctx.moveTo(leftShoulder.x, leftShoulder.y);
        ctx.lineTo(leftEar.x, leftEar.y);
        ctx.stroke();
        
        // Draw vertical reference line from shoulder
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(leftShoulder.x, leftShoulder.y);
        ctx.lineTo(leftShoulder.x, leftShoulder.y - 100);
        ctx.stroke();
        
        // Draw torso line
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(leftHip.x, leftHip.y);
        ctx.lineTo(leftShoulder.x, leftShoulder.y);
        ctx.stroke();
        
        // Draw vertical reference line from hip
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(leftHip.x, leftHip.y);
        ctx.lineTo(leftHip.x, leftHip.y - 100);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw forward head posture indicator if nose is available
        if (nose && leftEar) {
            const forwardColor = posture.isForwardHead ? '#f44336' : '#4caf50';
            
            // Draw line from ear to nose
            ctx.strokeStyle = forwardColor;
            ctx.beginPath();
            ctx.moveTo(leftEar.x, leftEar.y);
            if (rightEar) {
                // If both ears visible, use midpoint
                const earMidX = (leftEar.x + rightEar.x) / 2;
                const earMidY = (leftEar.y + rightEar.y) / 2;
                ctx.moveTo(earMidX, earMidY);
            }
            ctx.lineTo(nose.x, nose.y);
            ctx.stroke();
            
            // Draw the nose point
            this.drawKeypoint(nose, forwardColor);
        }
        
        // Draw keypoints
        this.drawKeypoint(leftShoulder, color);
        this.drawKeypoint(rightShoulder, color);
        this.drawKeypoint(leftEar, color);
        if (rightEar) this.drawKeypoint(rightEar, color);
        this.drawKeypoint(leftHip, color);
        if (rightHip) this.drawKeypoint(rightHip, color);
        
        // Add angle text
        ctx.font = '16px Arial';
        ctx.fillStyle = color;
        ctx.fillText(`${Math.round(posture.neckInclination)}°`, leftShoulder.x + 10, leftShoulder.y);
        ctx.fillText(`${Math.round(posture.torsoInclination)}°`, leftHip.x + 10, leftHip.y);
        
        // Add forward head text if applicable
        if (posture.forwardHeadRatio > 0) {
            const forwardColor = posture.isForwardHead ? '#f44336' : '#4caf50';
            ctx.fillStyle = forwardColor;
            const forwardHeadPercent = Math.round(posture.forwardHeadRatio * 100);
            ctx.fillText(`${forwardHeadPercent}%`, nose ? nose.x + 10 : leftEar.x + 10, nose ? nose.y : leftEar.y);
        }
    }
    
    /**
     * Draw a keypoint on the canvas
     */
    drawKeypoint(keypoint, color) {
        this.canvasCtx.fillStyle = color;
        this.canvasCtx.beginPath();
        this.canvasCtx.arc(keypoint.x, keypoint.y, 8, 0, 2 * Math.PI);
        this.canvasCtx.fill();
    }
    
    /**
     * Update metrics display with current posture data
     */
    updateMetrics(posture) {
        if (!posture.hasKeypoints) return;
        
        // Update neck angle
        const neckAngle = document.getElementById('neck-angle');
        const neckStatus = document.getElementById('neck-status');
        const neckProgress = document.getElementById('neck-progress');
        
        neckAngle.textContent = Math.round(posture.neckInclination);
        neckProgress.style.width = `${Math.min(100, (posture.neckInclination / 90) * 100)}%`;
        
        if (posture.neckInclination < this.thresholds.neckAngle) {
            neckStatus.textContent = 'Good';
            neckStatus.className = 'badge bg-success';
            neckProgress.className = 'progress-bar bg-success';
        } else {
            neckStatus.textContent = 'Poor';
            neckStatus.className = 'badge bg-danger';
            neckProgress.className = 'progress-bar bg-danger';
        }
        
        // Update torso angle
        const torsoAngle = document.getElementById('torso-angle');
        const torsoStatus = document.getElementById('torso-status');
        const torsoProgress = document.getElementById('torso-progress');
        
        torsoAngle.textContent = Math.round(posture.torsoInclination);
        torsoProgress.style.width = `${Math.min(100, (posture.torsoInclination / 45) * 100)}%`;
        
        if (posture.torsoInclination < this.thresholds.torsoAngle) {
            torsoStatus.textContent = 'Good';
            torsoStatus.className = 'badge bg-success';
            torsoProgress.className = 'progress-bar bg-success';
        } else {
            torsoStatus.textContent = 'Poor';
            torsoStatus.className = 'badge bg-danger';
            torsoProgress.className = 'progress-bar bg-danger';
        }
        
        // Update alignment
        const alignmentValue = document.getElementById('alignment-value');
        const alignmentStatus = document.getElementById('alignment-status');
        const alignmentProgress = document.getElementById('alignment-progress');
        
        alignmentValue.textContent = Math.round(posture.shoulderOffset);
        alignmentProgress.style.width = `${Math.min(100, (posture.shoulderOffset / 200) * 100)}%`;
        
        if (posture.isAligned) {
            alignmentStatus.textContent = 'Aligned';
            alignmentStatus.className = 'badge bg-success';
            alignmentProgress.className = 'progress-bar bg-success';
        } else {
            alignmentStatus.textContent = 'Misaligned';
            alignmentStatus.className = 'badge bg-danger';
            alignmentProgress.className = 'progress-bar bg-danger';
        }
        
        // Update forward head posture (if elements exist in the DOM)
        const forwardHeadValue = document.getElementById('forward-head-value');
        const forwardHeadStatus = document.getElementById('forward-head-status');
        const forwardHeadProgress = document.getElementById('forward-head-progress');
        
        if (forwardHeadValue && forwardHeadStatus && forwardHeadProgress) {
            // Convert ratio to percentage for display
            const forwardHeadPercent = Math.round(posture.forwardHeadRatio * 100);
            forwardHeadValue.textContent = `${forwardHeadPercent}%`;
            forwardHeadProgress.style.width = `${Math.min(100, forwardHeadPercent * 2)}%`;
            
            if (!posture.isForwardHead) {
                forwardHeadStatus.textContent = 'Good';
                forwardHeadStatus.className = 'badge bg-success';
                forwardHeadProgress.className = 'progress-bar bg-success';
            } else {
                forwardHeadStatus.textContent = 'Forward';
                forwardHeadStatus.className = 'badge bg-danger';
                forwardHeadProgress.className = 'progress-bar bg-danger';
            }
        }
    }
    
    /**
     * Show alert message
     */
    showAlert(message, type = 'warning') {
        this.alertElement.classList.remove('d-none', 'alert-info', 'alert-warning', 'alert-danger');
        this.alertElement.classList.add(`alert-${type}`);
        this.alertMessage.textContent = message;
    }
    
    /**
     * Hide alert message
     */
    hideAlert() {
        this.alertElement.classList.add('d-none');
    }
    
    /**
     * Reset posture timing statistics
     */
    resetStats() {
        this.goodPostureFrames = 0;
        this.badPostureFrames = 0;
        this.goodPostureTime = 0;
        this.badPostureTime = 0;
        
        document.getElementById('good-posture-time').textContent = '0s';
        document.getElementById('bad-posture-time').textContent = '0s';
        
        if (window.resetPostureChart) {
            window.resetPostureChart();
        }
    }
}
