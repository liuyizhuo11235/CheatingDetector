import openai
import json
from flask import Flask, request, jsonify, render_template
import uuid
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
from openai import OpenAI
import httpx
import base64
from werkzeug.utils import secure_filename
import tempfile
import pdfplumber
import docx
# import textract  # 如需支持doc，可解开注释

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("chatbot_logs.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 从环境变量获取API密钥，如果没有则使用默认值
api_key = os.getenv("OPENAI_API_KEY", "你的API")
api_base = "https://api.openai.com/v1"

# 创建OpenAI客户端
client = OpenAI(
    api_key=api_key,
    base_url=api_base,
    http_client=httpx.Client(timeout=httpx.Timeout(30.0, connect=10.0))
)

# 存储所有对话的字典
conversations = {}

def extract_text_from_pdf(file_path):
    try:
        with pdfplumber.open(file_path) as pdf:
            return '\n'.join(page.extract_text() or '' for page in pdf.pages)
    except Exception as e:
        return '[PDF解析失败]'

def extract_text_from_docx(file_path):
    try:
        doc = docx.Document(file_path)
        return '\n'.join([para.text for para in doc.paragraphs])
    except Exception as e:
        return '[DOCX解析失败]'

# def extract_text_from_doc(file_path):
#     # 预留API Key或调用方式
#     # return textract.process(file_path).decode('utf-8')
#     return '[DOC解析功能待接入API]'

def process_files(files):
    """
    处理上传的文件，返回多模态内容列表（图片:image_url，文本:text）
    """
    file_contents = []
    for file in files:
        if file.filename == '':
            continue
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[-1]) as temp_file:
            file.save(temp_file.name)
            temp_file.close()
            ext = os.path.splitext(file.filename)[-1].lower()
            if file.content_type.startswith('image/'):
                with open(temp_file.name, 'rb') as img_file:
                    img_data = base64.b64encode(img_file.read()).decode('utf-8')
                    file_contents.append({
                        'type': 'image_url',
                        'image_url': {'url': f'data:{file.content_type};base64,{img_data}'}
                    })
            elif file.content_type == 'text/plain':
                try:
                    with open(temp_file.name, 'r', encoding='utf-8') as text_file:
                        content = text_file.read()
                        file_contents.append({
                            'type': 'text',
                            'text': content
                        })
                except Exception:
                    file_contents.append({'type': 'text', 'text': '[文本文件解析失败]'})
            elif ext == '.pdf':
                text = extract_text_from_pdf(temp_file.name)
                file_contents.append({'type': 'text', 'text': text})
            elif ext == '.docx':
                text = extract_text_from_docx(temp_file.name)
                file_contents.append({'type': 'text', 'text': text})
            elif ext == '.doc':
                # text = extract_text_from_doc(temp_file.name)
                file_contents.append({'type': 'text', 'text': '[DOC解析功能待接入API]'})
            else:
                file_contents.append({'type': 'text', 'text': f'[暂不支持的文件类型: {file.filename}]'})
            os.unlink(temp_file.name)
    return file_contents

def generate_response(user_query, file_contents=None, conversation_id=None, model="gpt-4o"):
    """
    根据用户查询和文件内容生成回答，严格按GPT-4o/vision多模态格式，增强健壮性并输出详细日志
    """
    # 保留原有system_prompt
    system_prompt = """You are an intelligent assistant designed to help teachers detect potential academic misconduct by students. Your primary role is to analyze the materials provided by the teacher — including text, images, and files — and generate a clear, structured report.

Based on the input, your report must include:

Possibility of Cheating: A concise judgment on whether the student may have engaged in cheating (e.g., plagiarism or AI-generated content).

Cheating Probability (%): An estimated percentage indicating the likelihood of cheating.

Suspicious Content Locations: Specific sections or elements in the provided materials that are potentially plagiarized or AI-generated.

Reasoning and Evidence: A brief explanation of how you arrived at your conclusions, including any detectable patterns or anomalies.

"Cheating" refers specifically to:

Plagiarism: Copying from existing sources without proper attribution.

AI-Generated Content: Content that appears to be produced using AI tools without acknowledgment.

Your response must be objective, evidence-based, and helpful to the teacher in making an informed decision."""
    messages = [{"role": "system", "content": system_prompt}]
    if conversation_id and conversation_id in conversations:
        for msg in conversations[conversation_id]:
            messages.append(msg)
    user_content = []
    if user_query and user_query.strip():
        user_content.append({"type": "text", "text": user_query.strip()})
    if file_contents:
        for fc in file_contents:
            # 只添加有内容的
            if fc.get("type") == "text" and fc.get("text", "").strip():
                user_content.append(fc)
            elif fc.get("type") == "image_url" and fc.get("image_url", {}).get("url"):
                user_content.append(fc)
    if not user_content:
        return "消息不能为空"
    user_message = {"role": "user", "content": user_content}
    messages.append(user_message)
    logger.info(f"完整Prompt: {json.dumps(messages, ensure_ascii=False)}")
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages
        )
        assistant_message = response.choices[0].message.content
    except Exception as e:
        import traceback
        err_detail = traceback.format_exc()
        logger.error(f"OpenAI API错误: {e}\n{err_detail}", exc_info=True)
        assistant_message = f"抱歉，发生了错误，请稍后再试。\n详细信息：{e}\n{err_detail}"
    logger.info(f"助手回答: {assistant_message[:100]}...")
    if conversation_id:
        if conversation_id not in conversations:
            conversations[conversation_id] = []
        conversations[conversation_id].append(user_message)
        conversations[conversation_id].append({
            "role": "assistant",
            "content": assistant_message
        })
    return assistant_message

# 创建新对话
@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    conversation_id = str(uuid.uuid4())
    conversations[conversation_id] = []
    logger.info(f"创建新对话: {conversation_id}")
    return jsonify({"conversation_id": conversation_id})

# 获取对话历史
@app.route('/api/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    if conversation_id in conversations:
        logger.info(f"获取对话历史: {conversation_id}")
        return jsonify({"messages": conversations[conversation_id]})
    logger.warning(f"对话不存在: {conversation_id}")
    return jsonify({"error": "对话不存在"}), 404

# 发送消息
@app.route('/api/conversations/<conversation_id>/messages', methods=['POST'])
def send_message(conversation_id):
    # 获取文本消息
    user_query = request.form.get('message', '')
    
    # 获取文件
    files = request.files.getlist('files')
    
    if not user_query and not files:
        logger.warning("收到空消息")
        return jsonify({"error": "消息不能为空"}), 400
    
    logger.info(f"收到用户消息: {user_query}")
    if files:
        logger.info(f"收到文件: {[f.filename for f in files]}")
    
    # 处理文件
    file_contents = process_files(files) if files else None
    
    # 生成回复
    response = generate_response(user_query, file_contents, conversation_id)
    return jsonify({"response": response})

# 获取所有对话列表
@app.route('/api/conversations', methods=['GET'])
def list_conversations():
    # 为每个对话提取第一条用户消息作为标题
    conversation_list = []
    for conv_id, messages in conversations.items():
        title = "新对话"
        for msg in messages:
            if msg["role"] == "user":
                # 提取用户消息的文本内容
                if isinstance(msg["content"], list):
                    for content in msg["content"]:
                        if content["type"] == "text":
                            title = content["text"][:20] + "..."
                            break
                else:
                    title = msg["content"][:20] + "..."
                break
        
        conversation_list.append({
            "id": conv_id,
            "title": title
        })
    
    logger.info(f"获取对话列表: {len(conversation_list)}个对话")
    return jsonify({"conversations": conversation_list})

# 渲染主页
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == "__main__":
    app.run(debug=True)