import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

class FFmpegWorker {
    constructor() {
        this.ffmpeg = null;
        this.isLoaded = false;
    }

    async initialize() {
        if (this.isLoaded) return;

        try {
            this.postProgress(10, 'Loading FFmpeg...');
            
            this.ffmpeg = new FFmpeg();
            
            this.ffmpeg.on('log', ({ message }) => {
                console.log('FFmpeg log:', message);
                this.parseLogForProgress(message);
            });

            this.ffmpeg.on('progress', ({ progress }) => {
                const percentage = Math.round(progress * 100);
                this.postProgress(30 + (percentage * 0.6), `Processing... ${percentage}%`);
            });

            this.postProgress(15, 'Loading FFmpeg core...');
            
            await this.ffmpeg.load();

            this.isLoaded = true;
            this.postProgress(25, 'FFmpeg ready');
            
        } catch (error) {
            this.postError(`Failed to load FFmpeg: ${error.message}`);
            throw error;
        }
    }

    parseLogForProgress(message) {
        if (message.includes('frame=')) {
            const frameMatch = message.match(/frame=\s*(\d+)/);
            if (frameMatch) {
                const frame = parseInt(frameMatch[1]);
                const expectedFrames = 40;
                const progress = Math.min((frame / expectedFrames) * 100, 95);
                this.postProgress(30 + (progress * 0.6), `Processing frame ${frame}...`);
            }
        }
    }

    async generateGif({ videoFile, startTime, cropParams, duration, fps, outputSize }) {
        try {
            await this.initialize();

            this.postProgress(25, 'Preparing video data...');

            const inputFileName = 'input.mp4';
            const outputFileName = 'output.gif';
            
            const videoData = await fetchFile(videoFile);
            await this.ffmpeg.writeFile(inputFileName, videoData);

            this.postProgress(30, 'Starting GIF generation...');

            const ffmpegArgs = [
                '-i', inputFileName,
                '-ss', startTime.toString(),
                '-t', duration.toString(),
                '-vf', this.buildVideoFilter(cropParams, outputSize, fps),
                '-an',
                '-y',
                outputFileName
            ];

            console.log('FFmpeg command:', ffmpegArgs.join(' '));

            await this.ffmpeg.exec(ffmpegArgs);

            this.postProgress(95, 'Finalizing GIF...');

            const gifData = await this.ffmpeg.readFile(outputFileName);
            const gifBlob = new Blob([gifData], { type: 'image/gif' });

            await this.ffmpeg.deleteFile(inputFileName);
            await this.ffmpeg.deleteFile(outputFileName);

            this.postProgress(100, 'Complete!');
            this.postComplete(gifBlob);

        } catch (error) {
            console.error('FFmpeg processing error:', error);
            this.postError(error.message);
        }
    }

    buildVideoFilter(cropParams, outputSize, fps) {
        const { x, y, size } = cropParams;
        
        const filters = [
            `crop=${size}:${size}:${x}:${y}`,
            `scale=${outputSize}:${outputSize}:flags=lanczos`,
            `fps=${fps}`,
            'split[v1][v2]',
            '[v1]palettegen=stats_mode=single:max_colors=64[palette]',
            '[v2][palette]paletteuse=dither=bayer:bayer_scale=3'
        ];

        return filters.join(',');
    }

    postProgress(progress, message) {
        self.postMessage({
            type: 'progress',
            data: { progress, message }
        });
    }

    postComplete(gifBlob) {
        self.postMessage({
            type: 'complete',
            data: { gifBlob }
        });
    }

    postError(error) {
        self.postMessage({
            type: 'error',
            data: { error }
        });
    }
}

const worker = new FFmpegWorker();

self.onmessage = async (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'generate':
            await worker.generateGif(data);
            break;
        default:
            console.warn('Unknown message type:', type);
    }
};