/**
 * Main JavaScript file for Posture Analysis Web App
 * Handles UI interactions and initializes components
 */

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const resetStatsBtn = document.getElementById('resetStatsBtn');
    const noCameraDiv = document.getElementById('no-camera');
    
    // Create PostureAnalyzer instance
    const postureAnalyzer = new PostureAnalyzer();
    
    // Initialize posture chart
    initializePostureChart();
    
    // Add TensorFlow.js script dynamically
    function loadTensorFlow() {
        return new Promise((resolve, reject) => {
            // First load TensorFlow.js core
            const tfScript = document.createElement('script');
            tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js';
            tfScript.onload = () => {
                console.log('TensorFlow.js core loaded');
                
                // Then load TensorFlow.js models
                const tfModelsScript = document.createElement('script');
                tfModelsScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@0.0.6/dist/pose-detection.min.js';
                tfModelsScript.onload = () => {
                    console.log('TensorFlow.js pose detection loaded');
                    resolve();
                };
                tfModelsScript.onerror = reject;
                document.body.appendChild(tfModelsScript);
            };
            tfScript.onerror = reject;
            document.body.appendChild(tfScript);
        });
    }
    
    // Start button click handler
    startBtn.addEventListener('click', async function() {
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
        
        try {
            // Load TensorFlow.js if not already loaded
            if (typeof tf === 'undefined') {
                await loadTensorFlow();
            }
            
            // Start posture analysis
            await postureAnalyzer.start();
            
            // Update UI
            startBtn.disabled = true;
            stopBtn.disabled = false;
            noCameraDiv.classList.add('d-none');
        } catch (error) {
            console.error('Error starting posture analysis:', error);
            alert('Could not start posture analysis. Please check browser permissions and try again.');
        } finally {
            startBtn.innerHTML = '<i class="fas fa-play me-1"></i>Start';
        }
    });
    
    // Stop button click handler
    stopBtn.addEventListener('click', function() {
        postureAnalyzer.stop();
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });
    
    // Reset stats button click handler
    resetStatsBtn.addEventListener('click', function() {
        postureAnalyzer.resetStats();
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && postureAnalyzer.isRunning) {
            // Pause analysis when page is not visible
            postureAnalyzer.stop();
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (postureAnalyzer.isRunning) {
            postureAnalyzer.resizeCanvas();
        }
    });
});