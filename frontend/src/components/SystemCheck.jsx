import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  Lightbulb,
  Mic,
  Volume2,
} from "lucide-react";

function SystemCheck({
  onBack,
  onContinue,
  mediaStream,
  setMediaStream,
}) {
  const videoRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [permissionError, setPermissionError] = useState("");

  const questions = [
    "Tell me about a challenging technical project you led and how you handled unexpected roadblocks?",
    "How do you prioritize competing deadlines when engineering resources are constrained?",
    "Can you walk me through your experience with Node.js microservices and Docker containers?",
    "Describe a situation where you disagreed with a team member on software architecture.",
    "Where do you see your technical leadership trajectory over the next three years?",
  ];

  useEffect(() => {
    if (mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const startDevices = async () => {
    try {
      setPermissionError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setMediaStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraOn(true);
      setMicOn(true);
    } catch (error) {
      console.error(error);
      setPermissionError(
        "Camera or microphone permission was denied. Please allow access in your browser."
      );
    }
  };

  const toggleCamera = () => {
    if (!mediaStream) return;

    const videoTracks = mediaStream.getVideoTracks();

    videoTracks.forEach((track) => {
      track.enabled = !cameraOn;
    });

    setCameraOn(!cameraOn);
  };

  const toggleMic = () => {
    if (!mediaStream) return;

    const audioTracks = mediaStream.getAudioTracks();

    audioTracks.forEach((track) => {
      track.enabled = !micOn;
    });

    setMicOn(!micOn);
  };

  const testSpeaker = () => {
    const text =
      "Speaker test successful. You can hear the AI HR Agent clearly.";

    if ("speechSynthesis" in window) {
      const speech = new SpeechSynthesisUtterance(text);
      speech.rate = 1;
      speech.pitch = 1;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(speech);
    }
  };

  const startInterview = () => {
    if (!mediaStream) {
      alert("Please enable your camera and microphone first.");
      return;
    }

    onContinue(questions);
  };

  return (
    <section className="system-section">
      <div className="page-heading">
        <span className="step-pill">Step 2 of 3</span>

        <h1>Audio & Video Calibration</h1>

        <p>
          Ensure your microphone and camera are functioning properly before
          entering the AI interview room.
        </p>
      </div>

      {permissionError && (
        <div className="error-message">
          {permissionError}
        </div>
      )}

      <div className="system-grid">
        <div className="glass-panel calibration-card">
          <div className="panel-heading">
            <div>
              <Camera size={17} />
              Video Stream Feed
            </div>

            <span className={cameraOn ? "status-green" : "status-yellow"}>
              {cameraOn ? "Active" : "Not Started"}
            </span>
          </div>

          <div className="video-preview">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
            />

            {!cameraOn && (
              <div className="video-placeholder">
                <CameraOff size={28} />
                <span>Camera Feed Disabled</span>
              </div>
            )}

            <span className="video-quality">720p HD Camera</span>
          </div>

          <div className="device-actions">
            <button
              className="secondary-button"
              onClick={startDevices}
            >
              Enable Camera & Mic
            </button>

            <button
              className="secondary-button"
              onClick={toggleCamera}
              disabled={!mediaStream}
            >
              {cameraOn ? "Turn Camera Off" : "Turn Camera On"}
            </button>
          </div>
        </div>

        <div className="glass-panel calibration-card">
          <div className="panel-heading">
            <div>
              <Mic size={17} />
              Microphone & Speaker Check
            </div>

            <span className={micOn ? "status-green" : "status-yellow"}>
              {micOn ? "Mic Active" : "Not Started"}
            </span>
          </div>

          <div className="mic-test">
            <div className="mic-label">
              <span>Microphone</span>

              <span>{micOn ? "Ready" : "Waiting"}</span>
            </div>

            <div className="mic-bars">
              {[...Array(18)].map((_, index) => (
                <span
                  key={index}
                  className={micOn ? "active" : ""}
                />
              ))}
            </div>
          </div>

          <button
            className="speaker-button"
            onClick={testSpeaker}
          >
            <Volume2 size={17} />
            Play AI Sample Voice Test
          </button>

          <div className="tips-box">
            <div className="tips-title">
              <Lightbulb size={15} />
              Tips For A Great Interview
            </div>

            <ul>
              <li>Use a quiet room with minimal background noise.</li>
              <li>Speak clearly and naturally.</li>
              <li>You can ask the AI to repeat a question.</li>
            </ul>
          </div>

          <div className="system-bottom-actions">
            <button
              className="secondary-button"
              onClick={onBack}
            >
              <ArrowLeft size={15} />
              Back
            </button>

            <button
              className="primary-button"
              onClick={startInterview}
            >
              Enter Live AI Interview
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SystemCheck;