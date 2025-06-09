# MEG ChatGPT BCI System

A modern Brain-Computer Interface (BCI) system for MEG (Magnetoencephalography) data processing with real-time classification capabilities and a React-based web interface.

## Architecture Overview

```
meg_chatgpt_bci/
├── backend/               # FastAPI micro-service + workers
│   ├── api/               # route handlers
│   ├── schemas/           # Pydantic models for requests/responses
│   ├── workers/           # background tasks (training, inference)
│   └── main.py
├── core/                  # low-level device & streaming glue
│   ├── meg_connection.py  # EnhancedMEGConnection (TCP+LSL)
│   ├── phantom_controller.py
│   └── performance.py
├── signal_processing/     # filtering & artefact removal
│   ├── preprocessing.py
│   └── noise_reduction/
├── machine_learning/      # feature extraction + ML training
├── data/                  # I/O helpers & cached datasets
├── gui/                   # **legacy Tk GUIs** (kept for reference)
├── webui/                 # 🌐 **NEW React app** (Tauri wrapper later)
│   ├── src/
│   └── vite.config.ts
├── scripts/               # CLI tools (file replay, evaluation, etc.)
├── tests/                 # pytest + playwright for React
├── configs/               # YAML/TOML env configs, secrets excluded
├── docker/                # Dockerfile & compose for local stack
├── pyproject.toml
└── README.md
```

## Features

### 🧠 Real-time MEG Processing
- **Multi-channel support**: Handle 192+ MEG channels simultaneously
- **Real-time filtering**: Bandpass filtering with configurable parameters
- **Noise reduction**: SVD denoising, spatial filtering, and artifact removal
- **Feature extraction**: Common Spatial Patterns (CSP) and power band analysis

### 🎯 BCI Classification
- **Motor imagery detection**: Classify intended movements (up, down, left, right, rest)
- **Multiple algorithms**: LDA, SVM, Random Forest classifiers
- **Real-time inference**: Sub-20ms prediction latency
- **Adaptive learning**: Continuous model improvement

### 🌐 Modern Web Interface
- **React + TypeScript**: Modern, responsive web application
- **Real-time visualization**: Live signal monitoring and predictions
- **Training management**: Interactive training session control
- **Data analysis**: Comprehensive spectral and performance analysis
- **System monitoring**: Real-time health and performance metrics

### 🔧 System Integration
- **FastAPI backend**: RESTful API with WebSocket support
- **TCP/LSL connectivity**: Flexible MEG system integration
- **Phantom controller**: Built-in signal generator for testing
- **Configuration management**: Web-based system configuration

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- MEG system with TCP or LSL output

### Backend Setup
```bash
cd meg_chatgpt_bci
pip install -e .
python backend/main.py
```

### Frontend Setup
```bash
cd meg_chatgpt_bci/webui
npm install
npm run dev
```

### Access the Application
- Web Interface: http://localhost:5173
- API Documentation: http://localhost:8000/docs

## Usage

### 1. System Configuration
1. Navigate to the Configuration page
2. Set MEG connection parameters (host, port, sampling rate)
3. Configure signal processing filters
4. Test the connection

### 2. Training a BCI Model
1. Go to the Training page
2. Configure training parameters (trials, duration, directions)
3. Start a new training session
4. Follow the on-screen cues for motor imagery
5. Monitor training progress and data quality

### 3. Real-time Monitoring
1. Access the Monitoring page
2. Start real-time inference
3. View live signal visualization
4. Monitor prediction results and confidence levels
5. Analyze channel quality and system performance

### 4. Data Analysis
1. Visit the Analysis page
2. Review spectral analysis of recorded signals
3. Examine classification performance metrics
4. Analyze channel quality and SNR distribution
5. Export data for further analysis

## Key Components

### Enhanced MEG Connection (`core/meg_connection.py`)
- Robust TCP and LSL connectivity
- Automatic reconnection and error handling
- Real-time data streaming with buffering
- Signal quality monitoring

### Signal Processing Pipeline (`signal_processing/`)
- Butterworth bandpass filtering
- Common Spatial Patterns (CSP) feature extraction
- Multiple noise reduction techniques
- Real-time processing optimization

### Machine Learning (`machine_learning/`)
- Support for multiple classification algorithms
- Cross-validation and performance evaluation
- Model persistence and loading
- Real-time inference pipeline

### Web Interface (`webui/`)
- **Dashboard**: System overview and real-time metrics
- **Training**: Interactive BCI training interface
- **Monitoring**: Live signal visualization and predictions
- **Configuration**: System settings and parameters
- **Analysis**: Data analysis and performance metrics

## API Endpoints

### MEG Connection
- `GET /api/meg/status` - Get connection status
- `POST /api/meg/connect` - Establish MEG connection
- `POST /api/meg/disconnect` - Disconnect from MEG
- `POST /api/meg/test` - Test connection parameters

### Training
- `GET /api/training/sessions` - List training sessions
- `POST /api/training/sessions` - Create new session
- `POST /api/training/sessions/{id}/start` - Start training
- `POST /api/training/sessions/{id}/stop` - Stop training

### Inference
- `POST /api/inference/predict` - Single prediction
- `POST /api/inference/realtime/start` - Start real-time inference
- `POST /api/inference/realtime/stop` - Stop real-time inference

### System
- `GET /api/system/status` - System health status
- `GET /api/system/metrics` - Performance metrics
- `GET /api/system/config` - Get configuration
- `PUT /api/system/config` - Update configuration

## Development

### Project Structure
- **Backend**: FastAPI application with async workers
- **Frontend**: React + TypeScript with Vite
- **Styling**: TailwindCSS with custom MEG-specific components
- **State Management**: TanStack Query for server state
- **Charts**: Recharts for data visualization

### Key Technologies
- **Backend**: FastAPI, NumPy, SciPy, scikit-learn
- **Frontend**: React, TypeScript, TailwindCSS, Vite
- **Real-time**: WebSockets, Server-Sent Events
- **Visualization**: Recharts, custom signal plots

## Lessons Learned from Legacy System

This new architecture incorporates key insights from the previous Tkinter-based system:

### 🔧 **Robust Error Handling**
- Comprehensive connection retry logic
- Graceful degradation when MEG system is unavailable
- User-friendly error messages and recovery suggestions

### 📊 **Real-time Performance**
- Optimized signal processing pipeline
- Efficient data structures for streaming
- Background workers for non-blocking operations

### 🎯 **Signal Quality Awareness**
- Continuous monitoring of channel quality
- Automatic artifact detection and handling
- Visual feedback for signal quality issues

### 🧠 **Classification Reliability**
- Multiple classifier options with performance comparison
- Cross-validation and robust evaluation metrics
- Adaptive learning and model updating

### 🌐 **Modern User Experience**
- Responsive web interface replacing legacy Tkinter
- Real-time data visualization
- Intuitive workflow for training and monitoring

## Future Enhancements

- **Tauri Integration**: Desktop app wrapper for the React interface
- **Advanced Algorithms**: Deep learning models for classification
- **Multi-user Support**: User accounts and session management
- **Cloud Integration**: Remote data storage and processing
- **Mobile Interface**: Responsive design for tablets and phones

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions and support:
- Check the API documentation at `/docs`
- Review the troubleshooting guide in the wiki
- Open an issue on GitHub

---

**Built with ❤️ for the neuroscience and BCI research community**
