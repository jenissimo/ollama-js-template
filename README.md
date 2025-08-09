# Ollama Chat 🚀

> **Lightweight, fast web interface for [Ollama](https://ollama.com/) - your local AI companion**

A minimal, feature-rich chat interface that brings the power of local AI models to your browser. Built with vanilla JavaScript for maximum performance and simplicity.

**Just 3 small files** - `index.html`, `code.js`, `styles.css` - that's all you need for a full-featured Ollama chat interface!

## ✨ Features

- **Real-time streaming** - Watch AI responses generate live
- **Markdown support** - Full Markdown rendering with syntax highlighting
- **Code highlighting** - Automatic language detection and syntax highlighting
- **Responsive design** - Works perfectly on desktop, tablet, and mobile
- **Dark/Light themes** - Automatic theme switching with persistent settings
- **Model management** - Easy switching between different Ollama models
- **System prompts** - Customizable system prompts for different use cases
- **Context management** - Configurable context window sizes

## 🛠 Quick Start

### Prerequisites

- [Ollama](https://ollama.com/) installed and running
- A modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jenissimo/ollama-js-template.git
   cd ollama-js-template
   ```

2. **Start Ollama server**
   ```bash
   ollama serve
   ```

3. **Launch the web interface**
   ```bash
   python3 -m http.server 8000
   # or
   npx http-server -p 8000
   # or
   php -S localhost:8000
   ```

4. **Open your browser**
   Navigate to `http://localhost:8000`

## 📖 Usage

1. **Start a conversation** - Type your message in the input field
2. **Send messages** - Press `Enter` to send or `Shift+Enter` for new lines
3. **Switch modes** - Toggle between streaming and waiting modes in settings

## ⚙️ Configuration

Access settings via the gear icon in the header:

- **Model Selection** - Choose from available Ollama models
- **System Prompt** - Customize the AI's behavior
- **Context Size** - Adjust memory window (512-32768 tokens)
- **Temperature** - Control response creativity (0-2)
- **Streaming** - Enable/disable real-time responses

## 🏗 Architecture

### File Structure
```
ollama-js-template/
├── index.html          # Main HTML file
├── styles.css          # Styles and themes
├── code.js            # Core JavaScript logic
├── README.md          # Documentation
└── LICENSE            # MIT License
```

### Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Markdown**: [marked.js](https://marked.js.org/)
- **Code Highlighting**: [highlight.js](https://highlightjs.org/)
- **Icons**: [Font Awesome](https://fontawesome.com/)
- **DOM Manipulation**: [jQuery](https://jquery.com/)
- **HTML to Markdown**: [Turndown](https://github.com/mixmark-io/turndown)
- **API**: Ollama REST API

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the AI community**
