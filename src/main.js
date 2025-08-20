import './style.css'

class GifTool {
    constructor() {
        this.video = null;
        this.worker = null;
        this.cropBox = {
            x: 0,
            y: 0,
            size: 200
        };
        this.isDragging = false;
        this.isResizing = false;
        this.dragStart = { x: 0, y: 0 };
        this.resizeCorner = null;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.elements = {
            uploadArea: document.getElementById('uploadArea'),
            uploadBtn: document.getElementById('uploadBtn'),
            fileInput: document.getElementById('fileInput'),
            processingSection: document.getElementById('processingSection'),
            videoPreview: document.getElementById('videoPreview'),
            cropOverlay: document.getElementById('cropOverlay'),
            cropBoxEl: document.getElementById('cropBox'),
            timeSlider: document.getElementById('timeSlider'),
            timeDisplay: document.getElementById('timeDisplay'),
            generateBtn: document.getElementById('generateBtn'),
            cancelBtn: document.getElementById('cancelBtn'),
            resetBtn: document.getElementById('resetBtn'),
            progressSection: document.getElementById('progressSection'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            resultSection: document.getElementById('resultSection'),
            resultGif: document.getElementById('resultGif'),
            downloadBtn: document.getElementById('downloadBtn')
        };
    }

    setupEventListeners() {
        this.elements.uploadArea.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.uploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.elements.fileInput.click();
        });
        
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        this.elements.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.elements.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.elements.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        this.elements.videoPreview.addEventListener('loadedmetadata', () => this.setupVideo());
        this.elements.videoPreview.addEventListener('timeupdate', () => this.updateTimeDisplay());
        
        this.elements.timeSlider.addEventListener('input', (e) => this.handleTimeSliderChange(e));
        
        this.elements.generateBtn.addEventListener('click', () => this.generateGif());
        this.elements.cancelBtn.addEventListener('click', () => this.cancelGeneration());
        this.elements.resetBtn.addEventListener('click', () => this.reset());
        this.elements.downloadBtn.addEventListener('click', () => this.downloadGif());
        
        this.setupCropControls();
        
        window.addEventListener('resize', () => this.updateCropBox());
    }

    handleDragOver(e) {
        e.preventDefault();
        this.elements.uploadArea.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.elements.uploadArea.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.elements.uploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        if (!this.isVideoFile(file)) {
            alert('Please select a valid video file (MP4, WebM, MOV)');
            return;
        }

        if (file.size > 200 * 1024 * 1024) {
            if (!confirm('Large file detected (>200MB). Processing may be slow. Continue?')) {
                return;
            }
        }

        const url = URL.createObjectURL(file);
        this.elements.videoPreview.src = url;
        this.video = file;
    }

    isVideoFile(file) {
        const validTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'];
        return validTypes.includes(file.type);
    }

    setupVideo() {
        const video = this.elements.videoPreview;
        const duration = video.duration;
        
        if (duration > 60) {
            if (!confirm('Long video detected (>60s). Processing may be slow. Continue?')) {
                return;
            }
        }
        
        this.elements.timeSlider.max = duration;
        this.elements.processingSection.style.display = 'block';
        
        setTimeout(() => {
            this.initializeCropBox();
        }, 100);
    }

    updateTimeDisplay() {
        const currentTime = this.elements.videoPreview.currentTime;
        this.elements.timeDisplay.textContent = `${currentTime.toFixed(1)}s`;
        this.elements.timeSlider.value = currentTime;
    }

    handleTimeSliderChange(e) {
        this.elements.videoPreview.currentTime = parseFloat(e.target.value);
    }

    initializeCropBox() {
        const video = this.elements.videoPreview;
        const overlay = this.elements.cropOverlay;
        
        const videoRect = video.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        
        const videoAspect = video.videoWidth / video.videoHeight;
        const containerAspect = videoRect.width / videoRect.height;
        
        let displayWidth, displayHeight;
        if (videoAspect > containerAspect) {
            displayWidth = videoRect.width;
            displayHeight = videoRect.width / videoAspect;
        } else {
            displayHeight = videoRect.height;
            displayWidth = videoRect.height * videoAspect;
        }
        
        const offsetX = (videoRect.width - displayWidth) / 2;
        const offsetY = (videoRect.height - displayHeight) / 2;
        
        const size = Math.min(displayWidth, displayHeight) * 0.4;
        this.cropBox.size = size;
        this.cropBox.x = offsetX + (displayWidth - size) / 2;
        this.cropBox.y = offsetY + (displayHeight - size) / 2;
        
        this.updateCropBox();
    }

    updateCropBox() {
        const cropBoxEl = this.elements.cropBoxEl;
        cropBoxEl.style.left = `${this.cropBox.x}px`;
        cropBoxEl.style.top = `${this.cropBox.y}px`;
        cropBoxEl.style.width = `${this.cropBox.size}px`;
        cropBoxEl.style.height = `${this.cropBox.size}px`;
    }

    setupCropControls() {
        const cropBoxEl = this.elements.cropBoxEl;
        
        cropBoxEl.addEventListener('mousedown', (e) => this.handleCropMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleCropMouseMove(e));
        document.addEventListener('mouseup', () => this.handleCropMouseUp());
        
        const handles = cropBoxEl.querySelectorAll('.crop-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => this.handleResizeStart(e));
        });
        
        cropBoxEl.addEventListener('keydown', (e) => this.handleCropKeyDown(e));
        cropBoxEl.setAttribute('tabindex', '0');
    }

    handleCropMouseDown(e) {
        if (e.target.classList.contains('crop-handle')) return;
        
        this.isDragging = true;
        const rect = this.elements.cropOverlay.getBoundingClientRect();
        this.dragStart.x = e.clientX - rect.left - this.cropBox.x;
        this.dragStart.y = e.clientY - rect.top - this.cropBox.y;
        
        e.preventDefault();
    }

    handleResizeStart(e) {
        this.isResizing = true;
        this.resizeCorner = e.target.getAttribute('data-corner');
        
        const rect = this.elements.cropOverlay.getBoundingClientRect();
        this.dragStart.x = e.clientX - rect.left;
        this.dragStart.y = e.clientY - rect.top;
        
        e.preventDefault();
        e.stopPropagation();
    }

    handleCropMouseMove(e) {
        if (!this.isDragging && !this.isResizing) return;
        
        const rect = this.elements.cropOverlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isDragging) {
            this.cropBox.x = Math.max(0, Math.min(x - this.dragStart.x, rect.width - this.cropBox.size));
            this.cropBox.y = Math.max(0, Math.min(y - this.dragStart.y, rect.height - this.cropBox.size));
        } else if (this.isResizing) {
            this.handleResize(x, y);
        }
        
        this.updateCropBox();
    }

    handleResize(x, y) {
        const minSize = 50;
        const maxSize = Math.min(
            this.elements.cropOverlay.clientWidth,
            this.elements.cropOverlay.clientHeight
        );
        
        let newSize = this.cropBox.size;
        let newX = this.cropBox.x;
        let newY = this.cropBox.y;
        
        switch (this.resizeCorner) {
            case 'se':
                newSize = Math.min(x - this.cropBox.x, y - this.cropBox.y);
                break;
            case 'sw':
                newSize = Math.min(this.cropBox.x + this.cropBox.size - x, y - this.cropBox.y);
                newX = this.cropBox.x + this.cropBox.size - newSize;
                break;
            case 'ne':
                newSize = Math.min(x - this.cropBox.x, this.cropBox.y + this.cropBox.size - y);
                newY = this.cropBox.y + this.cropBox.size - newSize;
                break;
            case 'nw':
                newSize = Math.min(this.cropBox.x + this.cropBox.size - x, this.cropBox.y + this.cropBox.size - y);
                newX = this.cropBox.x + this.cropBox.size - newSize;
                newY = this.cropBox.y + this.cropBox.size - newSize;
                break;
        }
        
        newSize = Math.max(minSize, Math.min(maxSize, newSize));
        
        if (newX >= 0 && newX + newSize <= this.elements.cropOverlay.clientWidth) {
            this.cropBox.x = newX;
        }
        if (newY >= 0 && newY + newSize <= this.elements.cropOverlay.clientHeight) {
            this.cropBox.y = newY;
        }
        
        this.cropBox.size = newSize;
    }

    handleCropMouseUp() {
        this.isDragging = false;
        this.isResizing = false;
        this.resizeCorner = null;
    }

    handleCropKeyDown(e) {
        const step = e.shiftKey ? 10 : 1;
        
        switch (e.key) {
            case 'ArrowLeft':
                this.cropBox.x = Math.max(0, this.cropBox.x - step);
                break;
            case 'ArrowRight':
                this.cropBox.x = Math.min(this.elements.cropOverlay.clientWidth - this.cropBox.size, this.cropBox.x + step);
                break;
            case 'ArrowUp':
                this.cropBox.y = Math.max(0, this.cropBox.y - step);
                break;
            case 'ArrowDown':
                this.cropBox.y = Math.min(this.elements.cropOverlay.clientHeight - this.cropBox.size, this.cropBox.y + step);
                break;
            default:
                return;
        }
        
        e.preventDefault();
        this.updateCropBox();
    }

    async generateGif() {
        if (!this.video) return;
        
        this.elements.generateBtn.style.display = 'none';
        this.elements.cancelBtn.style.display = 'inline-block';
        this.elements.progressSection.style.display = 'block';
        this.elements.resultSection.style.display = 'none';
        
        try {
            const cropParams = this.calculateCropParameters();
            const startTime = parseFloat(this.elements.timeSlider.value);
            
            this.worker = new Worker('/src/worker.js', { type: 'module' });
            
            this.worker.onmessage = (e) => {
                const { type, data } = e.data;
                
                switch (type) {
                    case 'progress':
                        this.updateProgress(data.progress, data.message);
                        break;
                    case 'complete':
                        this.handleGenerationComplete(data.gifBlob);
                        break;
                    case 'error':
                        this.handleGenerationError(data.error);
                        break;
                }
            };
            
            this.worker.postMessage({
                type: 'generate',
                data: {
                    videoFile: this.video,
                    startTime,
                    cropParams,
                    duration: 4,
                    fps: 10,
                    outputSize: 62
                }
            });
            
        } catch (error) {
            this.handleGenerationError(error.message);
        }
    }

    calculateCropParameters() {
        const video = this.elements.videoPreview;
        const overlay = this.elements.cropOverlay;
        
        const videoRect = video.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        
        const videoAspect = video.videoWidth / video.videoHeight;
        const containerAspect = videoRect.width / videoRect.height;
        
        let displayWidth, displayHeight, offsetX, offsetY;
        if (videoAspect > containerAspect) {
            displayWidth = videoRect.width;
            displayHeight = videoRect.width / videoAspect;
            offsetX = 0;
            offsetY = (videoRect.height - displayHeight) / 2;
        } else {
            displayHeight = videoRect.height;
            displayWidth = videoRect.height * videoAspect;
            offsetX = (videoRect.width - displayWidth) / 2;
            offsetY = 0;
        }
        
        const scaleX = video.videoWidth / displayWidth;
        const scaleY = video.videoHeight / displayHeight;
        
        const cropX = (this.cropBox.x - offsetX) * scaleX;
        const cropY = (this.cropBox.y - offsetY) * scaleY;
        const cropSize = this.cropBox.size * Math.min(scaleX, scaleY);
        
        return {
            x: Math.max(0, Math.round(cropX)),
            y: Math.max(0, Math.round(cropY)),
            size: Math.round(cropSize)
        };
    }

    updateProgress(progress, message) {
        this.elements.progressFill.style.width = `${progress}%`;
        this.elements.progressText.textContent = message;
    }

    handleGenerationComplete(gifBlob) {
        const url = URL.createObjectURL(gifBlob);
        this.elements.resultGif.src = url;
        this.elements.resultSection.style.display = 'block';
        this.elements.progressSection.style.display = 'none';
        this.elements.generateBtn.style.display = 'inline-block';
        this.elements.cancelBtn.style.display = 'none';
        
        this.gifBlob = gifBlob;
    }

    handleGenerationError(error) {
        alert(`Error generating GIF: ${error}`);
        this.elements.progressSection.style.display = 'none';
        this.elements.generateBtn.style.display = 'inline-block';
        this.elements.cancelBtn.style.display = 'none';
    }

    cancelGeneration() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        this.elements.progressSection.style.display = 'none';
        this.elements.generateBtn.style.display = 'inline-block';
        this.elements.cancelBtn.style.display = 'none';
    }

    downloadGif() {
        if (!this.gifBlob) return;
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(this.gifBlob);
        a.download = `gif-thumbnail-${Date.now()}.gif`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    reset() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        this.video = null;
        this.gifBlob = null;
        
        this.elements.processingSection.style.display = 'none';
        this.elements.progressSection.style.display = 'none';
        this.elements.resultSection.style.display = 'none';
        this.elements.fileInput.value = '';
        
        if (this.elements.videoPreview.src) {
            URL.revokeObjectURL(this.elements.videoPreview.src);
            this.elements.videoPreview.src = '';
        }
        
        if (this.elements.resultGif.src) {
            URL.revokeObjectURL(this.elements.resultGif.src);
            this.elements.resultGif.src = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GifTool();
});
