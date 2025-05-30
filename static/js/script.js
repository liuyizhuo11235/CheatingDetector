// 全局变量
let currentConversationId = null;
let uploadedFiles = new Map(); // 存储上传的文件

// DOM元素
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-btn');
const newChatButton = document.getElementById('new-chat-btn');
const conversationList = document.getElementById('conversation-list');
const imageUpload = document.getElementById('image-upload');
const fileUpload = document.getElementById('file-upload');
const previewContainer = document.getElementById('preview-container');

// 配置 marked 选项
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 加载对话列表
    loadConversations();
    
    // 创建新对话
    newChatButton.addEventListener('click', createNewConversation);
    
    // 发送消息
    sendButton.addEventListener('click', sendMessage);
    
    // 按Enter发送消息
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 自动调整文本框高度
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });

    // 处理图片上传
    imageUpload.addEventListener('change', handleFileUpload);
    
    // 处理文件上传
    fileUpload.addEventListener('change', handleFileUpload);
});

// 加载对话列表
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        const data = await response.json();
        
        conversationList.innerHTML = '';
        
        data.conversations.forEach(conv => {
            const convItem = document.createElement('div');
            convItem.className = 'conversation-item';
            if (conv.id === currentConversationId) {
                convItem.classList.add('active');
            }
            
            convItem.textContent = conv.title;
            convItem.addEventListener('click', () => loadConversation(conv.id));
            
            conversationList.appendChild(convItem);
        });
    } catch (error) {
        console.error('加载对话列表失败:', error);
    }
}

// 创建新对话
async function createNewConversation() {
    try {
        const response = await fetch('/api/conversations', {
            method: 'POST'
        });
        
        const data = await response.json();
        currentConversationId = data.conversation_id;
        
        // 清空聊天区域
        chatMessages.innerHTML = '';
        
        // 重新加载对话列表
        loadConversations();
    } catch (error) {
        console.error('创建新对话失败:', error);
    }
}

// 加载对话
async function loadConversation(conversationId) {
    try {
        const response = await fetch(`/api/conversations/${conversationId}`);
        const data = await response.json();
        
        currentConversationId = conversationId;
        
        // 清空聊天区域
        chatMessages.innerHTML = '';
        
        // 显示消息
        data.messages.forEach(msg => {
            // 确保消息格式正确
            if (msg.role === 'user') {
                // 对于用户消息，尝试提取原始问题
                const displayContent = msg.original_question || 
                    (msg.content.includes('用户问题:') ? 
                        msg.content.split('用户问题:')[1].split('知识库内容:')[0].trim() : 
                        msg.content);
                appendMessage(msg.role, displayContent, true);
            } else {
                // 对于助手消息，直接显示内容
                appendMessage(msg.role, msg.content, true);
            }
        });
        
        // 更新对话列表选中状态
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 找到并高亮当前对话
        const activeItem = Array.from(document.querySelectorAll('.conversation-item')).find(
            item => item.textContent.includes(
                data.messages[0]?.original_question || 
                (data.messages[0]?.content.includes('用户问题:') ? 
                    data.messages[0].content.split('用户问题:')[1].split('知识库内容:')[0].trim() : 
                    data.messages[0]?.content || '')
            )
        );
        
        if (activeItem) {
            activeItem.classList.add('active');
        }
    } catch (error) {
        console.error('加载对话失败:', error);
    }
}

// 处理文件上传
function handleFileUpload(event) {
    const files = event.target.files;
    
    for (const file of files) {
        // 生成唯一ID
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // 存储文件
        uploadedFiles.set(fileId, file);
        
        // 创建预览
        createFilePreview(fileId, file);
    }
    
    // 清空input，允许重复上传相同文件
    event.target.value = '';
}

// 创建文件预览
function createFilePreview(fileId, file) {
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.dataset.fileId = fileId;
    
    // 创建预览内容
    if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        previewItem.appendChild(img);
    }
    
    // 添加文件信息
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.textContent = file.name;
    previewItem.appendChild(fileInfo);
    
    // 添加删除按钮
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', () => removeFile(fileId));
    previewItem.appendChild(removeBtn);
    
    previewContainer.appendChild(previewItem);
}

// 移除文件
function removeFile(fileId) {
    // 移除预览
    const previewItem = previewContainer.querySelector(`[data-file-id="${fileId}"]`);
    if (previewItem) {
        previewItem.remove();
    }
    
    // 移除文件
    uploadedFiles.delete(fileId);
}

// 发送消息
async function sendMessage() {
    const message = userInput.value.trim();
    
    if (!message && uploadedFiles.size === 0) return;
    
    if (!currentConversationId) {
        await createNewConversation();
    }

    // 构造多模态内容
    let userContentArray = [];
    if (message) {
        userContentArray.push({ type: 'text', text: message });
    }
    // 处理图片文件
    const imagePromises = [];
    uploadedFiles.forEach((file, fileId) => {
        if (file.type.startsWith('image/')) {
            imagePromises.push(new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    userContentArray.push({
                        type: 'image_url',
                        image_url: { url: e.target.result }
                    });
                    resolve();
                };
                reader.readAsDataURL(file);
            }));
        }
    });
    // 等待所有图片转base64后再渲染用户气泡
    await Promise.all(imagePromises);
    if (userContentArray.length > 0) {
        appendMessage('user', userContentArray, false);
    }

    // 准备FormData
    const formData = new FormData();
    formData.append('message', message);
    uploadedFiles.forEach((file, fileId) => {
        formData.append('files', file);
    });
    // 清空输入框和预览
    userInput.value = '';
    userInput.style.height = 'auto';
    previewContainer.innerHTML = '';
    uploadedFiles.clear();
    
    try {
        // 发送消息到服务器
        const response = await fetch(`/api/conversations/${currentConversationId}/messages`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        // 显示助手回复
        appendMessage('assistant', data.response, false);
        // 重新加载对话列表以更新标题
        loadConversations();
    } catch (error) {
        console.error('发送消息失败:', error);
        appendMessage('assistant', '抱歉，发生了错误，请稍后再试。', false);
    }
}

// 添加消息到聊天区域
function appendMessage(role, content, isHistory = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? 'U' : 'A';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (role === 'user') {
        // 支持多模态：content 可能是字符串，也可能是数组
        if (Array.isArray(content)) {
            content.forEach(item => {
                if (item.type === 'text') {
                    const p = document.createElement('div');
                    p.textContent = item.text.length > 300 ? item.text.slice(0, 300) + '...' : item.text;
                    messageContent.appendChild(p);
                } else if (item.type === 'image_url' && item.image_url && item.image_url.url) {
                    const img = document.createElement('img');
                    img.src = item.image_url.url;
                    img.style.maxWidth = '180px';
                    img.style.maxHeight = '120px';
                    img.style.display = 'block';
                    img.style.margin = '8px 0';
                    img.style.borderRadius = '8px';
                    messageContent.appendChild(img);
                }
            });
        } else if (typeof content === 'string') {
            messageContent.textContent = content;
        } else {
            messageContent.textContent = '[不支持的内容]';
        }
    } else {
        // 助手消息：使用 Markdown 解析
        messageContent.innerHTML = marked.parse(content);
        messageContent.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightBlock(block);
        });
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
} 