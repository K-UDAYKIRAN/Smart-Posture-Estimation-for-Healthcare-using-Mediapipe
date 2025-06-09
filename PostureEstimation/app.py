import os
import logging
import json
from flask import Flask, render_template, jsonify, request, Response

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create Flask app instance
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "posture-analysis-app-secret")

@app.route('/')
def index():
    """Render the main page of the application."""
    logger.info("Rendering index page")
    return render_template('index.html')

@app.route('/health_info')
def health_info():
    """Render the health information page."""
    logger.info("Rendering health info page")
    return render_template('health_info.html')

@app.route('/api/posture_thresholds', methods=['GET'])
def get_posture_thresholds():
    """Return the enhanced posture thresholds for the advanced analyzer."""
    logger.debug("Fetching posture thresholds")
    return jsonify({
        'neck_angle_threshold': 35,  # Updated based on ergonomic research
        'torso_angle_threshold': 10,
        'alignment_threshold': 30,   # Improved shoulder alignment detection
        'forward_head_threshold': 0.2 # New threshold for forward head position
    })

@app.route('/api/health_conditions', methods=['GET'])
def get_health_conditions():
    """Return information about posture-related health conditions."""
    logger.debug("Fetching health conditions information")
    return jsonify({
        'musculoskeletal': {
            'name': 'Musculoskeletal Issues',
            'description': 'Poor posture can lead to muscle imbalances, joint stress, and chronic pain conditions.',
            'risk_factors': ['Forward head posture', 'Rounded shoulders', 'Excessive slouching'],
            'prevention': 'Regular posture checks, ergonomic workspace, and strengthening exercises.'
        },
        'neurological': {
            'name': 'Neurological Impact',
            'description': 'Prolonged poor posture may increase pressure on nerves, contributing to conditions like cervical radiculopathy.',
            'risk_factors': ['Neck compression', 'Spinal misalignment', 'Nerve impingement'],
            'prevention': 'Proper alignment, regular breaks, and posture-correcting exercises.'
        },
        'respiratory': {
            'name': 'Respiratory Function',
            'description': 'Slouching compresses the lungs and can reduce oxygen intake by up to 30%, affecting energy levels and cognitive function.',
            'risk_factors': ['Slouched sitting', 'Compressed chest cavity', 'Limited lung expansion'],
            'prevention': 'Open chest posture, deep breathing exercises, and regular posture correction.'
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
