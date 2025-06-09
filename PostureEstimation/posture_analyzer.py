import math
import cv2
import mediapipe as mp
import logging

class PostureAnalyzer:
    """Enhanced class to analyze posture using MediaPipe 0.10.21 and OpenCV."""
    
    def __init__(self):
        """Initialize the PostureAnalyzer with MediaPipe pose solution."""
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        # Use the latest MediaPipe 0.10.21 features for better performance
        self.pose = self.mp_pose.Pose(
            model_complexity=1,  # 0=Lite, 1=Full, 2=Heavy
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6,
            enable_segmentation=False,  # For efficiency
            static_image_mode=False  # Optimize for video
        )
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        
    def find_distance(self, x1, y1, x2, y2):
        """Calculate the Euclidean distance between two points."""
        return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    
    def find_angle(self, x1, y1, x2, y2):
        """Calculate the angle between two points with respect to the vertical."""
        try:
            # More robust angle calculation
            angle = math.degrees(math.atan2(abs(x2 - x1), abs(y2 - y1)))
            return int(angle)
        except (ZeroDivisionError, ValueError) as e:
            self.logger.warning(f"Angle calculation error: {e}")
            return 0
    
    def process_frame(self, frame):
        """Process a video frame and detect posture landmarks."""
        if frame is None or frame.size == 0:
            self.logger.warning("Empty frame received")
            return None
            
        # Convert the BGR image to RGB for MediaPipe
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # To improve performance, optionally mark the image as not writeable
        image_rgb.flags.writeable = False
        
        # Process the image and find pose landmarks
        results = self.pose.process(image_rgb)
        
        # Make image writeable again for drawing
        image_rgb.flags.writeable = True
        
        return results
    
    def analyze_posture(self, results, frame):
        """Analyze the posture from detected landmarks with enhanced accuracy."""
        if not results or not results.pose_landmarks:
            return {
                "has_landmarks": False,
                "message": "No pose landmarks detected."
            }
        
        h, w = frame.shape[:2]
        lm = results.pose_landmarks.landmark
        lmPose = self.mp_pose.PoseLandmark
        
        # Extract key landmarks with error handling
        try:
            # Get all necessary landmarks
            nose = lm[lmPose.NOSE]
            left_eye = lm[lmPose.LEFT_EYE]
            right_eye = lm[lmPose.RIGHT_EYE]
            left_ear = lm[lmPose.LEFT_EAR]
            right_ear = lm[lmPose.RIGHT_EAR]
            left_shoulder = lm[lmPose.LEFT_SHOULDER]
            right_shoulder = lm[lmPose.RIGHT_SHOULDER]
            left_hip = lm[lmPose.LEFT_HIP]
            right_hip = lm[lmPose.RIGHT_HIP]
            
            # Get visibility scores to ensure accuracy
            landmarks_visibility = {
                "l_shoulder": left_shoulder.visibility,
                "r_shoulder": right_shoulder.visibility,
                "l_ear": left_ear.visibility,
                "r_ear": right_ear.visibility,
                "l_hip": left_hip.visibility,
                "r_hip": right_hip.visibility
            }
            
            # Skip if key landmarks are not visible enough
            visibility_threshold = 0.5
            if (left_shoulder.visibility < visibility_threshold or
                right_shoulder.visibility < visibility_threshold or
                left_hip.visibility < visibility_threshold):
                return {
                    "has_landmarks": False,
                    "message": "Key landmarks not visible enough",
                    "visibility": landmarks_visibility
                }
            
            # Convert normalized coordinates to pixel coordinates
            l_shldr_x, l_shldr_y = int(left_shoulder.x * w), int(left_shoulder.y * h)
            r_shldr_x, r_shldr_y = int(right_shoulder.x * w), int(right_shoulder.y * h)
            l_ear_x, l_ear_y = int(left_ear.x * w), int(left_ear.y * h)
            r_ear_x, r_ear_y = int(right_ear.x * w), int(right_ear.y * h)
            l_hip_x, l_hip_y = int(left_hip.x * w), int(left_hip.y * h)
            r_hip_x, r_hip_y = int(right_hip.x * w), int(right_hip.y * h)
            
            # Get midpoints for better measurements
            mid_shoulder_x = (l_shldr_x + r_shldr_x) // 2
            mid_shoulder_y = (l_shldr_y + r_shldr_y) // 2
            mid_hip_x = (l_hip_x + r_hip_x) // 2
            mid_hip_y = (l_hip_y + r_hip_y) // 2
            mid_ear_x = (l_ear_x + r_ear_x) // 2
            mid_ear_y = (l_ear_y + r_ear_y) // 2
            
            # Calculate posture metrics with enhanced accuracy
            # 1. Shoulder alignment (horizontal balance)
            shoulder_offset = abs(l_shldr_y - r_shldr_y)
            shoulder_distance = self.find_distance(l_shldr_x, l_shldr_y, r_shldr_x, r_shldr_y)
            
            # 2. Neck inclination: angle between middle ear and middle shoulder
            neck_inclination = self.find_angle(mid_shoulder_x, mid_shoulder_y, mid_ear_x, mid_ear_y)
            
            # 3. Torso inclination: angle between middle shoulder and middle hip
            torso_inclination = self.find_angle(mid_hip_x, mid_hip_y, mid_shoulder_x, mid_shoulder_y)
            
            # 4. Calculate forward head position (how far forward the head is compared to shoulders)
            forward_head_distance = mid_ear_x - mid_shoulder_x if mid_ear_x > mid_shoulder_x else 0
            forward_head_ratio = forward_head_distance / shoulder_distance if shoulder_distance > 0 else 0
            
            # Determine if posture is good with more advanced criteria
            is_aligned = shoulder_offset < 30  # Less than 30px vertical difference
            is_neck_good = neck_inclination < 35
            is_torso_good = torso_inclination < 10
            is_head_position_good = forward_head_ratio < 0.2  # Head not too far forward
            
            # Overall posture assessment
            is_good_posture = is_aligned and is_neck_good and is_torso_good and is_head_position_good
            
            # Detailed posture information for health insights
            posture_assessment = {
                "shoulder_balance": "Good" if is_aligned else "Poor",
                "neck_position": "Good" if is_neck_good else "Forward head posture",
                "torso_position": "Good" if is_torso_good else "Slouching",
                "overall": "Good" if is_good_posture else "Needs improvement"
            }
            
            return {
                "has_landmarks": True,
                "shoulder_offset": shoulder_offset,
                "shoulder_distance": shoulder_distance,
                "neck_inclination": neck_inclination,
                "torso_inclination": torso_inclination,
                "forward_head_ratio": forward_head_ratio,
                "is_aligned": is_aligned,
                "is_neck_good": is_neck_good,
                "is_torso_good": is_torso_good,
                "is_head_position_good": is_head_position_good,
                "is_good_posture": is_good_posture,
                "posture_assessment": posture_assessment,
                "visibility": landmarks_visibility,
                "landmarks": {
                    "mid_shoulder": (mid_shoulder_x, mid_shoulder_y),
                    "mid_hip": (mid_hip_x, mid_hip_y),
                    "mid_ear": (mid_ear_x, mid_ear_y),
                    "l_shldr": (l_shldr_x, l_shldr_y),
                    "r_shldr": (r_shldr_x, r_shldr_y),
                    "l_ear": (l_ear_x, l_ear_y),
                    "r_ear": (r_ear_x, r_ear_y),
                    "l_hip": (l_hip_x, l_hip_y),
                    "r_hip": (r_hip_x, r_hip_y)
                }
            }
        except (IndexError, AttributeError) as e:
            self.logger.error(f"Error processing landmarks: {str(e)}")
            return {
                "has_landmarks": False,
                "message": f"Error processing landmarks: {str(e)}"
            }
    
    def draw_pose_annotations(self, frame, posture_data):
        """Draw pose annotations on the frame for visualization."""
        if not posture_data or not posture_data.get("has_landmarks", False):
            return frame
        
        landmarks = posture_data.get("landmarks", {})
        is_good_posture = posture_data.get("is_good_posture", False)
        
        # Define colors
        good_color = (0, 255, 0)  # Green in BGR
        bad_color = (0, 0, 255)   # Red in BGR
        color = good_color if is_good_posture else bad_color
        
        # Draw lines for posture assessment
        if "mid_shoulder" in landmarks and "mid_ear" in landmarks:
            cv2.line(frame, landmarks["mid_shoulder"], landmarks["mid_ear"], color, 2)
            
        if "mid_shoulder" in landmarks and "mid_hip" in landmarks:
            cv2.line(frame, landmarks["mid_shoulder"], landmarks["mid_hip"], color, 2)
            
        if "mid_shoulder" in landmarks:
            # Draw vertical reference line
            mid_x, mid_y = landmarks["mid_shoulder"]
            cv2.line(frame, (mid_x, mid_y), (mid_x, mid_y - 150), (255, 255, 0), 2)  # Yellow vertical line
            
        # Draw shoulder line
        if "l_shldr" in landmarks and "r_shldr" in landmarks:
            cv2.line(frame, landmarks["l_shldr"], landmarks["r_shldr"], color, 3)
            
        # Add posture metrics text
        h, w = frame.shape[:2]
        font = cv2.FONT_HERSHEY_SIMPLEX
        
        # Display metrics
        neck_angle = posture_data.get("neck_inclination", 0)
        torso_angle = posture_data.get("torso_inclination", 0)
        
        cv2.putText(frame, f"Neck: {neck_angle}°", (10, 30), font, 0.6, color, 2)
        cv2.putText(frame, f"Torso: {torso_angle}°", (10, 60), font, 0.6, color, 2)
        
        posture_assessment = posture_data.get("posture_assessment", {})
        if posture_assessment:
            overall = posture_assessment.get("overall", "")
            cv2.putText(frame, f"Posture: {overall}", (10, h - 20), font, 0.6, color, 2)
        
        return frame
    
    def close(self):
        """Release the MediaPipe pose processor."""
        self.pose.close()
