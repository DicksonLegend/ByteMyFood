from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import google.generativeai as genai
import PIL.Image
import io
import os
import re
import json
import logging
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.', template_folder='.')
CORS(app)

load_dotenv()

# Configure Gemini API using environment variable
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

genai.configure(api_key=GEMINI_API_KEY)

# Initialize Gemini model
model = genai.GenerativeModel('gemini-1.5-flash')

# Nutrition database (enhanced version)
NUTRITION_DATABASE = {
    "rice": {"calories": 130, "protein": "2.7g", "carbs": "28g", "fat": "0.3g"},
    "dal": {"calories": 170, "protein": "9g", "carbs": "22g", "fat": "0.5g"},
    "lentils": {"calories": 170, "protein": "9g", "carbs": "22g", "fat": "0.5g"},
    "chapati": {"calories": 100, "protein": "3g", "carbs": "18g", "fat": "1g"},
    "roti": {"calories": 100, "protein": "3g", "carbs": "18g", "fat": "1g"},
    "naan": {"calories": 150, "protein": "4g", "carbs": "25g", "fat": "3g"},
    "bread": {"calories": 120, "protein": "4g", "carbs": "22g", "fat": "2g"},
    "pasta": {"calories": 200, "protein": "7g", "carbs": "42g", "fat": "1g"},
    "noodles": {"calories": 180, "protein": "6g", "carbs": "35g", "fat": "2g"},
    "chicken": {"calories": 165, "protein": "31g", "carbs": "0g", "fat": "3.6g"},
    "mutton": {"calories": 250, "protein": "26g", "carbs": "0g", "fat": "17g"},
    "fish": {"calories": 140, "protein": "28g", "carbs": "0g", "fat": "3g"},
    "egg": {"calories": 70, "protein": "6g", "carbs": "1g", "fat": "5g"},
    "paneer": {"calories": 265, "protein": "18g", "carbs": "3g", "fat": "20g"},
    "tofu": {"calories": 76, "protein": "8g", "carbs": "2g", "fat": "4.8g"},
    "potato": {"calories": 77, "protein": "2g", "carbs": "17g", "fat": "0.1g"},
    "tomato": {"calories": 18, "protein": "1g", "carbs": "4g", "fat": "0.2g"},
    "onion": {"calories": 40, "protein": "1g", "carbs": "9g", "fat": "0.1g"},
    "carrot": {"calories": 25, "protein": "1g", "carbs": "6g", "fat": "0.1g"},
    "spinach": {"calories": 23, "protein": "3g", "carbs": "4g", "fat": "0.4g"},
    "broccoli": {"calories": 25, "protein": "3g", "carbs": "5g", "fat": "0.3g"},
    "cauliflower": {"calories": 25, "protein": "2g", "carbs": "5g", "fat": "0.3g"},
    "bell pepper": {"calories": 20, "protein": "1g", "carbs": "5g", "fat": "0.2g"},
    "cabbage": {"calories": 25, "protein": "1g", "carbs": "6g", "fat": "0.1g"},
    "cucumber": {"calories": 16, "protein": "1g", "carbs": "4g", "fat": "0.1g"},
    "apple": {"calories": 52, "protein": "0g", "carbs": "14g", "fat": "0.2g"},
    "banana": {"calories": 89, "protein": "1g", "carbs": "23g", "fat": "0.3g"},
    "orange": {"calories": 43, "protein": "1g", "carbs": "11g", "fat": "0.1g"},
    "grapes": {"calories": 67, "protein": "1g", "carbs": "17g", "fat": "0.2g"},
    "mango": {"calories": 60, "protein": "1g", "carbs": "15g", "fat": "0.4g"},
    "milk": {"calories": 60, "protein": "3g", "carbs": "5g", "fat": "3.2g"},
    "yogurt": {"calories": 59, "protein": "10g", "carbs": "4g", "fat": "0.4g"},
    "cheese": {"calories": 113, "protein": "7g", "carbs": "1g", "fat": "9g"},
    "butter": {"calories": 717, "protein": "1g", "carbs": "0g", "fat": "81g"},
    "ghee": {"calories": 900, "protein": "0g", "carbs": "0g", "fat": "100g"},
    "oil": {"calories": 884, "protein": "0g", "carbs": "0g", "fat": "100g"},
    "nuts": {"calories": 607, "protein": "20g", "carbs": "16g", "fat": "54g"},
    "almonds": {"calories": 575, "protein": "21g", "carbs": "22g", "fat": "49g"},
    "cashews": {"calories": 553, "protein": "18g", "carbs": "30g", "fat": "44g"},
    "sugar": {"calories": 387, "protein": "0g", "carbs": "100g", "fat": "0g"},
    "honey": {"calories": 304, "protein": "0g", "carbs": "82g", "fat": "0g"},
    "quinoa": {"calories": 120, "protein": "4g", "carbs": "22g", "fat": "2g"},
    "oats": {"calories": 68, "protein": "2g", "carbs": "12g", "fat": "1.4g"},
    "corn": {"calories": 86, "protein": "3g", "carbs": "19g", "fat": "1.4g"},
    "idli": {"calories": 58, "protein": "2g", "carbs": "12g", "fat": "0.5g"},
    "dosa": {"calories": 85, "protein": "2g", "carbs": "16g", "fat": "1g"},
    "sambar": {"calories": 65, "protein": "3g", "carbs": "10g", "fat": "2g"},
    "rasam": {"calories": 35, "protein": "1g", "carbs": "7g", "fat": "1g"},
    "coconut chutney": {"calories": 85, "protein": "1g", "carbs": "3g", "fat": "8g"}
}

HEALTH_TIPS = [
    "🌈 Try to 'eat the rainbow' by including fruits and vegetables of different colors in your meals - each color provides unique nutrients and antioxidants!",
    "🍽️ Follow the plate method: fill half your plate with vegetables, one quarter with lean protein, and one quarter with whole grains for optimal nutrition.",
    "💧 Stay hydrated! Your body needs adequate water for digestion, nutrient absorption, and overall cellular function.",
    "🐌 Practice mindful eating by chewing slowly and paying attention to hunger cues - this improves digestion and helps prevent overeating.",
    "🥜 Include healthy fats like nuts, seeds, and avocados in your diet - they're essential for brain health and nutrient absorption.",
    "🕐 Try to eat regular meals throughout the day to maintain steady blood sugar levels and sustained energy.",
    "🧂 Limit processed foods and excess sodium - fresh, whole foods provide better nutrition and natural flavors.",
    "🏃‍♀️ Combine good nutrition with regular physical activity for optimal health and wellbeing.",
    "🍊 Vitamin C-rich foods like citrus fruits help boost immune function and iron absorption from plant-based foods.",
    "🥬 Dark leafy greens are nutritional powerhouses packed with vitamins A, C, K, and folate - try to include them daily!"
]

def allowed_file(filename):
    """Check if the uploaded file is an allowed image type"""
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_food_items(text):
    """Extract food items from Gemini response text"""
    # Common food item patterns
    food_keywords = list(NUTRITION_DATABASE.keys())
    
    # Convert text to lowercase for matching
    text_lower = text.lower()
    
    # Find food items mentioned in the text
    identified_foods = []
    
    for food in food_keywords:
        # Check for exact matches and partial matches
        if food in text_lower or any(word in text_lower for word in food.split()):
            identified_foods.append(food)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_foods = []
    for food in identified_foods:
        if food not in seen:
            seen.add(food)
            unique_foods.append(food)
    
    return unique_foods[:6]  # Limit to 6 items to avoid clutter

def get_nutrition_data(food_items):
    """Get nutrition data for identified food items"""
    nutrition_data = {}
    for food in food_items:
        if food in NUTRITION_DATABASE:
            nutrition_data[food] = NUTRITION_DATABASE[food]
    return nutrition_data

def select_health_tip(food_items):
    """Select an appropriate health tip based on identified foods"""
    # Select tip based on food types
    if any(food in ['spinach', 'broccoli', 'carrot', 'tomato'] for food in food_items):
        return HEALTH_TIPS[0]  # Rainbow eating
    elif len(food_items) >= 4:
        return HEALTH_TIPS[1]  # Plate method
    elif any(food in ['nuts', 'almonds', 'cashews'] for food in food_items):
        return HEALTH_TIPS[4]  # Healthy fats
    else:
        return HEALTH_TIPS[2]  # Default hydration tip

@app.route('/', methods=['GET'])
def index():
    """Serve the main HTML page"""
    try:
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error serving index.html: {str(e)}")
        return jsonify({
            "error": "Frontend files not found",
            "message": "Please ensure index.html, styles.css, and script.js are in the root directory",
            "api_status": "healthy"
        }), 404

@app.route('/styles.css')
def serve_css():
    """Serve CSS file"""
    try:
        return send_from_directory('.', 'styles.css', mimetype='text/css')
    except Exception:
        return "/* styles.css not found */", 404

@app.route('/script.js')
def serve_js():
    """Serve JavaScript file"""
    try:
        return send_from_directory('.', 'script.js', mimetype='application/javascript')
    except Exception:
        return "// script.js not found", 404

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "message": "Food Analysis API is running",
        "version": "1.0.0"
    })

@app.route('/analyze', methods=['POST'])
def analyze_food():
    """Main endpoint for food analysis"""
    try:
        # Check if image file is present
        if 'image' not in request.files:
            return jsonify({
                "success": False,
                "error": "No image file provided"
            }), 400
        
        file = request.files['image']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No file selected"
            }), 400
        
        # Validate file type
        if not allowed_file(file.filename):
            return jsonify({
                "success": False,
                "error": "Invalid file type. Please upload an image file (PNG, JPG, JPEG, GIF, BMP, WebP)"
            }), 400
        
        # Read and process the image
        try:
            image_bytes = file.read()
            image = PIL.Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Error processing image. Please ensure the file is a valid image."
            }), 400
        
        # Create comprehensive prompt for Gemini
        prompt = """
        Analyze this food image and provide detailed information. Please:
        
        1. Describe what food items you can see in the image
        2. List the specific food items/ingredients visible
        3. Provide details about the preparation style, colors, and presentation
        4. Mention any garnishes, accompaniments, or side dishes
        5. Describe the overall meal composition
        
        Be specific about food names (e.g., if you see Indian bread, specify if it's chapati, naan, or roti).
        Focus on identifying individual food components rather than just dish names.
        """
        
        # Generate content using Gemini
        try:
            response = model.generate_content([prompt, image])
            description = response.text
            
        except Exception as e:
            logger.error(f"Error calling Gemini API: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Error analyzing image. Please try again."
            }), 500
        
        # Extract food items from the description
        identified_foods = extract_food_items(description)
        
        # Get nutrition data
        nutrition_data = get_nutrition_data(identified_foods)
        
        # Select appropriate health tip
        health_tip = select_health_tip(identified_foods)
        
        # Calculate confidence score (based on number of foods identified)
        confidence = min(95, 75 + len(identified_foods) * 3)
        
        # Prepare response
        result = {
            "success": True,
            "description": description,
            "foods": identified_foods,
            "nutrition": nutrition_data,
            "health_tip": health_tip,
            "confidence": f"{confidence}.0",
            "analysis_time": "2.1"  # Mock analysis time
        }
        
        logger.info(f"Successfully analyzed image. Found {len(identified_foods)} food items.")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Unexpected error in analyze_food: {str(e)}")
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred. Please try again."
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Detailed health check endpoint"""
    return jsonify({
        "status": "healthy",
        "gemini_configured": bool(GEMINI_API_KEY),
        "supported_formats": ["PNG", "JPG", "JPEG", "GIF", "BMP", "WebP"],
        "nutrition_database_size": len(NUTRITION_DATABASE)
    })

@app.errorhandler(413)
def too_large(e):
    """Handle file too large error"""
    return jsonify({
        "success": False,
        "error": "File too large. Please upload an image smaller than 16MB."
    }), 413

@app.errorhandler(500)
def internal_error(e):
    """Handle internal server errors"""
    return jsonify({
        "success": False,
        "error": "Internal server error. Please try again."
    }), 500

if __name__ == '__main__':
    # Get port from environment variable (Railway sets this automatically)
    port = int(os.environ.get('PORT', 5000))
    
    # Run the app
    app.run(
        host='0.0.0.0',
        port=port,
        debug=os.environ.get('FLASK_ENV') == 'development'
    )