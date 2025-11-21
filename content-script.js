console.log('🔧 EXAM EXTRACTOR: Content script loading...');

function injectPageScript() {
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('page-script.js');
        script.onload = function () {
            console.log('✅ EXAM EXTRACTOR: Page script loaded successfully');
            this.remove();
        };
        script.onerror = function () {
            console.error('❌ EXAM EXTRACTOR: Failed to load page script');
            this.remove();
        };
        (document.head || document.documentElement).appendChild(script);
    } catch (error) {
        console.error('❌ EXAM EXTRACTOR: Error injecting page script:', error);
    }
}

// Store encrypted data for processing
let pendingEncryptedData = null;

// Listen for encrypted data from page script
document.addEventListener('EncryptedDataCaptured', function (event) {
    console.log('📥 EXAM EXTRACTOR: Received encrypted data');
    pendingEncryptedData = event.detail.data;

    // Inject decryption script as external file
    injectDecryptionScript();
});

function injectDecryptionScript() {
    if (!pendingEncryptedData) return;

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('decrypt-script.js');
    script.setAttribute('data-encrypted', pendingEncryptedData);
    script.onload = function () {
        console.log('✅ EXAM EXTRACTOR: Decryption script loaded');
        this.remove();
    };
    script.onerror = function () {
        console.error('❌ EXAM EXTRACTOR: Failed to load decryption script');
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

// Listen for extracted answers from page script
document.addEventListener('AnswersExtracted', function (event) {
    console.log('🎯 EXAM EXTRACTOR: Answers extracted!', event.detail);

    // Store answers in chrome.storage for popup to access
    chrome.storage.local.set({
        examAnswers: event.detail,
        lastUpdated: new Date().toISOString()
    }, () => {
        console.log('💾 Answers saved to storage for popup');
    });
});

// Inject the page script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPageScript);
} else {
    injectPageScript();
}

console.log('✅ EXAM EXTRACTOR: Content script ready');