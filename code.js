/**
 * @file code.js
 * @version 4.1.0
 * @description Lightweight client-side logic for Ollama Chat with Markdown and syntax highlighting.
 */

// --- 0. Library Configuration ---
marked.setOptions({
    breaks: true, // Convert GFM line breaks into <br>
    gfm: true,
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    }
});

// --- 1. API Communication Module ---
const llmApi = {
    get API_URL() {
        // Get host from current URL (works for both localhost and local network)
        const currentHost = window.location.hostname;
        const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        // Use the same host but default Ollama port 11434
        return `${window.location.protocol}//${currentHost}:11434/api`;
    },

    async _getDefaultModel() {
        try {
            const models = await this.getModels();
            return models.length > 0 ? models[0] : "llama3";
        } catch (error) {
            console.warn("Failed to get models, using fallback:", error);
            return "llama3";
        }
    },

    async _buildRequestBody(messages, { temperature, numCtx, stream = false }) {
        let model = localStorage.getItem('selectedModel');
        if (!model) {
            model = await this._getDefaultModel();
            localStorage.setItem('selectedModel', model);
        }
        
        // Process messages to handle images
        const processedMessages = messages.map(message => {
            const processedMessage = { ...message };
            
            // If message has images, convert them to base64 if they aren't already
            if (message.images && message.images.length > 0) {
                processedMessage.images = message.images.map(img => {
                    // If it's already a base64 string, return as is
                    if (typeof img === 'string') {
                        return img;
                    }
                    // If it's an object with base64 property, return the base64 string
                    if (img && typeof img === 'object' && img.base64) {
                        return img.base64;
                    }
                    return img;
                });
            }
            
            return processedMessage;
        });
        
        const body = { model, messages: processedMessages, stream, options: {} };
        if (temperature != null) body.options.temperature = Number(temperature);
        if (numCtx) body.options.num_ctx = Number(numCtx);
        return body;
    },

    async stream(messages, onChunk, options, signal) {
        const body = await this._buildRequestBody(messages, { ...options, stream: true });
        const response = await fetch(`${this.API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: signal // Pass the signal to the fetch API
        });

        if (!response.ok) throw new Error(`Network error: ${response.status}`);
        if (!response.body) throw new Error("Streaming not supported by browser.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        let buffer = "";

        try {
            while (true) {
                // Check if the signal is aborted
                if (signal && signal.aborted) {
                    throw new Error('Aborted');
                }
                
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const chunkContent = JSON.parse(line).message?.content;
                        if (chunkContent) {
                            fullResponse += chunkContent;
                            onChunk(chunkContent);
                        }
                    } catch (error) {
                        console.warn("Skipped non-JSON line in stream:", line);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        return fullResponse;
    },

    async get(messages, options) {
        const body = await this._buildRequestBody(messages, { ...options, stream: false });
        const response = await fetch(`${this.API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`Network error: ${response.status}`);
        const data = await response.json();
        return data.message?.content ?? "";
    },

    async getModels() {
        const response = await fetch(`${this.API_URL}/tags`);
        if (!response.ok) throw new Error(`Error loading models: ${response.status}`);
        const data = await response.json();
        const names = (data?.models ?? []).map(m => m.name).filter(Boolean);
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }
};

// --- 2. Utilities Module (ENHANCED) ---
const utils = {
    // Helper function to detect mobile devices
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    },

    formatMessageContent(text = '') {
        // 1. First, protect code blocks from HTML escaping
        const codeBlocks = [];
        let codeBlockIndex = 0;
        
        // Store code blocks temporarily (both ``` and `code`)
        let processedText = text.replace(/```[\s\S]*?```/g, (match) => {
            const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`;
            codeBlocks[codeBlockIndex] = match;
            codeBlockIndex++;
            return placeholder;
        });
        
        // Also protect inline code (but not if it's already in a code block)
        processedText = processedText.replace(/`([^`\n]+)`/g, (match, code) => {
            const placeholder = `__INLINE_CODE_${codeBlockIndex}__`;
            codeBlocks[codeBlockIndex] = match;
            codeBlockIndex++;
            return placeholder;
        });
        
        // 2. Now escape HTML
        processedText = processedText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        // 3. Restore code blocks with original content
        codeBlocks.forEach((block, index) => {
            const codeBlockPlaceholder = `__CODE_BLOCK_${index}__`;
            const inlineCodePlaceholder = `__INLINE_CODE_${index}__`;
            
            if (processedText.includes(codeBlockPlaceholder)) {
                processedText = processedText.replace(codeBlockPlaceholder, block);
            } else if (processedText.includes(inlineCodePlaceholder)) {
                processedText = processedText.replace(inlineCodePlaceholder, block);
            }
        });
        
        // 4. Process custom tags like <think> - handle both complete and incomplete tags
        let processedThinkTags = processedText;
        
        // Handle complete <think>...</think> blocks
        processedThinkTags = processedThinkTags.replace(/&lt;think&gt;([\s\S]*?)&lt;\/think&gt;/g, 
            '<div class="thinking-block"><i class="fas fa-lightbulb"></i><p>$1</p></div>');
        
        // Handle incomplete <think> blocks (for streaming)
        processedThinkTags = processedThinkTags.replace(/&lt;think&gt;([\s\S]*?)$/g, 
            '<div class="thinking-block"><i class="fas fa-lightbulb"></i><p>$1</p></div>');
            
        // 5. Process with marked.js
        // marked will handle code blocks and other markdown syntax.
        // It will also call highlight.js for code blocks because we configured it.
        return marked.parse(processedThinkTags);
    },
    
    // New function to apply syntax highlighting to code blocks
    applySyntaxHighlighting($container) {
        $container.find('pre code').each((_, block) => {
            const $block = $(block);
            // Only highlight if not already highlighted and has content
            if (!$block.hasClass('hljs') && $block.text().trim()) {
                try {
                    hljs.highlightElement(block);
                } catch (error) {
                    console.warn('Failed to highlight code block:', error);
                }
            }
        });
    },
    
    // New function to copy message as markdown (simplified)
    copyMessageAsMarkdown($messageContainer) {
        const html = $messageContainer.find('.message-content').html();
        // Use a library or a simpler conversion for basic markdown
        const turndownService = new TurndownService({ 
            codeBlockStyle: 'fenced',
            headingStyle: 'atx'
        });
        // remove copy buttons from html before converting
        const cleanHtml = html.replace(/<button class="copy-code-button".*?<\/button>/g, '');
        const markdown = turndownService.turndown(cleanHtml);
        
        navigator.clipboard.writeText(markdown).then(() => {
            const $button = $messageContainer.find('.copy-message-button');
            this.showCopyFeedback($button, "Copied Markdown!");
        }).catch(err => {
            console.error('Failed to copy message:', err);
        });
    },

    showCopyFeedback($button, text) {
        const originalIcon = $button.html();
        $button.html('<i class="fas fa-check"></i>');
        
        const $feedback = $(`<div class="copy-feedback">${text}</div>`).appendTo('body');
        const pos = $button.offset();
        $feedback.css({ top: pos.top + $button.outerHeight() + 5, left: pos.left + $button.outerWidth() / 2, opacity: 1, transform: 'translateX(-50%) translateY(0)' });

        setTimeout(() => {
            $button.html(originalIcon);
            $feedback.css({ opacity: 0, transform: 'translateX(-50%) translateY(-10px)' });
            setTimeout(() => $feedback.remove(), 300);
        }, 1500);
    },
    
    debounce(func, wait) {
        let timeout;
        return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); };
    },

    // Image handling functions
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                let { width, height } = img;
                
                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    },

    createImagePreview(file, onRemove) {
        const $previewItem = $('<div class="image-preview-item"></div>');
        const $img = $('<img>');
        const $removeBtn = $('<button class="remove-image" title="Remove image"><i class="fas fa-times"></i></button>');
        
        $previewItem.append($img, $removeBtn);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            $img.attr('src', e.target.result);
        };
        reader.onerror = () => {
            $img.attr('src', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23f0f0f0"/><text x="40" y="40" text-anchor="middle" dy=".3em" fill="%23999" font-size="12">Error</text></svg>');
        };
        reader.readAsDataURL(file);
        
        // Add error handling for image loading
        $img.on('error', function() {
            $(this).attr('src', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23f0f0f0"/><text x="40" y="40" text-anchor="middle" dy=".3em" fill="%23999" font-size="12">Error</text></svg>');
        });
        
        $removeBtn.on('click', () => {
            $previewItem.remove();
            if (onRemove) onRemove();
        });
        
        return $previewItem;
    }
};

// --- 3. Main Application Logic ---
$(document).ready(function () {
    // --- Cached DOM Elements ---
    const dom = {
        chatMessages: $('#chatMessages'),
        chatForm: $('#chatForm'),
        messageInput: $('#messageInput'),
        sendButton: $('#sendButton'),
        loadingIndicator: $('#loadingIndicator'),
        scrollToBottomBtn: $('#scrollToBottomBtn'),
        attachImageButton: $('#attachImageButton'),
        imageInput: $('#imageInput'),
        imagePreview: null // Will be created dynamically
    };

    // --- State Management ---
    const state = {
        messages: [],
        attachedImages: [], // New: array to store attached images
        settings: {
            systemPrompt: localStorage.getItem('systemPrompt') || 'You are a helpful AI assistant.',
            numCtx: Number(localStorage.getItem('numCtx') || 4096),
            temperature: Number(localStorage.getItem('temperature') || 0.7),
            isStreaming: (localStorage.getItem('isStreaming') ?? 'true') === 'true',
            selectedModel: localStorage.getItem('selectedModel') || null, // Will be set dynamically
        },
        isProcessing: false,
        isStreaming: false, // New: track if streaming is active
        currentAbortController: null, // New: abort controller for streaming
    };

    // --- UI Logic Module (ENHANCED) ---
    const ui = {
        // New state to track if user has manually scrolled up
        userHasScrolled: false,
        
        scrollToBottom: () => { // Simplified: just scrolls to the bottom
            requestAnimationFrame(() => {
                dom.chatMessages.scrollTop(dom.chatMessages.prop("scrollHeight"));
            });
        },

        // New: scrolls only if the user is already near the bottom
        conditionalScrollToBottom: () => {
            // If user has scrolled up, don't auto-scroll
            if (ui.userHasScrolled) return;
            
            const el = dom.chatMessages[0];
            // Tolerance: 100px. If user is within 100px of the bottom, we scroll.
            const isNearBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + 100;

            if (isNearBottom) {
                ui.scrollToBottom();
            }
        },

        debouncedConditionalScroll: utils.debounce(() => ui.conditionalScrollToBottom(), 50),

        appendMessage(role, content = '', images = []) {
             const avatarIcon = { user: 'fa-user', ai: 'fa-robot', system: 'fa-triangle-exclamation' }[role];
             const formattedContent = (role === 'user') 
                 ? content.replace(/</g, "&lt;").replace(/>/g, "&gt;")
                 : utils.formatMessageContent(content); 

             const $messageContainer = $(`<div class="message ${role}"><div class="avatar"><i class="fas ${avatarIcon}"></i></div><div class="message-content"></div></div>`);
             const $messageContent = $messageContainer.find('.message-content').html(formattedContent);

             // Add images if provided
             if (images && images.length > 0) {
                 images.forEach(imageData => {
                     const $img = $('<img class="message-image full-size" alt="Attached image">');
                     if (typeof imageData === 'string') {
                         // If it's already a full data URL, use as is
                         if (imageData.startsWith('data:')) {
                             $img.attr('src', imageData);
                         } else {
                             // If it's just base64 data, add the prefix
                             $img.attr('src', `data:image/jpeg;base64,${imageData}`);
                         }
                     } else if (imageData.base64) {
                         $img.attr('src', `data:image/jpeg;base64,${imageData.base64}`);
                     }
                     
                     // Add click handler for image enlargement
                     $img.on('click', function() {
                         const $modal = $('<div class="image-modal-overlay"></div>');
                         const $modalContent = $('<div class="image-modal-content"></div>');
                         const $modalImg = $('<img class="image-modal-img">').attr('src', $(this).attr('src'));
                         
                         // Add error handling for modal image
                         $modalImg.on('error', function() {
                             $(this).attr('src', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23f0f0f0"/><text x="150" y="150" text-anchor="middle" dy=".3em" fill="%23999" font-size="16">Image failed to load</text></svg>');
                         });
                         
                         $modalContent.append($modalImg);
                         $modal.append($modalContent);
                         $('body').append($modal);
                         
                         $modal.on('click', function() {
                             $modal.remove();
                         });
                         
                         $modalContent.on('click', function(e) {
                             e.stopPropagation();
                         });
                         
                         // Add keyboard support for closing modal
                         $(document).on('keydown.modal', function(e) {
                             if (e.key === 'Escape') {
                                 $modal.remove();
                                 $(document).off('keydown.modal');
                             }
                         });
                     });
                     
                     // Add error handling for images
                     $img.on('error', function() {
                         $(this).attr('src', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23f0f0f0"/><text x="150" y="150" text-anchor="middle" dy=".3em" fill="%23999" font-size="16">Image failed to load</text></svg>');
                     });
                     
                     $messageContent.append($img);
                 });
             }

             if (role === 'ai') {
                 $messageContainer.append('<button class="copy-message-button" title="Copy message as markdown"><i class="fas fa-copy"></i></button>');
             }
             
             dom.chatMessages.append($messageContainer);
             
             // Always scroll for new messages
             this.scrollToBottom();

             // Add fade-in animation
             $messageContainer.css({ opacity: 0, transform: 'translateY(10px)' }).animate({ opacity: 1, transform: 'translateY(0)' }, 300);

             return $messageContent;
         },

        finalizeMessage($messageContent) {
            // The content is already finalized, so we just add highlights and copy buttons
            utils.applySyntaxHighlighting($messageContent);
            $messageContent.find('pre').each(function() {
                if (!$(this).find('.copy-code-button').length) {
                    $(this).prepend('<button class="copy-code-button" title="Copy code"><i class="fas fa-copy"></i></button>');
                }
            });
        },

        setProcessingState(isProcessing, isStreaming = false) {
            state.isProcessing = isProcessing;
            state.isStreaming = isStreaming;
            
            // Update button appearance based on state
            const $button = dom.sendButton;
            const $icon = $button.find('i');
            const $buttonText = $button.find('span');
            
            if (isStreaming) {
                // Show stop button
                $button.removeClass('send-button').addClass('stop-button');
                $icon.removeClass('fa-paper-plane').addClass('fa-stop');
                $button.prop('title', 'Stop streaming');
            } else {
                // Show send button
                $button.removeClass('stop-button').addClass('send-button');
                $icon.removeClass('fa-stop').addClass('fa-paper-plane');
                if ($buttonText.length > 0) {
                    $buttonText.remove();
                }
                $button.prop('title', 'Send');
            }
            
            dom.sendButton.prop('disabled', isProcessing && !isStreaming);
            dom.messageInput.prop('disabled', isProcessing);
            // Only show loading indicator for non-streaming mode
            if (!state.settings.isStreaming) {
                dom.loadingIndicator.toggleClass('active', isProcessing);
            }
        },

        autoResizeTextarea: () => {
            const el = dom.messageInput[0];
            const currentHeight = el.style.height;
            el.style.height = 'auto';
            const newHeight = Math.min(el.scrollHeight, 200); // Max height is 200px
            
            // Only change height if it's actually different
            if (currentHeight !== `${newHeight}px`) {
                el.style.height = `${newHeight}px`;
            }
        },

        resetInput() {
            dom.messageInput.val('');
            // Use setTimeout to avoid layout thrashing
            setTimeout(() => {
                this.autoResizeTextarea();
                dom.messageInput.focus();
            }, 0);
        },

        // Image handling functions
        createImagePreview() {
            if (!dom.imagePreview) {
                dom.imagePreview = $('<div class="image-preview"></div>');
                dom.chatForm.prepend(dom.imagePreview);
            }
            return dom.imagePreview;
        },

        addImageToPreview(file) {
            const $preview = this.createImagePreview();
            const $previewItem = utils.createImagePreview(file, () => {
                // Remove from state when image is removed
                const index = state.attachedImages.findIndex(img => img.file === file);
                if (index > -1) {
                    state.attachedImages.splice(index, 1);
                }
                if (state.attachedImages.length === 0) {
                    dom.imagePreview.remove();
                    dom.imagePreview = null;
                }
            });
            
            $preview.append($previewItem);
            state.attachedImages.push({ file, element: $previewItem });
        },

        clearImagePreview() {
            if (dom.imagePreview) {
                dom.imagePreview.remove();
                dom.imagePreview = null;
            }
            state.attachedImages = [];
        },

        // New function to stop streaming
        stopStreaming() {
            if (state.isStreaming && state.currentAbortController) {
                state.currentAbortController.abort();
                state.currentAbortController = null;
                state.isStreaming = false;
                this.setProcessingState(false, false);
                
                // Remove the cursor from the current message and save the partial response
                const $aiContent = dom.chatMessages.find('.message.ai:last-child .message-content');
                if ($aiContent.length > 0) {
                    const currentText = $aiContent.text();
                    let cleanText = currentText;
                    
                    // Remove cursor if present
                    if (currentText.endsWith('█')) {
                        cleanText = currentText.slice(0, -1);
                    }
                    
                    // Update the display
                    if (cleanText.trim()) {
                        $aiContent.html(utils.formatMessageContent(cleanText));
                        utils.applySyntaxHighlighting($aiContent);
                        
                        // Update the last assistant message in state.messages (it should already exist)
                        const lastAssistantIndex = state.messages.length - 1;
                        if (lastAssistantIndex >= 0 && state.messages[lastAssistantIndex].role === 'assistant') {
                            state.messages[lastAssistantIndex].content = cleanText;
                        }
                    }
                }
            }
        }
    };

    // --- Core Chat Functions (ENHANCED for streaming) ---
    async function sendMessage() {
        const messageText = dom.messageInput.val().trim();
        const hasImages = state.attachedImages.length > 0;
        
        if ((!messageText && !hasImages) || state.isProcessing) return;

        ui.setProcessingState(true, false);
        $('#placeholderMessage').remove();

        // Prepare images for sending
        const imagesToSend = [];
        if (hasImages) {
            for (const imageData of state.attachedImages) {
                try {
                    const compressedBlob = await utils.compressImage(imageData.file);
                    const base64 = await utils.fileToBase64(compressedBlob);
                    // Remove the data:image/...;base64, prefix
                    const base64Data = base64.split(',')[1];
                    imagesToSend.push(base64Data);
                } catch (error) {
                    console.error('Error processing image:', error);
                    // Show error message to user
                    ui.appendMessage('system', `Error processing image ${imageData.file.name}: ${error.message}`);
                }
            }
        }

        // Render user message with images
        const $userMessageContent = ui.appendMessage('user', messageText, imagesToSend);

        // Prepare message for API
        const messageContent = messageText || '';
        const messageImages = imagesToSend;
        
        // Create message object for API
        const messageObj = {
            role: "user",
            content: messageContent,
            images: messageImages.length > 0 ? messageImages : undefined
        };

        state.messages.push(messageObj);
        ui.resetInput();
        ui.clearImagePreview();

        try {
            const llmOptions = { temperature: state.settings.temperature, numCtx: state.settings.numCtx };
            const fullHistory = [{ role: 'system', content: state.settings.systemPrompt }, ...state.messages];
            
            if (state.settings.isStreaming) {
                const $aiContent = ui.appendMessage('ai');
                const $aiMessageContainer = $aiContent.closest('.message');
                $aiMessageContainer.addClass('is-thinking');
                let currentFullResponse = "";
                let isFirstChunk = true;
                
                // Reset scroll lock state at the start of a new message
                ui.userHasScrolled = false;

                // Create abort controller for streaming
                state.currentAbortController = new AbortController();
                ui.setProcessingState(true, true);

                // Add assistant message to state immediately (will be updated as we receive chunks)
                const assistantMessageIndex = state.messages.length;
                state.messages.push({ role: "assistant", content: "" });

                const onChunk = (chunk) => {
                    if (isFirstChunk && chunk.trim()) {
                        $aiMessageContainer.removeClass('is-thinking');
                        isFirstChunk = false;
                    }
                    currentFullResponse += chunk;
                    
                    // Update the message in state.messages
                    state.messages[assistantMessageIndex].content = currentFullResponse;
                    
                    // Use the final formatting logic for streaming to ensure consistency
                    const processedHTML = utils.formatMessageContent(currentFullResponse + "█");
                    $aiContent.html(processedHTML);
                   
                    // Highlight syntax as it streams
                    utils.applySyntaxHighlighting($aiContent);
                    
                    // Use conditional scroll during streaming
                    ui.conditionalScrollToBottom();
                };

                // Create history without the empty assistant message for the API call
                const apiHistory = [{ role: 'system', content: state.settings.systemPrompt }, ...state.messages.slice(0, -1)];
                const finalResponse = await llmApi.stream(apiHistory, onChunk, llmOptions, state.currentAbortController.signal);
                // Remove thinking indicator if it's still showing
                if (isFirstChunk) {
                    $aiMessageContainer.removeClass('is-thinking');
                }

                // Final render without the cursor and update the final content
                const finalHTML = utils.formatMessageContent(finalResponse);
                $aiContent.html(finalHTML);
                
                // Update the final content in state.messages (remove cursor if present)
                state.messages[assistantMessageIndex].content = finalResponse;
                
                ui.finalizeMessage($aiContent);
                
                // One final scroll to the bottom if the user hasn't scrolled away
                ui.conditionalScrollToBottom();
            } else {
                const responseText = await llmApi.get(fullHistory, llmOptions);
                if (responseText) {
                    const $aiContent = ui.appendMessage('ai', responseText);
                    ui.finalizeMessage($aiContent);
                    state.messages.push({ role: "assistant", content: responseText });
                    ui.scrollToBottom();
                } else {
                    ui.appendMessage('system', "Model returned empty response.");
                }
            }
        } catch (error) {
            console.error("Error getting response:", error);
            let errorMessage = `Error occurred: ${error.message}`;
            
            // Check if error is related to images
            if (error.message.includes('images') || error.message.includes('multimodal')) {
                errorMessage = "This model may not support images. Please try without images or use a multimodal model.";
            }
            
            // Check if it's an abort error
            if (error.name === 'AbortError' || error.message === 'Aborted') {
                errorMessage = "Streaming stopped by user.";
            }
            
            ui.appendMessage('system', errorMessage);
        } finally {
            state.currentAbortController = null;
            ui.setProcessingState(false, false);
            dom.messageInput.focus();
        }
    }

    // --- Event Handlers & Initialization ---
    dom.chatForm.on('submit', (e) => { e.preventDefault(); sendMessage(); });
    dom.sendButton.on('click', function(e) {
        e.preventDefault();
        if (state.isStreaming) {
            ui.stopStreaming.call(ui);
        } else {
            sendMessage();
        }
    });
    dom.messageInput.on('keydown', (e) => {
        // Check if it's a mobile device
        const isMobile = utils.isMobileDevice();
        
        if (e.key === 'Enter') {
            if (isMobile) {
                // On mobile: Enter = new line, only send on Ctrl+Enter or Cmd+Enter
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    sendMessage();
                }
                // Otherwise let Enter create a new line (default behavior)
            } else {
                // On desktop: Enter = send, Shift+Enter = new line
                if (!e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            }
        }
    }).on('input', ui.autoResizeTextarea);

    // Image attachment handlers
    dom.attachImageButton.on('click', () => {
        dom.imageInput.click();
    });

    dom.imageInput.on('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                // Check file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    console.warn('File too large:', file.name);
                    continue;
                }
                ui.addImageToPreview(file);
            } else {
                console.warn('Non-image file selected:', file.name);
            }
        }

        // Clear the input for future selections
        dom.imageInput.val('');
    });

    // Drag and drop support
    dom.chatForm.on('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.chatForm.addClass('drag-over');
    });

    dom.chatForm.on('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.chatForm.removeClass('drag-over');
    });

    dom.chatForm.on('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.chatForm.removeClass('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                // Check file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    console.warn('File too large:', file.name);
                    continue;
                }
                ui.addImageToPreview(file);
            } else {
                console.warn('Non-image file selected:', file.name);
            }
        }
    });

    function setupScrollButton() {
        const $chatMessages = dom.chatMessages;
        const $btn = dom.scrollToBottomBtn;

        const checkScroll = () => {
            const el = $chatMessages[0];
            const isNearBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + 100; // Larger tolerance
            
            // If user scrolls up, set the flag
            if (!isNearBottom) {
                ui.userHasScrolled = true;
            } else {
                // When user scrolls back to bottom, unset the flag to re-enable auto-scroll
                ui.userHasScrolled = false;
            }

            $btn.toggleClass('visible', !isNearBottom && ui.userHasScrolled);
        };

        $chatMessages.on('scroll', utils.debounce(checkScroll, 100));
        $btn.on('click', () => {
            ui.userHasScrolled = false; // Clicking the button re-enables auto-scroll
            ui.scrollToBottom();
            $btn.removeClass('visible');
        });
    }

    function setupDynamicPlaceholder() {
        const setPlaceholder = () => {
            const modelName = state.settings.selectedModel || 'Ollama';
            // Check if it's a mobile device
            const isMobile = utils.isMobileDevice();
            
            let placeholderText;
            if (isMobile) {
                placeholderText = `Message ${modelName}... (Tap send button or use Ctrl/Cmd+Enter)`;
            } else {
                placeholderText = `Message ${modelName}... (Enter to send, Shift+Enter for new line)`;
            }
            
            dom.messageInput.attr('placeholder', placeholderText);
        };
        setPlaceholder(); // Initial set
        // Update when model changes in settings
        $('#settingsForm').on('submit', setPlaceholder);
        $('#settingsModel').on('change', setPlaceholder);
        // Also update when models are populated
        $(document).on('modelsLoaded', setPlaceholder);
        // Update on window resize (for responsive design)
        $(window).on('resize', utils.debounce(setPlaceholder, 250));
    }

    function setupSettings() {
        const $modal = $('#settingsModal'), $modelSelect = $('#settingsModel');
        const fields = {
            numCtx: '#settingsNumCtx',
            temperature: '#settingsTemperature',
            systemPrompt: '#settingsSystemPrompt',
            isStreaming: '#settingsStreaming'
        };

        $('#settingsButton').on('click', () => {
            Object.keys(fields).forEach(key => {
                const $el = $(fields[key]);
                if ($el.is(':checkbox')) $el.prop('checked', state.settings[key]);
                else $el.val(state.settings[key]);
            });
            $modelSelect.val(state.settings.selectedModel);
            if ($modelSelect.children().length === 0) populateModels();
            $modal.css('display', 'flex');
        });

        // FIX for the close button:
        $modal.on('click', function(e) { if (e.target === this) $modal.hide(); });
        $('#closeSettings').on('click', () => $modal.hide());
        
        $('#settingsForm').on('submit', (e) => {
             e.preventDefault();
             Object.keys(fields).forEach(key => {
                const $el = $(fields[key]);
                state.settings[key] = $el.is(':checkbox') ? $el.is(':checked') : $el.val();
             });
             state.settings.selectedModel = $modelSelect.val();
             Object.keys(state.settings).forEach(key => localStorage.setItem(key, state.settings[key]));
             $modal.hide();
        });

        async function populateModels() {
             const $refreshBtn = $('#refreshModels').prop('disabled', true);
             try {
                 const models = await llmApi.getModels();
                 if (models.length === 0) { $modelSelect.html('<option>No models found</option>'); return; }
                 
                 $modelSelect.empty().append(...models.map(name => `<option value="${name}">${name}</option>`));
                 
                 // If no model is selected or selected model doesn't exist, use the first available
                 if (!state.settings.selectedModel || !models.includes(state.settings.selectedModel)) {
                     state.settings.selectedModel = models[0];
                     localStorage.setItem('selectedModel', models[0]);
                 }
                 
                 $modelSelect.val(state.settings.selectedModel);
                 $(document).trigger('modelsLoaded'); // Trigger event after models are loaded
             } catch (error) {
                 console.error("Error loading models:", error);
                 $modelSelect.html(`<option>Loading error</option>`);
             } finally {
                 $refreshBtn.prop('disabled', false);
             }
        }
        $('#refreshModels').on('click', () => populateModels(true));
        populateModels();
    }

    function setupTheme() {
        const $toggle = $('#themeToggle');
        const $hljsTheme = $('#hljs-theme');
        const lightThemeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        const darkThemeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';

        const applyTheme = (theme) => {
            $('html').attr('data-theme', theme);
            $toggle.find('i').toggleClass('fa-moon', theme === 'dark').toggleClass('fa-sun', theme === 'light');
            $hljsTheme.attr('href', theme === 'dark' ? darkThemeUrl : lightThemeUrl);
            localStorage.setItem('theme', theme);
        };
        $toggle.on('click', () => applyTheme($('html').attr('data-theme') === 'light' ? 'dark' : 'light'));
        applyTheme(localStorage.getItem('theme') || 'light');
    }
    
    // Copy button event handler
    $(document).on('click', '.copy-code-button', function() {
        const code = $(this).siblings('code').text(); // Remove cursor before copying
        navigator.clipboard.writeText(code).then(() => {
            ui.showCopyFeedback($(this), "Copied!");
        });
    });

    // Copy message as markdown button event handler
    $(document).on('click', '.copy-message-button', function() {
        const $messageContainer = $(this).closest('.message');
        utils.copyMessageAsMarkdown($messageContainer);
    });

    // Initialize all components
    setupSettings();
    setupTheme();
    setupScrollButton();
    setupDynamicPlaceholder();

    dom.messageInput.focus();
});
