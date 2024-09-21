# Ollama HTML+JS Template

## Overview

**Ollama HTML+JS Template** is a versatile and customizable template designed to help developers quickly build web-based chat applications powered by [Ollama](https://ollama.com/) (a local large language model). This template leverages HTML, JavaScript, jQuery, and Font Awesome to create an interactive and user-friendly interface for engaging in real-time conversations with AI assistants.

## Features

- **Real-Time and Wait Modes:** Toggle between real-time streaming responses and waiting for the AI to generate a complete reply.  
- **Responsive Design:** Optimized for various screen sizes, ensuring usability across devices.  
- **Auto-Resizing Text Input:** The message input dynamically adjusts its height based on content, starting as a single line and expanding as needed.  
- **Avatar Integration:** Distinct avatars for users and AI, enhancing the conversational experience.  
- **Loading Indicator:** Visual feedback during AI response generation.  
- **Clean and Modern UI:** A polished interface with smooth transitions and intuitive controls.  
- **Accessibility:** Keyboard navigation and focus management for improved accessibility.

## Installation

### Prerequisites

- **Ollama Server:** Ensure that the Ollama server is installed and running on your local machine. You can download it from the [official website](https://ollama.com/).  
- **Python 3 or Node.js:** Required for serving the HTML file via a local web server.

### Steps

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/jenissimo/ollama-js-template.git
   ```

2. **Navigate to the Project Directory:**
   ```bash
   cd ollama-js-template
   ```

3. **Launch the Web Server:**

   You can serve the `index.html` file using a simple HTTP server. Choose one of the following methods:

   - **Using Python 3:**  
     ```bash
     python3 -m http.server 8000
     ```  
     Open your browser and navigate to `http://localhost:8000`.

   - **Using Node.js (http-server):**  
     First, install the `http-server` package globally if you haven't already:  
     ```bash
     npm install -g http-server
     ```  
     Then, start the server:  
     ```bash
     http-server -p 8000
     ```  
     Open your browser and navigate to `http://localhost:8000`.

## Usage

1. **Start the Ollama Server:**  
   - Ensure that the Ollama server is running and accessible at `http://127.0.0.1:11434/api/`.  
   - Adjust the URL in the `sendRequestToLLM` function within the JavaScript code if your server is hosted elsewhere.

2. **Open the Chat Interface:**  
   - Navigate to `http://localhost:8000` (or the port you specified) in your web browser to access the chat application.

3. **Interact with the AI:**  
   - Type your messages in the input field.  
   - Press `Enter` to send a message or `Shift+Enter` to insert a newline.  
   - Toggle between **Real-Time** and **Wait** modes using the switch in the header.

## Customization

### 1. **Changing the AI Model:**  
   - In the `sendRequestToLLM` function within the JavaScript code, update the `model` parameter to switch between different AI models supported by Ollama.  
     ```javascript
     const ollama_instance = new Ollama({
         model: "your-model-name",
         url: "http://127.0.0.1:11434/api/"
     });
     ```

### 2. **Styling Adjustments:**  
   - Modify the CSS within the `<style>` tag or link an external stylesheet to customize the appearance.  
   - Change colors, fonts, and layout as per your preference.

### 3. **Adding Features:**  
   - **Persistent Chat History:** Implement `localStorage` to save and load previous conversations.  
   - **Theme Switching:** Add light/dark mode toggles for better user personalization.  
   - **Message Timestamps:** Display timestamps for each message to provide context.

### 4. **Integrating Avatars:**  
   - The template uses Font Awesome icons for avatars. You can replace them with custom images or different icons as needed.  
     ```html
     <i class="fas fa-user avatar"></i> <!-- User Avatar -->
     <i class="fas fa-robot avatar"></i> <!-- AI Avatar -->
     ```

## Technologies Used

- **HTML5 & CSS3:** Structure and styling of the chat interface.  
- **JavaScript & jQuery:** Interactive functionalities and DOM manipulations.  
- **Font Awesome:** Iconography for avatars and other UI elements.  
- **Ollama JS Client:** Facilitates communication with the Ollama server.

## Contributing

Contributions are welcome! Whether it's reporting bugs, suggesting features, or submitting pull requests, your input is valuable.

1. **Fork the Repository**  
2. **Create a Feature Branch**  
   ```bash
   git checkout -b feature/YourFeature
   ```
3. **Commit Your Changes**  
   ```bash
   git commit -m "Add Your Feature"
   ```
4. **Push to the Branch**  
   ```bash
   git push origin feature/YourFeature
   ```
5. **Open a Pull Request**

Please ensure that your contributions adhere to the existing code style and include relevant tests if applicable.

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

For any inquiries or feedback, please contact [jenissimo@gmail.com](mailto:jenissimo@gmail.com).

---
