import type { StartAvatarResponse } from "@heygen/streaming-avatar";
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskMode,
  TaskType,
  VoiceEmotion,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Input,
  Select,
  SelectItem,
  Spinner,
  Chip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn } from "ahooks";
import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";
import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";

const WEBHOOK_URL = process.env.NEXT_PUBLIC_WEBHOOK_URL!;

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList extends Array<SpeechRecognitionResult> {
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult extends Array<SpeechRecognitionAlternative> {
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export default function InteractiveAvatar() {
  const [stream, setStream] = useState<MediaStream>();
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [processingWebhook, setProcessingWebhook] = useState(false);
  const [lastRecognizedSpeech, setLastRecognizedSpeech] = useState("");
  const [speakingError, setSpeakingError] = useState("");
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sessionIdRef = useRef<string>("");
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const generateSessionId = () => `session-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;

  const fetchAccessToken = async () => {
    const res = await fetch("/api/get-access-token", { method: 'POST' });
    return res.text();
  };

  const sendToWebhook = async (text: string) => {
    setProcessingWebhook(true);
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current, message: text }),
      });
      const data = await response.json();
      return data.response || data.output || '';
    } catch (e: any) {
      setSpeakingError(e.message);
      return '';
    } finally {
      setProcessingWebhook(false);
    }
  };

  const avatarSpeak = async (text: string) => {
    if (!avatarRef.current) return;
    try {
      await avatarRef.current.speak({ text, taskType: TaskType.REPEAT, taskMode: TaskMode.SYNC });
    } catch (e: any) {
      setSpeakingError(e.message);
    }
  };

  const initSpeechRecognition = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return;
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new Constructor();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = 'en-US';

    recog.onstart = () => { setIsUserTalking(true); };
    recog.onresult = async (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      setLastRecognizedSpeech(text);
      const reply = await sendToWebhook(text);
      recog.stop();
      await avatarSpeak(reply);
    };
    recog.onend = () => {
      setIsUserTalking(false);
      if (isRecording) recog.start();
    };
    recog.onerror = () => setIsUserTalking(false);
    recognitionRef.current = recog;
  };

  const startRecording = () => {
    initSpeechRecognition();
    recognitionRef.current?.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const startSession = async () => {
    setIsLoadingSession(true);
    const token = await fetchAccessToken();
    const avatar = new StreamingAvatar({ token, basePath: process.env.NEXT_PUBLIC_BASE_API_URL! });
    avatarRef.current = avatar;

    avatar.on(StreamingEvents.STREAM_READY, e => setStream(e.detail));
    avatar.on(StreamingEvents.AVATAR_START_TALKING, () => stopRecording());
    avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => startRecording());

    const res: StartAvatarResponse = await avatar.createStartAvatar({
      avatarName: AVATARS[0].avatar_id,
      quality: AvatarQuality.Low,
      language: 'en',
      disableIdleTimeout: true,
      voice: { rate: 1.0, emotion: VoiceEmotion.NEUTRAL }
    });

    const sid = res.sessionId || generateSessionId();
    sessionIdRef.current = sid;

    await avatarSpeak('start');
    startRecording();
    setIsLoadingSession(false);
  };

  const endSession = async () => {
    stopRecording();
    await avatarRef.current?.stopAvatar();
    setStream(undefined);
  };

  useEffect(() => () => { endSession(); }, []);
  useEffect(() => { if (stream && videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

  return (
    <Card>
      <CardBody>
        {stream ? <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" /> :
          <Button onClick={startSession} disabled={isLoadingSession}>Start Session</Button>
        }
      </CardBody>
      <Divider />
      <CardFooter>
        <div className="flex gap-2">
          {stream && <Button color="error" onClick={endSession}>End Session</Button>}
          {isRecording
            ? <Button color="warning" onClick={stopRecording}>Stop Recording</Button>
            : <Button color="success" onClick={startRecording} disabled={!stream}>Start Recording</Button>
          }
        </div>
        {isUserTalking && <Chip color="primary">Avatar Speaking</Chip>}
        {lastRecognizedSpeech && <p>You said: {lastRecognizedSpeech}</p>}
        {processingWebhook && <Spinner />}
        {speakingError && <p className="text-red-500">Error: {speakingError}</p>}
      </CardFooter>
    </Card>
  );
}
