// This runs in the PAGE context for decryption
(function () {
    console.log('🔐 DECRYPT SCRIPT: Starting decryption...');

    // Get encrypted data from script attribute
    const currentScript = document.currentScript;
    const encryptedData = currentScript.getAttribute('data-encrypted');

    if (!encryptedData) {
        console.log('❌ No encrypted data found');
        return;
    }

    // Check if CryptoJS is available
    if (!window.CryptoJS) {
        console.log('❌ CryptoJS not available');
        // Try to load CryptoJS
        loadCryptoJS().then(() => {
            if (window.CryptoJS) {
                decryptData(encryptedData);
            } else {
                console.log('❌ Failed to load CryptoJS');
            }
        });
    } else {
        decryptData(encryptedData);
    }

    function loadCryptoJS() {
        return new Promise((resolve) => {
            if (window.CryptoJS) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('crypto-js.min.js');
            script.onload = resolve;
            script.onerror = resolve;
            document.head.appendChild(script);
        });
    }

    function decryptData(encryptedData) {
        try {
            // Get keys from localStorage
            let accordEvent = JSON.parse(localStorage.getItem('accord_event'));
            let schoolDetails = JSON.parse(localStorage.getItem('school_details'));

            if (!accordEvent || !schoolDetails) {
                console.log("❌ No user data found in localStorage");
                return;
            }

            const userId = accordEvent.list.test_details[0].user_id;
            const schoolId = schoolDetails.school_id;
            const decryptionKey = userId + schoolId.toString() + 'k3QL95NjdP!cA34CsXL';
            const finalKey = decryptionKey.split('-').join('');

            console.log("🔑 Attempting decryption...");

            // Decrypt the data
            const decrypted = CryptoJS.AES.decrypt(encryptedData, finalKey);
            const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

            if (!decryptedText) {
                console.log('❌ Decryption failed - empty result');
                return;
            }

            const parsedData = JSON.parse(decryptedText);
            console.log('✅ Successfully decrypted exam data');

            // Extract answers with improved logic
            const answers = extractAnswers(parsedData);

            // Send answers to content script for display
            document.dispatchEvent(new CustomEvent('AnswersExtracted', {
                detail: answers
            }));

        } catch (error) {
            console.log('❌ Decryption failed:', error);
        }
    }

    function extractAnswers(parsedData) {
        let sections = [];
        let testName = '';

        try {
            // Extract test name from parsed data - FIXED to use c_name
            if (parsedData.c_name) {
                testName = parsedData.c_name;
            } else if (parsedData.test_name) {
                testName = parsedData.test_name;
            } else if (parsedData.name) {
                testName = parsedData.name;
            } else if (parsedData.exam_name) {
                testName = parsedData.exam_name;
            } else {
                testName = 'Exam Answers';
            }

            console.log(`📝 Test Name: ${testName}`);

            if (parsedData.frozen_test_data) {
                parsedData.frozen_test_data.forEach((section, sectionIndex) => {
                    console.log(`\n🔍 Scanning Section ${sectionIndex + 1}...`);

                    // FIXED: Get section name with proper priority and numbering
                    let sectionName = '';
                    if (section.c_name) {
                        sectionName = section.c_name;
                    } else if (section.section_name) {
                        sectionName = section.section_name;
                    } else if (section.name) {
                        sectionName = section.name;
                    } else {
                        sectionName = `Section ${sectionIndex + 1}`;
                    }

                    // Ensure section name has numbering if it doesn't already
                    if (!sectionName.match(/^\d/)) {
                        sectionName = `${sectionIndex + 1}. ${sectionName}`;
                    }

                    let sectionData = {
                        sectionNumber: sectionIndex + 1,
                        sectionName: sectionName, // Use the fixed section name
                        questions: [],
                        codingQuestions: []
                    };

                    if (section.questions && Array.isArray(section.questions)) {
                        section.questions.forEach((question, qIndex) => {
                            let questionInfo = {
                                section: sectionIndex + 1,
                                question: qIndex + 1,
                                type: 'unknown',
                                data: null
                            };

                            // Extract MCQ and Fill-in-blank answers
                            if (question.mcq_questions && question.mcq_questions.actual_answer &&
                                question.mcq_questions.actual_answer.args &&
                                question.mcq_questions.actual_answer.args.length > 0) {

                                let correctAnswer = question.mcq_questions.actual_answer.args[0];
                                questionInfo.type = 'mcq';
                                questionInfo.correctAnswer = correctAnswer;

                                if (question.options && Array.isArray(question.options)) {
                                    let optionIndex = question.options.findIndex(opt => opt.text === correctAnswer);
                                    if (optionIndex !== -1) {
                                        const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
                                        const correctOptionLetter = optionLetters[optionIndex];

                                        sectionData.questions.push({
                                            questionNumber: sectionData.questions.length + 1,
                                            type: 'mcq',
                                            correctOptionLetter: correctOptionLetter,
                                            correctAnswer: correctAnswer,
                                            allOptions: question.options.map((opt, idx) => ({
                                                letter: optionLetters[idx],
                                                text: opt.text,
                                                isCorrect: idx === optionIndex
                                            })),
                                            originalIndex: qIndex + 1,
                                            questionText: question.question_data || 'MCQ Question'
                                        });
                                    }
                                }
                            }
                            // Extract Fill-in-the-blank answers
                            else if (question.fillup_questions && question.fillup_questions.actual_answer &&
                                question.fillup_questions.actual_answer.fillups_answers &&
                                question.fillup_questions.actual_answer.fillups_answers.length > 0) {

                                let correctAnswer = question.fillup_questions.actual_answer.fillups_answers[0].args;
                                questionInfo.type = 'fill_in_blank';
                                questionInfo.correctAnswer = correctAnswer;

                                sectionData.questions.push({
                                    questionNumber: sectionData.questions.length + 1,
                                    type: 'fill_in_blank',
                                    correctAnswer: correctAnswer,
                                    originalIndex: qIndex + 1,
                                    questionText: question.question_data || 'Fill in the blank question'
                                });
                            }
                            // Extract coding solutions
                            else if (question.programming_question) {
                                questionInfo.type = 'coding';
                                questionInfo.programmingData = question.programming_question;

                                let solutionData = extractCodingData(question.programming_question);

                                if (solutionData) {
                                    sectionData.codingQuestions.push({
                                        questionNumber: sectionData.codingQuestions.length + 1,
                                        solution: solutionData.solution,
                                        languages: solutionData.languages,
                                        hasCode: solutionData.hasCode,
                                        originalIndex: qIndex + 1,
                                        fullData: question.programming_question
                                    });
                                }
                            }
                        });
                    }

                    sections.push(sectionData);
                });
            }

            console.log(`🎯 Extracted ${sections.length} sections with questions`);

        } catch (error) {
            console.log('❌ Error extracting answers:', error);
        }

        return {
            testName: testName,
            sections: sections,
            timestamp: new Date().toISOString()
        };
    }

    // Extract coding data with multiple language support
    function extractCodingData(programmingQuestion) {
        if (!programmingQuestion) return null;

        let solution = "";
        let languages = [];
        let hasCode = false;

        // Check for multiple language solutions
        if (programmingQuestion.solution && Array.isArray(programmingQuestion.solution)) {
            programmingQuestion.solution.forEach((sol, index) => {
                if (sol.language) {
                    languages.push(sol.language);
                }

                // Extract solution data if available
                if (sol.solutiondata && Array.isArray(sol.solutiondata) && sol.solutiondata.length > 0) {
                    sol.solutiondata.forEach((data, dataIndex) => {
                        if (data.solution) {
                            solution += `--- ${sol.language || `Solution ${index + 1}`} ---\n${data.solution}\n\n`;
                            hasCode = true;
                        }
                    });
                }
            });
        }

        // If no code solutions found, check for test cases
        if (!hasCode) {
            // Handle array of test cases
            if (Array.isArray(programmingQuestion) && programmingQuestion.length > 0) {
                solution = "🧪 TEST CASES:\n";
                programmingQuestion.forEach((testCase, index) => {
                    solution += `\n--- Test Case ${index + 1} ---\n`;
                    solution += `Input: ${testCase.input || 'N/A'}\n`;
                    solution += `Expected Output: ${testCase.output || 'N/A'}\n`;
                    if (testCase.sample && testCase.sample !== " - ") solution += `Sample: ${testCase.sample}\n`;
                    if (testCase.difficulty && testCase.difficulty !== " - ") solution += `Difficulty: ${testCase.difficulty}\n`;
                });
                languages = ['Test Cases'];
            }
            // Handle single test case structure
            else if (programmingQuestion.input || programmingQuestion.output) {
                solution = `📝 PROBLEM DESCRIPTION:\nQuestion: ${programmingQuestion.question || 'Coding Problem'}\nInput: ${programmingQuestion.input || 'N/A'}\nOutput: ${programmingQuestion.output || 'N/A'}`;
                languages = ['Problem Description'];
            }
            // Last resort - show structure for debugging
            else {
                solution = `🔍 DEBUG - No code solution found:\n${JSON.stringify(programmingQuestion, null, 2).substring(0, 1000)}...`;
                languages = ['Debug Info'];
            }
        }

        // If we have languages from solution array, use those
        if (languages.length === 0 && programmingQuestion.solution) {
            programmingQuestion.solution.forEach(sol => {
                if (sol.language) languages.push(sol.language);
            });
        }

        // If still no languages, detect from solution content
        if (languages.length === 0 && solution) {
            languages = detectProgrammingLanguages(solution);
        }

        return {
            solution: solution.trim(),
            languages: languages.length > 0 ? languages : ['Unknown'],
            hasCode: hasCode
        };
    }

    // Detect programming languages in solution
    // Detect programming languages in solution
    function detectProgrammingLanguages(solution) {
        const languages = [];
        const languagePatterns = {
            'Python': [/def\s+\w+\(/, /import\s+\w+/, /print\(/, /^#!\/usr\/bin\/env python/],
            'Java': [/public\s+class/, /void\s+main/, /System\.out\.print/, /import\s+java\./],
            'C++': [/#include\s+<iostream>/, /using\s+namespace\s+std/, /cout\s+<</, /std::/],
            'C': [/#include\s+<stdio.h>/, /printf\(/, /scanf\(/, /int\s+main\(\)/],
            'JavaScript': [/function\s+\w+\(/, /console\.log/, /const\s+|let\s+|var\s+/, /=>/],
            'Test Cases': [/TEST CASES:/, /Input:/, /Expected Output:/],
            'Problem Description': [/PROBLEM:/, /Question:/]
        };

        for (const [lang, patterns] of Object.entries(languagePatterns)) {
            if (patterns.some(pattern => pattern.test(solution))) {
                languages.push(lang);
            }
        }

        return languages.length > 0 ? languages : ['Text'];
    }
})();