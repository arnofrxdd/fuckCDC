document.addEventListener('DOMContentLoaded', function () {
    loadAnswers();

    // Add event listener for section dropdown
    document.getElementById('sectionDropdown').addEventListener('change', function () {
        displaySelectedSection();
    });
});

function loadAnswers() {
    chrome.storage.local.get(['examAnswers', 'lastUpdated'], function (result) {
        const answers = result.examAnswers;
        const lastUpdated = result.lastUpdated;

        updateTestName(answers);
        updateStatus(answers);
        populateSectionDropdown(answers);
        updateStats(answers, lastUpdated);

        // Simple format coding on initial load - ADD THIS LINE
        setTimeout(formatCodingOnLoad, 100);
    });
}
// Add to DOMContentLoaded
document.getElementById('automationToggle').addEventListener('click', toggleAutomation);

// Add these functions
function toggleAutomation() {
    const toggleBtn = document.getElementById('automationToggle');
    const isRunning = toggleBtn.textContent === 'fuck it ill do it by myself';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (isRunning) {
            // Stop automation
            chrome.tabs.sendMessage(tabs[0].id, { action: 'stopAutomation' }, (response) => {
                if (response && response.success) {
                    toggleBtn.textContent = 'i cant take this anymore';
                    toggleBtn.style.background = '#10b981';
                    updateAutomationStatus('Automation stopped', 'stopped');
                }
            });
        } else {
            // Start automation
            chrome.tabs.sendMessage(tabs[0].id, { action: 'startAutomation' }, (response) => {
                if (response && response.success) {
                    toggleBtn.textContent = 'fuck it ill do it by myself';
                    toggleBtn.style.background = '#ef4444';
                    updateAutomationStatus('Automation started...', 'running');
                } else {
                    updateAutomationStatus('Failed to start automation', 'error');
                }
            });
        }
    });
}

function updateAutomationStatus(message, status) {
    const statusElement = document.getElementById('automationStatus');
    statusElement.textContent = message;

    // Reset colors
    statusElement.style.color = '#6b7280';

    if (status === 'running') {
        statusElement.style.color = '#10b981';
    } else if (status === 'error') {
        statusElement.style.color = '#ef4444';
    } else if (status === 'completed') {
        statusElement.style.color = '#3b82f6';
    }
}
// Update the loadAnswers function to also get automation status
function loadAnswers() {
    chrome.storage.local.get(['examAnswers', 'lastUpdated'], function (result) {
        const answers = result.examAnswers;
        const lastUpdated = result.lastUpdated;

        updateTestName(answers);
        updateStatus(answers);
        populateSectionDropdown(answers);
        updateStats(answers, lastUpdated);

        // Get current automation status
        getAutomationStatus();

        setTimeout(formatCodingOnLoad, 100);
    });
}

function getAutomationStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url.includes('cdc')) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, (response) => {
                if (response) {
                    const toggleBtn = document.getElementById('automationToggle');
                    let statusMessage = 'Ready';

                    if (response.isAutomating) {
                        statusMessage = `Automating section ${response.currentSectionIndex + 1}...`;
                        toggleBtn.textContent = 'Stop Auto-Fill';
                        toggleBtn.style.background = '#ef4444';
                        updateAutomationStatus(statusMessage, 'running');
                    } else if (response.completed) {
                        statusMessage = 'Section completed!';
                        toggleBtn.textContent = 'i cant take this anymore';
                        toggleBtn.style.background = '#10b981';
                        updateAutomationStatus(statusMessage, 'completed');
                    } else {
                        toggleBtn.textContent = 'i cant take this anymore';
                        toggleBtn.style.background = '#10b981';
                        updateAutomationStatus(statusMessage, 'stopped');
                    }
                }
            });
        }
    });
}
// Add this new function
function formatCodingOnLoad() {
    const codeElements = document.querySelectorAll('.code-content');
    codeElements.forEach(element => {
        const currentCode = element.textContent;
        element.textContent = formatCode(currentCode);
    });
}
function populateSectionDropdown(answers) {
    const dropdown = document.getElementById('sectionDropdown');

    // Clear existing options except the first one
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }

    if (!answers || !answers.sections || answers.sections.length === 0) {
        return;
    }

    // Add sections to dropdown with better formatting
    answers.sections.forEach((section, index) => {
        const option = document.createElement('option');
        option.value = index;

        // Better formatting: "1. Section Name (5 questions)"
        const totalQuestions = section.questions.length + section.codingQuestions.length;
        option.textContent = `${section.sectionName} (${totalQuestions} questions)`;

        dropdown.appendChild(option);
    });

    // Auto-select first section if available
    if (answers.sections.length > 0) {
        dropdown.value = '0';
        displaySelectedSection();
    }
}

function displaySelectedSection() {
    const dropdown = document.getElementById('sectionDropdown');
    const sectionIndex = parseInt(dropdown.value);

    if (isNaN(sectionIndex)) {
        return;
    }

    chrome.storage.local.get(['examAnswers'], function (result) {
        const answers = result.examAnswers;

        if (!answers || !answers.sections || !answers.sections[sectionIndex]) {
            return;
        }

        const section = answers.sections[sectionIndex];
        displayMCQAnswers(section);
        displayCodingAnswers(section);

        // Format coding when switching sections - ADD THIS LINE
        setTimeout(formatCodingOnLoad, 100);
    });
}
function updateStatus(answers) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (answers && answers.sections && answers.sections.length > 0) {
        statusDot.classList.add('active');
        const totalQuestions = answers.sections.reduce((total, section) =>
            total + section.questions.length + section.codingQuestions.length, 0);
        statusText.textContent = `${totalQuestions} answers ready across ${answers.sections.length} sections`;
    } else {
        statusDot.classList.remove('active');
        statusText.textContent = 'go to fucking exam page to see answers';
    }
}

function displayMCQAnswers(section) {
    const container = document.getElementById('mcqAnswers');

    if (!section || !section.questions || section.questions.length === 0) {
        container.innerHTML = '<div class="empty-state">yay no questions in this section</div>';
        return;
    }

    let html = '';

    section.questions.forEach((question) => {
        if (question.type === 'mcq') {
            html += `
                <div class="answer-card">
                    <div class="question-header">
                        <div class="question-number">Question ${question.questionNumber}</div>
                        <div class="correct-answer">${question.correctOptionLetter}</div>
                    </div>
                    ${question.allOptions ? `
                        <div class="options-grid">
                            ${question.allOptions.map(opt => {
                const cleanText = stripHtml(opt.text);
                return `
                                    <div class="option ${opt.isCorrect ? 'correct' : ''}">
                                        <div class="option-bullet"></div>
                                        <span>${opt.letter}. ${cleanText}</span>
                                    </div>
                                `;
            }).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (question.type === 'fill_in_blank') {
            const cleanQuestionText = stripHtml(question.questionText);
            html += `
                <div class="answer-card">
                    <div class="question-header">
                        <div class="question-number">Question ${question.questionNumber}</div>
                        <div class="fill-answer">Fill</div>
                    </div>
                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">
                        ${cleanQuestionText}
                    </div>
                    <div class="fill-answer-text">
                        <strong>Answer:</strong> ${question.correctAnswer}
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html;
}

function displayCodingAnswers(section) {
    const container = document.getElementById('codingAnswers');

    if (!section || !section.codingQuestions || section.codingQuestions.length === 0) {
        container.innerHTML = '<div class="empty-state">fuck yes no coding questions in this section</div>';
        return;
    }

    let html = '';
    section.codingQuestions.forEach((coding, index) => {
        // Handle both string and object solutions
        let solutionText = coding.solution;
        if (typeof coding.solution === 'object' && coding.solution !== null) {
            if (coding.solution.solution) {
                solutionText = coding.solution.solution;
            } else {
                solutionText = JSON.stringify(coding.solution, null, 2);
            }
        }

        const solutions = parseMultiLanguageSolutions(solutionText);
        const languages = Object.keys(solutions);

        html += `
            <div class="coding-card">
                <div class="code-header">
                    <div class="coding-title">Problem ${coding.questionNumber}</div>
                    <button class="copy-btn" data-index="${index}">Copy</button>
                </div>
                
                ${languages.length > 1 ? `
                    <div class="language-tabs" id="tabs-${index}">
                        ${languages.map((lang, i) => `
                            <div class="language-tab ${i === 0 ? 'active' : ''}" 
                                 data-index="${index}" 
                                 data-lang="${lang}">
                                ${lang}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <pre class="code-content" id="code-${index}">${solutions[languages[0]]}</pre>
            </div>
        `;
    });

    container.innerHTML = html;

    // Add event listeners
    section.codingQuestions.forEach((coding, index) => {
        // Copy button
        const copyBtn = document.querySelector(`.copy-btn[data-index="${index}"]`);
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                copyCodeToClipboard(index);
            });
        }

        // Language tabs
        const solutions = parseMultiLanguageSolutions(coding.solution);
        const languages = Object.keys(solutions);
        if (languages.length > 1) {
            document.querySelectorAll(`#tabs-${index} .language-tab`).forEach(tab => {
                tab.addEventListener('click', function () {
                    const lang = this.getAttribute('data-lang');
                    // Update active tab
                    document.querySelectorAll(`#tabs-${index} .language-tab`).forEach(t =>
                        t.classList.remove('active'));
                    this.classList.add('active');
                    // Update code content
                    document.getElementById(`code-${index}`).textContent = solutions[lang];
                });
            });
        }
    });
}

// Keep all the existing helper functions (stripHtml, parseMultiLanguageSolutions, formatCode, copyCodeToClipboard, updateStats)
function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function parseMultiLanguageSolutions(solution) {
    const solutions = {};
    if (!solution) {
        return { 'Solution': 'No solution available' };
    }

    // Handle the case where solution is an object with string property
    if (typeof solution === 'object' && solution !== null) {
        if (solution.solution) {
            solution = solution.solution;
        } else {
            // Convert object to string representation but preserve structure
            solution = JSON.stringify(solution, null, 2);
        }
    }

    // Convert to string if it's not already
    solution = String(solution);

    // Handle the specific format you showed: "--- C++ ---\ncode..."
    const languageSections = solution.split(/---\s*([^-]+)\s*---/);

    if (languageSections.length > 1) {
        for (let i = 1; i < languageSections.length; i += 2) {
            const lang = languageSections[i].trim();
            const code = languageSections[i + 1]?.trim() || '';
            if (lang && code) {
                solutions[lang] = formatCode(code);
            }
        }
    }

    // If no language sections found, treat the whole thing as code
    if (Object.keys(solutions).length === 0) {
        solutions['Code'] = formatCode(solution);
    }

    return solutions;
}
function formatCode(code) {
    if (!code) return 'No code available';

    // Convert to string if it's an object
    if (typeof code === 'object' && code !== null) {
        if (code.solution) {
            code = code.solution;
        } else {
            code = JSON.stringify(code, null, 2);
        }
    }

    // Handle the specific case with newlines and escape sequences
    let cleanedCode = String(code)
        .replace(/\\n/g, '\n') // Convert \n escape sequences to actual newlines
        .replace(/\\t/g, '\t') // Convert \t escape sequences to actual tabs
        .replace(/\\"/g, '"')  // Convert \" to "
        .replace(/\\'/g, "'"); // Convert \' to '

    // Remove ONLY leading and trailing whitespace, preserve all internal formatting
    cleanedCode = cleanedCode.trim();

    return cleanedCode;
}

function copyCodeToClipboard(index) {
    const codeElement = document.getElementById(`code-${index}`);
    const copyBtn = document.querySelector(`.copy-btn[data-index="${index}"]`);
    if (codeElement && copyBtn) {
        const code = codeElement.textContent;
        navigator.clipboard.writeText(code).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy code: ', err);
            copyBtn.textContent = 'Failed!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 2000);
        });
    }
}
function updateTestName(answers) {
    const testNameElement = document.getElementById('testName');

    if (answers && answers.testName) {
        // Clean up the test name if it has HTML tags
        const cleanTestName = stripHtml(answers.testName);
        testNameElement.textContent = cleanTestName;
    } else {
        testNameElement.textContent = 'Exam Answers';
    }
}

function updateStats(answers, lastUpdated) {
    const mcqCount = document.getElementById('mcqCount');
    const codingCount = document.getElementById('codingCount');
    const lastUpdatedElement = document.getElementById('lastUpdated');

    if (answers && answers.sections) {
        const totalMCQ = answers.sections.reduce((total, section) => total + section.questions.length, 0);
        const totalCoding = answers.sections.reduce((total, section) => total + section.codingQuestions.length, 0);
        mcqCount.textContent = totalMCQ;
        codingCount.textContent = totalCoding;
    } else {
        mcqCount.textContent = '0';
        codingCount.textContent = '0';
    }

    if (lastUpdated) {
        const date = new Date(lastUpdated);
        lastUpdatedElement.textContent = `Last updated: ${date.toLocaleTimeString()}`;
    } else {
        lastUpdatedElement.textContent = 'Last updated: Never';
    }
}

// Listen for storage changes to auto-update
chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'local' && changes.examAnswers) {
        loadAnswers();
    }
});