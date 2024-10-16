import React, { useState, useRef } from 'react';
import { Camera, RotateCw  } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import LoadingSpinner from './spinner';
import SubmitReport from './submit_report';
import { backendAPI } from "@/lib/config";
import { reportPayload } from './submit_report';
import Letter from './letter';

export default function CameraImageCapture() {
  const [capturedImage, setCapturedImage] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [comment, setComment] = useState('');
  const [reportType, setReportType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [timestamp, setTimestamp] = useState<number>(0);
  const [letterContents, setLetter] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [showLetter, setShowLetter] = useState(false); // Track letter visibility
  const letterRef = useRef<HTMLDivElement>(null); // Ref to scroll to the letter
  const [title, setTitle] = useState(''); // Title for Letter component


  const startCamera = async () => {
    try {
        setIsCapturing(false);
        if (streamRef.current) {
          const tracks = streamRef.current.getTracks();
          tracks.forEach(track => track.stop());
        }
  
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCapturing(true);
        }
        streamRef.current = stream;
      } catch (err) {
        console.error("Error accessing the camera:", err);
      }
  };

  const toggleCamera = () => {
    setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
    startCamera();
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && isCapturing) {
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageDataUrl = canvas.toDataURL('image/jpeg');
          setCapturedImage(imageDataUrl);
          stopCamera();
          handleGeoLocation(); 
          return imageDataUrl;
        }
    }
    return null;
  };

  const sendImageToEndpoint = async (imageDataUrl: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(backendAPI + '/api/describe-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_data: imageDataUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }

      const data = await response.json();
      console.log(data);
      setComment(data.message);
      setReportType(data.feature);
    } catch (error) {
      console.error('Error sending image to endpoint:', error);
      setComment('Failed to analyze image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getLetter = async () => {
    const payload: reportPayload = {
        type: reportType,
        image: capturedImage,
        comment: comment,
        timestamp: timestamp,
        latitude: latitude,
        longitude: longitude,
    }
    const response = await fetch(backendAPI + '/api/get-letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to generate letter');
      }
      const data = await response.json();
      setLetter(data.message);
      setShowLetter(true);
      setTimeout(() => letterRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  const stopCamera = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
      setIsCapturing(false);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComment(e.target.value);
  };

  const handleGeoLocation = () => {
    if (!navigator.geolocation) {
        console.error("Geolocation is not supported by your browser");
        return;
    }
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const timestamp = position.timestamp;
        const address = await getAddressFromCoords(latitude, longitude);
        setLatitude(latitude);
        setLongitude(longitude);
        setTimestamp(timestamp);
        setAddress(address);
        // sendLocationToBackend(latitude, longitude);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching geolocation:", error);
        setIsLoading(false);
    });
  };

  // function sendLocationToBackend(lat, lon) {
  //     // existing send location to backend code
  // };

  async function getAddressFromCoords(lat: number, lon: number) {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
      try {
          const response = await fetch(url);
          const data = await response.json();
          return data.display_name;
      } catch (error) {
          console.error("Error fetching address:", error);
          return "Unable to retrieve address";
      }
  };


  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Camera Image Capture</CardTitle>
      </CardHeader>
      <CardContent>
        {!capturedImage ? (
          <div className="relative bg-gray-100 rounded-lg overflow-hidden h-[600px]">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-fit" />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              <Button
                onClick={async () => {
                  const image = captureImage();
                  if (image) {
                    await sendImageToEndpoint(image);
                  }
                }}
                disabled={isLoading}
              >
                <Camera className="mr-2 h-4 w-4" /> Capture
              </Button>
              <Button onClick={toggleCamera} variant="outline">
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <img src={capturedImage} alt="Captured" className="w-full rounded-lg" />
            {isLoading ? <LoadingSpinner /> : <p>Add a comment to describe the issue, or use the AI-generated comment.</p>}
            <div className="border-gray-300 border-2 box-border p-2 rounded-lg overflow-hidden">
              <textarea
                className="h-[200px] w-full focus:outline-none text-sm"
                placeholder={isLoading ? 'Analyzing image...' : 'Add a comment...'}
                value={comment}
                onChange={handleCommentChange}
                disabled={isLoading}
              />
            </div>
          </div>
        )}
        <div className="mt-4">
          {capturedImage && address && <p>Address: {address}</p>}
        </div>
      </CardContent>
  
      <CardFooter className="flex justify-between">
        {!capturedImage ? (
          <Button onClick={startCamera}>Start Camera</Button>
        ) : (
          <div className="flex justify-between w-full">
            <Button
              onClick={() => {
                setCapturedImage('');
                setComment('');
                setAddress('');
                startCamera();
              }}
            >
              Retake Photo
            </Button>
            <SubmitReport
              type={reportType}
              image={capturedImage}
              comment={comment}
              timestamp={timestamp ?? 0}
              latitude={latitude ?? 0}
              longitude={longitude ?? 0}
              onSubmitCallback={() => {
                getLetter()
              }}
            />
          </div>
        )}
      </CardFooter>
  
      {/* Letter component, rendered conditionally */}
      {showLetter && (
        <div ref={letterRef}>
          <Letter recipient="John Doe" initialTitle={"Citizen Concern: "+reportType + ", " + address} initialBody={letterContents} />
        </div>
      )}
  
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Card>
  );
  
}