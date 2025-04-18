document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const spamCheckForm = document.getElementById('spam-check-form');
    const messageInput = document.getElementById('message-input');
    const checkButton = document.getElementById('check-button');
    const resultsCard = document.getElementById('results-card');
    const resultsHeader = document.getElementById('results-header');
    const resultTitle = document.getElementById('result-title');
    const resultBadge = document.getElementById('result-badge');
    const resultMessage = document.getElementById('result-message');
    const confidenceBar = document.getElementById('confidence-bar');
    const indicatorsList = document.getElementById('indicators-list');
    const copyResultBtn = document.getElementById('copy-result-btn');
    const shareResultBtn = document.getElementById('share-result-btn');
    const reportHamBtn = document.getElementById('report-ham-btn');
    const reportSpamBtn = document.getElementById('report-spam-btn');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const noHistoryAlert = document.getElementById('no-history-alert');
    const checkedCount = document.getElementById('checked-count');
    const spamCount = document.getElementById('spam-count');
    const spamRatioBar = document.getElementById('spam-ratio-bar');
    const historyLink = document.getElementById('history-link');
    const shareModal = new bootstrap.Modal(document.getElementById('shareModal'));
    const shareText = document.getElementById('share-text');
    const copyShareTextBtn = document.getElementById('copy-share-text-btn');
    const toast = new bootstrap.Toast(document.getElementById('toast'));
    const toastMessage = document.getElementById('toast-message');

    // Current message data
    let currentMessageData = null;
    
    // Load history from localStorage
    let messageHistory = JSON.parse(localStorage.getItem('smsSpamHistory')) || [];
    
    // Initialize stats
    updateStats();
    renderHistory();

    // Spam detector class - client-side implementation
    class SpamDetector {
        constructor() {
            // Common spam phrases patterns
            this.spamPatterns = [
                // Common spam phrases
                /\b(free|win|won|winner|offer|prize|claim|congratulations|urgent|limited time)\b/i,
                // Money-related terms
                /\b(cash|money|dollars|\$|€|£)\b/i,
                // Urgency indicators
                /\b(act now|don't miss|expires|hurry|immediately|instant|now|offer expires|only|quick|urgent)\b/i,
                // Call to action
                /\b(call|reply|visit|click|apply now|buy|order|get it now|sign up)\b/i,
                // URLs and contact methods often found in spam
                /https?:\/\/\S+/i,
                // Excessive punctuation
                /!{2,}|\?{2,}/,
                // All caps words (shouting)
                /\b[A-Z]{3,}\b/,
                // Typical spam message patterns
                /\b(verify your account|your payment|your number was selected)\b/i
            ];
            
            // Common legitimate message patterns
            this.hamPatterns = [
                /\b(meeting|lunch|dinner|remember|forgot|tomorrow|tonight|love you|miss you|see you|call me)\b/i,
                /\b(home|work|school|class|doctor|appointment|pick up|bring)\b/i
            ];
        }
        
        // Extract features from the message text
        extractFeatures(message) {
            const features = {};
            
            // Basic text features
            features.length = message.length;
            features.word_count = message.split(/\s+/).filter(Boolean).length;
            
            // Not calculating avg_word_length to simplify
            
            features.exclamation_count = (message.match(/!/g) || []).length;
            features.question_count = (message.match(/\?/g) || []).length;
            
            // Calculate uppercase ratio
            const uppercaseChars = message.replace(/[^A-Z]/g, '').length;
            features.uppercase_ratio = uppercaseChars / Math.max(1, message.length);
            
            // Calculate digit ratio
            const digitChars = message.replace(/[^0-9]/g, '').length;
            features.digit_ratio = digitChars / Math.max(1, message.length);
            
            // Count spam and ham pattern matches
            features.spam_pattern_matches = this.spamPatterns.filter(pattern => pattern.test(message)).length;
            features.ham_pattern_matches = this.hamPatterns.filter(pattern => pattern.test(message)).length;
            
            // URL features
            const urls = message.match(/https?:\/\/\S+/g) || [];
            features.url_count = urls.length;
            
            // Phone number features
            const phoneNumbers = message.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g) || [];
            features.phone_number_count = phoneNumbers.length;
            
            // Special character ratio
            const specialChars = message.match(/[^\w\s]/g) || [];
            features.special_char_ratio = specialChars.length / Math.max(1, message.length);
            
            return features;
        }
        
        // Predict if a message is spam
        predict(message) {
            // Extract features
            const features = this.extractFeatures(message);
            
            // Simple scoring mechanism
            let spamScore = 0;
            
            // Length-based scoring (longer messages are more likely to be spam)
            if (features.length > 160) {
                spamScore += 0.5;
            }
            
            // Pattern matching
            spamScore += features.spam_pattern_matches * 1.5;
            spamScore -= features.ham_pattern_matches * 1.0;
            
            // URL presence is a strong spam indicator
            spamScore += features.url_count * 2.0;
            
            // Excessive punctuation
            if (features.exclamation_count > 2) {
                spamScore += 0.5;
            }
            
            // Uppercase ratio (shouting)
            if (features.uppercase_ratio > 0.3) {
                spamScore += 1.0;
            }
            
            // Phone numbers are common in spam
            spamScore += features.phone_number_count * 0.5;
            
            // Normalize score to a confidence value between 0 and 1
            // Higher values indicate more confidence in spam classification
            const rawConfidence = 1 / (1 + Math.exp(-spamScore));  // Sigmoid function
            
            // Classify as spam if confidence > 0.5
            const isSpam = rawConfidence > 0.5;
            
            // Return results
            return {
                is_spam: isSpam,
                confidence: Math.round(rawConfidence * 100) / 100,
                features: features,
                message: message
            };
        }
    }
    
    // Create an instance of the spam detector
    const spamDetector = new SpamDetector();

    // Form submission
    spamCheckForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const message = messageInput.value.trim();
        
        if (message) {
            checkButton.disabled = true;
            checkButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Checking...';
            
            // Simulate a brief delay to give the feeling of processing
            setTimeout(() => {
                try {
                    // Run the client-side spam detection
                    const data = spamDetector.predict(message);
                    
                    // Process results
                    displayResult(data);
                    saveToHistory(data);
                    updateStats();
                } catch (error) {
                    console.error('Error:', error);
                    showToast('Error checking message: ' + error.message);
                } finally {
                    checkButton.disabled = false;
                    checkButton.innerHTML = '<i class="fas fa-search me-2"></i>Check Message';
                }
            }, 500);
        }
    });
    
    // Copy result button
    copyResultBtn.addEventListener('click', function() {
        if (currentMessageData) {
            const resultText = `Message: "${currentMessageData.message}"\nResult: ${currentMessageData.is_spam ? 'SPAM' : 'NOT SPAM'}\nConfidence: ${currentMessageData.confidence * 100}%`;
            navigator.clipboard.writeText(resultText)
                .then(() => showToast('Result copied to clipboard!'))
                .catch(err => showToast('Failed to copy: ' + err));
        }
    });
    
    // Share result button
    shareResultBtn.addEventListener('click', function() {
        if (currentMessageData) {
            const shareContent = `SMS Spam Check Result:\n\nMessage: "${currentMessageData.message}"\n\nVerdict: ${currentMessageData.is_spam ? 'SPAM ⚠️' : 'LEGITIMATE ✅'}\nConfidence: ${currentMessageData.confidence * 100}%\n\nChecked with SMS Spam Filter`;
            shareText.value = shareContent;
            shareModal.show();
        }
    });
    
    // Copy share text button
    copyShareTextBtn.addEventListener('click', function() {
        shareText.select();
        navigator.clipboard.writeText(shareText.value)
            .then(() => {
                showToast('Shared text copied to clipboard!');
                shareModal.hide();
            })
            .catch(err => showToast('Failed to copy: ' + err));
    });
    
    // Report buttons
    reportHamBtn.addEventListener('click', function() {
        if (currentMessageData && currentMessageData.is_spam) {
            // Simply update the classification in history
            updateClassificationInHistory(currentMessageData.message, false);
            showToast('Thank you for your feedback!');
        }
    });
    
    reportSpamBtn.addEventListener('click', function() {
        if (currentMessageData && !currentMessageData.is_spam) {
            // Simply update the classification in history
            updateClassificationInHistory(currentMessageData.message, true);
            showToast('Thank you for your feedback!');
        }
    });
    
    // Clear history button
    clearHistoryBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear your message history?')) {
            messageHistory = [];
            localStorage.setItem('smsSpamHistory', JSON.stringify(messageHistory));
            renderHistory();
            updateStats();
            showToast('History cleared');
        }
    });
    
    // History link
    historyLink.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('history-section').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Function to display the result
    function displayResult(data) {
        currentMessageData = data;
        const isSpam = data.is_spam;
        const confidence = data.confidence;
        
        // Update result card styling
        resultsCard.classList.remove('d-none', 'spam-result', 'ham-result');
        resultsCard.classList.add('fade-in', isSpam ? 'spam-result' : 'ham-result');
        
        // Update header
        resultsHeader.className = 'card-header ' + (isSpam ? 'spam-header' : 'ham-header');
        
        // Update result title and badge
        resultTitle.textContent = isSpam ? 'Spam Detected' : 'Message is Legitimate';
        resultBadge.textContent = isSpam ? 'SPAM' : 'LEGITIMATE';
        resultBadge.className = 'badge fs-6 ' + (isSpam ? 'spam-badge' : 'ham-badge');
        
        // Display the message
        resultMessage.textContent = data.message;
        
        // Update confidence bar
        confidenceBar.style.width = `${confidence * 100}%`;
        confidenceBar.textContent = `${Math.round(confidence * 100)}%`;
        confidenceBar.className = 'progress-bar ' + (isSpam ? 'bg-danger' : 'bg-success');
        
        // Show appropriate report button
        reportHamBtn.classList.toggle('d-none', !isSpam);
        reportSpamBtn.classList.toggle('d-none', isSpam);
        
        // Display key indicators
        displayIndicators(data.features, isSpam);
        
        // Scroll to result
        resultsCard.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Function to display indicators
    function displayIndicators(features, isSpam) {
        indicatorsList.innerHTML = '';
        
        const indicators = [];
        
        // Add relevant indicators based on features
        if (features.spam_pattern_matches > 0) {
            indicators.push({
                text: `Suspicious patterns found (${features.spam_pattern_matches})`,
                icon: 'exclamation-triangle',
                color: 'danger'
            });
        }
        
        if (features.ham_pattern_matches > 0) {
            indicators.push({
                text: `Common legitimate patterns (${features.ham_pattern_matches})`,
                icon: 'check-circle',
                color: 'success'
            });
        }
        
        if (features.url_count > 0) {
            indicators.push({
                text: `Contains URLs (${features.url_count})`,
                icon: 'link',
                color: 'warning'
            });
        }
        
        if (features.uppercase_ratio > 0.3) {
            indicators.push({
                text: 'Excessive uppercase text',
                icon: 'font',
                color: 'danger'
            });
        }
        
        if (features.exclamation_count > 2) {
            indicators.push({
                text: `Multiple exclamation marks (${features.exclamation_count})`,
                icon: 'exclamation',
                color: 'warning'
            });
        }
        
        if (features.special_char_ratio > 0.1) {
            indicators.push({
                text: 'High ratio of special characters',
                icon: 'percentage',
                color: 'warning'
            });
        }
        
        if (features.phone_number_count > 0) {
            indicators.push({
                text: `Contains phone numbers (${features.phone_number_count})`,
                icon: 'phone',
                color: 'info'
            });
        }
        
        if (features.length > 160) {
            indicators.push({
                text: 'Message is unusually long',
                icon: 'align-left',
                color: 'secondary'
            });
        }
        
        // Add indicators to the list
        indicators.forEach(indicator => {
            const li = document.createElement('li');
            li.className = `list-group-item d-flex justify-content-between align-items-center indicator-item`;
            li.innerHTML = `
                <span>${indicator.text}</span>
                <span class="badge bg-${indicator.color}">
                    <i class="fas fa-${indicator.icon}"></i>
                </span>
            `;
            indicatorsList.appendChild(li);
        });
        
        // If no indicators found
        if (indicators.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-group-item text-center';
            li.textContent = 'No specific indicators found';
            indicatorsList.appendChild(li);
        }
    }
    
    // Function to save to history
    function saveToHistory(data) {
        // Add to beginning of history array
        const historyItem = {
            message: data.message,
            is_spam: data.is_spam,
            confidence: data.confidence,
            timestamp: new Date().toISOString()
        };
        
        messageHistory.unshift(historyItem);
        
        // Limit history to 50 items
        if (messageHistory.length > 50) {
            messageHistory.pop();
        }
        
        // Save to localStorage
        localStorage.setItem('smsSpamHistory', JSON.stringify(messageHistory));
        
        // Update history display
        renderHistory();
    }
    
    // Function to render history
    function renderHistory() {
        historyList.innerHTML = '';
        
        if (messageHistory.length === 0) {
            noHistoryAlert.classList.remove('d-none');
            return;
        }
        
        noHistoryAlert.classList.add('d-none');
        
        messageHistory.forEach((item, index) => {
            const formattedDate = new Date(item.timestamp).toLocaleString();
            const li = document.createElement('li');
            li.className = `list-group-item history-item ${item.is_spam ? 'border-danger' : 'border-success'}`;
            li.dataset.index = index;
            
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div class="history-message">${item.message}</div>
                    <div>
                        <span class="badge ${item.is_spam ? 'bg-danger' : 'bg-success'} me-2">
                            ${item.is_spam ? 'SPAM' : 'OK'}
                        </span>
                        <small class="text-muted">${formattedDate}</small>
                    </div>
                </div>
            `;
            
            li.addEventListener('click', function() {
                // Load this message from history
                currentMessageData = item;
                displayResult(item);
                messageInput.value = item.message;
            });
            
            historyList.appendChild(li);
        });
    }
    
    // Function to update stats
    function updateStats() {
        const total = messageHistory.length;
        const spamTotal = messageHistory.filter(item => item.is_spam).length;
        const spamRatio = total > 0 ? (spamTotal / total) * 100 : 0;
        
        checkedCount.textContent = total;
        spamCount.textContent = spamTotal;
        spamRatioBar.style.width = `${spamRatio}%`;
        spamRatioBar.textContent = `${Math.round(spamRatio)}%`;
    }
    
    // Function to update classification in history
    function updateClassificationInHistory(message, isSpam) {
        // Find the message in history
        const index = messageHistory.findIndex(item => item.message === message);
        
        if (index !== -1) {
            // Update classification
            messageHistory[index].is_spam = isSpam;
            
            // Update localStorage
            localStorage.setItem('smsSpamHistory', JSON.stringify(messageHistory));
            
            // Update UI
            updateStats();
            renderHistory();
            
            // Update current display if it's the same message
            if (currentMessageData && currentMessageData.message === message) {
                currentMessageData.is_spam = isSpam;
                displayResult(currentMessageData);
            }
        }
    }
    
    // Function to show toast
    function showToast(message) {
        toastMessage.textContent = message;
        toast.show();
    }
    
    // Listen for keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+Enter to submit form
        if (e.ctrlKey && e.key === 'Enter' && document.activeElement === messageInput) {
            spamCheckForm.dispatchEvent(new Event('submit'));
        }
    });
    
    // Add some example messages
    const exampleMessages = [
        {
            message: "CONGRATULATIONS! You've been selected to win a FREE iPhone 13! Click here to claim your prize now: http://bit.ly/claim-prize",
            is_spam: true
        },
        {
            message: "Hi mom, can you pick me up from school at 3pm today? Thanks!",
            is_spam: false
        }
    ];
    
    // Add an "Example" button functionality
    const exampleBtn = document.createElement('button');
    exampleBtn.className = 'btn btn-outline-secondary mt-2';
    exampleBtn.innerHTML = '<i class="fas fa-lightbulb me-1"></i> Try an Example';
    exampleBtn.addEventListener('click', function() {
        // Pick a random example
        const example = exampleMessages[Math.floor(Math.random() * exampleMessages.length)];
        messageInput.value = example.message;
        
        // Scroll to input area to make it visible
        messageInput.scrollIntoView({ behavior: 'smooth' });
        messageInput.focus();
    });
    
    // Add the button below the form
    const formParent = spamCheckForm.parentNode;
    formParent.appendChild(exampleBtn);
});