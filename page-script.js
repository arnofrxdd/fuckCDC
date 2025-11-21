// This runs in the PAGE context
console.log('🔧 EXAM EXTRACTOR: Page script starting...');

// Load CryptoJS from extension
function loadCryptoJS() {
    return new Promise((resolve) => {
        if (window.CryptoJS) {
            console.log('✅ CryptoJS already loaded');
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('crypto-js.min.js');
        script.onload = () => {
            console.log('✅ CryptoJS loaded from extension');
            resolve();
        };
        script.onerror = (error) => {
            console.error('❌ Failed to load CryptoJS:', error);
            resolve();
        };
        document.head.appendChild(script);
    });
}

// Override XMLHttpRequest to capture exam data
const OriginalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function () {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;

    xhr.open = function (method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    xhr.send = function (data) {
        if (this._url && (this._url.includes('sEKMRyOJKjIzZbUa') || this._url.includes('9DECJfxqhu0cgJAQ'))) {
            console.log('🎯 TARGET EXAM API DETECTED:', this._url);

            this.addEventListener('load', function () {
                if (this.status === 200) {
                    try {
                        const response = JSON.parse(this.responseText);
                        console.log('📦 EXAM API RESPONSE CAPTURED');

                        // Send encrypted data for processing
                        document.dispatchEvent(new CustomEvent('EncryptedDataCaptured', {
                            detail: {
                                url: this._url,
                                data: response.data || this.responseText,
                                timestamp: new Date().toISOString()
                            }
                        }));
                    } catch (error) {
                        console.log('❌ Error parsing exam API response:', error);
                    }
                }
            });
        }
        return originalSend.apply(this, arguments);
    };
    return xhr;
};

// Override fetch as well
const originalFetch = window.fetch;
window.fetch = function (...args) {
    const url = args[0];

    if (url && (url.includes('sEKMRyOJKjIzZbUa') || url.includes('9DECJfxqhu0cgJAQ'))) {
        console.log('🎯 TARGET EXAM FETCH DETECTED:', url);

        return originalFetch.apply(this, args).then(response => {
            return response.clone().text().then(text => {
                try {
                    const responseData = JSON.parse(text);
                    console.log('📦 EXAM FETCH RESPONSE CAPTURED');

                    document.dispatchEvent(new CustomEvent('EncryptedDataCaptured', {
                        detail: {
                            url: url,
                            data: responseData.data || text,
                            timestamp: new Date().toISOString()
                        }
                    }));
                } catch (error) {
                    console.log('❌ Error parsing exam fetch response:', error);
                }
                return response;
            });
        });
    }
    return originalFetch.apply(this, args);
};

// Initialize
loadCryptoJS().then(() => {
    console.log('✅✅✅ EXAM EXTRACTOR: Page script ready - monitoring exam APIs');
});

console.log('✅✅✅ EXAM EXTRACTOR: Page script active!');