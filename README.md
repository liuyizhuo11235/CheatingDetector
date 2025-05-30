# 学术诚信检测助手

## 项目简介
本项目是一个基于 Flask + OpenAI API 的多模态学术诚信检测助手，支持文本、图片、文件等多模态输入，能够帮助教师检测学生作业中的潜在学术不端行为（如抄袭、AI生成内容等），并生成结构化的检测报告。

## 主要功能
- 支持文本、图片、文档（txt、doc、docx、pdf）多模态输入
- 聊天式交互，自动生成学术不端检测报告
- 支持 Markdown 格式输出，代码高亮
- 文件/图片上传预览与删除
- 对话历史管理与多轮对话
- 现代化美观UI，响应式设计

## 技术栈
- 后端：Flask、OpenAI API、httpx、python-dotenv、werkzeug
- 前端：HTML5、CSS3、JavaScript (原生)
  - Markdown 渲染：marked.js (CDN)
  - 代码高亮：highlight.js (CDN)
- 依赖管理：requirements.txt

## 安装与运行
1. **克隆项目**
   ```bash
   git clone <your-repo-url>
   cd <your-project-folder>
   ```
2. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```
3. **配置环境变量**
   在根目录下创建 `.env` 文件，内容示例：
   ```env
   OPENAI_API_KEY=你的API密钥
   OPENAI_BASE_URL=https://api.openai.com/v1
   ```
4. **运行项目**
   ```bash
   python app.py
   ```
   默认访问地址：http://127.0.0.1:5000

> ⚠️ **安全提示：请勿将包含真实 API Key 的 .env 文件或 app.py 上传到 GitHub 等公开平台。上传前请务必删除或注释掉 API Key，避免密钥泄露造成安全风险！**

## 使用说明
- 在左侧点击"新建对话"可开启新的检测会话。
- 在输入框输入文本，或点击图片/文件按钮上传作业材料。
- 支持多文件、多图片同时上传，上传后可预览和删除。
- 点击发送按钮，助手会自动分析并生成学术不端检测报告。
- 支持 Markdown 格式显示，报告内容结构清晰。

## 界面美化说明
- 主聊天区居中卡片化，宽度自适应大屏，消息气泡圆角阴影，现代感强。
- 输入区与上传按钮横向紧凑排列，预览区美观实用。
- 侧边栏简洁，支持多轮对话历史。
- 主题色以蓝白为主，辅以灰色，整体清新舒适。

## 依赖说明
- 后端依赖见 requirements.txt
- 前端依赖（marked.js、highlight.js）通过 CDN 自动加载，无需本地安装

## 适用场景
- 高校教师作业查重、学术诚信检测
- 支持多模态材料的学术分析

---
如有问题或建议，欢迎提 issue 或 PR！ 