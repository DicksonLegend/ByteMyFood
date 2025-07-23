// ===== CONFIGURATION =====
const API_BASE_URL = window.location.origin; // Change to your backend URL

// ===== DOM ELEMENTS =====
const uploadForm = document.getElementById('uploadForm');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const btnText = document.querySelector('.btn-text');
const btnSpinner = document.querySelector('.btn-spinner');
const resultsSection = document.getElementById('resultsSection');
const errorMessage = document.getElementById('errorMessage');

// Result display elements
const foodDescription = document.getElementById('foodDescription');
const foodNames = document.getElementById('foodNames');
const nutritionInfo = document.getElementById('nutritionInfo');
const healthTip = document.getElementById('healthTip');

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', initializeApp);
imageInput.addEventListener('change', handleImageSelection);
removeImageBtn.addEventListener('click', clearImagePreview);
uploadForm.addEventListener('submit', handleFormSubmission);

// Enhanced drag and drop
const fileInputLabel = document.querySelector('.file-input-label');
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileInputLabel.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    fileInputLabel.addEventListener(eventName, highlightDropArea, false);
});

['dragleave', 'drop'].forEach(eventName => {
    fileInputLabel.addEventListener(eventName, unhighlightDropArea, false);
});

fileInputLabel.addEventListener('drop', handleFileDrop, false);

// ===== MAIN FUNCTIONS =====
function initializeApp() {
    console.log('🍽️ What\'s On My Plate? - Food Analyzer Initialized');
    hideError();
    hideResults();
    
    // Check backend connection
    checkBackendConnection();
}

async function checkBackendConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend connected successfully:', data);
        } else {
            console.warn('⚠️ Backend connection issue');
        }
    } catch (error) {
        console.error('❌ Backend not accessible:', error);
        showError('⚠️ Backend server is not accessible. Please make sure your Flask server is running on port 5000.');
    }
}

function handleImageSelection(event) {
    const file = event.target.files[0];
    
    if (file) {
        if (validateFile(file)) {
            displayImagePreview(file);
        } else {
            clearImagePreview();
        }
    }
}

function validateFile(file) {
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 
        'image/gif', 'image/webp', 'image/bmp'
    ];
    const maxSize = 16 * 1024 * 1024; // 16MB (matches Flask limit)
    const minSize = 1024; // 1KB
    
    if (!allowedTypes.includes(file.type)) {
        showError(`❌ Unsupported file type: ${file.type}. Please select a valid image file (JPEG, PNG, GIF, WebP, or BMP).`);
        return false;
    }
    
    if (file.size > maxSize) {
        showError(`📏 File too large: ${formatFileSize(file.size)}. Please choose an image smaller than ${formatFileSize(maxSize)}.`);
        return false;
    }
    
    if (file.size < minSize) {
        showError('📄 File too small. Please select a proper image file.');
        return false;
    }
    
    return true;
}

function displayImagePreview(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        previewImg.src = e.target.result;
        previewImg.onload = function() {
            displayImageInfo(file, this);
            
            imagePreview.style.display = 'block';
            imagePreview.classList.add('slide-up');
            analyzeBtn.disabled = false;
            hideError();
            
            setTimeout(() => {
                imagePreview.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
            }, 200);
            
            showMiniSuccess('✅ Image loaded successfully!');
        };
    };
    
    reader.onerror = function() {
        showError('💥 Error reading the image file. The file might be corrupted. Please try a different image.');
        clearImagePreview();
    };
    
    reader.readAsDataURL(file);
}

function displayImageInfo(file, img) {
    let infoOverlay = document.querySelector('.image-info-overlay');
    if (!infoOverlay) {
        infoOverlay = document.createElement('div');
        infoOverlay.className = 'image-info-overlay';
        infoOverlay.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 0.8rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            z-index: 10;
        `;
        imagePreview.appendChild(infoOverlay);
    }
    
    infoOverlay.innerHTML = `
        📸 ${file.name}<br>
        📏 ${img.naturalWidth} × ${img.naturalHeight}px<br>
        💾 ${formatFileSize(file.size)}
    `;
}

function clearImagePreview() {
    imageInput.value = '';
    imagePreview.style.display = 'none';
    imagePreview.classList.remove('slide-up');
    analyzeBtn.disabled = true;
    hideResults();
    hideError();
    previewImg.src = '';
    
    const infoOverlay = document.querySelector('.image-info-overlay');
    if (infoOverlay) {
        infoOverlay.remove();
    }
    
    console.log('🗑️ Image preview cleared');
}

async function handleFormSubmission(event) {
    event.preventDefault();
    
    const file = imageInput.files[0];
    if (!file) {
        showError('📷 Please select an image first.');
        return;
    }
    
    setLoadingState(true);
    hideError();
    hideResults();
    
    try {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('image', file);
        
        // Send request to Flask backend
        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            body: formData,
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayResults(result);
            showSuccessMessage(result);
        } else {
            showError(`❌ Analysis failed: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Analysis Error:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showError('🔌 Cannot connect to the backend server. Please make sure your Flask server is running on port 5000.');
        } else {
            showError('🔄 An error occurred during analysis. Please try again.');
        }
    } finally {
        setLoadingState(false);
    }
}

function displayResults(data) {
    displayDescription(data.description);
    displayIdentifiedFoods(data.foods);
    displayNutritionInfo(data.nutrition);
    displayHealthTip(data.health_tip);
    displayAnalysisMetrics(data);
    
    resultsSection.style.display = 'block';
    resultsSection.classList.add('fade-in');
    
    // Staggered card animations
    const cards = resultsSection.querySelectorAll('.result-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 200);
    });
    
    setTimeout(() => {
        resultsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 400);
}

function displayAnalysisMetrics(data) {
    let metricsDiv = document.querySelector('.analysis-metrics');
    if (!metricsDiv) {
        metricsDiv = document.createElement('div');
        metricsDiv.className = 'analysis-metrics';
        metricsDiv.style.cssText = `
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(255, 255, 255, 0.1));
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-around;
            text-align: center;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        resultsSection.insertBefore(metricsDiv, resultsSection.firstChild.nextSibling);
    }
    
    metricsDiv.innerHTML = `
        <div>
            <div style="font-size: 1.5rem; font-weight: bold; color: #667eea;">⚡</div>
            <div style="font-size: 0.9rem; color: #666;">Analysis Time</div>
            <div style="font-size: 1.1rem; font-weight: 600;">${data.analysis_time}s</div>
        </div>
        <div>
            <div style="font-size: 1.5rem; font-weight: bold; color: #4ecdc4;">🎯</div>
            <div style="font-size: 0.9rem; color: #666;">Confidence</div>
            <div style="font-size: 1.1rem; font-weight: 600;">${data.confidence}%</div>
        </div>
        <div>
            <div style="font-size: 1.5rem; font-weight: bold; color: #fa709a;">🍽️</div>
            <div style="font-size: 0.9rem; color: #666;">Items Found</div>
            <div style="font-size: 1.1rem; font-weight: 600;">${data.foods.length}</div>
        </div>
    `;
}

function displayDescription(description) {
    foodDescription.textContent = '';
    let index = 0;
    
    const typeInterval = setInterval(() => {
        if (index < description.length) {
            foodDescription.textContent += description.charAt(index);
            index++;
        } else {
            clearInterval(typeInterval);
        }
    }, 25);
}

function displayIdentifiedFoods(foods) {
    foodNames.innerHTML = '';
    
    if (foods.length === 0) {
        foodNames.innerHTML = `
            <div style="text-align: center; color: #718096; font-style: italic; padding: 30px;">
                🔍 No specific foods identified in this image. Try uploading a clearer food photo.
            </div>
        `;
        return;
    }
    
    foods.forEach((food, index) => {
        setTimeout(() => {
            const foodTag = document.createElement('span');
            foodTag.className = 'food-tag';
            foodTag.textContent = capitalizeFirstLetter(food.replace('_', ' '));
            foodTag.style.opacity = '0';
            foodTag.style.transform = 'translateY(20px) scale(0.8)';
            
            foodNames.appendChild(foodTag);
            
            setTimeout(() => {
                foodTag.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                foodTag.style.opacity = '1';
                foodTag.style.transform = 'translateY(0) scale(1)';
            }, 50);
            
        }, index * 150);
    });
}

function displayNutritionInfo(nutrition) {
    nutritionInfo.innerHTML = '';
    
    if (Object.keys(nutrition).length === 0) {
        nutritionInfo.innerHTML = `
            <div style="text-align: center; color: #718096; font-style: italic; padding: 30px; grid-column: 1 / -1;">
                📊 No nutrition information available for the identified foods.
            </div>
        `;
        return;
    }
    
    const totals = calculateNutritionTotals(nutrition);
    displayNutritionTotals(totals);
    
    if (Object.keys(nutrition).length > 1) {
        displayNutritionBreakdown(nutrition);
    }
}

function displayNutritionTotals(totals) {
    const nutritionCards = [
        { 
            key: 'calories', 
            label: 'Total Calories', 
            value: totals.calories, 
            unit: 'kcal', 
            icon: '🔥',
            color: '#ff6b6b',
            description: 'Energy content'
        },
        { 
            key: 'protein', 
            label: 'Total Protein', 
            value: totals.protein, 
            unit: '', 
            icon: '💪',
            color: '#4ecdc4',
            description: 'Muscle building'
        },
        { 
            key: 'carbs', 
            label: 'Total Carbs', 
            value: totals.carbs, 
            unit: '', 
            icon: '🌾',
            color: '#45b7d1',
            description: 'Quick energy'
        }
    ];
    
    nutritionCards.forEach((card, index) => {
        setTimeout(() => {
            const nutritionItem = document.createElement('div');
            nutritionItem.className = 'nutrition-item';
            nutritionItem.innerHTML = `
                <h4 style="color: ${card.color}">${card.icon} ${card.label}</h4>
                <div class="nutrition-value">
                    ${card.value}
                    <span class="nutrition-unit">${card.unit}</span>
                </div>
                <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">
                    ${card.description}
                </div>
            `;
            
            nutritionItem.style.opacity = '0';
            nutritionItem.style.transform = 'translateY(30px) scale(0.9)';
            nutritionInfo.appendChild(nutritionItem);
            
            setTimeout(() => {
                nutritionItem.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                nutritionItem.style.opacity = '1';
                nutritionItem.style.transform = 'translateY(0) scale(1)';
            }, 50);
            
        }, index * 200);
    });
}

function displayNutritionBreakdown(nutrition) {
    setTimeout(() => {
        const breakdownTitle = document.createElement('div');
        breakdownTitle.innerHTML = `
            <h4 style="grid-column: 1 / -1; margin: 40px 0 20px 0; text-align: center; color: #667eea; font-size: 1.2rem;">
                📋 Individual Food Breakdown
            </h4>
        `;
        nutritionInfo.appendChild(breakdownTitle);
        
        Object.entries(nutrition).forEach(([food, data], index) => {
            setTimeout(() => {
                const foodBreakdown = document.createElement('div');
                foodBreakdown.className = 'nutrition-item';
                foodBreakdown.style.background = 'linear-gradient(135deg, #fff 0%, #f8f9ff 100%)';
                foodBreakdown.innerHTML = `
                    <h4 style="color: #667eea; margin-bottom: 15px;">
                        🍽️ ${capitalizeFirstLetter(food.replace('_', ' '))}
                    </h4>
                    <div style="font-size: 0.95rem; line-height: 1.8;">
                        <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
                            <span>Calories:</span>
                            <strong>${data.calories} kcal</strong>
                        </div>
                        <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
                            <span>Protein:</span>
                            <strong>${data.protein}</strong>
                        </div>
                        <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
                            <span>Carbs:</span>
                            <strong>${data.carbs}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Fat:</span>
                            <strong>${data.fat}</strong>
                        </div>
                    </div>
                `;
                
                foodBreakdown.style.opacity = '0';
                foodBreakdown.style.transform = 'translateY(20px)';
                nutritionInfo.appendChild(foodBreakdown);
                
                setTimeout(() => {
                    foodBreakdown.style.transition = 'all 0.4s ease';
                    foodBreakdown.style.opacity = '1';
                    foodBreakdown.style.transform = 'translateY(0)';
                }, 50);
                
            }, index * 150);
        });
    }, 1200);
}

function calculateNutritionTotals(nutrition) {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    
    Object.values(nutrition).forEach(food => {
        totalCalories += food.calories || 0;
        totalProtein += parseFloat(food.protein) || 0;
        totalCarbs += parseFloat(food.carbs) || 0;
    });
    
    return {
        calories: totalCalories,
        protein: totalProtein.toFixed(1) + 'g',
        carbs: totalCarbs.toFixed(1) + 'g'
    };
}

function displayHealthTip(tip) {
    healthTip.textContent = tip;
    healthTip.style.opacity = '0';
    healthTip.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        healthTip.style.transition = 'all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        healthTip.style.opacity = '1';
        healthTip.style.transform = 'translateY(0)';
    }, 1500);
}

// ===== UI STATE MANAGEMENT =====
function setLoadingState(isLoading) {
    if (isLoading) {
        analyzeBtn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'flex';
        uploadForm.classList.add('loading');
        document.body.style.cursor = 'wait';
        
    } else {
        analyzeBtn.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        uploadForm.classList.remove('loading');
        document.body.style.cursor = 'default';
    }
}

function showError(message) {
    const errorText = errorMessage.querySelector('.error-text');
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    errorMessage.classList.add('slide-up');
    
    errorMessage.style.animation = 'shake 0.5s ease-in-out';
    
    setTimeout(() => {
        errorMessage.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }, 100);
    
    setTimeout(hideError, 15000); // Auto-hide after 15 seconds
}

function showSuccessMessage(data) {
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.style.cssText = `
        background: linear-gradient(135deg, #10b981, #059669);
        backdrop-filter: blur(20px);
        color: white;
        padding: 20px 25px;
        border-radius: 15px;
        margin-bottom: 25px;
        text-align: center;
        font-weight: 500;
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        animation: successSlideIn 0.6s ease;
        border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    successMsg.innerHTML = `
        <div style="font-size: 1.2rem; margin-bottom: 8px;">
            ✅ Analysis completed successfully!
        </div>
        <div style="font-size: 0.9rem; opacity: 0.9;">
            Found ${data.foods.length} food items with ${data.confidence}% confidence
        </div>
    `;
    
    resultsSection.parentNode.insertBefore(successMsg, resultsSection);
    
    setTimeout(() => {
        successMsg.style.transition = 'all 0.5s ease';
        successMsg.style.opacity = '0';
        successMsg.style.transform = 'translateY(-20px)';
        setTimeout(() => successMsg.remove(), 500);
    }, 5000);
}

function showMiniSuccess(message) {
    const miniSuccess = document.createElement('div');
    miniSuccess.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    `;
    miniSuccess.textContent = message;
    
    document.body.appendChild(miniSuccess);
    
    setTimeout(() => {
        miniSuccess.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => miniSuccess.remove(), 300);
    }, 2000);
}

function hideError() {
    errorMessage.style.display = 'none';
    errorMessage.classList.remove('slide-up');
    errorMessage.style.animation = '';
}

function hideResults() {
    resultsSection.style.display = 'none';
    resultsSection.classList.remove('fade-in');
}

// ===== DRAG AND DROP =====
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlightDropArea() {
    fileInputLabel.classList.add('drag-over');
    fileInputLabel.style.transform = 'scale(1.02)';
}

function unhighlightDropArea() {
    fileInputLabel.classList.remove('drag-over');
    fileInputLabel.style.transform = '';
}

function handleFileDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        imageInput.files = files;
        handleImageSelection({ target: { files: files } });
        showMiniSuccess('📁 File dropped successfully!');
    }
}

// ===== UTILITY FUNCTIONS =====
function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Add CSS animations for better UX
const style = document.createElement('style');
style.textContent = `
    @keyframes successSlideIn {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(300px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(300px);
        }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);
