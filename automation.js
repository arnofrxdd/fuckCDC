// Content script for automating exam answers
class ExamAutomator {
    constructor() {
        this.currentSectionIndex = 0; // Default to first section
        this.answers = null;
        this.isAutomating = false;
        this.init();
    }

    async init() {
        // Load answers from storage
        await this.loadAnswers();

        // Start observing for section changes
        this.observeSectionChanges();

        // Listen for messages from popup
        this.setupMessageListener();
    }

    async loadAnswers() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['examAnswers'], (result) => {
                this.answers = result.examAnswers;
                resolve();
            });
        });
    }

    observeSectionChanges() {
        // Observe section container for changes
        const sectionObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'subtree') {
                    this.detectCurrentSectionIndex();
                }
            });
        });

        const sectionContainer = document.querySelector('[aria-labelledby="sections"]');
        if (sectionContainer) {
            sectionObserver.observe(sectionContainer, {
                childList: true,
                subtree: true
            });
        }

        // Also observe URL changes for single page apps
        let currentUrl = window.location.href;
        setInterval(() => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                this.detectCurrentSectionIndex();
            }
        }, 1000);

        // Initial detection
        setTimeout(() => this.detectCurrentSectionIndex(), 1000);
    }

    detectCurrentSectionIndex() {
        try {
            console.log('🔍 Detecting current section...');

            // Method 1: Look for the ACTIVE/EXPANDED section dropdown (most reliable)
            const activeSections = document.querySelectorAll('.t-cursor-pointer, .t-flex, [aria-labelledby*="section"]');
            for (let section of activeSections) {
                const sectionText = section.textContent;
                if (sectionText && sectionText.includes('Section')) {
                    console.log('Found section element:', sectionText.trim());

                    // Extract section number from "Section 2/3"
                    const match = sectionText.match(/Section\s*(\d+)\s*\/\s*(\d+)/);
                    if (match) {
                        this.currentSectionIndex = parseInt(match[1]) - 1; // Convert to 0-based index
                        console.log('✅ Detected ACTIVE section index:', this.currentSectionIndex, '(from Section ' + match[1] + ')');
                        return;
                    }
                }
            }

            // Method 2: Look for specific section container structure from your HTML
            const sectionContainer = document.querySelector('[aria-labelledby="section-container"]');
            if (sectionContainer) {
                const sectionText = sectionContainer.textContent;
                console.log('Section container text:', sectionText);

                const match = sectionText.match(/Section\s*(\d+)\s*\/\s*(\d+)/);
                if (match) {
                    this.currentSectionIndex = parseInt(match[1]) - 1;
                    console.log('✅ Detected section index from container:', this.currentSectionIndex);
                    return;
                }
            }

            // Method 3: Look for the section panels
            const sectionPanels = document.getElementById('each-section-panels');
            if (sectionPanels) {
                const sectionText = sectionPanels.textContent;
                console.log('Section panels text:', sectionText);

                const match = sectionText.match(/Section\s*(\d+)\s*\/\s*(\d+)/);
                if (match) {
                    this.currentSectionIndex = parseInt(match[1]) - 1;
                    console.log('✅ Detected section index from panels:', this.currentSectionIndex);
                    return;
                }
            }

            // Method 4: Try to find by section name if we know the sections
            if (this.answers && this.answers.sections) {
                const sectionNames = document.querySelectorAll('.t-text-black, .t-text-medium, [class*="section"]');
                for (let nameElement of sectionNames) {
                    const sectionName = nameElement.textContent.trim();
                    if (sectionName && sectionName.length > 0) {
                        const sectionIndex = this.answers.sections.findIndex(section =>
                            section.sectionName.includes(sectionName) || sectionName.includes(section.sectionName)
                        );
                        if (sectionIndex !== -1) {
                            this.currentSectionIndex = sectionIndex;
                            console.log('✅ Detected section index by name:', this.currentSectionIndex, 'Name:', sectionName);
                            return;
                        }
                    }
                }
            }

            // Method 5: Last resort - scan ALL text on page for section pattern
            const allText = document.body.textContent;
            const match = allText.match(/Section\s*(\d+)\s*\/\s*(\d+)/);
            if (match) {
                this.currentSectionIndex = parseInt(match[1]) - 1;
                console.log('✅ Detected section index from page text:', this.currentSectionIndex);
                return;
            }

            console.log('❌ WARNING: Could not detect current section, using default index: 0');
            this.currentSectionIndex = 0;

        } catch (error) {
            console.error('❌ Error detecting section index:', error);
            this.currentSectionIndex = 0;
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'startAutomation') {
                this.startAutomation();
                sendResponse({ success: true });
            } else if (request.action === 'stopAutomation') {
                this.stopAutomation();
                sendResponse({ success: true });
            } else if (request.action === 'getStatus') {
                sendResponse({
                    currentSectionIndex: this.currentSectionIndex,
                    isAutomating: this.isAutomating,
                    completed: !this.isAutomating // Add completion status
                });
            }
            return true;
        });
    }

    async startAutomation() {
        if (this.isAutomating) return;

        this.isAutomating = true;
        console.log('Starting automation...');

        // 🔥 CRITICAL FIX: Always detect current section RIGHT BEFORE starting automation
        console.log('🔄 Re-detecting current section before automation...');
        await this.detectCurrentSectionIndex();

        // Wait a bit to ensure detection completes
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('🔍 FINAL SECTION CHECK - Current section index:', this.currentSectionIndex);

        await this.loadAnswers();

        if (!this.answers || !this.answers.sections) {
            console.error('No answers found in storage');
            this.isAutomating = false;
            return;
        }

        // Use section by index
        if (this.currentSectionIndex >= this.answers.sections.length) {
            console.error('Section index out of range:', this.currentSectionIndex);
            console.log('Available sections:', this.answers.sections.map((s, i) => `${i}: ${s.sectionName}`));
            this.isAutomating = false;
            return;
        }

        const targetSection = this.answers.sections[this.currentSectionIndex];
        console.log('🎯 AUTOMATION TARGET:');
        console.log('   - Section Index:', this.currentSectionIndex);
        console.log('   - Section Name:', targetSection.sectionName);
        console.log('   - Questions Count:', targetSection.questions.length);

        // Debug: Show first question's correct answer to verify it's the right section
        if (targetSection.questions.length > 0) {
            console.log('   - First question correct answer:', targetSection.questions[0].correctOptionLetter);
        }

        await this.automateSection(targetSection);
    }

    async automateSection(section) {
        console.log('🔍 DEBUG: Current section index:', this.currentSectionIndex);
        console.log('🔍 DEBUG: Section being automated:', section.sectionName);
        console.log('🔍 DEBUG: Questions in this section:', section.questions.length);

        // Start from first question
        await this.navigateToFirstQuestion();

        // Process all questions by index
        for (let i = 0; i < section.questions.length; i++) {
            if (!this.isAutomating) break;

            const question = section.questions[i];
            console.log(`🔍 DEBUG: Processing question ${i} - Correct answer: ${question.correctOptionLetter}`);

            await this.processQuestion(question, i);

            // Check if this is the last question
            if (i === section.questions.length - 1) {
                console.log('All questions completed in section');
                this.isAutomating = false;
                return; // Exit immediately when done
            }

            // Navigate to next question if not last
            await this.navigateToNextQuestion();
            await this.waitForQuestionLoad();
        }

        this.isAutomating = false;
        console.log('Automation completed');
    }
    async navigateToFirstQuestion() {
        // Click on first question button (button with number 1)
        const firstQuestionBtn = this.findQuestionButton(1);
        if (firstQuestionBtn) {
            firstQuestionBtn.click();
            await this.waitForQuestionLoad();
        } else {
            console.log('First question button not found, trying to navigate to question 1');
            // Alternative: try to click on question 1 in the question list
            const question1 = document.querySelector('[aria-labelledby*="question-1"], [id*="question-1"]');
            if (question1) {
                question1.click();
                await this.waitForQuestionLoad();
            }
        }
    }

    async navigateToNextQuestion() {
        const nextBtn = document.querySelector('.next-btn');
        if (nextBtn) {
            nextBtn.click();
            await this.waitForQuestionLoad();
        }
    }

    findQuestionButton(questionNumber) {
        // Find question navigation button by number
        const buttons = document.querySelectorAll('[role="menuitemradio"], .t-cursor-pointer');
        for (let btn of buttons) {
            if (btn.textContent.trim() === questionNumber.toString()) {
                return btn;
            }
        }
        return null;
    }

    async waitForQuestionLoad() {
        return new Promise(resolve => {
            let checks = 0;
            const maxChecks = 50; // 5 seconds max wait

            const checkInterval = setInterval(() => {
                const questionContent = document.querySelector('[aria-labelledby="question-content"]');
                const answerContent = document.querySelector('[aria-labelledby="answer-content"]');

                if (questionContent && answerContent) {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }

                checks++;
                if (checks >= maxChecks) {
                    clearInterval(checkInterval);
                    resolve(); // Resolve anyway after timeout
                }
            }, 100);
        });
    }

    async processQuestion(question, questionIndex) {
        console.log('Processing question index:', questionIndex, 'Number:', question.questionNumber);

        if (question.type === 'mcq') {
            await this.processMCQ(question, questionIndex);
        } else if (question.type === 'fill_in_blank') {
            await this.processFillInBlank(question, questionIndex);
        }
    }

    async processMCQ(question, questionIndex) {
        const correctOptionIndex = this.getOptionIndex(question.correctOptionLetter);
        if (correctOptionIndex === -1) {
            console.error(`Question ${questionIndex}: Invalid option letter "${question.correctOptionLetter}"`);
            return;
        }

        // Wait for options to load
        await this.waitForOptions();

        // Get all option elements
        const optionElements = document.querySelectorAll('[id*="tt-option"]');

        if (optionElements.length === 0) {
            console.error(`Question ${questionIndex}: No option elements found`);
            return;
        }

        // Handle case where there are fewer options than expected
        if (correctOptionIndex >= optionElements.length) {
            console.error(`Question ${questionIndex}: Option index ${correctOptionIndex} out of range (only ${optionElements.length} options available)`);
            return;
        }

        // Check if correct option is already selected
        const currentlySelectedIndex = this.getSelectedOptionIndex();
        if (currentlySelectedIndex === correctOptionIndex) {
            console.log(`Question ${questionIndex}: Correct option already selected at index ${correctOptionIndex}`);
            return;
        }

        // Select the correct option by index
        const optionElement = optionElements[correctOptionIndex];
        const radioInput = optionElement.querySelector('input[type="radio"]') || optionElement;
        radioInput.click();
        console.log(`Question ${questionIndex}: Selected option at index ${correctOptionIndex}`);

        // Wait a bit for the selection to register
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    async processFillInBlank(question, questionIndex) {
        const correctAnswer = question.correctAnswer;
        if (!correctAnswer) return;

        // Wait for input field to load
        await this.waitForFillInput();

        // Find the input field
        const inputField = document.querySelector('input[aria-labelledby*="Blank"], input[id*="blank"]');
        if (inputField) {
            // Clear existing value
            inputField.value = '';

            // Enter correct answer
            inputField.value = correctAnswer;

            // Trigger input events
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
            inputField.dispatchEvent(new Event('change', { bubbles: true }));

            console.log(`Question ${questionIndex}: Filled answer "${correctAnswer}"`);

            // Wait a bit and click submit if available
            await new Promise(resolve => setTimeout(resolve, 1000));

            const submitBtn = document.querySelector('#tt-footer-submit-answer');
            if (submitBtn) {
                submitBtn.click();
                console.log(`Question ${questionIndex}: Submitted answer`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            console.error(`Question ${questionIndex}: Could not find input field`);
        }
    }

    // Convert option letter (A, B, C, D, E) to index (0, 1, 2, 3, 4)
    getOptionIndex(letter) {
        const optionMap = {
            'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4,
            'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4
        };
        return optionMap[letter] !== undefined ? optionMap[letter] : -1;
    }

    // Get currently selected option index
    getSelectedOptionIndex() {
        const optionElements = document.querySelectorAll('[id*="tt-option"]');
        for (let i = 0; i < optionElements.length; i++) {
            const radioInput = optionElements[i].querySelector('input[type="radio"]');
            if (radioInput && radioInput.checked) {
                return i;
            }
        }
        return -1;
    }

    async waitForOptions() {
        return this.waitForElement('[id*="tt-option"]', 30);
    }

    async waitForFillInput() {
        return this.waitForElement('input[type="text"], input[aria-labelledby*="Blank"]', 30);
    }

    waitForElement(selector, maxAttempts = 50) {
        return new Promise((resolve) => {
            let attempts = 0;

            const checkElement = () => {
                attempts++;
                const element = document.querySelector(selector);

                if (element) {
                    resolve(element);
                } else if (attempts >= maxAttempts) {
                    resolve(null); // Resolve with null after max attempts
                } else {
                    setTimeout(checkElement, 100);
                }
            };

            checkElement();
        });
    }

    stopAutomation() {
        this.isAutomating = false;
        console.log('Automation stopped');
    }
}

// Initialize automator when page loads
let automator;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        automator = new ExamAutomator();
    });
} else {
    automator = new ExamAutomator();
}