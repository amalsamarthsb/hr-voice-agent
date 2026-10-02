import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Clock,
  ShieldCheck,
  Bot,
  User,
  Loader2,
} from "lucide-react";
import { api, getErrorMessage } from "../services/api";

const INTERVIEW_DURATION_SECONDS = 20 * 60;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const TARGET_AUDIO_SAMPLE_RATE = 16000;

function convertSamplesToWav(samples, sampleRate) {
  const inputSampleCount = samples.reduce(
    (count, chunk) => count + chunk.length,
    0
  );
  const outputSampleCount = Math.ceil(
    (inputSampleCount * TARGET_AUDIO_SAMPLE_RATE) / sampleRate
  );
  const wavBuffer = new ArrayBuffer(44 + outputSampleCount * 2);
  const view = new DataView(wavBuffer);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + outputSampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_AUDIO_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_AUDIO_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, outputSampleCount * 2, true);

  let sourceChunkIndex = 0;
  let sourceChunkOffset = 0;
  for (let index = 0; index < outputSampleCount; index += 1) {
    const sourcePosition = (index * sampleRate) / TARGET_AUDIO_SAMPLE_RATE;
    const sourceIndex = Math.floor(sourcePosition);
    const fraction = sourcePosition - sourceIndex;
    while (
      sourceChunkIndex < samples.length - 1 &&
      sourceIndex >= sourceChunkOffset + samples[sourceChunkIndex].length
    ) {
      sourceChunkOffset += samples[sourceChunkIndex].length;
      sourceChunkIndex += 1;
    }
    const currentChunk = samples[sourceChunkIndex];
    const currentChunkIndex = sourceIndex - sourceChunkOffset;
    const first = currentChunk?.[currentChunkIndex] ?? 0;
    const second =
      currentChunk?.[currentChunkIndex + 1] ??
      samples[sourceChunkIndex + 1]?.[0] ??
      first;
    const interpolated = first + (second - first) * fraction;
    const clamped = Math.max(-1, Math.min(1, interpolated));
    view.setInt16(
      44 + index * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true
    );
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

function releaseAudioCapture({
  audioContextRef,
  audioProcessorRef,
  audioSourceRef,
  microphoneStreamRef,
}) {
  if (audioProcessorRef.current) {
    audioProcessorRef.current.onaudioprocess = null;
    audioProcessorRef.current.disconnect();
    audioProcessorRef.current = null;
  }
  audioSourceRef.current?.disconnect();
  audioSourceRef.current = null;
  microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
  microphoneStreamRef.current = null;
  const context = audioContextRef.current;
  audioContextRef.current = null;
  if (context && context.state !== "closed") {
    void context.close().catch((error) => {
      console.warn("Could not close microphone audio context:", error);
    });
  }
}

export default function VoiceInterview({
  interviewId,
  questions = [],
  onFinish,
}) {
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [candidateTranscript, setCandidateTranscript] = useState("");
  const [aiTranscript, setAiTranscript] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(
    INTERVIEW_DURATION_SECONDS
  );
  const [voiceProvider, setVoiceProvider] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechQuestionOverrides, setSpeechQuestionOverrides] = useState({});
  const [submittingSpeech, setSubmittingSpeech] = useState(false);
  const [speechDraft, setSpeechDraft] = useState("");
  const [recordingAnswer, setRecordingAnswer] = useState(false);

  const peerRef = useRef(null);
  const dataChannelRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const audioSourceRef = useRef(null);
  const recordedSamplesRef = useRef([]);
  const recordedSampleCountRef = useRef(0);
  const recordingLimitReachedRef = useRef(false);
  const submittingSpeechRef = useRef(false);

  const currentQuestionIndexRef = useRef(0);
  const candidateTranscriptRef = useRef("");
  const answerSavedRef = useRef(false);
  const finishingRef = useRef(false);

  const currentQuestion = questions[currentQuestionIndex] || null;
  const currentQuestionText =
    speechQuestionOverrides[currentQuestionIndex] || currentQuestion?.text;

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");

    const seconds = (totalSeconds % 60).toString().padStart(2, "0");

    return `${minutes}:${seconds}`;
  };

  const sendRealtimeEvent = useCallback((event) => {
    const channel = dataChannelRef.current;

    if (!channel || channel.readyState !== "open") {
      return false;
    }

    channel.send(JSON.stringify(event));
    return true;
  }, []);

  const saveCurrentAnswer = useCallback(async () => {
    const question = questions[currentQuestionIndexRef.current];

    const transcript = candidateTranscriptRef.current.trim();

    if (!question || !transcript || answerSavedRef.current) {
      return answerSavedRef.current;
    }

    answerSavedRef.current = true;

    try {
      await api(`/answers/interviews/${interviewId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_id: question.id,
          transcript,
        }),
      });
      return true;
    } catch (saveError) {
      console.error("Failed to save answer:", saveError);
      answerSavedRef.current = false;
      return false;
    }
  }, [interviewId, questions]);

  const askQuestion = useCallback(
    (questionText) => {
      if (!questionText) {
        return;
      }

      sendRealtimeEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Ask the candidate this interview question exactly as written, naturally and professionally:

${questionText}`,
            },
          ],
        },
      });

      sendRealtimeEvent({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
        },
      });
    },
    [sendRealtimeEvent]
  );

  const finishInterview = useCallback(
    async (automatic = false) => {
      if (finishingRef.current) {
        return;
      }

      finishingRef.current = true;
      setStatus("finishing");
      releaseAudioCapture({
        audioContextRef,
        audioProcessorRef,
        audioSourceRef,
        microphoneStreamRef,
      });
      recordedSamplesRef.current = [];
      recordedSampleCountRef.current = 0;
      setRecordingAnswer(false);

      try {
        if (voiceProvider === "openai") {
          await saveCurrentAnswer();
        }

        await api(`/interviews/${interviewId}/finish`, {
          method: "POST",
        });
      } catch (finishError) {
        console.error("Failed to finish interview:", finishError);
      }

      try {
        if (
          voiceProvider === "openai" &&
          dataChannelRef.current &&
          dataChannelRef.current.readyState === "open"
        ) {
          dataChannelRef.current.send(
            JSON.stringify({
              type: "session.close",
            })
          );
        }
      } catch (closeError) {
        console.error("Realtime close error:", closeError);
      }

      window.speechSynthesis?.cancel();

      microphoneStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      cameraStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      peerRef.current?.close();

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (automatic) {
        setStatus("completed");
      } else {
        setStatus("completed");
      }

      if (onFinish) {
        onFinish();
      }
    },
    [interviewId, onFinish, saveCurrentAnswer, voiceProvider]
  );

  const speakBrowserQuestion = useCallback((text) => {
    if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setError("Speech output is unavailable. Please use the latest version of Chrome.");
      setStatus("error");
      return;
    }

    window.speechSynthesis.cancel();
    setAiTranscript(text);
    setStatus("ai-speaking");

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.onend = () => setStatus("connected");
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setError("The browser could not play the interview question aloud.");
        setStatus("error");
      }
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const submitSpeechAnswer = useCallback(async (transcript) => {
    const answer = transcript.trim();
    const question = questions[currentQuestionIndexRef.current];
    if (!answer || !question || submittingSpeechRef.current) {
      if (!answer) {
        setError("No speech was recognized. Start your answer and try again.");
        setStatus("connected");
      }
      return;
    }

    submittingSpeechRef.current = true;
    setSubmittingSpeech(true);
    setError("");
    setStatus("processing");
    candidateTranscriptRef.current = answer;
    setCandidateTranscript(answer);

    try {
      const saved = await saveCurrentAnswer();
      if (!saved) {
        throw new Error("Your answer could not be saved. Please try again.");
      }

      const nextIndex = currentQuestionIndexRef.current + 1;
      const nextQuestion = questions[nextIndex] || null;
      const result = await api(`/voice/interviews/${interviewId}/turn`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_id: question.id,
          next_question_id: nextQuestion?.id ?? null,
        }),
      });

      if (!nextQuestion) {
        await finishInterview();
        return;
      }

      if (
        typeof result.next_question !== "string" ||
        !result.next_question.trim()
      ) {
        throw new Error("The interview did not return its next question.");
      }

      const nextQuestionText = result.next_question.trim();
      setSpeechQuestionOverrides((previous) => ({
        ...previous,
        [nextIndex]: nextQuestionText,
      }));
      currentQuestionIndexRef.current = nextIndex;
      setCurrentQuestionIndex(nextIndex);
      candidateTranscriptRef.current = "";
      setSpeechDraft("");
      setCandidateTranscript("");
      answerSavedRef.current = false;
      setAiTranscript("");
      speakBrowserQuestion(nextQuestionText);
    } catch (speechError) {
      console.error("Failed to process spoken answer:", speechError);
      setError(
        getErrorMessage(
          speechError,
          "Unable to process your answer. Please try again."
        )
      );
      setStatus("error");
    } finally {
      submittingSpeechRef.current = false;
      setSubmittingSpeech(false);
    }
  }, [finishInterview, interviewId, questions, saveCurrentAnswer, speakBrowserQuestion]);

  const transcribeRecording = useCallback(async (recording) => {
    setSubmittingSpeech(true);
    setStatus("transcribing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("question_id", String(
        questions[currentQuestionIndexRef.current]?.id
      ));
      formData.append("audio", recording, "answer.wav");
      const result = await api(
        `/voice/interviews/${interviewId}/transcribe`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (typeof result.transcript !== "string" || !result.transcript.trim()) {
        throw new Error("No speech was heard. Check your microphone and try again.");
      }

      setSpeechDraft(result.transcript);
      await submitSpeechAnswer(result.transcript);
    } catch (transcriptionError) {
      console.error("Failed to transcribe recorded answer:", transcriptionError);
      setError(
        getErrorMessage(
          transcriptionError,
          "Unable to transcribe your answer. Please try recording again."
        )
      );
      setStatus("error");
    } finally {
      setSubmittingSpeech(false);
    }
  }, [interviewId, questions, submitSpeechAnswer]);

  const finishAudioRecording = useCallback(() => {
    if (!audioProcessorRef.current) {
      return;
    }

    const samples = recordedSamplesRef.current;
    const sampleRate = audioContextRef.current?.sampleRate;
    const limitReached = recordingLimitReachedRef.current;
    releaseAudioCapture({
      audioContextRef,
      audioProcessorRef,
      audioSourceRef,
      microphoneStreamRef,
    });
    recordedSamplesRef.current = [];
    recordedSampleCountRef.current = 0;
    recordingLimitReachedRef.current = false;
    setRecordingAnswer(false);
    setMicEnabled(false);

    if (finishingRef.current) {
      return;
    }
    if (limitReached) {
      setError("This answer reached the 10 MB recording limit. Please record a shorter answer.");
      setStatus("error");
      return;
    }
    if (!samples.length || !sampleRate) {
      setError("No audio was recorded. Check your microphone and try again.");
      setStatus("error");
      return;
    }

    try {
      const wav = convertSamplesToWav(samples, sampleRate);
      if (wav.size > MAX_AUDIO_BYTES) {
        setError("This answer is too long to upload. Please record a shorter answer.");
        setStatus("error");
        return;
      }
      void transcribeRecording(wav);
    } catch (encodingError) {
      console.error("Could not encode recorded audio:", encodingError);
      setError("Could not prepare the recorded audio. Please try again.");
      setStatus("error");
    }
  }, [transcribeRecording]);

  const startAudioRecording = useCallback(async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      !(window.AudioContext || window.webkitAudioContext)
    ) {
      setSpeechSupported(false);
      setError(
        "Browser audio recording is not supported. Please use the latest version of Chrome."
      );
      setStatus("error");
      return;
    }

    try {
      setError("");
      setPermissionBlocked(false);
      setStatus("connecting");
      setSpeechDraft("");
      setCandidateTranscript("");
      candidateTranscriptRef.current = "";
      answerSavedRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;

      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextConstructor();
      audioContextRef.current = context;
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentOutput = context.createGain();
      silentOutput.gain.value = 0;
      audioSourceRef.current = source;
      audioProcessorRef.current = processor;
      recordedSamplesRef.current = [];
      recordedSampleCountRef.current = 0;
      recordingLimitReachedRef.current = false;
      const maxInputSamples = Math.floor(
        ((MAX_AUDIO_BYTES - 48) * context.sampleRate) /
          (2 * TARGET_AUDIO_SAMPLE_RATE)
      );
      setMicEnabled(true);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const remainingSamples =
          maxInputSamples - recordedSampleCountRef.current;
        const capturedSamples = input.slice(
          0,
          Math.max(0, Math.min(input.length, remainingSamples))
        );
        if (capturedSamples.length) {
          recordedSamplesRef.current.push(capturedSamples);
          recordedSampleCountRef.current += capturedSamples.length;
        }
        if (recordedSampleCountRef.current >= maxInputSamples) {
          recordingLimitReachedRef.current = true;
          finishAudioRecording();
        }
      };
      source.connect(processor);
      processor.connect(silentOutput);
      silentOutput.connect(context.destination);
      setRecordingAnswer(true);
      setStatus("candidate-speaking");
    } catch (recordingError) {
      console.error("Could not start audio recording:", recordingError);
      releaseAudioCapture({
        audioContextRef,
        audioProcessorRef,
        audioSourceRef,
        microphoneStreamRef,
      });
      if (
        recordingError?.name === "NotAllowedError" ||
        recordingError?.name === "NotFoundError" ||
        recordingError?.name === "NotReadableError"
      ) {
        setPermissionBlocked(true);
        setError(
          recordingError.name === "NotAllowedError"
            ? "Microphone access is blocked. Allow microphone access for this site, then retry."
            : recordingError.name === "NotFoundError"
              ? "No microphone was found. Connect or enable one, then retry."
              : "The microphone is busy or unavailable. Close other apps using it, then retry."
        );
      } else {
        setError(
          getErrorMessage(
            recordingError,
            "Could not start audio recording. Please try again."
          )
        );
      }
      setStatus("error");
    }
  }, [finishAudioRecording]);

  const handleRealtimeEvent = useCallback(
    async (event) => {
      switch (event.type) {
        case "session.started":
          setStatus("connected");

          if (questions.length > 0) {
            setTimeout(() => {
              askQuestion(questions[0].text);
            }, 500);
          }

          break;

        case "input_audio_buffer.speech_started":
          setStatus("candidate-speaking");
          break;

        case "input_audio_buffer.speech_stopped":
          setStatus("processing");
          break;

        case "conversation.item.input_audio_transcription.completed": {
          const transcript = event.transcript?.trim();

          if (!transcript) {
            break;
          }

          candidateTranscriptRef.current = transcript;
          setCandidateTranscript(transcript);
          setStatus("processing");

          await saveCurrentAnswer();

          break;
        }

        case "response.output_audio_transcript.delta":
          if (event.delta) {
            setAiTranscript((previous) => previous + event.delta);
          }
          break;

        case "response.output_audio_transcript.done":
          if (event.transcript) {
            setAiTranscript(event.transcript);
          }
          break;

        case "response.done":
          setStatus("connected");
          break;

        case "session.closed":
          setStatus("completed");
          break;

        case "error":
          console.error("Realtime error:", event);
          setError(
            getErrorMessage(
              event.error,
              "The voice interview connection encountered an error."
            )
          );
          setStatus("error");
          break;

        default:
          break;
      }
    },
    [askQuestion, questions, saveCurrentAnswer]
  );

  const connectRealtime = useCallback(async () => {
    if (!interviewId) {
      setError("Interview ID is missing.");
      setStatus("error");
      return;
    }

    if (!questions.length) {
      setError("No interview questions were loaded.");
      setStatus("error");
      return;
    }

    try {
      setStatus("connecting");
      setError("");
      setPermissionBlocked(false);

      const microphoneStream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      microphoneStreamRef.current = microphoneStream;

      let cameraStream = null;

      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });

        cameraStreamRef.current = cameraStream;

        if (videoRef.current) {
          videoRef.current.srcObject = cameraStream;
        }
      } catch (cameraError) {
        console.warn("Camera unavailable:", cameraError);
        setCameraEnabled(false);
      }

      const peer = new RTCPeerConnection();

      peerRef.current = peer;

      peer.ontrack = (event) => {
        if (!remoteAudioRef.current) {
          return;
        }

        remoteAudioRef.current.srcObject = event.streams[0];

        remoteAudioRef.current
          .play()
          .catch((playError) =>
            console.warn("Audio autoplay blocked:", playError)
          );
      };

      microphoneStream.getAudioTracks().forEach((track) => {
        peer.addTrack(track, microphoneStream);
      });

      if (cameraStream) {
        cameraStream.getVideoTracks().forEach((track) => {
          peer.addTrack(track, cameraStream);
        });
      }

      const dataChannel = peer.createDataChannel("oai-events");

      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log("Realtime data channel opened.");
      };

      dataChannel.onmessage = async (messageEvent) => {
        try {
          const event = JSON.parse(messageEvent.data);

          await handleRealtimeEvent(event);
        } catch (eventError) {
          console.error("Failed to process realtime event:", eventError);
        }
      };

      dataChannel.onerror = (channelError) => {
        console.error("Realtime data channel error:", channelError);

        setError("Realtime voice connection failed.");
        setStatus("error");
      };

      peer.onconnectionstatechange = () => {
        const connectionState = peer.connectionState;

        if (connectionState === "connected") {
          setStatus("connected");
        }

        if (
          connectionState === "failed" ||
          connectionState === "disconnected"
        ) {
          setError("Voice connection was interrupted.");
          setStatus("error");
        }
      };

      const offer = await peer.createOffer();

      await peer.setLocalDescription(offer);

      if (peer.iceGatheringState !== "complete") {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            peer.removeEventListener(
              "icegatheringstatechange",
              handleIceState
            );

            reject(
              new Error("Timed out while gathering ICE candidates.")
            );
          }, 10000);

          const handleIceState = () => {
            if (peer.iceGatheringState !== "complete") {
              return;
            }

            clearTimeout(timeout);

            peer.removeEventListener(
              "icegatheringstatechange",
              handleIceState
            );

            resolve();
          };

          peer.addEventListener(
            "icegatheringstatechange",
            handleIceState
          );

          handleIceState();
        });
      }

      const localSdp = peer.localDescription?.sdp;

      if (!localSdp) {
        throw new Error("Could not create WebRTC SDP offer.");
      }

      const result = await api(
        `/realtime/interviews/${interviewId}/connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sdp: localSdp,
          }),
        }
      );

      if (!result?.sdp) {
        throw new Error("Backend returned an invalid SDP answer.");
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: result.sdp,
      });
    } catch (connectionError) {
      console.error("Realtime connection failed:", connectionError);

      microphoneStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      cameraStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      peerRef.current?.close();

      if (connectionError?.name === "NotAllowedError") {
        setPermissionBlocked(true);
        setError(
          "Microphone access is blocked. Allow microphone access for this site in your browser settings, and make sure your operating system allows microphone access for the browser. Then choose Retry microphone access."
        );
      } else if (connectionError?.name === "NotFoundError") {
        setPermissionBlocked(true);
        setError(
          "No microphone was found. Connect or enable a microphone, then choose Retry microphone access."
        );
      } else if (connectionError?.name === "NotReadableError") {
        setPermissionBlocked(true);
        setError(
          "The microphone is busy or unavailable. Close other apps using it, check your Windows sound settings, then choose Retry microphone access."
        );
      } else {
        setError(
          getErrorMessage(
            connectionError,
            "Unable to start the voice interview."
          )
        );
      }
      setStatus("error");
    }
  }, [handleRealtimeEvent, interviewId, questions]);

  const startGroqSpeechInterview = useCallback(async () => {
    if (
      !(window.AudioContext || window.webkitAudioContext)
    ) {
      setSpeechSupported(false);
      setError(
        "Browser audio recording is not supported. Please use the latest version of Chrome."
      );
      setStatus("error");
      return;
    }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setSpeechSupported(false);
      setError(
        "Speech playback is not supported in this browser. Please use the latest version of Chrome."
      );
      setStatus("error");
      return;
    }
    if (!questions.length) {
      setError("No interview questions were loaded.");
      setStatus("error");
      return;
    }

    setSpeechSupported(true);
    setError("");
    setPermissionBlocked(false);

    setCameraEnabled(false);
    setStatus("connected");
    speakBrowserQuestion(
      speechQuestionOverrides[0] || questions[0].text
    );
  }, [questions, speakBrowserQuestion]);

  const nextQuestion = useCallback(async () => {
    await saveCurrentAnswer();

    const nextIndex = currentQuestionIndexRef.current + 1;

    if (nextIndex >= questions.length) {
      await finishInterview();
      return;
    }

    currentQuestionIndexRef.current = nextIndex;

    setCurrentQuestionIndex(nextIndex);

    candidateTranscriptRef.current = "";
    setCandidateTranscript("");

    answerSavedRef.current = false;

    setAiTranscript("");

    askQuestion(questions[nextIndex].text);
  }, [askQuestion, finishInterview, questions, saveCurrentAnswer]);

  const toggleMicrophone = () => {
    if (voiceProvider === "groq") {
      if (recordingAnswer) {
        finishAudioRecording();
      } else {
        startAudioRecording();
      }
      return;
    }

    const tracks = microphoneStreamRef.current?.getAudioTracks() || [];

    const nextState = !micEnabled;

    tracks.forEach((track) => {
      track.enabled = nextState;
    });

    setMicEnabled(nextState);
  };

  const toggleCamera = async () => {
    const tracks = cameraStreamRef.current?.getVideoTracks() || [];
    const nextState = !cameraEnabled;

    if (voiceProvider === "groq" && nextState && tracks.length === 0) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraEnabled(true);
      } catch (cameraError) {
        console.warn("Camera unavailable:", cameraError);
        setError("Camera access is unavailable. You can continue the voice interview without video.");
      }
      return;
    }

    tracks.forEach((track) => {
      track.enabled = nextState;
    });
    setCameraEnabled(nextState);
  };

  useEffect(() => {
    let mounted = true;
    api("/config")
      .then((config) => {
        if (!mounted) {
          return;
        }
        if (!["groq", "openai"].includes(config.voice_provider)) {
          throw new Error("Backend returned an unsupported voice provider.");
        }
        setVoiceProvider(config.voice_provider);
      })
      .catch((configError) => {
        if (!mounted) {
          return;
        }
        console.error("Unable to load voice configuration:", configError);
        setError(
          getErrorMessage(
            configError,
            "Could not determine the interview voice mode."
          )
        );
        setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!voiceProvider) {
      return undefined;
    }

    if (voiceProvider === "openai") {
      connectRealtime();
    } else {
      startGroqSpeechInterview();
    }

    return () => {
      releaseAudioCapture({
        audioContextRef,
        audioProcessorRef,
        audioSourceRef,
        microphoneStreamRef,
      });
      recordedSamplesRef.current = [];
      recordedSampleCountRef.current = 0;
      window.speechSynthesis?.cancel();
      microphoneStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      cameraStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      dataChannelRef.current?.close();
      peerRef.current?.close();
    };
  }, [connectRealtime, startGroqSpeechInterview, voiceProvider]);

  useEffect(() => {
    if (status === "completed" || status === "error") {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);

          finishInterview(true);

          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [finishInterview, status]);

  const isConnected =
    status === "connected" ||
    status === "candidate-speaking" ||
    status === "processing" ||
    status === "ai-speaking";

  if (status === "completed") {
    return (
      <div className="interview-page">
        <div className="interview-complete-card">
          <div className="complete-icon">
            <ShieldCheck size={42} />
          </div>

          <h2>Interview Submitted</h2>

          <p>
            Your interview has been submitted successfully.
          </p>

          <p>
            Your responses will now be reviewed by the HR team.
          </p>

          <div className="candidate-notice">
            <ShieldCheck size={18} />
            <span>
              Interview evaluation is available only to HR.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="interview-page">
      <div className="interview-header">
        <div>
          <div className="interview-brand">
            <Bot size={20} />
            AI Interview
          </div>

          <span className="interview-subtitle">
            Real-time voice assessment
          </span>
        </div>

        <div className="interview-timer">
          <Clock size={18} />
          {formatTime(secondsLeft)}
        </div>
      </div>

      <div className="interview-main">
        <div className="interview-video-card">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="candidate-video"
          />

          {!cameraEnabled && (
            <div className="camera-off">
              <VideoOff size={38} />
              <span>Camera Off</span>
            </div>
          )}

          <div className="candidate-label">
            <User size={16} />
            You
          </div>
        </div>

        <div className="ai-interviewer-card">
          <div className="ai-avatar">
            <Bot size={48} />
          </div>

          <div className="ai-status">
            <strong>AI Interviewer</strong>

            <span>
              {status === "connecting" &&
                (voiceProvider === "groq"
                  ? "Starting browser voice..."
                  : "Connecting...")}
              {status === "connected" &&
                (voiceProvider === "groq"
                  ? "Ready for your answer"
                  : "Listening")}
              {status === "ai-speaking" && "Asking the next question"}
              {status === "candidate-speaking" &&
                "Listening to your answer"}
              {status === "transcribing" && "Transcribing your answer"}
              {status === "processing" && "Evaluating your answer"}
              {status === "finishing" && "Finishing interview..."}
              {status === "error" && "Connection error"}
            </span>
          </div>

          {isConnected && (
            <div className="voice-indicator">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      </div>

      <div className="question-panel">
        <div className="question-progress">
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>

        <h2>
          {currentQuestionText || "Preparing your interview..."}
        </h2>

        {voiceProvider === "groq" && speechDraft && (
          <div className="speech-draft" aria-live="polite">
            <span>Recognized answer</span>
            <p>{speechDraft}</p>
          </div>
        )}

        {aiTranscript && (
          <div className="transcript-block ai-transcript">
            <div className="transcript-heading">
              <Bot size={16} />
              AI Interviewer
            </div>

            <p>{aiTranscript}</p>
          </div>
        )}

        {candidateTranscript && (
          <div className="transcript-block candidate-transcript">
            <div className="transcript-heading">
              <User size={16} />
              Your response
            </div>

            <p>{candidateTranscript}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="interview-error" role="alert">
          <div className="interview-error-copy">
            <strong>
              {!speechSupported
                ? "Browser not supported"
                : permissionBlocked
                ? "Microphone permission needed"
                : status === "error" && voiceProvider === "groq"
                  ? "Answer recording problem"
                  : "Interview connection problem"}
            </strong>
            <span>{error}</span>
          </div>
          {permissionBlocked && (
            <button
              type="button"
              className="retry-microphone-button"
              onClick={
                voiceProvider === "groq"
                  ? startAudioRecording
                  : connectRealtime
              }
              disabled={status === "connecting"}
            >
              {status === "connecting" ? (
                <>
                  <Loader2 size={15} className="spin" />
                  Checking microphone...
                </>
              ) : (
                <>
                  <Mic size={15} />
                  Retry microphone access
                </>
              )}
            </button>
          )}
        </div>
      )}

      <div className="interview-controls">
        {voiceProvider === "openai" && (
          <button
            type="button"
            className={`control-button ${
              !micEnabled ? "disabled" : ""
            }`}
            onClick={toggleMicrophone}
            title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
          </button>
        )}

        <button
          type="button"
          className={`control-button ${
            !cameraEnabled ? "disabled" : ""
          }`}
          onClick={toggleCamera}
          title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
        >
          {cameraEnabled ? <Video size={22} /> : <VideoOff size={22} />}
        </button>

        {voiceProvider === "groq" ? (
          <button
            type="button"
            className="next-question-button"
            onClick={
              recordingAnswer
                ? finishAudioRecording
                : answerSavedRef.current
                  ? () => submitSpeechAnswer(candidateTranscriptRef.current)
                  : startAudioRecording
            }
            disabled={
              !voiceProvider ||
              (voiceProvider === "groq" && !speechSupported) ||
              status === "connecting" ||
              status === "ai-speaking" ||
              submittingSpeech ||
              status === "processing"
            }
          >
            {status === "transcribing" ? (
              <>
                <Loader2 size={18} className="spin" />
                Transcribing answer...
              </>
            ) : submittingSpeech || status === "processing" ? (
              <>
                <Loader2 size={18} className="spin" />
                Processing answer...
              </>
            ) :             recordingAnswer ? (
              <>
                <MicOff size={18} />
                Finish answer
              </>
            ) : (
              <>
                <Mic size={18} />
                {status === "transcribing"
                  ? "Transcribing answer..."
                  : answerSavedRef.current
                  ? "Retry answer processing"
                  : speechDraft
                    ? "Try answer again"
                    : "Start answer"}
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="next-question-button"
            onClick={nextQuestion}
            disabled={!isConnected}
          >
            {currentQuestionIndex === questions.length - 1
              ? "Submit Interview"
              : "Next Question"}
          </button>
        )}

        <button
          type="button"
          className="end-interview-button"
          onClick={() => finishInterview(false)}
        >
          <PhoneOff size={20} />
          End Interview
        </button>
      </div>

      <div className="interview-security">
        <ShieldCheck size={16} />
        Your interview responses are securely recorded for HR review.
      </div>

      <audio ref={remoteAudioRef} autoPlay />
      <div style={{ display: "none" }}>
        <Loader2 />
      </div>
    </div>
  );
}